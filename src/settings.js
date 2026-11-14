// Settings: defaults, ranges and one normaliser. Pure, no browser globals.

export const KEY = 'sable_voice';
export const VERSION = '0.6.0';

export const VIEWS = Object.freeze(['float', 'bar-top', 'bar-bottom', 'side-left', 'side-right']);
export const LANGUAGES = Object.freeze(['auto', 'ru', 'en']);
export const CARD_MODES = Object.freeze(['compact', 'full']);
// What text in *asterisks* is: the character's thoughts, or actions the narrator reads.
export const ASTERISK = Object.freeze(['thought', 'narration']);
export const THOUGHT_VOICES = Object.freeze(['character', 'narrator']);
// Where a voice comes from: the device itself, or a service on the internet (own key needed).
export const SOURCES = Object.freeze(['device', 'openrouter', 'openai', 'openai2', 'google', 'eleven']);
// Sources that are just an address and a key: any server that answers like OpenAI's /audio/speech.
export const OWN_SOURCES = Object.freeze(['openai', 'openai2']);
export const SOURCE_DEFAULTS = Object.freeze({ openrouter: Object.freeze({ key: '' }), openai: Object.freeze({ url: 'https://api.openai.com/v1', key: '' }),
  openai2: Object.freeze({ url: '', key: '' }),
  google: Object.freeze({ key: '' }), eleven: Object.freeze({ key: '' }) });

// Tags whose whole content is never read aloud (trackers, checklists, plans, picture prompts).
export const DEFAULT_SKIP_TAGS = 'info, checklist, plan, think, thinking, details, summary, pic, image, state, status, tracker, sable_state';

export const VISUAL_DEFAULTS = Object.freeze({ accent: '#8fb6d9', base: null, text: null, mark: null, opacity: 0.92, blur: 14, radius: 22,
  fontSize: 14, scale: 1, bgImage: null, bgDim: 0.5, bgFit: 'cover', cover: 'avatar', spin: true });
export const VISUAL_RANGES = Object.freeze({ opacity: [0.4, 1, 0.01], blur: [0, 30, 1], radius: [6, 32, 1], fontSize: [12, 18, 1],
  scale: [0.8, 1.3, 0.05], bgDim: [0, 0.9, 0.01] });
export const VISUAL_CHOICES = Object.freeze({ bgFit: ['cover', 'contain', 'tile'], cover: ['avatar', 'disc', 'none'] });
export const VISUAL_COLORS = Object.freeze(['accent', 'base', 'text', 'mark']);
// About 900 KB of text; the settings UI refuses to store more than about 600 KB.
export const BG_IMAGE_MAX_LENGTH = 900 * 1024;

export const RANGES = Object.freeze({ volume: [0, 1, 0.05], speed: [0.5, 2, 0.05], pauseMs: [0, 1500, 50], chunkChars: [80, 400, 10] });
export const VOICE_RANGES = Object.freeze({ rate: [0.5, 2, 0.05], pitch: [0, 2, 0.05] });
export const VOICE_DEFAULTS = Object.freeze({ source: 'device', model: '', id: '', style: '', rate: 1, pitch: 1 });

export const DEFAULTS = Object.freeze({
  // `shown` is the ✕ on the player: hidden, but the ▶ on messages and the wand-menu entry bring it back.
  enabled: true, shown: true, language: 'auto', view: 'float', cardMode: 'compact',
  autoplay: false, chain: false, mesButton: true, tapJump: true, highlight: true, follow: true,
  read: Object.freeze({ narration: true, speech: true, thoughts: true, user: false }),
  asterisk: 'thought',
  skip: Object.freeze({ ooc: true, footer: true, code: true, links: true, tags: DEFAULT_SKIP_TAGS, selectors: '', regex: '' }),
  provider: 'device',
  sources: SOURCE_DEFAULTS,
  voices: Object.freeze({ narrator: VOICE_DEFAULTS, character: VOICE_DEFAULTS, thoughts: 'character', byName: Object.freeze({}) }),
  volume: 1, speed: 1, pauseMs: 250, chunkChars: 180,
  visual: VISUAL_DEFAULTS,
  // Places as fractions of the window, so they survive a rotated phone: fab/card = centre point, side = height.
  pos: Object.freeze({ fab: null, card: null, side: 0.5 }),
  debug: false,
});

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const HEX = /^#[0-9a-f]{6}$/i;
const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const LINK_IMAGE = /^https?:\/\/[^\s"'()\\<>]+$/i;

export function clamp(value, [min, max, step], fallback) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return fallback;
  const clamped = Math.min(max, Math.max(min, number));
  if (!step) return clamped;
  // Snap to the step and cut float noise (0.1 + 0.2).
  return Number((Math.round((clamped - min) / step) * step + min).toFixed(4));
}

const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const pick = (value, choices, fallback) => (choices.includes(value) ? value : fallback);
const text = (value, fallback, max = 4000) => (typeof value === 'string' ? value.slice(0, max) : fallback);

/** A background image the stylesheet may load: a small data URL or an http(s) link. Anything else is null. */
export function cleanImage(value) {
  if (typeof value !== 'string' || !value || value.length > BG_IMAGE_MAX_LENGTH) return null;
  return DATA_IMAGE.test(value) || LINK_IMAGE.test(value) ? value : null;
}

export function normalizeVisual(raw) {
  const source = isObject(raw) ? raw : {};
  const visual = {};
  for (const key of VISUAL_COLORS) {
    const fallback = VISUAL_DEFAULTS[key];
    visual[key] = typeof source[key] === 'string' && HEX.test(source[key]) ? source[key].toLowerCase() : source[key] === null ? (key === 'accent' ? fallback : null) : fallback;
  }
  for (const [key, range] of Object.entries(VISUAL_RANGES)) visual[key] = clamp(source[key], range, VISUAL_DEFAULTS[key]);
  for (const [key, choices] of Object.entries(VISUAL_CHOICES)) visual[key] = pick(source[key], choices, VISUAL_DEFAULTS[key]);
  visual.bgImage = cleanImage(source.bgImage);
  visual.spin = bool(source.spin, VISUAL_DEFAULTS.spin);
  return visual;
}

/** One voice. `own` = a character's own voice: source '' there means "the same as all characters". */
export function normalizeVoice(raw, fallback = VOICE_DEFAULTS, own = false) {
  const source = isObject(raw) ? raw : {};
  const id = text(source.id, fallback.id, 300);
  // A choice saved before sources existed is a voice of the device.
  const from = own ? pick(source.source, ['', ...SOURCES], id ? 'device' : '') : pick(source.source, SOURCES, fallback.source);
  return { source: from, model: text(source.model, fallback.model, 200).trim(), id, style: text(source.style, fallback.style, 500),
    rate: clamp(source.rate, VOICE_RANGES.rate, fallback.rate), pitch: clamp(source.pitch, VOICE_RANGES.pitch, fallback.pitch) };
}

const LINK = /^https?:\/\/[^\s"'<>]+$/i;

export function normalizeSources(raw) {
  const source = isObject(raw) ? raw : {};
  const result = {};
  for (const [name, defaults] of Object.entries(SOURCE_DEFAULTS)) {
    const item = isObject(source[name]) ? source[name] : {};
    result[name] = { key: text(item.key, '', 400).trim() };
    if ('url' in defaults) { const url = text(item.url, defaults.url, 300).trim(); result[name].url = url === '' || LINK.test(url) ? url : defaults.url; }
  }
  return result;
}

const point = value => (isObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y)
  ? { x: Math.min(1, Math.max(0, value.x)), y: Math.min(1, Math.max(0, value.y)) } : null);

/** The whole settings object from whatever was stored: unknown keys dropped, bad values replaced by defaults. */
export function normalize(raw) {
  const source = isObject(raw) ? raw : {};
  const read = isObject(source.read) ? source.read : {};
  const skip = isObject(source.skip) ? source.skip : {};
  const voices = isObject(source.voices) ? source.voices : {};
  const pos = isObject(source.pos) ? source.pos : {};
  const byName = {};
  if (isObject(voices.byName)) {
    for (const [name, voice] of Object.entries(voices.byName).slice(0, 200)) {
      if (name && isObject(voice)) byName[name.slice(0, 200)] = normalizeVoice(voice, VOICE_DEFAULTS, true);
    }
  }
  return {
    enabled: bool(source.enabled, DEFAULTS.enabled),
    shown: bool(source.shown, DEFAULTS.shown),
    language: pick(source.language, LANGUAGES, DEFAULTS.language),
    view: pick(source.view, VIEWS, DEFAULTS.view),
    cardMode: pick(source.cardMode, CARD_MODES, DEFAULTS.cardMode),
    autoplay: bool(source.autoplay, DEFAULTS.autoplay),
    chain: bool(source.chain, DEFAULTS.chain),
    mesButton: bool(source.mesButton, DEFAULTS.mesButton),
    tapJump: bool(source.tapJump, DEFAULTS.tapJump),
    highlight: bool(source.highlight, DEFAULTS.highlight),
    follow: bool(source.follow, DEFAULTS.follow),
    read: { narration: bool(read.narration, true), speech: bool(read.speech, true), thoughts: bool(read.thoughts, true), user: bool(read.user, false) },
    asterisk: pick(source.asterisk, ASTERISK, DEFAULTS.asterisk),
    skip: { ooc: bool(skip.ooc, true), footer: bool(skip.footer, true), code: bool(skip.code, true), links: bool(skip.links, true),
      tags: text(skip.tags, DEFAULT_SKIP_TAGS, 1000), selectors: text(skip.selectors, '', 1000), regex: text(skip.regex, '', 4000) },
    provider: text(source.provider, DEFAULTS.provider, 40) || DEFAULTS.provider,
    sources: normalizeSources(source.sources),
    voices: { narrator: normalizeVoice(voices.narrator), character: normalizeVoice(voices.character),
      thoughts: pick(voices.thoughts, THOUGHT_VOICES, 'character'), byName },
    volume: clamp(source.volume, RANGES.volume, DEFAULTS.volume),
    speed: clamp(source.speed, RANGES.speed, DEFAULTS.speed),
    pauseMs: clamp(source.pauseMs, RANGES.pauseMs, DEFAULTS.pauseMs),
    chunkChars: clamp(source.chunkChars, RANGES.chunkChars, DEFAULTS.chunkChars),
    visual: normalizeVisual(source.visual),
    pos: { fab: point(pos.fab), card: point(pos.card), side: clamp(pos.side, [0.08, 0.92, 0], DEFAULTS.pos.side) },
    debug: bool(source.debug, false),
  };
}

/** Value at a dotted path ('voices.narrator.rate'). */
export function getPath(object, path) {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

/** A copy of `object` with the value at a dotted path replaced. The copy is plain data (settings only). */
export function setPath(object, path, value) {
  const copy = structuredClone(object);
  const keys = String(path).split('.');
  let cursor = copy;
  for (const key of keys.slice(0, -1)) {
    if (!isObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
  return copy;
}

/**
 * The settings store: one normalised object kept in the tavern's extension settings.
 * `host` = { read(): stored object, write(object): void (stores and schedules the save) }.
 */
export function createStore(host) {
  let current = normalize(host.read());
  const listeners = new Set();
  const commit = (next, path) => {
    current = normalize(next);
    host.write(current);
    for (const listener of [...listeners]) {
      try { listener(current, path); } catch (error) { console.error('[Sable Voice] settings listener failed', error); }
    }
    return current;
  };
  host.write(current);
  return {
    get: () => current,
    set: (path, value) => commit(setPath(current, path, value), path),
    replace: next => commit(next, ''),
    reset: () => commit({}, ''),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
