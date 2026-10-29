// iOS requires AudioContext to be created from a user gesture, so we init it
// lazily on the first touch/click and reuse the instance afterwards.
const audioCtxRef: { current: AudioContext | null } = { current: null };

export function isDeviceAudioReady(): boolean {
  return audioCtxRef.current?.state === 'running';
}

export function ensureAudio(): AudioContext | null {
  if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) audioCtxRef.current = new AC();
  }
  if (audioCtxRef.current?.state === 'suspended') void audioCtxRef.current.resume().catch(() => {});
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

export function buzz(pattern: number[]): boolean {
  const vibrate = (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate;
  if (typeof vibrate !== 'function') return false;
  try { return vibrate.call(navigator, pattern); } catch { return false; }
}

