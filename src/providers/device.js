// Voice source "device": the voices built into the browser / phone (Web Speech API). Free and instant.
// A source is { id, available(), voices(), speak(text, options) -> { done, cancel() } }; step 2 adds more of them.

const LANG_TAGS = { ru: 'ru-RU', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR' };

/** Best installed voice for a language: `nth` picks a different one for the second role when there is a choice. */
export function pickVoice(voices, lang, nth = 0) {
  const wanted = String(lang || 'en').toLowerCase().slice(0, 2);
  const matching = voices.filter(voice => String(voice.lang).toLowerCase().replace('_', '-').startsWith(wanted));
  if (!matching.length) return null;
  const score = voice => (/natural|neural|online|google|premium|enhanced/i.test(voice.name) ? 2 : 0) + (voice.default ? 1 : 0);
  const ranked = [...matching].sort((a, b) => score(b) - score(a));
  return ranked[nth % ranked.length];
}

export function createDeviceProvider(win = globalThis) {
  const synth = win.speechSynthesis;
  const available = () => !!synth && typeof win.SpeechSynthesisUtterance === 'function';
  let cached = [];
  let active = null;

  const list = () => {
    try { const found = synth.getVoices(); if (found?.length) cached = [...found]; } catch { /* no voices yet */ }
    return cached;
  };

  /** Installed voices as [{ id, name, lang, local }]. Browsers fill the list late, so this waits a little for it. */
  async function voices() {
    if (!available()) return [];
    if (!list().length) {
      await new Promise(resolve => {
        const timer = win.setTimeout(resolve, 1500);
        synth.addEventListener?.('voiceschanged', () => { win.clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    return list().map(voice => ({ id: voice.voiceURI || voice.name, name: voice.name, lang: voice.lang, local: !!voice.localService }));
  }

  function speak(text, { voice = '', rate = 1, pitch = 1, volume = 1, lang = 'en', nth = 0 } = {}) {
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    if (!available()) { finish('silent'); return { done, cancel() {} }; }
    const installed = list();
    const chosen = (voice && installed.find(item => (item.voiceURI || item.name) === voice)) || pickVoice(installed, lang, nth);
    const utterance = new win.SpeechSynthesisUtterance(text);
    if (chosen) { utterance.voice = chosen; utterance.lang = chosen.lang; } else utterance.lang = LANG_TAGS[lang] ?? lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const startedAt = Date.now();
    let settled = false;
    let watch = null;
    const settle = result => {
      if (settled) return;
      settled = true;
      win.clearInterval(watch);
      if (active === handle) active = null;
      // A long phrase that "ended" at once was never spoken: no voice for the language, or the engine is off.
      finish(result === 'end' && text.length >= 20 && Date.now() - startedAt < 120 ? 'silent' : result);
    };
    const handle = { done, cancel() { if (settled) return; settle('cancelled'); try { synth.cancel(); } catch { /* nothing playing */ } } };
    utterance.onend = () => settle('end');
    utterance.onerror = event => settle(event?.error === 'interrupted' || event?.error === 'canceled' ? 'cancelled' : 'silent');

    const start = () => {
      if (settled) return;
      try { synth.speak(utterance); } catch { settle('silent'); return; }
      // Some phones never fire "end": watch the engine and move on once it has been quiet for two looks.
      let quiet = 0;
      watch = win.setInterval(() => {
        quiet = synth.speaking || synth.pending ? 0 : quiet + 1;
        if (quiet >= 2 && Date.now() - startedAt > 900) settle('end');
      }, 400);
    };
    // Keep a reference (browsers drop the callbacks of a collected utterance) and let a cancel settle before speaking.
    handle.utterance = utterance;
    const busy = synth.speaking || synth.pending;
    if (active) active.cancel();
    else if (busy) { try { synth.cancel(); } catch { /* nothing playing */ } }
    active = handle;
    if (busy) win.setTimeout(start, 70); else start();
    return handle;
  }

  return { id: 'device', available, voices, speak };
}
