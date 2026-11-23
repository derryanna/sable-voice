// Sable Voice: a player that reads tavern replies aloud. This file ties the pieces to the tavern page:
// settings store, the phrases of a message, the voice source, the player and the settings section.

import { KEY, createStore, styleOf } from './src/settings.js';
import { KIND, readMessage, rangeFor, chunkAt, detectLang } from './src/text.js';
import { createEngine } from './src/engine.js';
import { createDeviceProvider } from './src/providers/device.js';
import { createRemote } from './src/providers/remote.js';
import { createAudioOut } from './src/providers/audio.js';
import { createBackground } from './src/providers/background.js';
import { createTranslator, resolveLanguage } from './src/i18n.js';
import { applyVisual } from './src/ui/visual.js';
import { createPlayer } from './src/ui/player.js';
import { mountSettings } from './src/ui/settings.js';
import { SUGGEST_SYSTEM, suggestPrompt, cleanSuggestion } from './src/suggest.js';
import { castPrompt, pickCastVoice, roleVoice, hideTags, bumpStats, today } from './src/cast.js';
import { joinSounds, offerFile, fileName } from './src/save.js';

const USER_SCROLL_MS = 4000;
const RATE_LIMITS = [0.4, 3];
const AHEAD = 2;
const CAST_KEY = 'sable_voice_cast';
const IN_CHAT = 1;

function init() {
  const tavern = globalThis.SillyTavern;
  if (!tavern?.getContext) { console.warn('[Sable Voice] the tavern context is missing, the player is off'); return; }
  const ctx = () => tavern.getContext();

  let saved = JSON.stringify(ctx().extensionSettings[KEY] ?? null);
  const store = createStore({
    read: () => ctx().extensionSettings[KEY],
    write: value => {
      const next = JSON.stringify(value);
      if (next === saved) return;
      saved = next;
      const context = ctx();
      context.extensionSettings[KEY] = value;
      context.saveSettingsDebounced();
    },
  });

  let language = resolveLanguage(store.get().language, window);
  let tr = createTranslator(language);
  const provider = createDeviceProvider(window);
  const remote = createRemote({ fetch: (url, init) => window.fetch(url, init), sources: () => store.get().sources, onSynth: () => count('internet') });
  const out = createAudioOut(window);
  const log = (...args) => { if (store.get().debug) console.log('[Sable Voice]', ...args); };

  const chatEl = () => document.getElementById('chat');
  const mesEl = id => chatEl()?.querySelector(`.mes[mesid="${Number(id)}"]`) ?? null;
  const charName = () => ctx().name2 || '';

  /** A message the player picks by itself: a character's (or mine, when switched on), shown on the page. */
  function readable(id) {
    const message = ctx().chat?.[id];
    if (!message || message.is_system) return false;
    if (message.is_user && !store.get().read.user) return false;
    return !!mesEl(id);
  }

  function load(mesId) {
    const element = mesEl(mesId);
    const body = element?.querySelector('.mes_text');
    if (!body) return null;
    const { doc, chunks } = readMessage(body, store.get());
    const message = ctx().chat?.[mesId];
    log('message', mesId, 'phrases', chunks.length);
    return {
      mesId: Number(mesId),
      name: message?.name ?? element.getAttribute('ch_name') ?? '',
      isUser: !!message?.is_user,
      avatar: element.querySelector('.avatar img')?.getAttribute('src') ?? '',
      doc,
      chunks,
    };
  }

  function pickLast() {
    const chat = ctx().chat ?? [];
    for (let id = chat.length - 1; id >= 0; id--) if (readable(id)) return id;
    return null;
  }

  function nextOf(mesId) {
    const chat = ctx().chat ?? [];
    for (let id = mesId + 1; id < chat.length; id++) if (readable(id)) return id;
    return null;
  }

  /** Today's counter: phrases spoken, phrases that went to the internet. */
  function count(field) { store.set('stats', bumpStats(store.get().stats, today(), field)); }

  /** Voice options for a role: the narrator, or a character (with their own voice when one is chosen); `who` = a tagged speaker. */
  function voiceFor(narrator, name, text, who = '') {
    const settings = store.get();
    const base = narrator ? settings.voices.narrator : settings.voices.character;
    const own = !narrator && name ? settings.voices.byName[name] : null;
    // A character's own voice replaces source, model and voice together; the tempo stays the common one.
    // A line tagged with another speaker takes that person's voice from the cast list.
    const chosen = (!narrator && pickCastVoice(settings.cast, name, who)) || (own?.source ? own : base);
    return {
      source: chosen.source, model: chosen.model, id: chosen.id, style: styleOf(chosen),
      voice: chosen.id,
      rate: Math.min(RATE_LIMITS[1], Math.max(RATE_LIMITS[0], base.rate * settings.speed)),
      pitch: base.pitch,
      volume: settings.volume,
      lang: detectLang(text, language),
      nth: narrator ? 0 : 1,
    };
  }

  /** Says one text with a chosen voice: the device speaks itself, an internet voice sends a sound file to play. */
  function say(text, options) {
    if (options.source === 'device') {
      if (!provider.available()) throw new Error('novoice');
      return provider.speak(text, options);
    }
    return out.play(remote.audio(options, text), options);
  }

  const byNarrator = item => item.kind === KIND.NARRATION || (item.kind === KIND.THOUGHT && store.get().voices.thoughts === 'narrator');

  function speak(chunk, track) {
    const name = track.isUser ? '' : track.name;
    // Internet voices take seconds: ask for the next phrase while this one is being read.
    // Two phrases ahead: a phone slows a page down when it is not on the screen.
    const at = track.chunks.indexOf(chunk);
    for (const next of track.chunks.slice(at + 1, at + 1 + AHEAD)) {
      const ahead = voiceFor(byNarrator(next), name, next.text, next.who);
      if (ahead.source !== 'device') remote.audio(ahead, next.text).catch(() => {});
    }
    count('phrases');
    return say(chunk.text, voiceFor(byNarrator(chunk), name, chunk.text, chunk.who));
  }

  // The phrase being read: marked in the text and kept on screen.
  const canHighlight = typeof window.Highlight === 'function' && !!window.CSS?.highlights;
  let markedBlock = null;
  let lastSpot = '';
  let userScrollAt = 0;
  let refreshing = false;

  function clearMark() {
    if (canHighlight) window.CSS.highlights.delete('sv-now');
    markedBlock?.classList.remove('sv-reading');
    markedBlock = null;
  }

  function follow(range) {
    const chat = chatEl();
    if (!chat || Date.now() - userScrollAt < USER_SCROLL_MS) return;
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const box = chat.getBoundingClientRect();
    const margin = Math.min(80, box.height * 0.15);
    if (rect.top >= box.top + margin && rect.bottom <= box.bottom - margin) return;
    chat.scrollBy({ top: rect.top - box.top - box.height * 0.3, behavior: 'smooth' });
  }

  function paint(state) {
    clearMark();
    const track = state.track;
    const chunk = track?.chunks[state.index];
    if (!chunk || (state.status !== 'playing' && state.status !== 'paused')) { lastSpot = ''; return; }
    const range = rangeFor(track.doc, chunk.start, chunk.end, document);
    if (!range) {
      // The tavern drew the message again: take the phrases from the new text, once.
      if (!refreshing) { refreshing = true; try { engine.refresh(); } finally { refreshing = false; } }
      return;
    }
    const settings = store.get();
    if (settings.highlight) {
      if (canHighlight) window.CSS.highlights.set('sv-now', new window.Highlight(range));
      else { markedBlock = track.doc.blocks[chunk.block]?.el ?? null; markedBlock?.classList.add('sv-reading'); }
    }
    const spot = `${track.mesId}:${state.index}`;
    if (settings.follow && state.status === 'playing' && spot !== lastSpot) follow(range);
    lastSpot = spot;
  }

  // The ▶ on every message.
  function injectButtons() {
    for (const bar of document.querySelectorAll('#message_template .mes_buttons, #chat .mes .mes_buttons')) {
      if (bar.querySelector(':scope > .sv-mes-btn')) continue;
      const button = document.createElement('div');
      button.className = 'mes_button sv-mes-btn fa-solid fa-circle-play interactable';
      button.title = tr('act.mes');
      button.tabIndex = 0;
      button.setAttribute('role', 'button');
      bar.prepend(button);
    }
  }

  function markButtons(state) {
    for (const button of document.querySelectorAll('#chat .sv-mes-btn.sv-on')) {
      button.classList.remove('sv-on', 'fa-circle-pause');
      button.classList.add('fa-circle-play');
    }
    if (!state.track || (state.status !== 'playing' && state.status !== 'paused')) return;
    const button = mesEl(state.track.mesId)?.querySelector('.sv-mes-btn');
    if (!button) return;
    button.classList.add('sv-on');
    button.classList.toggle('fa-circle-pause', state.status === 'playing');
    button.classList.toggle('fa-circle-play', state.status !== 'playing');
  }

  // Off the screen: the quiet track holds the page awake under internet voices, the lock screen gets the buttons.
  function background(state) {
    const track = state.track;
    const chunk = track?.chunks[state.index];
    const live = !!chunk && (state.status === 'playing' || state.status === 'paused');
    const playing = live && state.status === 'playing';
    // Held through the whole message when any phrase of it is an internet voice: switching per phrase would open gaps.
    const name = track?.isUser ? '' : track?.name;
    const internet = playing && track.chunks.some(item => voiceFor(byNarrator(item), name, item.text, item.who).source !== 'device');
    behind.hold(internet);
    behind.describe(live ? { title: track.name || 'Sable Voice', artist: 'Sable Voice', artwork: track.avatar, playing } : {});
  }

  let player = null;
  const engine = createEngine({
    speak, load, pickLast, nextOf,
    settings: () => store.get(),
    notify: state => { player?.update(state); paint(state); markButtons(state); background(state); },
  });
  const behind = createBackground(window, {
    play: () => engine.play(), pause: () => engine.pause(), prev: () => engine.step(-1), next: () => engine.step(1),
  });

  // "Послушать" in the settings: one sample phrase, in the language of the chosen voice.
  let sample = null;
  async function test(role) {
    engine.pause();
    sample?.cancel();
    const narrator = role === 'narrator';
    // A cast voice ('male', 'female', 'cast:N') is tried as it is; one without a source sounds like the common character voice.
    const cast = roleVoice(store.get(), charName(), role);
    const options = cast?.source
      ? { ...voiceFor(false, '', ''), source: cast.source, model: cast.model, id: cast.id, voice: cast.id, style: styleOf(cast) }
      : voiceFor(narrator, role === 'own' ? charName() : '', '');
    const chosen = options.source === 'device' && options.voice ? (await provider.voices()).find(voice => voice.id === options.voice) : null;
    const lang = chosen ? String(chosen.lang).slice(0, 2).toLowerCase() : language;
    const text = createTranslator(lang === 'ru' ? 'ru' : 'en')(narrator ? 'sample.narrator' : 'sample.character');
    settingsUi?.note('voices', options.source === 'device' ? '' : tr('voice.wait'));
    const mine = say(text, { ...options, lang: detectLang(text, language) });
    sample = mine;
    const result = await mine.done;
    if (sample === mine && result !== 'cancelled') settingsUi?.note('voices', '');
  }

  const settingsUi = mountSettings({
    document, window, store, provider, remote,
    t: () => tr,
    uiLanguage: () => language,
    getCharName: charName,
    onSuggest: async () => {
      const context = ctx();
      const prompt = suggestPrompt(context.characters?.[context.characterId] ?? {});
      if (!prompt || !context.generateRaw) return '';
      return cleanSuggestion(await context.generateRaw({ prompt, systemPrompt: SUGGEST_SYSTEM, responseLength: 300 }));
    },
    onTest: role => {
      test(role).catch(error => {
        const code = String(error?.message ?? error ?? 'error');
        settingsUi?.note('voices', tr(`err.${code}`) !== `err.${code}` ? tr(`err.${code}`) : code);
        log('the voice sample failed', code);
      });
    },
  });

  player = createPlayer({
    document, window, store, engine,
    t: () => tr,
    actions: { openSettings: () => settingsUi?.open(), hide: () => store.set('shown', false), save: () => save() },
  });

  // «Save the sound»: every phrase of the message through its internet voice, glued into one file.
  let saving = false;
  async function save() {
    if (saving) return;
    const id = engine.state.track?.mesId ?? pickLast();
    const track = id == null ? null : load(id);
    const tr0 = tr;
    try {
      saving = true;
      if (!track?.chunks.length) throw new Error('empty');
      const name = track.isUser ? '' : track.name;
      const voices = track.chunks.map(chunk => voiceFor(byNarrator(chunk), name, chunk.text, chunk.who));
      if (voices.some(voice => voice.source === 'device')) throw new Error('savedevice');
      const pieces = [];
      for (let index = 0; index < track.chunks.length; index++) {
        player.note(tr0('save.wait', { n: index + 1, total: track.chunks.length }));
        const chunk = track.chunks[index];
        const blob = await remote.audio(voices[index], chunk.text);
        pieces.push({ blob, gap: index && chunk.block !== track.chunks[index - 1].block ? store.get().pauseMs / 1000 : 0 });
      }
      player.note(tr0('save.join'));
      const { blob, ext } = await joinSounds(window, pieces);
      offerFile(document, blob, fileName(track.name, track.mesId, ext));
      player.note(tr0('save.done', { ext }), 4000);
    } catch (error) {
      const code = String(error?.message ?? error ?? 'error');
      player.note(tr0(`err.${code}`) !== `err.${code}` ? tr0(`err.${code}`) : code, 6000);
      log('saving failed', code);
    } finally { saving = false; }
  }

  // The cast line in the request: only while the cast is on and a character is open. Names from the list go in, so the model spells them the same.
  function applyCast() {
    const context = ctx();
    if (typeof context.setExtensionPrompt !== 'function') return;
    const settings = store.get();
    const name = charName();
    const text = settings.enabled && settings.cast.enabled && name ? castPrompt(name, (settings.cast.byChar[name] ?? []).map(row => row.name)) : '';
    context.setExtensionPrompt(CAST_KEY, text, IN_CHAT, 1, false, 0);
  }

  /** [v:Name] tags in a message (or in every message) become hidden marks. */
  function hideIn(mesId) {
    const roots = mesId == null ? chatEl()?.querySelectorAll('.mes .mes_text') ?? [] : [mesEl(mesId)?.querySelector('.mes_text')].filter(Boolean);
    let hidden = 0;
    for (const root of roots) hidden += hideTags(root, document);
    if (hidden) log('speaker tags hidden', hidden);
  }

  // The entry in the wand menu: shows or hides the player.
  let wand = null;
  function mountWand() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || wand?.isConnected) return;
    wand = document.createElement('div');
    wand.id = 'sv_wand';
    wand.className = 'list-group-item flex-container flexGap5 interactable';
    wand.tabIndex = 0;
    wand.setAttribute('role', 'button');
    wand.innerHTML = '<div class="fa-solid fa-headphones extensionsMenuExtensionButton"></div><span></span>';
    wand.addEventListener('click', () => {
      const settings = store.get();
      if (!settings.enabled) { store.set('enabled', true); store.set('shown', true); }
      else store.set('shown', !settings.shown);
    });
    menu.append(wand);
    labelWand();
  }
  function labelWand() {
    const settings = store.get();
    const label = wand?.querySelector('span');
    if (label) label.textContent = tr(settings.enabled && settings.shown ? 'menu.hide' : 'menu.show');
  }

  function applyFlags() {
    const settings = store.get();
    document.documentElement.dataset.svMesbtn = settings.enabled && settings.mesButton ? '1' : '0';
    labelWand();
  }

  const REBUILD = new Set(['view', 'language', 'enabled', 'shown']);
  const RECHUNK = new Set(['read', 'skip', 'asterisk', 'chunkChars']);
  store.subscribe((settings, path) => {
    const head = path.split('.')[0];
    const everything = path === '';
    // The counter ticks on every phrase: only its line is repainted.
    if (head === 'stats') { settingsUi?.stats(); return; }
    if (everything || head === 'cast' || head === 'enabled') applyCast();
    if (everything || head === 'visual') applyVisual(settings.visual, document.documentElement);
    if (everything || head === 'language') {
      language = resolveLanguage(settings.language, window);
      tr = createTranslator(language);
      for (const button of document.querySelectorAll('.sv-mes-btn')) button.title = tr('act.mes');
      settingsUi?.render();
    } else settingsUi?.sync();
    if ((everything || head === 'enabled') && !settings.enabled) engine.stop();
    if (everything || REBUILD.has(head)) player.render();
    else if (head === 'pos' || head === 'cardMode') { player.update(engine.state); player.place(); }
    else player.update(engine.state);
    if (everything || RECHUNK.has(head)) engine.refresh();
    if (head === 'highlight' || head === 'follow') paint(engine.state);
    applyFlags();
  });

  // Clicks in the chat: the ▶ on a message, and a tap on the text to read from there.
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      return position ? { node: position.offsetNode, offset: position.offset } : null;
    }
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      return range ? { node: range.startContainer, offset: range.startOffset } : null;
    }
    return null;
  }

  function onClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const settings = store.get();
    if (!settings.enabled) return;
    const state = engine.state;

    const button = target.closest('.sv-mes-btn');
    if (button) {
      const id = Number(button.closest('.mes')?.getAttribute('mesid'));
      if (!Number.isInteger(id)) return;
      if (!settings.shown) store.set('shown', true);
      if (state.track?.mesId === id && (state.status === 'playing' || state.status === 'paused')) engine.toggle();
      else engine.playMessage(id);
      return;
    }

    if (!settings.tapJump || !state.track || (state.status !== 'playing' && state.status !== 'paused')) return;
    const body = target.closest('#chat .mes_text');
    if (!body || target.closest('a, button, input, textarea, select, summary, img, video, .mes_button, [contenteditable="true"]')) return;
    if (String(window.getSelection?.() ?? '')) return;
    const id = Number(body.closest('.mes')?.getAttribute('mesid'));
    const spot = caretAt(event.clientX, event.clientY);
    if (!Number.isInteger(id) || !spot) return;
    if (id === state.track.mesId) {
      const index = chunkAt(state.track.doc, state.track.chunks, spot.node, spot.offset);
      if (index >= 0) engine.seek(index, { play: true });
      return;
    }
    const other = load(id);
    const index = other ? chunkAt(other.doc, other.chunks, spot.node, spot.offset) : -1;
    if (index >= 0) engine.playMessage(id, index);
  }
  document.addEventListener('click', onClick);

  const scrolled = event => { if (event.target instanceof Element && event.target.closest('#chat')) userScrollAt = Date.now(); };
  document.addEventListener('wheel', scrolled, { passive: true });
  document.addEventListener('touchmove', scrolled, { passive: true });

  // Tavern events.
  const { eventSource, event_types: types } = ctx();
  const on = (name, handler) => { if (types?.[name]) eventSource.on(types[name], handler); };
  let autoTimer = 0;

  on('CHARACTER_MESSAGE_RENDERED', (mesId, type) => {
    hideIn(mesId);
    injectButtons();
    const settings = store.get();
    if (!settings.enabled || !settings.shown || !settings.autoplay || type === 'first_message') return;
    const id = Number(mesId);
    let tries = 0;
    const attempt = () => {
      if (id !== (ctx().chat?.length ?? 0) - 1 || !readable(id)) return;
      // Other extensions still write into a reply while the tavern is busy with it.
      if (document.body.dataset.generating && tries++ < 50) { autoTimer = window.setTimeout(attempt, 200); return; }
      engine.playMessage(id);
    };
    window.clearTimeout(autoTimer);
    autoTimer = window.setTimeout(attempt, 250);
  });
  on('USER_MESSAGE_RENDERED', injectButtons);
  on('MORE_MESSAGES_LOADED', () => { hideIn(); injectButtons(); });
  on('CHAT_CHANGED', () => {
    window.clearTimeout(autoTimer);
    engine.stop();
    hideIn();
    injectButtons();
    applyCast();
    settingsUi?.sync();
  });
  on('MESSAGE_SWIPED', mesId => { if (engine.state.track?.mesId === Number(mesId)) engine.stop(); });
  on('MESSAGE_DELETED', () => { if (engine.state.track) engine.stop(); });
  const redrawn = mesId => { hideIn(mesId); if (engine.state.track?.mesId === Number(mesId)) window.setTimeout(() => engine.refresh(), 60); };
  on('MESSAGE_EDITED', redrawn);
  on('MESSAGE_UPDATED', redrawn);
  on('APP_READY', () => { mountWand(); hideIn(); injectButtons(); applyCast(); player.place(); });

  window.speechSynthesis?.addEventListener?.('voiceschanged', () => settingsUi?.reloadVoices());
  // A page that goes away must not keep talking.
  window.addEventListener('pagehide', () => { sample?.cancel(); engine.stop(); });

  applyVisual(store.get().visual, document.documentElement);
  applyFlags();
  hideIn();
  injectButtons();
  applyCast();
  mountWand();
  player.render();
  log('ready', { language, voices: provider.available() });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
