// Personal driver bell chime, owned by the global selected-trip notifications.

// 4-note ding-dong pattern, one cycle ≈ 2.8 s.
const NOTES = [
  { offset: 0.00, freq: 1568, dur: 0.80, gain: 0.90 }, // G6 — ding
  { offset: 0.65, freq: 1175, dur: 0.80, gain: 0.80 }, // D6 — dong
  { offset: 1.30, freq: 987,  dur: 0.95, gain: 0.75 }, // B5 — deep
  { offset: 2.00, freq: 1319, dur: 0.65, gain: 0.70 }, // E6 — accent
] as const;
const CYCLE = 2.8;

type ChimeHandle = {
  stop: () => void;
};

function scheduleNotes(ctx: AudioContext, durationSecs: number): ChimeHandle {
  const nodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
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
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.frequency.value = n.freq;

      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(n.gain, ctx.currentTime + t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + n.dur);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + n.dur + 0.05);
      nodes.push({ osc, gain });
    }
  }

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      for (const { osc, gain } of nodes) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          osc.stop(now);
        } catch {
          // An oscillator that has already ended cannot be stopped again.
        }
      }
    },
  };
}

/** Track (mobile): use the caller's persistent AudioContext (iOS Safari compat). */
export function playChimeWithCtx(ctx: AudioContext | null, durationSecs = 10): ChimeHandle | null {
  if (!ctx) return null;
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return scheduleNotes(ctx, durationSecs);
  } catch {
    return null;
  }
}

/** Repeat only while the owning alert is open; stop cancels both timer and notes. */
export function playRepeatingChimeWithCtx(ctx: AudioContext | null): ChimeHandle | null {
  if (!ctx) return null;
  let current = playChimeWithCtx(ctx, 10);
  if (!current) return null;
  const timer = setInterval(() => {
    current?.stop();
    current = playChimeWithCtx(ctx, 10);
  }, 10_000);
  let stopped = false;
  return { stop: () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    current?.stop();
    current = null;
  } };
}
