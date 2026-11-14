// Saving a reply as one sound file: mp3 when every phrase came back as mp3, otherwise one WAV made in the browser.

/** 16-bit mono WAV from float samples. */
export function encodeWav(samples, rate) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at, text) => { for (let index = 0; index < text.length; index++) bytes[at + index] = text.charCodeAt(index); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return bytes;
}

export const isMp3 = blob => /mpeg|mp3/i.test(String(blob?.type ?? ''));

/** A file name from the character's name and the message number. */
export const fileName = (name, mesId, ext) => `${String(name || '').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'sable-voice'}-${Number(mesId) + 1}.${ext}`;

/**
 * Joins sounds into one file. `pieces`: [{ blob, gap }] — gap in seconds of silence before the piece.
 * All mp3 → the bytes are glued (players read it as one stream); anything else → decoded and written as WAV.
 */
export async function joinSounds(win, pieces) {
  if (pieces.length && pieces.every(piece => isMp3(piece.blob))) return { blob: new win.Blob(pieces.map(piece => piece.blob), { type: 'audio/mpeg' }), ext: 'mp3' };
  const Context = win.AudioContext ?? win.webkitAudioContext;
  const Offline = win.OfflineAudioContext ?? win.webkitOfflineAudioContext;
  if (!Context || !Offline) throw new Error('audio');
  const context = new Context();
  const buffers = [];
  try {
    for (const piece of pieces) buffers.push(await context.decodeAudioData(await piece.blob.arrayBuffer()));
  } finally { context.close?.(); }
  const rate = Math.max(...buffers.map(buffer => buffer.sampleRate));
  let frames = 0;
  const starts = pieces.map((piece, index) => { frames += Math.round(piece.gap * rate); const start = frames; frames += Math.round(buffers[index].duration * rate); return start; });
  const offline = new Offline(1, Math.max(1, frames), rate);
  buffers.forEach((buffer, index) => { const source = offline.createBufferSource(); source.buffer = buffer; source.connect(offline.destination); source.start(starts[index] / rate); });
  const rendered = await offline.startRendering();
  return { blob: new win.Blob([encodeWav(rendered.getChannelData(0), rate)], { type: 'audio/wav' }), ext: 'wav' };
}

/** Offers a file to the user. */
export function offerFile(document, blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
