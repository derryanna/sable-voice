// The player on the page. Three shapes: a floating button with a card, a bar inside the chat column (top or
// bottom), a mini panel at the screen edge. One click handler, one update() that paints the engine state.

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const DRAG_START = 6;

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const clamp01 = value => Math.min(1, Math.max(0, value));

/** The next step on the speed chip after `speed`. */
export function nextSpeed(speed) {
  const index = SPEEDS.findIndex(step => step > speed + 0.001);
  return index < 0 ? SPEEDS[0] : SPEEDS[index];
}

export const formatSpeed = speed => `${Number(speed.toFixed(2))}×`;

/**
 * deps: document, window, store, engine, t() -> translator,
 *       actions { openSettings(), hide() }
 */
export function createPlayer({ document, window, store, engine, t, actions }) {
  let roots = [];
  let fab = null;
  let card = null;
  let side = null;
  let cardOpen = false;
  let barMore = false;
  let cleanups = [];

  const icon = name => `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
  const btn = (act, glyph, label, extra = '') => `<button type="button" class="sv-btn ${extra}" data-act="${act}" title="${escape(label)}" aria-label="${escape(label)}">${icon(glyph)}</button>`;
  const disc = (extra = '', attrs = '') => `<div class="sv-disc ${extra}" ${attrs}><img class="sv-avatar" alt="" hidden><span class="sv-hole"></span></div>`;
  const meta = () => '<div class="sv-meta"><div class="sv-title"></div><div class="sv-sub"></div></div>';
  const line = (extra = '') => `<div class="sv-line ${extra}" aria-hidden="true"><span></span></div>`;

  function parts(tr) {
    return {
      transport: `${btn('prev', 'fa-backward-step', tr('act.prev'))}${btn('toggle', 'fa-play', tr('act.play'), 'sv-play')}${btn('next', 'fa-forward-step', tr('act.next'))}`,
      speed: `<button type="button" class="sv-btn sv-chip" data-act="speed" title="${escape(tr('act.speed'))}" aria-label="${escape(tr('act.speed'))}"><span class="sv-speed"></span></button>`,
      who: btn('who', 'fa-book-open', tr('act.who'), 'sv-who'),
      progress: `<div class="sv-progress"><span class="sv-count sv-now">0</span><input type="range" class="sv-range" data-range="progress" min="0" max="0" step="1" value="0" aria-label="${escape(tr('act.progress'))}"><span class="sv-count sv-total">0</span></div>`,
      volume: `<div class="sv-volume">${icon('fa-volume-low')}<input type="range" class="sv-range" data-range="volume" min="0" max="1" step="0.05" aria-label="${escape(tr('act.volume'))}">${icon('fa-volume-high')}</div>`,
    };
  }

  function make(html) {
    const holder = document.createElement('div');
    holder.innerHTML = html.trim();
    return holder.firstElementChild;
  }

  function buildFloat(tr) {
    const p = parts(tr);
    fab = make(`<button type="button" class="sv sv-fab" data-act="card" title="${escape(tr('act.open'))}" aria-label="${escape(tr('act.open'))}" aria-expanded="false">${icon('fa-play')}</button>`);
    card = make(`<section class="sv sv-card" aria-label="Sable Voice" hidden>
      <div class="sv-bg"></div>
      <header class="sv-top" data-drag="card" title="${escape(tr('act.move'))}">
        <span class="sv-grip" aria-hidden="true"></span>
        <div class="sv-tools">${btn('mode', 'fa-up-right-and-down-left-from-center', tr('act.expand'), 'sv-small')}${btn('settings', 'fa-gear', tr('act.settings'), 'sv-small')}${btn('card', 'fa-xmark', tr('act.close'), 'sv-small')}</div>
      </header>
      <div class="sv-cover">${disc()}</div>
      ${meta()}
      ${p.progress}
      <div class="sv-controls">${p.speed}${p.transport}${p.who}</div>
      ${p.volume}
      ${line()}
    </section>`);
    document.body.append(fab, card);
    return [fab, card];
  }

  function buildBar(tr, place) {
    const p = parts(tr);
    const bar = make(`<section class="sv sv-bar" data-place="${place}" aria-label="Sable Voice">
      <div class="sv-bg"></div>
      <div class="sv-bar-main">
        ${disc('sv-disc--small')}
        ${meta()}
        <div class="sv-controls">${p.transport}</div>
        <div class="sv-extra">${p.speed}${p.who}</div>
        <div class="sv-tools">${btn('more', 'fa-chevron-down', tr('act.expand'), 'sv-small')}${btn('settings', 'fa-gear', tr('act.settings'), 'sv-small')}${btn('hide', 'fa-xmark', tr('act.close'), 'sv-small')}</div>
      </div>
      <div class="sv-bar-more" hidden>
        ${p.progress}
        <div class="sv-bar-row">${p.speed}${p.who}${p.volume}</div>
      </div>
      ${line()}
    </section>`);
    const sheld = document.getElementById('sheld');
    const anchor = document.getElementById(place === 'top' ? 'chat' : 'form_sheld');
    if (sheld && anchor && anchor.parentElement === sheld) sheld.insertBefore(bar, anchor);
    else { bar.classList.add('sv-bar--loose'); document.body.append(bar); }
    return [bar];
  }

  function buildSide(tr, place) {
    const p = parts(tr);
    side = make(`<section class="sv sv-side" data-place="${place}" aria-label="Sable Voice">
      <div class="sv-bg"></div>
      ${disc('sv-disc--small', `data-drag="side" title="${escape(tr('act.move'))}"`)}
      ${btn('toggle', 'fa-play', tr('act.play'), 'sv-play')}
      ${btn('prev', 'fa-backward-step', tr('act.prev'))}
      ${btn('next', 'fa-forward-step', tr('act.next'))}
      ${p.speed}${p.who}
      ${btn('settings', 'fa-gear', tr('act.settings'), 'sv-small')}
      ${line('sv-line--v')}
    </section>`);
    document.body.append(side);
    return [side];
  }

  const all = selector => roots.flatMap(root => [...root.querySelectorAll(selector)]);
  /** The filled part of a slider, for the stylesheet. */
  const fill = range => {
    const span = Number(range.max) - Number(range.min);
    range.style.setProperty('--sv-fill', `${span > 0 ? ((Number(range.value) - Number(range.min)) / span) * 100 : 0}%`);
  };

  function viewport() {
    const view = window.visualViewport;
    return { width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight };
  }

  /** Puts the floating parts where the saved places say, clamped into the window. */
  function place() {
    const { pos } = store.get();
    const { width, height } = viewport();
    const form = document.getElementById('form_sheld');
    document.documentElement.style.setProperty('--sv-form-h', `${form?.offsetHeight ?? 64}px`);
    // The tavern's top bar lies above everything: nothing of the player may hide under it.
    const floor = (document.getElementById('top-bar')?.offsetHeight ?? 0) + 4;
    if (fab) {
      if (pos.fab) {
        const size = fab.offsetWidth || 56;
        fab.style.left = `${Math.min(Math.max(4, pos.fab.x * width - size / 2), Math.max(4, width - size - 4))}px`;
        fab.style.top = `${Math.min(Math.max(floor, pos.fab.y * height - size / 2), Math.max(floor, height - size - 4))}px`;
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
      } else for (const key of ['left', 'top', 'right', 'bottom']) fab.style.removeProperty(key);
    }
    if (card && !card.hidden) {
      if (pos.card) {
        const w = card.offsetWidth;
        const h = card.offsetHeight;
        card.style.left = `${Math.min(Math.max(4, pos.card.x * width - w / 2), Math.max(4, width - w - 4))}px`;
        card.style.top = `${Math.min(Math.max(floor, pos.card.y * height - h / 2), Math.max(floor, height - h - 4))}px`;
        card.style.transform = 'none';
      } else {
        // Never moved: centred near the top, and pulled up when the window is too short for it.
        for (const key of ['left', 'transform']) card.style.removeProperty(key);
        card.style.top = `${Math.max(floor, Math.min(height * 0.16, height - card.offsetHeight - 4))}px`;
      }
    }
    if (side) {
      const h = side.offsetHeight;
      side.style.top = `${Math.min(Math.max(floor, pos.side * height - h / 2), Math.max(floor, height - h - 4))}px`;
    }
  }

  function setCard(open) {
    cardOpen = open;
    if (!card) return;
    card.hidden = !open;
    fab?.setAttribute('aria-expanded', String(open));
    if (open) place();
  }

  function act(name) {
    const settings = store.get();
    if (name === 'toggle') engine.toggle();
    else if (name === 'prev') engine.step(-1);
    else if (name === 'next') engine.step(1);
    else if (name === 'speed') { store.set('speed', nextSpeed(settings.speed)); if (engine.state.status === 'playing') engine.seek(engine.state.index); }
    else if (name === 'who') {
      const everything = settings.read.narration;
      store.set('read', { ...settings.read, narration: !everything, speech: true, thoughts: !everything });
    }
    else if (name === 'settings') actions.openSettings();
    else if (name === 'hide') { engine.pause(); actions.hide(); }
    else if (name === 'card') setCard(!cardOpen);
    else if (name === 'mode') store.set('cardMode', settings.cardMode === 'full' ? 'compact' : 'full');
    else if (name === 'more') { barMore = !barMore; update(engine.state); }
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  /** Dragging with a threshold, so a tap on the same element still counts as a click. */
  function draggable(handle, moved, dropped) {
    let start = null;
    let dragging = false;
    listen(handle, 'pointerdown', event => {
      if (event.button > 0 || (event.target.closest('button, input') && event.target.closest('button, input') !== handle)) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dragging = false;
    });
    listen(handle, 'pointermove', event => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < DRAG_START) return;
      if (!dragging) { dragging = true; try { handle.setPointerCapture(start.id); } catch { /* pointer already gone */ } handle.classList.add('sv-dragging'); }
      event.preventDefault();
      moved(event.clientX, event.clientY);
    });
    const finish = event => {
      if (!start || event.pointerId !== start.id) return;
      const was = dragging;
      start = null;
      dragging = false;
      handle.classList.remove('sv-dragging');
      if (!was) return;
      dropped();
      // The click that follows a drag must not press the button under the finger.
      const swallow = click => { click.stopImmediatePropagation(); click.preventDefault(); };
      handle.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => handle.removeEventListener('click', swallow, { capture: true }), 80);
    };
    listen(handle, 'pointerup', finish);
    listen(handle, 'pointercancel', finish);
  }

  function wire() {
    for (const root of roots) {
      listen(root, 'click', event => {
        const button = event.target.closest('[data-act]');
        if (button && root.contains(button)) act(button.dataset.act);
      });
      listen(root, 'input', event => {
        const range = event.target.closest('[data-range]');
        if (!range) return;
        fill(range);
        if (range.dataset.range === 'volume') store.set('volume', Number(range.value));
        else for (const label of all('.sv-now')) label.textContent = String(Number(range.value) + 1);
      });
      listen(root, 'change', event => {
        const range = event.target.closest('[data-range="progress"]');
        if (range) engine.seek(Number(range.value));
      });
    }
    if (fab) {
      draggable(fab, (x, y) => {
        const size = fab.offsetWidth;
        fab.style.left = `${x - size / 2}px`; fab.style.top = `${y - size / 2}px`; fab.style.right = 'auto'; fab.style.bottom = 'auto';
      }, () => {
        const box = fab.getBoundingClientRect();
        const { width, height } = viewport();
        store.set('pos.fab', { x: clamp01((box.left + box.width / 2) / width), y: clamp01((box.top + box.height / 2) / height) });
      });
    }
    if (card) {
      const handle = card.querySelector('[data-drag="card"]');
      let grab = null;
      listen(handle, 'pointerdown', event => { const box = card.getBoundingClientRect(); grab = { x: event.clientX - box.left, y: event.clientY - box.top }; });
      draggable(handle, (x, y) => {
        card.style.left = `${x - (grab?.x ?? 0)}px`; card.style.top = `${y - (grab?.y ?? 0)}px`; card.style.transform = 'none';
      }, () => {
        const box = card.getBoundingClientRect();
        const { width, height } = viewport();
        store.set('pos.card', { x: clamp01((box.left + box.width / 2) / width), y: clamp01((box.top + box.height / 2) / height) });
      });
    }
    if (side) {
      const handle = side.querySelector('[data-drag="side"]');
      draggable(handle, (x, y) => { side.style.top = `${y - 24}px`; }, () => {
        const box = side.getBoundingClientRect();
        store.set('pos.side', clamp01((box.top + box.height / 2) / viewport().height));
      });
    }
    listen(window, 'resize', place);
    if (window.visualViewport) listen(window.visualViewport, 'resize', place);
  }

  function destroy() {
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    for (const root of roots) root.remove();
    roots = [];
    fab = card = side = null;
  }

  /** Builds the shape chosen in the settings (or nothing when the player is off or hidden). */
  function render() {
    destroy();
    const settings = store.get();
    if (!settings.enabled || !settings.shown) return;
    const tr = t();
    if (settings.view === 'float') roots = buildFloat(tr);
    else if (settings.view.startsWith('bar')) roots = buildBar(tr, settings.view === 'bar-top' ? 'top' : 'bottom');
    else roots = buildSide(tr, settings.view === 'side-left' ? 'left' : 'right');
    wire();
    if (card) setCard(cardOpen);
    update(engine.state);
    place();
  }

  function swap(element, on, off, active) {
    const glyph = element.querySelector('i');
    if (!glyph) return;
    glyph.classList.toggle(on, active);
    glyph.classList.toggle(off, !active);
  }

  /** Paints the engine state: titles, buttons, progress. */
  function update(state) {
    if (!roots.length) return;
    const tr = t();
    const settings = store.get();
    const playing = state.status === 'playing';
    const track = state.track;
    const total = track?.chunks.length ?? 0;
    const chunk = track?.chunks[state.index];
    const title = track?.name || 'Sable Voice';
    const known = state.error && tr(`err.${state.error}`) !== `err.${state.error}`;
    const sub = state.error ? (known ? tr(`err.${state.error}`) : state.error)
      : state.status === 'done' ? tr('done.sub')
      : track && chunk && state.status !== 'idle' ? chunk.text
      : tr('idle.sub');
    const fraction = !total ? 0 : state.status === 'done' ? 1 : (state.index + (playing ? 1 : 0)) / total;

    for (const root of roots) {
      root.dataset.status = state.status;
      root.dataset.error = state.error ? '1' : '0';
      root.style.setProperty('--sv-done', String(fraction));
    }
    if (card) card.dataset.mode = settings.cardMode;
    for (const element of all('.sv-title')) element.textContent = title;
    for (const element of all('.sv-sub')) { element.textContent = sub; element.title = sub; }
    for (const button of [...all('[data-act="toggle"]'), ...(fab ? [fab] : [])]) {
      swap(button, 'fa-pause', 'fa-play', playing);
      if (button !== fab) { button.title = tr(playing ? 'act.pause' : 'act.play'); button.setAttribute('aria-label', button.title); }
    }
    for (const range of all('[data-range="progress"]')) {
      range.max = String(Math.max(0, total - 1));
      if (document.activeElement !== range || !range.matches(':active')) range.value = String(state.index);
      range.disabled = total < 2;
      fill(range);
    }
    for (const label of all('.sv-now')) label.textContent = String(total ? state.index + 1 : 0);
    for (const label of all('.sv-total')) label.textContent = String(total);
    for (const range of all('[data-range="volume"]')) { if (!range.matches(':active')) range.value = String(settings.volume); fill(range); }
    for (const label of all('.sv-speed')) label.textContent = formatSpeed(settings.speed);
    const everything = settings.read.narration;
    for (const button of all('[data-act="who"]')) {
      swap(button, 'fa-comment-dots', 'fa-book-open', !everything);
      button.title = tr(everything ? 'who.all' : 'who.speech');
      button.setAttribute('aria-label', `${tr('act.who')}: ${button.title}`);
      button.setAttribute('aria-pressed', String(!everything));
    }
    for (const button of all('[data-act="mode"]')) {
      const full = settings.cardMode === 'full';
      swap(button, 'fa-down-left-and-up-right-to-center', 'fa-up-right-and-down-left-from-center', full);
      button.title = tr(full ? 'act.collapse' : 'act.expand');
      button.setAttribute('aria-label', button.title);
    }
    for (const button of all('[data-act="more"]')) {
      swap(button, 'fa-chevron-up', 'fa-chevron-down', barMore);
      button.title = tr(barMore ? 'act.collapse' : 'act.expand');
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-expanded', String(barMore));
    }
    for (const more of all('.sv-bar-more')) more.hidden = !barMore;
    const avatar = settings.visual.cover === 'avatar' ? track?.avatar ?? '' : '';
    for (const image of all('.sv-avatar')) {
      if (avatar && image.getAttribute('src') !== avatar) image.setAttribute('src', avatar);
      image.hidden = !avatar;
    }
  }

  return { render, update, destroy, place, openCard: () => setCard(true), isMounted: () => roots.length > 0 };
}
