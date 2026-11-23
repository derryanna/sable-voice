// Voice sources that live on the internet: OpenRouter, any OpenAI-shaped address, Google Gemini, ElevenLabs.
// Each one turns a phrase into an audio file (a Blob). Pure: `fetch` comes in, so this runs under node tests.

import { OWN_SOURCES } from '../settings.js';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
export const GOOGLE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const ELEVEN_URL = 'https://api.elevenlabs.io';

export const DEFAULT_MODELS = Object.freeze({ openrouter: 'fish-audio/s2.1-pro-free:free', openai: '', openai2: '', google: 'gemini-3.8-flash-tts',
  eleven: 'eleven_multilingual_v2' });
export const GOOGLE_MODELS = Object.freeze(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts']);
export const GOOGLE_VOICES = Object.freeze(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus',
  'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux',
  'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat']);
export const GOOGLE_DEFAULT_VOICE = 'Kore';
export const OPENAI_VOICES = Object.freeze(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse']);
// On an own address a Gemini voice model is asked the Gemini way; every other model the OpenAI way.
export const isGeminiVoice = model => /gemini.*tts/i.test(String(model ?? ''));
const isOpenAiVoice = model => /^(tts-1|gpt-4o.*-tts)/i.test(String(model ?? ''));
export const ELEVEN_MODELS = Object.freeze(['eleven_multilingual_v2', 'eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5']);
// A model with no voice list (Fish) picks a random voice for every phrase unless the voice is described.
export const STYLE_SAMPLES = Object.freeze({
  narrator: 'A calm, low, adult male voice. Unhurried, warm storytelling.',
  character: 'A deep, quiet adult male voice. Natural, close, conversational.',
  female: 'A warm, clear adult female voice. Natural, close, conversational.',
});

const CACHE_SIZE = 80;
const PCM_RATE = 24000;

/** Raw 16-bit sound as a WAV file the browser can play. */
export function pcmToWav(bytes, rate = PCM_RATE, channels = 1) {
  const wav = new Uint8Array(44 + bytes.length);
  const view = new DataView(wav.buffer);
  const ascii = (offset, word) => { for (let i = 0; i < word.length; i++) wav[offset + i] = word.charCodeAt(i); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + bytes.length, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, bytes.length, true);
  wav.set(bytes, 44);
  return wav;
}

const isRiff = bytes => bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
const numberIn = (text, name, fallback) => Number(new RegExp(`${name}=(\\d+)`, 'i').exec(text)?.[1] ?? fallback);

/** Sound bytes as a playable Blob: raw PCM gets a WAV header, anything else keeps its type. */
function soundBlob(bytes, type, pcm) {
  if (!bytes.length) throw new Error('noaudio');
  if (isRiff(bytes)) return new Blob([bytes], { type: 'audio/wav' });
  if (pcm || /audio\/(pcm|l16)/i.test(type)) return new Blob([pcmToWav(bytes, numberIn(type, 'rate', PCM_RATE), numberIn(type, 'channels', 1))], { type: 'audio/wav' });
  return new Blob([bytes], { type: type.split(';')[0].trim() || 'audio/mpeg' });
}

function fromBase64(data) {
  const binary = atob(String(data).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The service's own words about a failed request, short enough for one line in the player. */
function reason(status, body) {
  let message = '';
  try { const data = JSON.parse(body); message = data?.error?.message ?? data?.detail?.message ?? data?.message ?? (typeof data?.detail === 'string' ? data.detail : ''); } catch { message = body; }
  return `${status}${message ? `: ${String(message).replace(/\s+/g, ' ').slice(0, 140)}` : ''}`;
}

function failure(status, body) {
  if (status === 401 || status === 403) return new Error('key');
  if (status === 402) return new Error('credits');
  if (status === 429) return new Error('busy');
  return new Error(reason(status, body));
}

/**
 * deps: fetch(url, init) -> Response; sources() -> { openrouter: { key }, openai: { url, key }, openai2: { url, key }, google: { key }, eleven: { key } }
 * A voice here is { source, model, id, style }.
 * ownStyle() -> false: the description is not sent to own addresses (there it can make the voice drift between phrases).
 */
export function createRemote({ fetch, sources, onSynth, ownStyle = () => true }) {
  const cache = new Map();
  const lists = new Map();
  const pcmOnly = new Set();
  const speechOnly = new Set();

  async function call(url, init) {
    let response;
    try { response = await fetch(url, init); } catch { throw new Error('net'); }
    return response;
  }
  const checked = async response => { if (!response.ok) throw failure(response.status, await response.text().catch(() => '')); return response; };
  const json = (headers, body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const trimUrl = url => String(url ?? '').trim().replace(/\/+$/, '');

  // Measured: with this layout a Gemini voice model lets the description shape the voice and does not read it aloud; "Say in this style: …" was read.
  const geminiScript = (voice, text) => (voice.style
    ? ['# AUDIO PROFILE', voice.style, '', '# DIRECTOR NOTES', 'Speak only the transcript below. Never speak this profile or these notes.', '', '# TRANSCRIPT', text].join('\n')
    : text);

  /** OpenRouter and every OpenAI-shaped address: POST /audio/speech answers with the sound itself. */
  async function speech(base, key, voice, text) {
    const model = voice.model || DEFAULT_MODELS[voice.source];
    if (!model) throw new Error('nomodel');
    const send = format => call(`${base}/audio/speech`, json({ Authorization: `Bearer ${key}` },
      { model, input: text, ...(voice.id ? { voice: voice.id } : {}), ...(voice.style ? { instructions: voice.style } : {}), response_format: format }));
    const tag = `${base}|${model}`;
    let format = pcmOnly.has(tag) ? 'pcm' : 'mp3';
    let response = await send(format);
    if (response.status === 400 && format === 'mp3') {
      const body = await response.text().catch(() => '');
      // Some models only answer with raw sound and say so.
      if (!/pcm/i.test(body)) throw failure(400, body);
      pcmOnly.add(tag);
      format = 'pcm';
      response = await send(format);
    }
    await checked(response);
    return soundBlob(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type') ?? '', format === 'pcm');
  }

  async function google(key, voice, text) {
    const part = { type: 'text', text, ...(voice.style ? { annotations: [{ type: 'speech_metadata', style: voice.style }] } : {}) };
    const response = await checked(await call(`${GOOGLE_URL}/interactions`, json({ 'x-goog-api-key': key }, {
      model: voice.model || DEFAULT_MODELS.google,
      input: [{ type: 'user_input', content: [part] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: voice.id || GOOGLE_DEFAULT_VOICE }] },
    })));
    const data = await response.json().catch(() => null);
    const sounds = (data?.steps ?? []).flatMap(step => step?.content ?? []).filter(item => item?.type === 'audio' && item.data);
    const last = sounds.at(-1);
    if (!last) throw new Error('noaudio');
    return soundBlob(fromBase64(last.data), String(last.mime_type ?? last.mimeType ?? 'audio/pcm'), false);
  }

  /** A Gemini voice model behind an own address: POST /v1beta/models/<model>:generateContent answers with the sound inside JSON. */
  async function gemini(base, key, voice, text) {
    const script = geminiScript(voice, text);
    const root = base.replace(/\/v1(beta)?$/i, '');
    const response = await checked(await call(`${root}/v1beta/models/${encodeURIComponent(voice.model)}:generateContent`, json(key ? { Authorization: `Bearer ${key}` } : {}, {
      contents: [{ parts: [{ text: script }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.id || GOOGLE_DEFAULT_VOICE } } } },
    })));
    const data = await response.json().catch(() => null);
    const sound = (data?.candidates ?? []).flatMap(item => item?.content?.parts ?? []).map(part => part?.inlineData ?? part?.inline_data).find(item => item?.data);
    if (!sound) throw new Error('noaudio');
    return soundBlob(fromBase64(sound.data), String(sound.mimeType ?? sound.mime_type ?? 'audio/pcm'), false);
  }

  async function eleven(key, voice, text) {
    if (!voice.id) throw new Error('novoiceid');
    const response = await checked(await call(`${ELEVEN_URL}/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`,
      json({ 'xi-api-key': key }, { text, model_id: voice.model || DEFAULT_MODELS.eleven })));
    return soundBlob(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type') ?? 'audio/mpeg', false);
  }

  function synth(voice, text) {
    const config = sources()?.[voice.source] ?? {};
    const key = String(config.key ?? '').trim();
    if (OWN_SOURCES.includes(voice.source)) {
      const base = trimUrl(config.url);
      if (!base) throw new Error('nourl');
      // A home server may need no key at all.
      if (!isGeminiVoice(voice.model) || speechOnly.has(base)) return speech(base, key, voice, text);
      // Some addresses serve Gemini voice models only through /audio/speech: the Gemini path is not there (404).
      return gemini(base, key, voice, text).catch(error => {
        if (!/^404\b/.test(error?.message ?? '')) throw error;
        speechOnly.add(base);
        return speech(base, key, voice, text);
      });
    }
    if (!key) throw new Error('nokey');
    if (voice.source === 'openrouter') return speech(OPENROUTER_URL, key, voice, text);
    if (voice.source === 'google') return google(key, voice, text);
    if (voice.source === 'eleven') return eleven(key, voice, text);
    throw new Error('nosource');
  }

  /** The sound of a phrase, made once: the same phrase with the same voice comes from memory. */
  function audio(spoken, text) {
    const voice = OWN_SOURCES.includes(spoken.source) && !ownStyle() ? { ...spoken, style: '' } : spoken;
    const config = sources()?.[voice.source] ?? {};
    const id = JSON.stringify([voice.source, config.url ?? '', voice.model ?? '', voice.id ?? '', voice.style ?? '', text]);
    const kept = cache.get(id);
    if (kept) { cache.delete(id); cache.set(id, kept); return kept; }
    const made = (async () => synth(voice, text))();
    // A sound that really came from the internet: counted (a replay from memory is free).
    made.then(() => onSynth?.(voice, text)).catch(() => {});
    cache.set(id, made);
    made.catch(() => { if (cache.get(id) === made) cache.delete(id); });
    while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
    return made;
  }

  async function loadCatalog(source) {
    const key = String(sources()?.[source]?.key ?? '').trim();
    if (source === 'google') return { models: GOOGLE_MODELS.map(id => ({ id, name: id, voices: GOOGLE_VOICES.map(name => ({ id: name, name })) })) };
    if (source === 'openrouter') {
      const response = await checked(await call(`${OPENROUTER_URL}/models?output_modalities=speech`, { method: 'GET' }));
      const data = await response.json();
      const models = (data?.data ?? []).filter(model => model?.id).map(model => ({
        id: model.id,
        name: String(model.name ?? model.id),
        free: Number(model.pricing?.prompt) === 0 && Number(model.pricing?.completion) === 0,
        voices: Array.isArray(model.supported_voices) && model.supported_voices.length ? model.supported_voices.map(name => ({ id: String(name), name: String(name) })) : null,
      }));
      models.sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name));
      return { models };
    }
    if (source === 'eleven') {
      if (!key) return { models: ELEVEN_MODELS.map(id => ({ id, name: id, voices: null })), needsKey: true };
      const headers = { 'xi-api-key': key };
      const voices = [];
      let token = '';
      for (let page = 0; page < 5; page++) {
        const response = await checked(await call(`${ELEVEN_URL}/v2/voices?page_size=100${token ? `&next_page_token=${encodeURIComponent(token)}` : ''}`, { method: 'GET', headers }));
        const data = await response.json();
        for (const voice of data?.voices ?? []) {
          if (!voice?.voice_id) continue;
          const about = [voice.labels?.gender, voice.labels?.accent].filter(Boolean).join(', ');
          voices.push({ id: voice.voice_id, name: `${voice.name ?? voice.voice_id}${about ? ` · ${about}` : ''}` });
        }
        token = data?.has_more ? data.next_page_token ?? '' : '';
        if (!token) break;
      }
      let ids = [...ELEVEN_MODELS];
      try {
        const data = await (await checked(await call(`${ELEVEN_URL}/v1/models`, { method: 'GET', headers }))).json();
        const found = (Array.isArray(data) ? data : []).filter(model => model?.model_id && model.can_do_text_to_speech !== false).map(model => model.model_id);
        if (found.length) ids = found;
      } catch { /* the built-in list is enough */ }
      return { models: ids.map(id => ({ id, name: id, voices })) };
    }
    if (OWN_SOURCES.includes(source)) {
      const base = trimUrl(sources()?.[source]?.url);
      if (!base) return { models: [] };
      const response = await checked(await call(`${base}/models`, { method: 'GET', headers: key ? { Authorization: `Bearer ${key}` } : {} }));
      const data = await response.json();
      const kinds = model => [].concat(model?.supported_endpoint_types ?? []).join(' ');
      const ids = (data?.data ?? []).filter(model => model?.id && (/tts/i.test(model.id) || /text.to.speech|tts/i.test(kinds(model)))).map(model => String(model.id)).sort((a, b) => a.localeCompare(b));
      const voices = id => (isGeminiVoice(id) ? GOOGLE_VOICES : isOpenAiVoice(id) ? OPENAI_VOICES : null)?.map(name => ({ id: name, name })) ?? null;
      return { models: ids.map(id => ({ id, name: id, voices: voices(id) })) };
    }
    return { models: [] };
  }

  /** Models and voices of a source: { models: [{ id, name, free?, voices: [{ id, name }] | null }], needsKey? }. Asked once. */
  function catalog(source) {
    const kept = lists.get(source);
    if (kept) return kept;
    const made = loadCatalog(source);
    lists.set(source, made);
    made.catch(() => { if (lists.get(source) === made) lists.delete(source); });
    return made;
  }

  /** A key or an address changed: ask the lists again next time. */
  function forget(source) { if (source) lists.delete(source); else lists.clear(); }

  return { audio, catalog, forget };
}
