// Plays the sound files of the internet voices. One <audio> element for everything: a phone lets a page play
// by itself only through an element the user has already started once.

/** play(soundPromise, { rate, volume }) -> { done: Promise<'end' | 'cancelled'> (rejects when it cannot play), cancel() } */
export function createAudioOut(win = globalThis) {
  let element = null;
  let active = null;

  function play(sound, { rate = 1, volume = 1 } = {}) {
    active?.cancel();
    let finish;
    let fail;
    const done = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    let settled = false;
    let url = '';
    const player = element ??= new win.Audio();

    const release = () => {
      player.onended = null;
      player.onerror = null;
      if (url) { try { win.URL.revokeObjectURL(url); } catch { /* already gone */ } url = ''; }
      if (active === handle) active = null;
    };
    const settle = (result, error) => {
      if (settled) return;
      settled = true;
      release();
      if (error) fail(error); else finish(result);
    };
    const handle = { done, cancel() { if (settled) return; try { player.pause(); } catch { /* not playing */ } settle('cancelled'); } };
    active = handle;

    Promise.resolve(sound).then(async blob => {
      if (settled) return;
      url = win.URL.createObjectURL(blob);
      player.onended = () => settle('end');
      player.onerror = () => settle('', new Error('audio'));
      player.src = url;
      player.preservesPitch = true;
      player.defaultPlaybackRate = rate;
      player.playbackRate = rate;
      player.volume = Math.min(1, Math.max(0, volume));
      await player.play();
    }).catch(error => settle('', error?.name === 'NotAllowedError' ? new Error('blocked') : error?.name === 'NotSupportedError' ? new Error('audio') : error));
    return handle;
  }

  return { play };
}
