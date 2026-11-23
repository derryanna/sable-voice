import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalize, DEFAULTS, setPath, getPath, createStore, cleanImage } from '../src/settings.js';
import { KIND, readMessage, readDom, applyRules, buildChunks, splitRun, speakable, rangeFor, chunkAt, detectLang, parsePatterns } from '../src/text.js';
import { createEngine } from '../src/engine.js';
import { pickVoice } from '../src/providers/device.js';

const dom = html => new JSDOM(`<!doctype html><div class="mes_text">${html}</div>`).window.document;
const read = (html, settings = {}) => {
  const document = dom(html);
  return { document, ...readMessage(document.querySelector('.mes_text'), normalize(settings)) };
};
const kinds = chunks => chunks.map(chunk => [chunk.kind, chunk.text]);

test('settings: defaults survive, junk is replaced', () => {
  const clean = normalize(undefined);
  assert.equal(clean.view, 'float');
  assert.equal(clean.read.user, false);
  assert.equal(clean.visual.accent, '#8fb6d9');
  const dirty = normalize({ view: 'nope', speed: 99, volume: '0.5', visual: { accent: 'red', blur: -4, bgImage: 'javascript:alert(1)' }, voices: { narrator: { rate: 'x' } }, extra: 1 });
  assert.equal(dirty.view, 'float');
  assert.equal(dirty.speed, 2);
  assert.equal(dirty.volume, 0.5);
  assert.equal(dirty.visual.accent, '#8fb6d9');
  assert.equal(dirty.visual.blur, 0);
  assert.equal(dirty.visual.bgImage, null);
  assert.equal(dirty.voices.narrator.rate, 1);
  assert.equal('extra' in dirty, false);
  assert.deepEqual(normalize(normalize(DEFAULTS)), normalize(DEFAULTS));
});

test('settings: paths, store and images', () => {
  const next = setPath(normalize({}), 'voices.narrator.rate', 1.5);
  assert.equal(getPath(next, 'voices.narrator.rate'), 1.5);
  let stored = { view: 'bar-top' };
  const store = createStore({ read: () => stored, write: value => { stored = value; } });
  const seen = [];
  store.subscribe((settings, path) => seen.push(path));
  store.set('visual.accent', '#FF00AA');
  assert.equal(stored.visual.accent, '#ff00aa');
  assert.equal(stored.view, 'bar-top');
  assert.deepEqual(seen, ['visual.accent']);
  store.reset();
  assert.equal(stored.view, 'float');
  assert.equal(cleanImage('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(cleanImage('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(cleanImage('data:text/html;base64,AAAA'), null);
  assert.equal(cleanImage('https://x/a.png") ; x: url("b'), null);
});

test('text: quotes are speech, the rest is narration, italics are thoughts', () => {
  const { chunks } = read('<p>Он обернулся. <q>"Ты опоздала."</q> Пауза. <em>Опять.</em></p><p>«Знаю», — сказала она.</p>');
  assert.deepEqual(kinds(chunks), [
    [KIND.NARRATION, 'Он обернулся.'], [KIND.SPEECH, 'Ты опоздала.'], [KIND.NARRATION, 'Пауза.'], [KIND.THOUGHT, 'Опять.'],
    [KIND.SPEECH, 'Знаю'], [KIND.NARRATION, 'сказала она.'],
  ]);
  assert.equal(chunks[0].block, 0);
  assert.equal(chunks[4].block, 1);
});

test('text: plain quotes without <q>, italics inside speech stay speech, asterisk = narration option', () => {
  const plain = read('<p>She smiled. "Come <em>here</em>, now." He did.</p>').chunks;
  assert.deepEqual(kinds(plain), [[KIND.NARRATION, 'She smiled.'], [KIND.SPEECH, 'Come here, now.'], [KIND.NARRATION, 'He did.']]);
  const actions = read('<p><em>He walks in.</em> "Hi."</p>', { asterisk: 'narration' }).chunks;
  assert.deepEqual(kinds(actions), [[KIND.NARRATION, 'He walks in.'], [KIND.SPEECH, 'Hi.']]);
});

test('text: trackers, checklists, code, pictures and hidden parts are never read', () => {
  const { chunks } = read(`<details><summary>Checklist</summary><p>Step one of the plan.</p></details>
    <p>Дождь стучал по стеклу.</p><pre><code>status: ok</code></pre><info>HP 10</info>
    <div hidden>secret</div><img src="x.png" alt="a picture"><p>[pic: 1girl, rain] хвост</p>
    <p>See https://example.com/page now. (OOC: skip me) Done.</p>`, { skip: { regex: '\\[pic:[^\\]]*\\]' } });
  const spoken = chunks.map(chunk => chunk.text).join(' | ');
  assert.equal(spoken, 'Дождь стучал по стеклу. | хвост | See | now. | Done.');
});

test('text: a tracker footer after the last rule is skipped, prose after a rule is kept', () => {
  const footer = read('<p>Текст сцены.</p><hr><p>📅 12 ноября<br>📍 Кухня<br>[Настроение: спокойное]</p>').chunks;
  assert.deepEqual(footer.map(chunk => chunk.text), ['Текст сцены.']);
  const prose = read('<p>Часть первая.</p><hr><p>Часть вторая началась.</p>').chunks;
  assert.deepEqual(prose.map(chunk => chunk.text), ['Часть первая.', 'Часть вторая началась.']);
  const kept = read('<p>Текст.</p><hr><p>📅 дата</p>', { skip: { footer: false } }).chunks;
  assert.equal(kept.length, 2);
});

test('text: reader switches (only the character, no thoughts)', () => {
  const html = '<p>Он молчал. "Говори." <em>Ну же.</em></p>';
  assert.deepEqual(kinds(read(html, { read: { narration: false, thoughts: false } }).chunks), [[KIND.SPEECH, 'Говори.']]);
  assert.deepEqual(kinds(read(html, { read: { speech: false } }).chunks), [[KIND.NARRATION, 'Он молчал.'], [KIND.THOUGHT, 'Ну же.']]);
});

test('text: line breaks split blocks, long sentences are cut at commas, short ones are glued', () => {
  const lines = read('<p>Первая строка<br>Вторая строка</p>').chunks;
  assert.deepEqual(lines.map(chunk => [chunk.block, chunk.text]), [[0, 'Первая строка'], [1, 'Вторая строка']]);
  const long = `${'очень длинная фраза, '.repeat(20)}конец.`;
  const ranges = splitRun(long, 0, long.length, 120);
  assert.ok(ranges.length > 2);
  assert.ok(ranges.every(range => range.end - range.start <= 120));
  assert.equal(ranges.map(range => long.slice(range.start, range.end)).join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' ').trim());
  const glued = splitRun('Да. Нет. Может быть.', 0, 20, 180);
  assert.equal(glued.length, 1);
});

test('text: speakable strips emoji, markup and quotes; blanks are normalised', () => {
  assert.equal(speakable('  *Привет* 😀 «мир» — <3 ok__  '), 'Привет мир — ok');
  assert.equal(speakable('🔥🔥'), '');
  const { chunks } = read('<p>Раз два⠀три.</p>');
  assert.equal(chunks[0].text, 'Раз два три.');
});

test('text: ranges map back to the page and a tapped place finds its phrase', () => {
  const { document, doc, chunks } = read('<p>Он обернулся. <q>"Ты опоздала."</q></p><p>Тишина.</p>');
  const range = rangeFor(doc, chunks[1].start, chunks[1].end, document);
  assert.equal(range.toString(), '"Ты опоздала."');
  const last = document.querySelectorAll('p')[1].firstChild;
  assert.equal(chunkAt(doc, chunks, last, 3), 2);
  assert.equal(chunkAt(doc, chunks, document.querySelector('q').firstChild, 0), 1);
  assert.equal(chunkAt(doc, chunks, document.createTextNode('x'), 0), -1);
  document.querySelector('q').remove();
  assert.equal(rangeFor(doc, chunks[1].start, chunks[1].end, document), null);
});

test('text: language guess and user patterns', () => {
  assert.equal(detectLang('Привет, мир'), 'ru');
  assert.equal(detectLang('Hello there'), 'en');
  assert.equal(detectLang('こんにちは'), 'ja');
  assert.equal(detectLang('…', 'ru'), 'ru');
  assert.equal(parsePatterns('/a+/i\n[broken\nplain').length, 2);
});

test('text: kinds array always matches the text length', () => {
  const document = dom('<p>a<br>b</p><hr><ul><li>c</li><li><em>d</em> "e"</li></ul>текст\nс переводом');
  const doc = applyRules(readDom(document.querySelector('.mes_text')));
  assert.equal(doc.kinds.length, doc.text.length);
  assert.ok(doc.nodes.every(entry => doc.text.slice(entry.start, entry.end).length === entry.node.data.length));
  assert.ok(buildChunks(doc).length >= 5);
});

function harness({ chain = false, tracks = {} } = {}) {
  const spoken = [];
  const pending = [];
  const states = [];
  const engine = createEngine({
    speak(chunk) {
      let finish;
      const done = new Promise(resolve => { finish = resolve; });
      const entry = { text: chunk.text, finish, cancelled: false };
      pending.push(entry);
      spoken.push(chunk.text);
      return { done, cancel() { entry.cancelled = true; finish('cancelled'); } };
    },
    load: id => (tracks[id] ? { mesId: id, name: 'X', chunks: tracks[id].map((text, index) => ({ text, block: index })) } : null),
    pickLast: () => Number(Object.keys(tracks).at(-1)),
    nextOf: id => (tracks[id + 1] ? id + 1 : null),
    settings: () => ({ pauseMs: 0, chain }),
    notify: state => states.push(`${state.status}:${state.index}`),
    wait: async () => {},
  });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const end = async (result = 'end') => { pending.at(-1).finish(result); await tick(); };
  return { engine, spoken, pending, states, end, tick };
}

test('engine: reads phrase by phrase to the end', async () => {
  const { engine, spoken, end } = harness({ tracks: { 3: ['a', 'b', 'c'] } });
  assert.equal(engine.playMessage(3), true);
  assert.equal(engine.state.status, 'playing');
  await end(); await end();
  assert.deepEqual(spoken, ['a', 'b', 'c']);
  assert.equal(engine.state.index, 2);
  await end();
  assert.equal(engine.state.status, 'done');
  assert.equal(engine.state.index, 0);
});

test('engine: pause keeps the place, play resumes the same phrase', async () => {
  const { engine, spoken, pending, end, tick } = harness({ tracks: { 1: ['a', 'b', 'c'] } });
  engine.playMessage(1);
  await end();
  engine.pause();
  await tick();
  assert.equal(pending.at(-1).cancelled, true);
  assert.equal(engine.state.status, 'paused');
  assert.equal(engine.state.index, 1);
  engine.play();
  assert.deepEqual(spoken, ['a', 'b', 'b']);
  assert.equal(engine.state.status, 'playing');
});

test('engine: step and seek cancel the current phrase and never play two at once', async () => {
  const { engine, spoken, pending, tick } = harness({ tracks: { 1: ['a', 'b', 'c', 'd'] } });
  engine.playMessage(1);
  engine.step(1);
  engine.step(1);
  await tick();
  assert.deepEqual(spoken, ['a', 'b', 'c']);
  assert.equal(pending.filter(entry => !entry.cancelled).length, 1);
  assert.equal(engine.state.status, 'playing');
  engine.pause();
  engine.seek(0);
  assert.equal(engine.state.status, 'paused');
  assert.equal(engine.state.index, 0);
  engine.step(-5);
  assert.equal(engine.state.index, 0);
});

test('engine: keep reading moves to the next message, empty messages do nothing', async () => {
  const { engine, spoken, end } = harness({ chain: true, tracks: { 1: ['a'], 2: ['b'] } });
  engine.playMessage(1);
  await end();
  assert.deepEqual(spoken, ['a', 'b']);
  assert.equal(engine.state.track.mesId, 2);
  await end();
  assert.equal(engine.state.status, 'done');
  const empty = harness({ tracks: {} });
  assert.equal(empty.engine.playMessage(7), false);
  assert.equal(empty.engine.play(), false);
  assert.equal(empty.engine.state.error, 'empty');
});

test('engine: three silent phrases in a row stop with an error; stop clears everything', async () => {
  const { engine, end } = harness({ tracks: { 1: ['a', 'b', 'c', 'd'] } });
  engine.playMessage(1);
  await end('silent'); await end('silent'); await end('silent');
  assert.equal(engine.state.status, 'paused');
  assert.equal(engine.state.error, 'silent');
  engine.stop();
  assert.equal(engine.state.status, 'idle');
  assert.equal(engine.state.track, null);
});

test('device: picks a voice by language and a second one for the other role', () => {
  const voices = [{ name: 'Milena', lang: 'ru-RU' }, { name: 'Google русский', lang: 'ru_RU' }, { name: 'Sam', lang: 'en-US', default: true }];
  assert.equal(pickVoice(voices, 'ru', 0).name, 'Google русский');
  assert.equal(pickVoice(voices, 'ru', 1).name, 'Milena');
  assert.equal(pickVoice(voices, 'en', 1).name, 'Sam');
  assert.equal(pickVoice(voices, 'ja'), null);
});

test('i18n: ru and en have the same keys, and the settings use only known ones', async () => {
  const { DICTIONARIES, createTranslator, resolveLanguage } = await import('../src/i18n.js');
  const ru = Object.keys(DICTIONARIES.ru).sort();
  const en = Object.keys(DICTIONARIES.en).sort();
  assert.deepEqual(ru, en);
  const { readFileSync } = await import('node:fs');
  const used = new Set();
  for (const file of ['../src/ui/settings.js', '../src/ui/player.js', '../index.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\btr\('([a-zA-Z.\-]+)'/g)) used.add(match[1]);
  }
  const missing = [...used].filter(key => !(key in DICTIONARIES.en));
  assert.deepEqual(missing, []);
  const { VIEWS, CARD_MODES, ASTERISK, THOUGHT_VOICES, LANGUAGES, VISUAL_CHOICES } = await import('../src/settings.js');
  const choices = [...VIEWS.map(v => `view.${v}`), ...CARD_MODES.map(v => `cardMode.${v}`), ...ASTERISK.map(v => `asterisk.${v}`),
    ...THOUGHT_VOICES.map(v => `voice.thoughts.${v}`), ...LANGUAGES.map(v => `lang.${v}`), ...VISUAL_CHOICES.cover.map(v => `cover.${v}`),
    ...VISUAL_CHOICES.bgFit.map(v => `bgFit.${v}`), ...['player', 'read', 'voices', 'skip', 'look', 'danger'].map(v => `g.${v}`),
    ...['accent', 'base', 'text', 'mark'].map(v => `look.${v}`), ...['look', 'pos', 'voices', 'all'].map(v => `danger.${v}`),
    'voice.narrator', 'voice.character', 'err.empty', 'err.silent', 'err.novoice'];
  assert.deepEqual(choices.filter(key => !(key in DICTIONARIES.ru)), []);
  assert.equal(createTranslator('ru')('voice.own', { name: 'Kakashi' }), 'Свой голос для: Kakashi');
  assert.equal(resolveLanguage('auto', { navigator: { language: 'ru-RU' } }), 'ru');
  assert.equal(resolveLanguage('en', { navigator: { language: 'ru-RU' } }), 'en');
});

test('look: colours, ink and the speed chip', async () => {
  const { applyVisual, clearVisual, inkFor, PRESETS } = await import('../src/ui/visual.js');
  const { nextSpeed, formatSpeed } = await import('../src/ui/player.js');
  assert.equal(inkFor('#ffffff'), '#10141a');
  assert.equal(inkFor('#101010'), '#ffffff');
  const root = new JSDOM('<!doctype html><html></html>').window.document.documentElement;
  applyVisual(normalize({ visual: { accent: '#b79cf2', bgImage: 'https://example.com/a.png', bgFit: 'tile' } }).visual, root);
  assert.equal(root.style.getPropertyValue('--sv-accent'), '#b79cf2');
  assert.equal(root.style.getPropertyValue('--sv-base'), '');
  assert.equal(root.dataset.svBg, 'tile');
  assert.match(root.style.getPropertyValue('--sv-bg-image'), /^url\("https:\/\/example\.com\/a\.png"\)$/);
  clearVisual(root);
  assert.equal(root.style.getPropertyValue('--sv-accent'), '');
  for (const preset of PRESETS) assert.equal(normalize({ visual: preset }).visual.accent, preset.accent);
  assert.equal(nextSpeed(1), 1.25);
  assert.equal(nextSpeed(2), 0.75);
  assert.equal(nextSpeed(1.1), 1.25);
  assert.equal(formatSpeed(1.25), '1.25×');
});

test('remote: OpenRouter speech, the pcm retry, the cache and plain error words', async () => {
  const { createRemote, pcmToWav } = await import('../src/providers/remote.js');
  const calls = [];
  const answer = (status, body, type = 'application/json') => new Response(body, { status, headers: { 'content-type': type } });
  const config = { openrouter: { key: 'k1' }, openai: { url: 'http://home:8000/v1/', key: '' }, google: { key: '' }, eleven: { key: 'e1' } };
  const fetch = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers });
    if (url.endsWith('/audio/speech')) {
      if (body.model === 'pcm-only' && body.response_format === 'mp3') return answer(400, JSON.stringify({ error: { message: 'only supports response_format "pcm"' } }));
      if (body.model === 'pcm-only') return answer(200, new Uint8Array([1, 0, 2, 0]), 'audio/pcm;rate=44100;channels=1');
      if (body.model === 'broke') return answer(402, '{}');
      return answer(200, new Uint8Array([9, 9, 9]), 'audio/mpeg');
    }
    if (url.endsWith('/v1/models')) return answer(200, JSON.stringify({ data: [{ id: 'chat-big' }, { id: 'gemini-3.8-flash-tts' }, { id: 'gpt-4o-mini-tts' }, { id: 'eleven_v3', supported_endpoint_types: ['Text to speech'] }] }));
    if (url.endsWith(':generateContent') && url.includes('plain.example')) return answer(404, '404 page not found');
    if (url.endsWith(':generateContent')) return answer(200, JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'UklGRgAAAABXQVZFZm10IA==' } }] } }] }));
    if (url.includes('/v1/text-to-speech/')) return answer(200, new Uint8Array([7, 7]), 'audio/mpeg');
    return answer(404, 'nope');
  };
  let sendStyle = true;
  const remote = createRemote({ fetch, sources: () => config, ownStyle: () => sendStyle });

  const fish = { source: 'openrouter', model: '', id: '', style: 'A low male voice.' };
  const first = await remote.audio(fish, 'Привет');
  assert.equal(first.type, 'audio/mpeg');
  assert.deepEqual(calls[0].body, { model: 'fish-audio/s2.1-pro-free:free', input: 'Привет', instructions: 'A low male voice.', response_format: 'mp3' });
  assert.equal(calls[0].headers.Authorization, 'Bearer k1');
  await remote.audio(fish, 'Привет');
  assert.equal(calls.length, 1, 'the same phrase is not asked twice');

  const wav = await remote.audio({ source: 'openrouter', model: 'pcm-only', id: 'gareth', style: '' }, 'Hi');
  assert.equal(wav.type, 'audio/wav');
  const bytes = new Uint8Array(await wav.arrayBuffer());
  assert.equal(bytes.length, 48);
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 44100);
  await remote.audio({ source: 'openrouter', model: 'pcm-only', id: 'gareth', style: '' }, 'Again');
  assert.equal(calls.at(-1).body.response_format, 'pcm', 'a pcm-only model is asked for pcm straight away');
  assert.equal(pcmToWav(new Uint8Array(4)).length, 48);

  await assert.rejects(remote.audio({ source: 'openrouter', model: 'broke', id: '', style: '' }, 'x'), /credits/);
  await assert.rejects(remote.audio({ source: 'google', model: '', id: '', style: '' }, 'x'), /nokey/);
  await assert.rejects(remote.audio({ source: 'eleven', model: '', id: '', style: '' }, 'x'), /novoiceid/);
  await assert.rejects(remote.audio({ source: 'openai', model: '', id: '', style: '' }, 'x'), /nomodel/);

  await remote.audio({ source: 'openai', model: 'tts-1', id: 'onyx', style: '' }, 'x');
  assert.equal(calls.at(-1).url, 'http://home:8000/v1/audio/speech');
  config.openai2 = { url: 'https://two.example/v1', key: 'k2' };
  await remote.audio({ source: 'openai2', model: 'tts-1', id: 'onyx', style: '' }, 'x');
  assert.equal(calls.at(-1).url, 'https://two.example/v1/audio/speech');
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer k2', 'the second address uses its own key');
  const gem = await remote.audio({ source: 'openai2', model: 'gemini-3.8-flash-tts', id: 'Charon', style: 'Low and calm.' }, 'Hello');
  assert.equal(calls.at(-1).url, 'https://two.example/v1beta/models/gemini-3.8-flash-tts:generateContent', 'a Gemini voice model is asked the Gemini way');
  assert.equal(calls.at(-1).body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Charon');
  assert.match(calls.at(-1).body.contents[0].parts[0].text, /^# AUDIO PROFILE\nLow and calm\.\n[^]*# TRANSCRIPT\nHello$/);
  assert.equal(gem.type, 'audio/wav');
  config.openai = { url: 'https://plain.example/v1', key: 'k3' };
  const plain = await remote.audio({ source: 'openai', model: 'google/gemini-3.8-flash-tts', id: 'Orus', style: '' }, 'Hello');
  assert.equal(calls.at(-1).url, 'https://plain.example/v1/audio/speech', 'no Gemini path at the address: the same phrase goes the usual way');
  assert.equal(calls.at(-1).body.voice, 'Orus');
  assert.equal(plain.type, 'audio/mpeg');
  const before = calls.length;
  await remote.audio({ source: 'openai', model: 'google/gemini-3.8-flash-tts', id: 'Orus', style: '' }, 'Again');
  assert.equal(calls.length, before + 1, 'the missing path is asked once per address');
  await remote.audio({ source: 'openai', model: 'google/gemini-3.8-flash-tts', id: 'Orus', style: 'Low and calm.' }, 'Hello');
  assert.equal(calls.at(-1).body.input, 'Hello');
  assert.equal(calls.at(-1).body.instructions, 'Low and calm.', 'the description goes out by default');
  sendStyle = false;
  await remote.audio({ source: 'openai', model: 'google/gemini-3.8-flash-tts', id: 'Orus', style: 'Low and calm.' }, 'Hello once more');
  assert.equal('instructions' in calls.at(-1).body, false, 'switched off: an own address gets only the voice name');
  await remote.audio(fish, 'Hello again');
  assert.equal(calls.at(-1).body.instructions, 'A low male voice.', 'the switch is for own addresses only');
  sendStyle = true;
  const own = await remote.catalog('openai2');
  assert.deepEqual(own.models.map(item => item.id), ['eleven_v3', 'gemini-3.8-flash-tts', 'gpt-4o-mini-tts'], 'only voice models are listed');
  assert.equal(own.models[1].voices.length, 30);
  assert.equal(own.models[2].voices[0].id, 'alloy');
  assert.equal(own.models[0].voices, null);
  await remote.audio({ source: 'eleven', model: '', id: 'abc', style: '' }, 'x');
  assert.equal(calls.at(-1).headers['xi-api-key'], 'e1');
  assert.deepEqual(calls.at(-1).body, { text: 'x', model_id: 'eleven_multilingual_v2' });
});

test('remote: Google answer and the model lists', async () => {
  const { createRemote, GOOGLE_VOICES } = await import('../src/providers/remote.js');
  const calls = [];
  const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
  const fetch = async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (url.endsWith('/interactions')) return json({ steps: [{ content: [{ type: 'text', text: '…' }, { type: 'audio', mime_type: 'audio/wav', data: btoa('RIFF0000WAVEfmt 0000') }] }] });
    if (url.includes('/models?output_modalities=speech')) return json({ data: [
      { id: 'paid/one', name: 'Paid', pricing: { prompt: '0.1', completion: '0' }, supported_voices: ['a', 'b'] },
      { id: 'fish/free', name: 'Fish', pricing: { prompt: '0', completion: '0' } }] });
    if (url.includes('/v2/voices')) return json({ voices: [{ voice_id: 'v1', name: 'Adam', labels: { gender: 'male' } }], has_more: false });
    if (url.endsWith('/v1/models')) return json([{ model_id: 'eleven_v3', can_do_text_to_speech: true }, { model_id: 'sts', can_do_text_to_speech: false }]);
    return new Response('no', { status: 404 });
  };
  const config = { openrouter: { key: '' }, openai: { url: '', key: '' }, google: { key: 'g1' }, eleven: { key: '' } };
  const remote = createRemote({ fetch, sources: () => config });

  const sound = await remote.audio({ source: 'google', model: '', id: 'Charon', style: 'calm' }, 'Привет');
  assert.equal(sound.type, 'audio/wav');
  assert.equal(calls[0].headers['x-goog-api-key'], 'g1');
  assert.equal(calls[0].body.generation_config.speech_config[0].voice, 'Charon');
  assert.deepEqual(calls[0].body.input[0].content[0].annotations, [{ type: 'speech_metadata', style: 'calm' }]);

  const open = await remote.catalog('openrouter');
  assert.deepEqual(open.models.map(model => model.id), ['fish/free', 'paid/one'], 'free models first');
  assert.equal(open.models[0].voices, null);
  assert.deepEqual(open.models[1].voices, [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }]);
  assert.equal((await remote.catalog('google')).models[0].voices.length, GOOGLE_VOICES.length);

  const locked = await remote.catalog('eleven');
  assert.equal(locked.needsKey, true);
  config.eleven.key = 'e1';
  remote.forget('eleven');
  const eleven = await remote.catalog('eleven');
  assert.deepEqual(eleven.models.map(model => model.id), ['eleven_v3']);
  assert.deepEqual(eleven.models[0].voices, [{ id: 'v1', name: 'Adam · male' }]);
});

test('voice suggestion: the request is built from the card and the answer is cleaned', async () => {
  const { suggestPrompt, cleanSuggestion } = await import('../src/suggest.js');
  assert.equal(suggestPrompt({}), '');
  const prompt = suggestPrompt({ name: 'Rowan', description: 'A tired detective, 40.', personality: '', mes_example: 'x'.repeat(9000) });
  assert.match(prompt, /^Name: Rowan\n\nDescription: A tired detective, 40\./);
  assert.ok(!prompt.includes('Personality'));
  assert.ok(prompt.length < 6100);
  assert.equal(cleanSuggestion('<think>hm</think> **Voice:** "A low, dry male voice in his forties; unhurried."'), 'A low, dry male voice in his forties; unhurried.');
  assert.ok(cleanSuggestion('Deep male voice. '.repeat(60)).length <= 300);
  assert.equal(cleanSuggestion(null), '');
});
