// The settings section in the tavern's Extensions menu. Rows are declared with data-path; one listener writes
// them into the store, sync() paints the store back into the rows.

import { VIEWS, LANGUAGES, CARD_MODES, ASTERISK, THOUGHT_VOICES, RANGES, VOICE_RANGES, VISUAL_RANGES, VISUAL_CHOICES, VISUAL_DEFAULTS,
  DEFAULTS, VERSION, SOURCES, OWN_SOURCES, getPath, normalizeVisual } from '../settings.js';
import { DEFAULT_MODELS, STYLE_SAMPLES } from '../providers/remote.js';
import { PRESETS } from './visual.js';

const BG_LIMIT = 600 * 1024;
const BG_STEPS = [[1280, 0.82], [960, 0.78], [720, 0.72]];
const ARM_MS = 4000;

const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const FORMATS = {
  percent: value => `${Math.round(value * 100)}%`,
  times: value => `${Number(Number(value).toFixed(2))}×`,
  px: value => `${value}px`,
  ms: (value, tr) => `${value} ${tr('unit.ms')}`,
  chars: (value, tr) => `${value} ${tr('unit.chars')}`,
};

function build(tr) {
  const hintOf = key => (key ? `<small>${esc(tr(key))}</small>` : '');
  const toggle = (path, key, hint) => `<label class="sv-row sv-check"><input type="checkbox" data-path="${path}"><span class="sv-label">${esc(tr(key))}${hintOf(hint)}</span></label>`;
  const select = (path, key, values, prefix) => `<label class="sv-row sv-field"><span class="sv-label">${esc(tr(key))}</span><select class="text_pole" data-path="${path}">${
    values.map(value => `<option value="${value}">${esc(tr(`${prefix}.${value}`))}</option>`).join('')}</select></label>`;
  const range = (path, key, [min, max, step], format, hint) => `<label class="sv-row sv-field"><span class="sv-label">${esc(tr(key))}<output data-out="${path}"></output>${hintOf(hint)}</span>`
    + `<input type="range" data-path="${path}" data-format="${format}" min="${min}" max="${max}" step="${step}"></label>`;
  const text = (path, key, hint, rows = 0) => `<label class="sv-row sv-field sv-wide"><span class="sv-label">${esc(tr(key))}${hintOf(hint)}</span>${rows
    ? `<textarea class="text_pole" data-path="${path}" rows="${rows}" spellcheck="false"></textarea>`
    : `<input type="text" class="text_pole" data-path="${path}" spellcheck="false">`}</label>`;
  const color = (key, auto) => `<div class="sv-row sv-color"><span class="sv-label">${esc(tr(`look.${key}`))}</span><input type="color" data-color="${key}" aria-label="${esc(tr(`look.${key}`))}">${
    auto ? `<button type="button" class="menu_button sv-auto" data-auto="${key}">${esc(tr('look.auto'))}</button>` : ''}</div>`;
  const group = (id, body, extra = '') => `<details class="sv-group ${extra}" data-group="${id}"><summary>${esc(tr(`g.${id}`))}</summary><div class="sv-grid">${body}</div></details>`;
  const testButton = role => `<button type="button" class="menu_button sv-test" data-test="${role}"><i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(tr('voice.test'))}</button>`;
  // One voice = where it comes from, which model, which voice, and (for internet voices) how it should sound.
  const pair = (field, key) => `<div class="sv-row sv-field" data-box="${field}"><span class="sv-label">${esc(tr(key))}</span>`
    + `<select class="text_pole" data-f="${field}" data-kind="list" aria-label="${esc(tr(key))}"></select>`
    + `<input type="text" class="text_pole" data-f="${field}" data-kind="text" aria-label="${esc(tr(key))}" spellcheck="false"></div>`;
  const voiceFields = own => `<div class="sv-row sv-field"><span class="sv-label">${esc(tr('voice.source'))}</span><select class="text_pole" data-f="source" aria-label="${esc(tr('voice.source'))}">${
      own ? `<option value="">${esc(tr('voice.same'))}</option>` : ''}${SOURCES.map(source => `<option value="${source}">${esc(tr(`source.${source}`))}</option>`).join('')}</select></div>
      ${pair('model', 'voice.model')}${pair('id', 'voice.voice')}
      <div class="sv-row sv-field" data-box="style"><span class="sv-label">${esc(tr('voice.style'))}<small>${esc(tr('voice.style.hint'))}</small></span><textarea class="text_pole" data-f="style" rows="2" aria-label="${esc(tr('voice.style'))}"></textarea></div>
      <small class="sv-status" data-hint></small>`;
  const voice = role => `<div class="sv-voice sv-wide" data-role="${role}">
      <div class="sv-voice-head"><b>${esc(tr(`voice.${role}`))}</b>${testButton(role)}</div>
      ${voiceFields(false)}
      <div class="sv-grid">${range(`voices.${role}.rate`, 'voice.rate', VOICE_RANGES.rate, 'times')}<div data-box="pitch">${range(`voices.${role}.pitch`, 'voice.pitch', VOICE_RANGES.pitch, 'times')}</div></div>
    </div>`;
  const secret = (source, field, key) => `<label class="sv-row sv-field"><span class="sv-label">${esc(tr(key))}</span><input type="${field === 'key' ? 'password' : 'text'}" class="text_pole" data-path="sources.${source}.${field}" data-sv-source="${source}" autocomplete="off" spellcheck="false"></label>`;

  return `<div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header"><b>${esc(tr('set.title'))}</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
    <div class="inline-drawer-content">
      <div class="sv-grid sv-head">
        ${toggle('enabled', 'set.enabled')}
        ${select('language', 'set.language', LANGUAGES, 'lang')}
      </div>
      ${group('player', `
        ${select('view', 'view', VIEWS, 'view')}
        ${select('cardMode', 'cardMode', CARD_MODES, 'cardMode')}
        ${toggle('autoplay', 'autoplay', 'autoplay.hint')}
        ${toggle('chain', 'chain', 'chain.hint')}
        ${toggle('mesButton', 'mesButton')}
        ${toggle('tapJump', 'tapJump', 'tapJump.hint')}
        ${toggle('highlight', 'highlight')}
        ${toggle('follow', 'follow')}`)}
      ${group('read', `
        ${toggle('read.narration', 'read.narration')}
        ${toggle('read.speech', 'read.speech')}
        ${toggle('read.thoughts', 'read.thoughts')}
        ${toggle('read.user', 'read.user')}
        ${select('asterisk', 'asterisk', ASTERISK, 'asterisk')}`)}
      ${group('voices', `
        <details class="sv-keys sv-wide" data-group="keys"><summary>${esc(tr('keys.title'))}</summary><div class="sv-grid">
          ${secret('openrouter', 'key', 'keys.openrouter')}${secret('google', 'key', 'keys.google')}${secret('eleven', 'key', 'keys.eleven')}
          ${OWN_SOURCES.map(source => `${secret(source, 'url', `keys.${source}.url`)}${secret(source, 'key', `keys.${source}`)}`).join('')}
          <div class="sv-row sv-wide sv-note"><small>${esc(tr('keys.hint'))}</small></div>
        </div></details>
        <small class="sv-status sv-wide" data-status="voices" role="status"></small>
        <div class="sv-row sv-wide sv-warn" data-novoice hidden>${esc(tr('voice.none'))}</div>
        ${voice('narrator')}
        ${voice('character')}
        <div class="sv-voice sv-wide" data-role="own">
          <div class="sv-voice-head"><b data-own-title></b>${testButton('own')}</div>
          ${voiceFields(true)}
          <div class="sv-row sv-suggest"><button type="button" class="menu_button" data-suggest><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> ${esc(tr('voice.suggest'))}</button><small>${esc(tr('voice.suggest.hint'))}</small></div>
        </div>
        ${select('voices.thoughts', 'voice.thoughts', THOUGHT_VOICES, 'voice.thoughts')}
        ${range('speed', 'speed', RANGES.speed, 'times')}
        ${range('volume', 'volume', RANGES.volume, 'percent')}
        ${range('pauseMs', 'pauseMs', RANGES.pauseMs, 'ms')}
        ${range('chunkChars', 'chunkChars', RANGES.chunkChars, 'chars', 'chunkChars.hint')}`)}
      ${group('skip', `
        ${toggle('skip.ooc', 'skip.ooc')}
        ${toggle('skip.footer', 'skip.footer', 'skip.footer.hint')}
        ${toggle('skip.code', 'skip.code')}
        ${toggle('skip.links', 'skip.links')}
        ${text('skip.tags', 'skip.tags', 'skip.tags.hint', 2)}
        ${text('skip.selectors', 'skip.selectors', 'skip.selectors.hint')}
        ${text('skip.regex', 'skip.regex', 'skip.regex.hint', 3)}`)}
      ${group('look', `
        <div class="sv-row sv-wide sv-presets"><span class="sv-label">${esc(tr('look.presets'))}</span><div class="sv-swatches">${
          PRESETS.map(preset => `<button type="button" class="sv-swatch" data-preset="${preset.id}" title="${preset.id}" aria-label="${preset.id}" style="--sw-a:${preset.accent};--sw-b:${preset.base ?? '#1b1f27'}"></button>`).join('')}</div></div>
        ${color('accent', false)}${color('base', true)}${color('text', true)}${color('mark', true)}
        ${range('visual.opacity', 'look.opacity', VISUAL_RANGES.opacity, 'percent')}
        ${range('visual.blur', 'look.blur', VISUAL_RANGES.blur, 'px')}
        ${range('visual.radius', 'look.radius', VISUAL_RANGES.radius, 'px')}
        ${range('visual.fontSize', 'look.fontSize', VISUAL_RANGES.fontSize, 'px')}
        ${range('visual.scale', 'look.scale', VISUAL_RANGES.scale, 'times')}
        ${select('visual.cover', 'look.cover', VISUAL_CHOICES.cover, 'cover')}
        ${toggle('visual.spin', 'look.spin')}
        <div class="sv-row sv-wide sv-bgrow">
          <span class="sv-label">${esc(tr('look.bg'))}</span>
          <div class="sv-buttons">
            <button type="button" class="menu_button" data-bg="file"><i class="fa-solid fa-image" aria-hidden="true"></i> ${esc(tr('look.bg.file'))}</button>
            <button type="button" class="menu_button" data-bg="remove">${esc(tr('look.bg.remove'))}</button>
            <input type="file" accept="image/*" data-bg-file hidden>
          </div>
          <input type="text" class="text_pole" data-bg-link placeholder="${esc(tr('look.bg.link'))}" aria-label="${esc(tr('look.bg.link'))}" spellcheck="false">
          <small class="sv-status" data-status="bg" role="status"></small>
        </div>
        ${range('visual.bgDim', 'look.bgDim', VISUAL_RANGES.bgDim, 'percent')}
        ${select('visual.bgFit', 'look.bgFit', VISUAL_CHOICES.bgFit, 'bgFit')}
        <div class="sv-row sv-wide">
          <div class="sv-buttons">
            <button type="button" class="menu_button" data-look="export">${esc(tr('look.export'))}</button>
            <button type="button" class="menu_button" data-look="import">${esc(tr('look.import'))}</button>
            <input type="file" accept="application/json,.json" data-look-file hidden>
          </div>
          <small class="sv-status" data-status="look" role="status"></small>
        </div>`)}
      ${group('danger', `
        <div class="sv-row sv-wide sv-note"><small>${esc(tr('danger.note'))}</small></div>
        ${['look', 'pos', 'voices', 'all'].map(what => `<button type="button" class="menu_button sv-danger-btn" data-danger="${what}" data-label="${esc(tr(`danger.${what}`))}">${esc(tr(`danger.${what}`))}</button>`).join('')}
        ${toggle('debug', 'debug')}`, 'sv-danger')}
      <div class="sv-version">Sable Voice ${VERSION}</div>
    </div>
  </div>`;
}

function loadImage(document, file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = document.createElement('img');
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    image.src = url;
  });
}

/** A picture file as a JPEG data URL small enough to live in the settings; null when it cannot be made that small. */
async function shrink(document, file) {
  const image = await loadImage(document, file);
  for (const [side, quality] of BG_STEPS) {
    const ratio = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    context.fillStyle = '#111';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= BG_LIMIT) return url;
  }
  return null;
}

/**
 * deps: document, window, store, t() -> translator, uiLanguage() -> 'ru' | 'en', provider (device voices), remote (internet voices),
 *       getCharName() -> string, onTest(role), onSuggest() -> Promise<string>
 */
export function mountSettings({ document, window, store, t, uiLanguage, provider, remote, getCharName, onTest, onSuggest }) {
  const host = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
  if (!host) return null;
  const root = document.createElement('div');
  root.className = 'sv-settings';
  root.id = 'sv_settings';
  host.append(root);

  let voices = [];
  let voicesLoaded = false;
  const openGroups = new Set(['player']);
  const timers = new Set();

  const later = (fn, ms) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const status = (name, message) => {
    const element = root.querySelector(`[data-status="${name}"]`);
    if (!element) return;
    element.textContent = message;
    if (message) later(() => { if (element.textContent === message) element.textContent = ''; }, 5000);
  };

  /** A status line that stays until it is replaced. */
  const note = (name, message) => { const element = root.querySelector(`[data-status="${name}"]`); if (element) element.textContent = message; };

  const EMPTY = Object.freeze({ source: '', model: '', id: '', style: '' });
  const turns = {};

  function voiceOf(role) {
    const settings = store.get();
    if (role !== 'own') return settings.voices[role];
    const name = getCharName();
    return (name && settings.voices.byName[name]) || EMPTY;
  }

  function setVoice(role, field, value) {
    const current = voiceOf(role);
    const patch = { [field]: value };
    // Another source has other models and voices; a model without a voice list needs the voice described.
    if (field === 'source') Object.assign(patch, { model: '', id: '' }, value && value !== 'device' && !current.style ? { style: STYLE_SAMPLES[role === 'narrator' ? 'narrator' : 'character'] } : {});
    if (field === 'model') patch.id = '';
    if (role !== 'own') { store.set(`voices.${role}`, { ...current, ...patch }); return; }
    const name = getCharName();
    if (!name) return;
    const byName = { ...store.get().voices.byName };
    if (field === 'source' && !value) delete byName[name]; else byName[name] = { ...current, ...patch };
    store.set('voices.byName', byName);
  }

  function deviceOptions() {
    const tr = t();
    const first = uiLanguage();
    const rank = voice => { const lang = String(voice.lang).toLowerCase(); return lang.startsWith(first) ? 0 : /^(ru|en)/.test(lang) ? 1 : 2; };
    const sorted = [...voices].sort((a, b) => rank(a) - rank(b) || String(a.lang).localeCompare(String(b.lang)) || a.name.localeCompare(b.name));
    const option = voice => `<option value="${esc(voice.id)}">${esc(voice.name)} · ${esc(voice.lang)}</option>`;
    const near = sorted.filter(voice => rank(voice) < 2).map(option).join('');
    const rest = sorted.filter(voice => rank(voice) === 2).map(option).join('');
    return `<option value="">${esc(tr('voice.auto'))}</option>${near}${rest ? `<optgroup label="${esc(tr('voice.other'))}">${rest}</optgroup>` : ''}`;
  }

  let suggesting = false;
  /** Asks for a voice description of the open character and puts it into their own voice. */
  async function suggest(button) {
    const name = getCharName();
    if (!name || suggesting || !onSuggest) return;
    const tr = t();
    suggesting = true;
    button.disabled = true;
    note('voices', tr('voice.suggest.wait'));
    try {
      const style = await onSuggest();
      if (!style) throw new Error('empty');
      if (getCharName() !== name) return;
      const settings = store.get();
      const own = settings.voices.byName[name];
      // No own voice yet: start from the common character voice, so only the description differs.
      const base = own?.source ? own : { ...EMPTY, source: settings.voices.character.source, model: settings.voices.character.model, id: settings.voices.character.id };
      store.set('voices.byName', { ...settings.voices.byName, [name]: { ...base, style } });
      note('voices', tr(base.source === 'device' ? 'voice.suggest.device' : 'voice.suggest.done'));
    } catch {
      note('voices', tr('voice.suggest.fail'));
    } finally {
      suggesting = false;
      button.disabled = !getCharName();
    }
  }

  /** Paints one voice card: which of the fields this source has, and what can be chosen in them. */
  async function paint(role) {
    const card = root.querySelector(`.sv-voice[data-role="${role}"]`);
    if (!card) return;
    const turn = turns[role] = (turns[role] ?? 0) + 1;
    const tr = t();
    const voice = voiceOf(role);
    const source = voice.source;
    const locked = role === 'own' && !getCharName();
    const active = document.activeElement;
    const field = (name, kind) => card.querySelector(`[data-f="${name}"]${kind ? `[data-kind="${kind}"]` : ''}`);
    const box = (name, on) => { const element = card.querySelector(`[data-box="${name}"]`); if (element) element.hidden = !on; };
    // kind: 'list' | 'text' | '' (this source has no such field)
    const show = (name, kind, html = '', value = '') => {
      box(name, !!kind);
      const list = field(name, 'list');
      const text = field(name, 'text');
      list.hidden = kind !== 'list';
      text.hidden = kind !== 'text';
      if (kind === 'list') { list.innerHTML = html; chooseVoice(list, value); }
      if (kind === 'text' && text !== active) text.value = value;
    };
    const hint = message => { card.querySelector('[data-hint]').textContent = message; };
    const options = (items, lead) => (lead == null ? '' : `<option value="">${esc(lead)}</option>`) + items.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');

    for (const element of card.querySelectorAll('[data-f]')) element.disabled = locked;
    field('source').value = source;
    box('style', !!source && source !== 'device');
    box('pitch', source === 'device');
    const style = field('style');
    if (style !== active) style.value = voice.style ?? '';
    style.placeholder = STYLE_SAMPLES[role === 'narrator' ? 'narrator' : 'character'];
    hint('');

    if (!source) { show('model', ''); show('id', ''); return; }
    if (source === 'device') { show('model', ''); show('id', 'list', deviceOptions(), voice.id); return; }
    if (OWN_SOURCES.includes(source)) {
      // The address is asked for its voice models; when it has no list, both fields are typed by hand.
      show('model', 'text', '', voice.model); show('id', 'text', '', voice.id);
      let list = null;
      try { list = await remote.catalog(source); } catch { /* typed by hand */ }
      if (turn !== turns[role] || !card.isConnected || !list?.models.length) return;
      show('model', 'list', options(list.models, tr('voice.pick')), voice.model);
      const voices = list.models.find(item => item.id === voice.model)?.voices;
      if (voices?.length) show('id', 'list', options(voices, tr('voice.default')), voice.id);
      return;
    }

    const model = voice.model || DEFAULT_MODELS[source];
    show('model', 'list', options([{ id: model, name: model }]), model);
    show('id', voice.id ? 'list' : '', options(voice.id ? [{ id: voice.id, name: voice.id }] : []), voice.id);
    let catalog;
    try { catalog = await remote.catalog(source); }
    catch (error) {
      if (turn !== turns[role] || !card.isConnected) return;
      const code = String(error?.message ?? 'net');
      hint(tr(`err.${code}`) !== `err.${code}` ? tr(`err.${code}`) : code);
      show('id', 'text', '', voice.id);
      return;
    }
    if (turn !== turns[role] || !card.isConnected) return;
    const label = item => (item.free ? `${item.name} · ${tr('voice.free')}` : item.name);
    show('model', 'list', options(catalog.models.map(item => ({ id: item.id, name: label(item) }))), model);
    const known = catalog.models.find(item => item.id === model)?.voices;
    if (known?.length) show('id', 'list', options(known, tr('voice.default')), voice.id);
    else if (source === 'eleven') { show('id', 'text', '', voice.id); hint(tr('hint.eleven')); }
    else { show('id', ''); hint(tr('hint.describe')); }
    if (source !== 'eleven' && !store.get().sources[source]?.key) hint(tr('err.nokey'));
  }

  function fillVoiceSelects() {
    const none = root.querySelector('[data-novoice]');
    const settings = store.get();
    const wanted = [settings.voices.narrator, settings.voices.character].some(voice => voice.source === 'device');
    if (none) none.hidden = !wanted || !voicesLoaded || voices.length > 0;
  }

  /** Selects a voice id; an id from another device stays in the list, marked, so the choice is not lost. */
  function chooseVoice(element, id) {
    if (id && ![...element.options].some(item => item.value === id)) {
      const missing = document.createElement('option');
      missing.value = id;
      missing.textContent = `${id.split('/').pop().slice(0, 40)} — ${t()('voice.missing')}`;
      element.append(missing);
    }
    element.value = id;
  }

  function sync() {
    const settings = store.get();
    const tr = t();
    const active = document.activeElement;
    for (const element of root.querySelectorAll('[data-path]')) {
      const value = getPath(settings, element.dataset.path);
      if (element.type === 'checkbox') element.checked = !!value;
      else if (element === active && (element.type === 'text' || element.type === 'password' || element.tagName === 'TEXTAREA')) continue;
      else element.value = String(value ?? '');
      if (element.type === 'range') {
        const out = root.querySelector(`[data-out="${element.dataset.path}"]`);
        if (out) out.textContent = FORMATS[element.dataset.format]?.(Number(value), tr) ?? String(value);
      }
    }
    for (const element of root.querySelectorAll('[data-color]')) {
      const key = element.dataset.color;
      const value = settings.visual[key];
      element.value = value ?? (key === 'mark' ? settings.visual.accent : key === 'text' ? '#e8e8e8' : key === 'base' ? '#1b1f27' : VISUAL_DEFAULTS.accent);
      element.classList.toggle('sv-auto-on', value == null);
      root.querySelector(`[data-auto="${key}"]`)?.classList.toggle('sv-on', value == null);
    }
    for (const element of root.querySelectorAll('[data-preset]')) {
      const preset = PRESETS.find(item => item.id === element.dataset.preset);
      element.classList.toggle('sv-on', !!preset && preset.accent === settings.visual.accent && preset.base === settings.visual.base && preset.text === settings.visual.text);
    }
    const link = root.querySelector('[data-bg-link]');
    if (link && link !== active) link.value = settings.visual.bgImage && !settings.visual.bgImage.startsWith('data:') ? settings.visual.bgImage : '';
    const remove = root.querySelector('[data-bg="remove"]');
    if (remove) remove.disabled = !settings.visual.bgImage;

    const name = getCharName();
    const title = root.querySelector('[data-own-title]');
    if (title) title.textContent = name ? tr('voice.own', { name }) : tr('voice.own.none');
    const ownTest = root.querySelector('[data-test="own"]');
    if (ownTest) ownTest.disabled = !name || !settings.voices.byName[name]?.source;
    const suggestButton = root.querySelector('[data-suggest]');
    if (suggestButton && !suggesting) suggestButton.disabled = !name;
    fillVoiceSelects();
    for (const role of ['narrator', 'character', 'own']) paint(role);
  }

  function render() {
    for (const element of root.querySelectorAll('details[data-group]')) {
      if (element.open) openGroups.add(element.dataset.group); else openGroups.delete(element.dataset.group);
    }
    const before = root.querySelector('.inline-drawer-content');
    const wasOpen = !!before && window.getComputedStyle(before).display !== 'none';
    root.innerHTML = build(t());
    for (const element of root.querySelectorAll('details[data-group]')) element.open = openGroups.has(element.dataset.group);
    if (wasOpen) { const content = root.querySelector('.inline-drawer-content'); if (content) content.style.display = 'block'; }
    sync();
  }

  async function loadVoices() {
    try { voices = provider.available() ? await provider.voices() : []; } catch { voices = []; }
    voicesLoaded = true;
    sync();
  }

  function setValue(element) {
    const path = element.dataset.path;
    if (element.type === 'checkbox') store.set(path, element.checked);
    else if (element.type === 'range') store.set(path, Number(element.value));
    else store.set(path, element.value);
  }

  const DANGER = {
    look: () => store.set('visual', { ...VISUAL_DEFAULTS }),
    pos: () => { store.set('pos', { ...DEFAULTS.pos }); store.set('shown', true); },
    voices: () => store.set('voices.byName', {}),
    all: () => store.reset(),
  };

  function danger(button) {
    const tr = t();
    if (button.dataset.armed !== '1') {
      button.dataset.armed = '1';
      button.textContent = tr('danger.sure');
      later(() => { if (button.isConnected && button.dataset.armed === '1') { button.dataset.armed = '0'; button.textContent = button.dataset.label; } }, ARM_MS);
      return;
    }
    const what = button.dataset.danger;
    DANGER[what]?.();
    // A full reset can change the language and rebuild the section: find the button again.
    const fresh = root.querySelector(`[data-danger="${what}"]`);
    if (!fresh) return;
    fresh.dataset.armed = '0';
    fresh.textContent = t()('danger.done');
    later(() => { if (fresh.isConnected) fresh.textContent = fresh.dataset.label; }, 1500);
  }

  async function pickBackground(file) {
    const tr = t();
    if (!file) return;
    if (!file.type.startsWith('image/')) { status('bg', tr('look.bg.bad')); return; }
    try {
      const url = await shrink(document, file);
      if (!url) { status('bg', tr('look.bg.big')); return; }
      store.set('visual.bgImage', url);
      status('bg', '');
    } catch { status('bg', tr('look.bg.bad')); }
  }

  function exportLook() {
    const data = JSON.stringify({ app: 'sable-voice', kind: 'look', version: VERSION, visual: store.get().visual }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sable-voice-look.json';
    document.body.append(link);
    link.click();
    link.remove();
    later(() => URL.revokeObjectURL(url), 2000);
  }

  async function importLook(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const visual = data && typeof data === 'object' ? data.visual ?? data : null;
      if (!visual || typeof visual !== 'object' || Array.isArray(visual)) throw new Error('no look inside');
      store.set('visual', normalizeVisual(visual));
    } catch { status('look', t()('look.import.bad')); }
  }

  root.addEventListener('input', event => {
    const element = event.target;
    if (element.matches('[data-path][type="range"]')) setValue(element);
    else if (element.matches('[data-color]')) store.set(`visual.${element.dataset.color}`, element.value);
  });
  root.addEventListener('change', event => {
    const element = event.target;
    if (element.matches('[data-path]') && element.type !== 'range') {
      // A new key or address: the lists of that source are asked again.
      if (element.dataset.svSource) remote.forget(element.dataset.svSource);
      setValue(element);
    }
    else if (element.matches('[data-f]')) setVoice(element.closest('.sv-voice')?.dataset.role, element.dataset.f, element.value.trim());
    else if (element.matches('[data-bg-link]')) {
      const value = element.value.trim();
      if (!value) { if (!store.get().visual.bgImage?.startsWith('data:')) store.set('visual.bgImage', null); return; }
      store.set('visual.bgImage', value);
      if (store.get().visual.bgImage !== value) status('bg', t()('look.bg.bad'));
    }
    else if (element.matches('[data-bg-file]')) { pickBackground(element.files?.[0]); element.value = ''; }
    else if (element.matches('[data-look-file]')) { importLook(element.files?.[0]); element.value = ''; }
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.dataset.test) onTest(button.dataset.test);
    else if ('suggest' in button.dataset) suggest(button);
    else if (button.dataset.auto) store.set(`visual.${button.dataset.auto}`, null);
    else if (button.dataset.preset) {
      const preset = PRESETS.find(item => item.id === button.dataset.preset);
      if (preset) store.set('visual', { ...store.get().visual, accent: preset.accent, base: preset.base, text: preset.text, mark: null });
    }
    else if (button.dataset.bg === 'file') root.querySelector('[data-bg-file]')?.click();
    else if (button.dataset.bg === 'remove') store.set('visual.bgImage', null);
    else if (button.dataset.look === 'export') exportLook();
    else if (button.dataset.look === 'import') root.querySelector('[data-look-file]')?.click();
    else if (button.dataset.danger) danger(button);
  });

  /** Opens the Extensions menu on this section. */
  function open() {
    const drawer = document.getElementById('rm_extensions_block');
    const toggle = document.querySelector('#extensions-settings-button .drawer-toggle');
    if (drawer && toggle && !drawer.classList.contains('openDrawer')) toggle.click();
    const content = root.querySelector('.inline-drawer-content');
    if (content && window.getComputedStyle(content).display === 'none') root.querySelector('.inline-drawer-toggle')?.click();
    later(() => root.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
  }

  function destroy() {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    root.remove();
  }

  render();
  loadVoices();
  return { root, render, sync, open, destroy, note, reloadVoices: loadVoices };
}
