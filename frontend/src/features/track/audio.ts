// iOS requires AudioContext to be created from a user gesture, so we init it
// lazily on the first touch/click and reuse the instance afterwards.
const audioCtxRef: { current: AudioContext | null } = { current: null };

export function ensureAudio(): AudioContext | null {
  if (!audioCtxRef.current) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) audioCtxRef.current = new AC();
  }
  if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
  return audioCtxRef.current ?? null;
}

// Play a 0-volume buffer to fully unlock AudioContext on iOS Safari.
// Must be called inside a user-gesture handler (touchstart / click).
export function unlockIOSAudio() {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    src.disconnect();
  } catch { /* ignore */ }
}

export function playBeeps(pattern: { freq: number; start: number; dur: number }[]) {
  const ctx = ensureAudio();
  if (!ctx) return;
  for (const { freq, start, dur } of pattern) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }
}

export function buzz(pattern: number[]): boolean {
  const vibrate = (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate;
  if (typeof vibrate !== 'function') return false;
  try { return vibrate.call(navigator, pattern); } catch { return false; }
}

export function sendNotification(title: string, body: string, tag: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag, icon: '/icons/icon-192.png' }); } catch {}
  }
}
