import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { normalize, DEFAULTS } from '../src/settings.js';
import { readMessage, speakerAt } from '../src/text.js';
import { castPrompt, pickCastVoice, roleVoice, hideTags, bumpStats, costLine, today, whoKind } from '../src/cast.js';
import { encodeWav, fileName, joinSounds, isMp3 } from '../src/save.js';

const page = html => new JSDOM(`<!doctype html><div class="mes_text">${html}</div>`).window.document;
const chunksOf = (document, settings = {}) => readMessage(document.querySelector('.mes_text'), normalize(settings)).chunks.map(chunk => [chunk.kind, chunk.who, chunk.text]);

test('cast: tags in the text are hidden on the page and remembered as speakers', () => {
  const document = page('<p>Kakashi sighed. [v:Guy]"Rival!" Guy boomed. [v:f] "Enough," she said.</p><p>"Fine," Kakashi said.</p><pre>[v:Guy]code</pre>');
  const root = document.querySelector('.mes_text');
  assert.equal(hideTags(root, document), 2, 'two tags hidden, the one in code stays');
  assert.equal(root.querySelectorAll('.sv-who[hidden]').length, 2);
  assert.equal(root.querySelector('p').textContent, 'Kakashi sighed. "Rival!" Guy boomed. "Enough," she said.');
  assert.equal(hideTags(root, document), 0, 'a second pass finds nothing');
  assert.deepEqual(chunksOf(document), [
    [0, '', 'Kakashi sighed.'], [1, 'Guy', 'Rival!'], [0, 'Guy', 'Guy boomed.'], [1, 'f', 'Enough,'], [0, 'f', 'she said.'],
    [1, '', 'Fine,'], [0, '', 'Kakashi said.'],
  ]);
});

test('cast: a tag still in the text (not hidden yet) is skipped by the voice and still names the speaker', () => {
  const document = page('<p>[v:Sakura]"Stop it." She glared. [v:m]"Tea?"</p><p>[v:Guy] "Yes!"</p>');
  assert.deepEqual(chunksOf(document), [[1, 'Sakura', 'Stop it.'], [0, 'Sakura', 'She glared.'], [1, 'm', 'Tea?'], [1, 'Guy', 'Yes!']]);
  const { doc } = readMessage(document.querySelector('.mes_text'), normalize({}));
  assert.equal(speakerAt(doc, doc.blocks[1].start, doc.blocks[1].end), 'Guy');
  assert.equal(speakerAt(doc, doc.blocks[1].start, doc.blocks[1].start), '', 'the tag itself comes first: nobody yet');
  assert.equal(speakerAt(doc, doc.blocks[1].start, doc.blocks[0].end), '', 'a speaker does not leak into the next block');
  assert.equal(speakerAt(doc, 0, 0), '');
});

test('cast: the prompt line, the voice picked for a speaker, and the role lookup', () => {
  const line = castPrompt('Kakashi', ['Guy', ' Sakura ', '', 'Guy']);
  assert.match(line, /^\[Voice tags/);
  assert.match(line, /other than Kakashi/);
  assert.match(line, /Use these names exactly: Guy, Sakura\./);
  assert.match(line, /\[v:m\]/);
  assert.doesNotMatch(castPrompt('Kakashi', []), /Use these names/);

  const settings = normalize({ cast: { enabled: true, female: { source: 'device', id: 'she' },
    byChar: { Kakashi: [{ name: 'Guy', source: 'openrouter', model: 'fish', id: 'g1' }, { name: 'Sakura', source: '', id: '' }, { name: '', source: 'device', id: 'x' }] } } });
  assert.equal(settings.cast.byChar.Kakashi.length, 3);
  assert.equal(pickCastVoice(settings.cast, 'Kakashi', 'guy')?.id, 'g1', 'names match whatever the case');
  assert.equal(pickCastVoice(settings.cast, 'Kakashi', 'Guy Sensei')?.id, 'g1', 'a longer tag starting with the name still matches');
  assert.equal(pickCastVoice(settings.cast, 'Kakashi', 'Sakura'), null, 'a row without a source falls back to the character voice');
  assert.equal(pickCastVoice(settings.cast, 'Kakashi', 'ж')?.id, 'she');
  assert.equal(pickCastVoice(settings.cast, 'Kakashi', 'f')?.id, 'she');
  assert.equal(pickCastVoice(settings.cast, 'Kakashi', 'm'), null, 'no man voice set');
  assert.equal(pickCastVoice(settings.cast, 'Other', 'Guy'), null, 'the list belongs to one character');
  assert.equal(pickCastVoice({ ...settings.cast, enabled: false }, 'Kakashi', 'Guy'), null, 'off = nothing changes');
  assert.equal(whoKind('М'), 'male');
  assert.equal(roleVoice(settings, 'Kakashi', 'cast:0').id, 'g1');
  assert.equal(roleVoice(settings, 'Kakashi', 'cast:9'), null);
  assert.equal(roleVoice(settings, 'Kakashi', 'female').id, 'she');
  assert.equal(roleVoice(settings, '', 'cast:0'), null);
  assert.deepEqual(normalize({}).cast, { enabled: false, male: DEFAULTS.cast.male, female: DEFAULTS.cast.female, byChar: {} });
});

test('cast: the day counter and the cost line; price and download survive normalising', () => {
  let stats = bumpStats(normalize({}).stats, '2026-11-14', 'phrases');
  stats = bumpStats(stats, '2026-11-14', 'internet');
  stats = bumpStats(stats, '2026-11-14', 'phrases');
  assert.deepEqual(stats, { day: '2026-11-14', phrases: 2, internet: 1 });
  assert.deepEqual(bumpStats(stats, '2026-11-15', 'internet'), { day: '2026-11-15', phrases: 0, internet: 1 }, 'a new day starts from zero');
  assert.equal(today(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(costLine({ internet: 9 }, '0,004'), '≈ 0.036');
  assert.equal(costLine({ internet: 300 }, '0.05'), '≈ 15.0');
  assert.equal(costLine({ internet: 9 }, ''), '');
  assert.equal(costLine({ internet: 0 }, '1'), '');
  const settings = normalize({ stats: { day: '2026-11-14', phrases: '7', internet: -3 }, price: ' 0.004 ', download: true });
  assert.deepEqual(settings.stats, { day: '2026-11-14', phrases: 7, internet: 0 });
  assert.equal(settings.price, '0.004');
  assert.equal(settings.download, true);
});

test('save: wav bytes, file names, and mp3 pieces are glued as they are', async () => {
  const wav = encodeWav(new Float32Array([0, 0.5, -1]), 8000);
  const view = new DataView(wav.buffer);
  assert.equal(wav.length, 50);
  assert.equal(view.getUint32(24, true), 8000);
  assert.equal(view.getInt16(46, true), 16383);
  assert.equal(view.getInt16(48, true), -32768);
  assert.equal(fileName('Kakashi — Uni', 4, 'mp3'), 'Kakashi_Uni-5.mp3');
  assert.equal(fileName('', 0, 'wav'), 'sable-voice-1.wav');
  const mp3 = new Blob([new Uint8Array([1, 2])], { type: 'audio/mpeg' });
  assert.equal(isMp3(mp3), true);
  const glued = await joinSounds({ Blob }, [{ blob: mp3, gap: 0 }, { blob: mp3, gap: 0.3 }]);
  assert.equal(glued.ext, 'mp3');
  assert.equal(glued.blob.size, 4);
  await assert.rejects(joinSounds({ Blob }, [{ blob: new Blob([new Uint8Array(2)], { type: 'audio/wav' }), gap: 0 }]), /audio/, 'no decoder here = a plain error word');
});

test('remote: a sound that really came from the internet is counted once', async () => {
  const { createRemote } = await import('../src/providers/remote.js');
  let counted = 0;
  const fetch = async () => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  const remote = createRemote({ fetch, sources: () => ({ openrouter: { key: 'k' } }), onSynth: () => { counted += 1; } });
  const voice = { source: 'openrouter', model: 'm', id: '', style: '' };
  await remote.audio(voice, 'one');
  await remote.audio(voice, 'one');
  await remote.audio(voice, 'two');
  assert.equal(counted, 2);
});
