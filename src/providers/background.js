// Keeps the reading alive when the tavern is not on the screen, and puts the buttons on the lock screen.
// A phone treats a page as "playing" only while one sound of five seconds or more is running; phrases are shorter
// and have gaps between them, so the page gets frozen in a gap. A quiet looped track under the phrases closes the gaps.

const RATE = 8000;
const SECONDS = 10;

function quietTrack(win) {
  const samples = RATE * SECONDS;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples * 2, true);
  // The lowest possible level instead of plain zeros: not heard, but still a sound for the phone.
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, i % 2 ? 1 : -1, true);
  return new win.Blob([buffer], { type: 'audio/wav' });
}

/**
 * actions: { play(), pause(), prev(), next() }
 * -> hold(on)                        the quiet track runs / stops
 *    describe({ title, artist, artwork, playing })   what the lock screen shows
 */
export function createBackground(win = globalThis, actions = {}) {
  const session = win.navigator?.mediaSession ?? null;
  let element = null;
  let url = '';
  let held = false;
  let shown = '';

  if (session) {
    const bind = (name, handler) => { try { session.setActionHandler(name, handler); } catch { /* the browser has no such button */ } };
    bind('play', () => actions.play?.());
    bind('pause', () => actions.pause?.());
    bind('previoustrack', () => actions.prev?.());
    bind('nexttrack', () => actions.next?.());
  }

  function hold(on) {
    if (on === held) return;
    held = on;
    if (!on) { try { element?.pause(); } catch { /* not playing */ } return; }
    if (typeof win.Audio !== 'function') return;
    if (!element) {
      element = new win.Audio();
      url = win.URL.createObjectURL(quietTrack(win));
      element.src = url;
      element.loop = true;
    }
    Promise.resolve().then(() => element.play()).catch(() => { held = false; });
  }

  function describe({ title = '', artist = '', artwork = '', playing = false } = {}) {
    if (!session) return;
    try { session.playbackState = title ? (playing ? 'playing' : 'paused') : 'none'; } catch { /* read-only in an old browser */ }
    const key = `${title}|${artist}|${artwork}`;
    if (key === shown) return;
    shown = key;
    if (!title || typeof win.MediaMetadata !== 'function') { try { session.metadata = null; } catch { /* nothing to clear */ } return; }
    try {
      session.metadata = new win.MediaMetadata({ title, artist, artwork: artwork ? [{ src: new win.URL(artwork, win.location?.href).href }] : [] });
    } catch { /* a picture the browser refuses must not stop the reading */ }
  }

  return { hold, describe };
}
