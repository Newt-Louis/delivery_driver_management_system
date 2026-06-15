// Shared bell chime — used by WaitingScreen (TV display) and Track (driver mobile).

// 4-note ding-dong pattern, one cycle ≈ 2.8 s.
const NOTES = [
  { offset: 0.00, freq: 1568, dur: 0.80, gain: 0.90 }, // G6 — ding
  { offset: 0.65, freq: 1175, dur: 0.80, gain: 0.80 }, // D6 — dong
  { offset: 1.30, freq: 987,  dur: 0.95, gain: 0.75 }, // B5 — deep
  { offset: 2.00, freq: 1319, dur: 0.65, gain: 0.70 }, // E6 — accent
] as const;
const CYCLE = 2.8;

function scheduleNotes(ctx: AudioContext, durationSecs: number) {
  const cycles = Math.ceil(durationSecs / CYCLE);
  for (let c = 0; c < cycles; c++) {
    for (const n of NOTES) {
      const t = c * CYCLE + n.offset;
      if (t >= durationSecs) break;

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = n.freq;

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(n.gain, ctx.currentTime + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + n.dur);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + n.dur + 0.05);
    }
  }
}

/** WaitingScreen (TV): creates its own AudioContext each call. */
export function playChime(durationSecs = 10) {
  try {
    const ctx = new AudioContext();
    scheduleNotes(ctx, durationSecs);
  } catch { /* autoplay blocked */ }
}

/** Track (mobile): use the caller's persistent AudioContext (iOS Safari compat). */
export function playChimeWithCtx(ctx: AudioContext | null, durationSecs = 10) {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    scheduleNotes(ctx, durationSecs);
  } catch { /* autoplay blocked */ }
}
