// The player's motor: one loaded message (a "track" of phrases), a position, and play / pause / step / seek.
// It knows nothing about the page or the voice source: both come in as functions, so it runs under node tests.

/**
 * deps:
 *   speak(chunk, track) -> { done: Promise<'end' | 'cancelled' | 'silent'>, cancel() }
 *   load(mesId) -> track { mesId, name, chunks: [...] } | null       (builds the phrases of one message)
 *   pickLast() -> mesId | null                                       (the message Play reads when nothing is loaded)
 *   nextOf(mesId) -> mesId | null                                    (the next readable message, for "keep reading")
 *   settings() -> { pauseMs, chain }
 *   notify(state)                                                    (called after every change)
 *   wait(ms) -> Promise
 */
export function createEngine(deps) {
  const wait = deps.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const state = { status: 'idle', track: null, index: 0, error: '' };
  let token = 0;
  let current = null;

  const emit = () => { try { deps.notify?.(state); } catch (error) { console.error('[Sable Voice] player update failed', error); } };
  const halt = () => { token += 1; const active = current; current = null; try { active?.cancel(); } catch { /* already silent */ } };

  async function run() {
    halt();
    const mine = token;
    state.status = 'playing';
    state.error = '';
    let silent = 0;
    while (mine === token && state.track) {
      const track = state.track;
      const chunk = track.chunks[state.index];
      if (!chunk) break;
      emit();
      let result;
      try {
        current = deps.speak(chunk, track);
        result = await current.done;
      } catch (error) {
        if (mine !== token) return;
        state.status = 'paused';
        state.error = String(error?.message ?? error ?? 'error');
        emit();
        return;
      }
      if (mine !== token) return;
      if (result === 'cancelled') { state.status = 'paused'; emit(); return; }
      silent = result === 'silent' ? silent + 1 : 0;
      if (silent >= 3) { state.status = 'paused'; state.error = 'silent'; emit(); return; }
      const next = track.chunks[state.index + 1];
      if (!next) {
        const following = deps.settings().chain ? deps.nextOf?.(track.mesId) : null;
        const nextTrack = following == null ? null : deps.load(following);
        if (!nextTrack?.chunks.length) break;
        state.track = nextTrack;
        state.index = 0;
        continue;
      }
      state.index += 1;
      const gap = next.block !== chunk.block ? deps.settings().pauseMs : 0;
      if (gap > 0) { emit(); await wait(gap); if (mine !== token) return; }
    }
    if (mine !== token) return;
    current = null;
    state.status = state.track ? 'done' : 'idle';
    state.index = 0;
    emit();
  }

  function open(mesId, from = 0) {
    const track = mesId == null ? null : deps.load(mesId);
    if (!track?.chunks.length) return false;
    halt();
    state.track = track;
    state.index = Math.min(Math.max(0, from), track.chunks.length - 1);
    state.error = '';
    return true;
  }

  const api = {
    state,
    /** Reads a message from a phrase. False when it has nothing to read. */
    playMessage(mesId, from = 0) {
      if (!open(mesId, from)) { state.error = 'empty'; emit(); return false; }
      run();
      return true;
    },
    play() {
      if (state.status === 'playing') return true;
      if (state.track && state.status === 'paused') { run(); return true; }
      const last = deps.pickLast?.();
      // After the end, Play takes the newest reply if there is one, else reads the same message again.
      if (last != null && open(last, 0)) { run(); return true; }
      if (state.track) { run(); return true; }
      state.error = 'empty';
      emit();
      return false;
    },
    pause() {
      if (state.status !== 'playing') return;
      halt();
      state.status = 'paused';
      emit();
    },
    toggle() { return state.status === 'playing' ? api.pause() : api.play(); },
    stop() {
      halt();
      state.status = 'idle';
      state.track = null;
      state.index = 0;
      state.error = '';
      emit();
    },
    seek(index, { play = state.status === 'playing' } = {}) {
      if (!state.track) return;
      state.index = Math.min(Math.max(0, Math.round(index)), state.track.chunks.length - 1);
      if (play) run();
      else { halt(); if (state.status === 'done' || state.status === 'idle') state.status = 'paused'; emit(); }
    },
    step(delta) { if (state.track) api.seek(state.index + delta); },
    /** The message was re-rendered: take the new phrases and stay on the same phrase when it is still there. */
    refresh() {
      if (!state.track) return;
      const fresh = deps.load(state.track.mesId);
      if (!fresh?.chunks.length) { api.stop(); return; }
      const now = state.track.chunks[state.index]?.text;
      const same = fresh.chunks[state.index]?.text === now ? state.index : fresh.chunks.findIndex(chunk => chunk.text === now);
      state.track = fresh;
      state.index = same >= 0 ? same : Math.min(state.index, fresh.chunks.length - 1);
      emit();
    },
  };
  return api;
}
