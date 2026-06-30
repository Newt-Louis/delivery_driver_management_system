import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import jsQR from 'jsqr';

// ─── Session helpers ──────────────────────────────────────────────────────────
const T_TOKEN = 'kiosk_token';
const T_STAFF = 'kiosk_staff';
const T_EXP   = 'kiosk_exp';
const T_DEVICE = 'kiosk_device';
const D_CODE = 'kiosk_device_code';
const D_SECRET = 'kiosk_device_secret';

type KioskSession = { token: string; staffName: string; deviceCode?: string };

function loadSession(): KioskSession | null {
  const token     = sessionStorage.getItem(T_TOKEN);
  const staffName = sessionStorage.getItem(T_STAFF);
  const exp       = Number(sessionStorage.getItem(T_EXP) ?? 0);
  if (!token || !staffName || Date.now() > exp) {
    [T_TOKEN, T_STAFF, T_EXP, T_DEVICE].forEach(k => sessionStorage.removeItem(k));
    return null;
  }
  return {
    token,
    staffName,
    deviceCode: sessionStorage.getItem(T_DEVICE) ?? localStorage.getItem(D_CODE) ?? undefined,
  };
}
function saveSession(token: string, staffName: string, expiresIn: number, deviceCode?: string) {
  sessionStorage.setItem(T_TOKEN, token);
  sessionStorage.setItem(T_STAFF, staffName);
  sessionStorage.setItem(T_EXP, String(Date.now() + expiresIn * 1000));
  if (deviceCode) sessionStorage.setItem(T_DEVICE, deviceCode);
}
function clearSession() {
  [T_TOKEN, T_STAFF, T_EXP, T_DEVICE].forEach(k => sessionStorage.removeItem(k));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const UNIT_COLOR: Record<string, string> = {
  EMART: '#FF9500', THISKYHALL: '#27A55E', TENANT: '#4F46E5',
};
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  const match   = trimmed.match(/\/track\/([A-Z0-9]+)/i);
  return match ? match[1].toUpperCase() : trimmed.toUpperCase();
}
const BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? '';
const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

interface KioskBrand {
  mallName:   string;
  logoUrl:    string | null;
  tagline:    string | null;
  kioskBgUrl: string | null;
}

// ─── useWakeLock: keep screen on while kiosk is active ───────────────────────
type WakeLockHandle = { release(): Promise<void> };
function useWakeLock() {
  const lockRef = useRef<WakeLockHandle | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLockHandle> } };
    if (!nav.wakeLock) return;
    let cancelled = false;
    const acquire = () =>
      nav.wakeLock!.request('screen')
        .then(l => { if (!cancelled) lockRef.current = l; })
        .catch(() => {});
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lockRef.current?.release().catch(() => {});
    };
  }, []);
}

// ─── useKioskViewport: lock zoom on this page only ───────────────────────────
function useKioskViewport() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
    const orig = meta?.getAttribute('content') ?? 'width=device-width, initial-scale=1.0';
    meta?.setAttribute('content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    );
    return () => { meta?.setAttribute('content', orig); };
  }, []);
}

// ─── useFullscreen ────────────────────────────────────────────────────────────
function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const h = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggle = useCallback(async () => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?(): Promise<void>;
    };
    const doc = document as Document & { webkitExitFullscreen?(): Promise<void> };
    if (document.fullscreenElement) {
      await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
    }
  }, []);
  return { on, toggle };
}

// ─── Auth Phase ───────────────────────────────────────────────────────────────
function AuthPhase({ onAuth, brand }: {
  onAuth: (session: KioskSession) => void;
  brand: KioskBrand;
}) {
  const [pin,          setPin]          = useState('');
  const [deviceCode,   setDeviceCode]   = useState(() => localStorage.getItem(D_CODE) ?? '');
  const [deviceSecret, setDeviceSecret] = useState(() => localStorage.getItem(D_SECRET) ?? '');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useKioskViewport();
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedDeviceCode = deviceCode.trim().toUpperCase();
    if (pin.length < 4 || !normalizedDeviceCode || !deviceSecret) return;
    setError(''); setLoading(true);
    try {
      const res = await axios.post(`${BASE}/api/checkin/terminal-auth`, {
        pin,
        deviceCode: normalizedDeviceCode,
        deviceSecret,
      });
      const { terminalToken, staffName, expiresIn } = res.data;
      const activeDeviceCode = (res.data as { deviceCode?: string }).deviceCode ?? normalizedDeviceCode;
      localStorage.setItem(D_CODE, activeDeviceCode);
      localStorage.setItem(D_SECRET, deviceSecret);
      saveSession(terminalToken, staffName, expiresIn, activeDeviceCode);
      onAuth({ token: terminalToken, staffName, deviceCode: activeDeviceCode });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Không thể kích hoạt kiosk',
      );
      setPin(''); inputRef.current?.focus();
    } finally { setLoading(false); }
  }

  function clearDeviceConfig() {
    localStorage.removeItem(D_CODE);
    localStorage.removeItem(D_SECRET);
    setDeviceCode('');
    setDeviceSecret('');
    setError('');
  }

  const canSubmit = pin.length >= 4 && !!deviceCode.trim() && !!deviceSecret && !loading;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center select-none"
      style={{
        padding: '2rem env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        backgroundImage: brand.kioskBgUrl ? `url(${brand.kioskBgUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#1C1C1C',
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {brand.kioskBgUrl && <div className="absolute inset-0 bg-black/65" />}

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="text-center mb-8">
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt="" className="h-14 mx-auto mb-4 object-contain drop-shadow-lg" />
            : <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🔐</span>
              </div>}
          <h1 className="text-white font-black text-2xl tracking-widest">Kiosk Check-in</h1>
          <p className="text-white/40 text-sm mt-1">{brand.mallName}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-7 shadow-2xl">
          <div className="mb-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-black text-white/50 tracking-widest uppercase">
                Thiết bị
              </label>
              {(deviceCode || deviceSecret) && (
                <button
                  type="button"
                  onClick={clearDeviceConfig}
                  className="text-xs font-bold text-white/35 hover:text-red-300 transition-colors"
                >
                  Xóa cấu hình
                </button>
              )}
            </div>
            <input
              type="text"
              value={deviceCode}
              onChange={e => { setDeviceCode(e.target.value.toUpperCase().replace(/\s+/g, '')); setError(''); }}
              placeholder="KIOSK-LOC1"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white font-mono font-bold placeholder:text-white/25 focus:outline-none focus:border-sky-400 transition-colors"
            />
            <input
              type="password"
              value={deviceSecret}
              onChange={e => { setDeviceSecret(e.target.value); setError(''); }}
              placeholder="Device secret"
              autoComplete="current-password"
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>

          <label className="block text-xs font-black text-white/50 tracking-widest uppercase mb-3 text-center">
            Mã bảo vệ (4 chữ số)
          </label>
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="• • • •"
            className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-4 py-5 text-center text-4xl font-black tracking-[0.6em] text-white focus:outline-none focus:border-sky-400 transition-colors placeholder:text-white/20 placeholder:tracking-[0.4em]"
          />
          {error && (
            <div className="mt-3 text-sm text-red-300 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-center">
              ⚠️ {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 w-full py-4 rounded-2xl font-black text-white tracking-widest text-lg transition-all bg-sky-500 hover:bg-sky-400 active:scale-[0.97] disabled:opacity-30 touch-manipulation"
          >
            {loading ? 'Đang xác thực...' : 'Kích hoạt →'}
          </button>
        </form>

        <p className="text-center text-white/25 text-xs mt-5">
          Phiên hoạt động 8 giờ — không cần nhập lại trong ca
        </p>
      </div>
    </div>
  );
}

// ─── Camera Scanner ────────────────────────────────────────────────────────────
type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'insecure';

function CameraScanner({ onCode, active }: { onCode: (code: string) => void; active: boolean }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const lastCode  = useRef('');
  const lastTime  = useRef(0);
  const [status, setStatus] = useState<CameraStatus>('idle');

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame); return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(scanFrame); return; }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      const now = Date.now();
      if (code.data !== lastCode.current || now - lastTime.current > 3000) {
        lastCode.current = code.data; lastTime.current = now;
        onCode(code.data);
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [onCode]);

  const startCamera = useCallback(async () => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('insecure'); return;
    }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return; }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStatus('active');
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch { setStatus('denied'); }
  }, [scanFrame]);

  useEffect(() => {
    if (active) { startCamera(); } else { stopCamera(); setStatus('idle'); }
    return stopCamera;
  }, [active, startCamera, stopCamera]);

  if (!active) return null;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {status === 'active' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/30" />
          {/* Viewfinder */}
          <div className="relative z-10" style={{ width: '65vmin', height: '65vmin' }}>
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-10 h-10 border-white ${cls}`} />
            ))}
            <div className="absolute inset-x-2 h-0.5 bg-green-400 shadow-[0_0_10px_3px_rgba(74,222,128,0.9)] animate-scanline" />
          </div>
        </div>
      )}
      {status === 'active' && (
        <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none">
          <p className="text-white/80 text-sm font-semibold bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm animate-pulse">
            Đưa QR code vào khung
          </p>
        </div>
      )}
      {status === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white text-sm font-semibold">Đang mở camera...</p>
        </div>
      )}
      {status === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-8 text-center">
          <span className="text-5xl mb-4">🚫</span>
          <p className="text-white font-bold text-lg mb-2">Camera bị chặn</p>
          <p className="text-white/50 text-sm leading-relaxed">
            Vào cài đặt trình duyệt → cấp quyền Camera cho trang này rồi tải lại
          </p>
        </div>
      )}
      {status === 'insecure' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-8 text-center">
          <span className="text-5xl mb-4">🔒</span>
          <p className="text-white font-bold text-lg mb-2">Cần truy cập HTTPS</p>
          <p className="text-white/50 text-sm leading-relaxed mb-5">
            Camera chỉ hoạt động trên kết nối an toàn.<br />
            Truy cập địa chỉ HTTPS bên dưới:
          </p>
          <p className="text-sky-400 font-mono text-sm bg-white/10 rounded-xl px-4 py-3 break-all">
            {typeof window !== 'undefined'
              ? window.location.href.replace(/^http:/, 'https:').replace(/:3000(\/|$)/, ':3443$1')
              : 'https://[server-ip]:3443/kiosk'}
          </p>
          <p className="text-white/30 text-xs mt-4">Chấp nhận cảnh báo chứng chỉ một lần là xong</p>
        </div>
      )}
      {status === 'unsupported' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-8 text-center">
          <span className="text-5xl mb-4">📵</span>
          <p className="text-white font-bold text-lg mb-2">Không hỗ trợ camera</p>
          <p className="text-white/50 text-sm">Dùng tab Quét mã hoặc Biển số bên dưới</p>
        </div>
      )}
    </div>
  );
}

// ─── Scan Phase ───────────────────────────────────────────────────────────────
type ScanMode = 'camera' | 'code' | 'plate';

interface CheckInResult {
  type: 'checked_in' | 'waiting' | 'receiving_started' | 'completed'
      | 'already' | 'wrong_date' | 'error';
  ticketCode?: string;
  vehiclePlate?: string;
  driverName?: string;
  unit?: string;
  slotName?: string;
  message: string;
}

function ScanPhase({ staffName, token, deviceCode, onExpired, brand }: {
  staffName: string;
  token: string;
  deviceCode?: string;
  onExpired: () => void;
  brand: KioskBrand;
}) {
  const [mode,       setMode]       = useState<ScanMode>(() => isTouchDevice() ? 'camera' : 'code');
  const [input,      setInput]      = useState('');
  const [plateInput, setPlateInput] = useState('');
  const [plateError, setPlateError] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<CheckInResult | null>(null);
  const [clock,      setClock]      = useState(() => new Date());

  const inputRef   = useRef<HTMLInputElement>(null);
  const plateRef   = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWakeLock();
  useKioskViewport();
  const { on: isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (result || loading) return;
    if (mode === 'code')  setTimeout(() => inputRef.current?.focus(), 50);
    if (mode === 'plate') setTimeout(() => plateRef.current?.focus(), 50);
  }, [mode, result, loading]);

  function scheduleReset(ms = 5000) {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => { setResult(null); setInput(''); setPlateInput(''); }, ms);
  }

  const performCheckin = useCallback(async (raw: string) => {
    const code = extractCode(raw);
    if (!code) return;
    setLoading(true); setResult(null);
    try {
      const res = await axios.post(
        `${BASE}/api/checkin/scan`,
        { registrationCode: code },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const { action, delivery, ticketCode, slotInfo } = res.data as {
        action:    string;
        delivery:  { vehiclePlate: string; driverName: string; receivingUnit: string };
        ticketCode?: string;
        slotInfo?: { code: string; name: string; zone?: { name: string } };
      };

      if (action === 'CHECKED_IN') {
        setResult({
          type: 'checked_in', ticketCode,
          vehiclePlate: delivery.vehiclePlate, driverName: delivery.driverName,
          unit: delivery.receivingUnit, message: 'Check-in thành công!',
        });
        scheduleReset(6000);
      } else if (action === 'WAITING') {
        setResult({
          type: 'waiting', ticketCode,
          vehiclePlate: delivery.vehiclePlate,
          message: (res.data as { message?: string }).message ?? 'Đang trong hàng chờ, chưa được gọi',
        });
        scheduleReset(4000);
      } else if (action === 'RECEIVING_STARTED') {
        const slotName = slotInfo
          ? `${slotInfo.name}${slotInfo.zone ? ' · ' + slotInfo.zone.name : ''}`
          : undefined;
        setResult({
          type: 'receiving_started', slotName,
          vehiclePlate: delivery.vehiclePlate, driverName: delivery.driverName,
          unit: delivery.receivingUnit, message: 'Bắt đầu nhận hàng',
        });
        scheduleReset(6000);
      } else if (action === 'COMPLETED') {
        setResult({
          type: 'completed',
          vehiclePlate: delivery.vehiclePlate, driverName: delivery.driverName,
          unit: delivery.receivingUnit, message: 'Giao hàng hoàn thành',
        });
        scheduleReset(6000);
      }
    } catch (err: unknown) {
      const httpStatus = (err as { response?: { status?: number } })?.response?.status;
      const errData    = (err as { response?: { data?: { error?: string; delivery?: { status?: string } } } })?.response?.data;
      if (httpStatus === 401) { clearSession(); onExpired(); return; }
      const type: CheckInResult['type'] =
        errData?.error?.includes('lên lịch')          ? 'wrong_date'
        : errData?.delivery?.status === 'COMPLETED'   ? 'already'
        : 'error';
      setResult({ type, message: errData?.error ?? 'Có lỗi xảy ra. Thử lại.' });
      scheduleReset(5000);
    } finally { setLoading(false); }
  }, [token, onExpired]);

  async function lookupByPlate() {
    const plate = plateInput.trim().toUpperCase().replace(/\s+/g, '');
    if (!plate) return;
    setPlateError(''); setLoading(true);
    try {
      const res = await axios.get(`${BASE}/api/track/search?plate=${encodeURIComponent(plate)}`);
      const { registrationCode } = res.data as { registrationCode: string };
      setPlateInput('');
      await performCheckin(registrationCode);
    } catch (err: unknown) {
      setPlateError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Không tìm thấy biển số này',
      );
    } finally { setLoading(false); }
  }

  const timeStr     = clock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const timeFull    = clock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr     = clock.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const TABS: { id: ScanMode; icon: string; label: string }[] = [
    { id: 'camera', icon: '📷', label: 'Camera' },
    { id: 'code',   icon: '⌨',  label: 'Quét mã' },
    { id: 'plate',  icon: '🚗',  label: 'Biển số' },
  ];

  const hasBg = !!brand.kioskBgUrl;

  return (
    <div
      className="fixed inset-0 flex flex-col select-none"
      style={{
        touchAction: 'manipulation',
        backgroundImage: hasBg ? `url(${brand.kioskBgUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#1C1C1C',
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* bg overlay */}
      {hasBg && <div className="absolute inset-0 bg-black/60 pointer-events-none z-0" />}

      {/* ── Header ── */}
      <header
        className="shrink-0 h-12 bg-black/70 backdrop-blur-md border-b border-white/10 flex items-center px-3 gap-2 relative z-20"
        style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
      >
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt="" className="h-6 w-auto object-contain flex-shrink-0" />
          : <span className="text-base flex-shrink-0">🏪</span>}
        <span className="text-white font-black text-sm flex-1 truncate">{brand.mallName}</span>
        <span className="text-white font-mono font-bold text-sm tabular-nums">{timeStr}</span>
        <span className="text-white/20 text-xs mx-1">·</span>
        {deviceCode && (
          <>
            <span className="text-white/40 text-xs truncate max-w-[92px]">{deviceCode}</span>
            <span className="text-white/20 text-xs mx-1">·</span>
          </>
        )}
        <span className="text-white/40 text-xs truncate max-w-[80px]">{staffName}</span>

        <button
          onClick={toggleFullscreen}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors text-base touch-manipulation ml-1"
          title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
        >
          {isFullscreen ? '⊡' : '⊞'}
        </button>

        <button
          onClick={() => { clearSession(); onExpired(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm touch-manipulation"
          title="Đổi ca"
        >
          ↩
        </button>
      </header>

      {/* ── Content area ── */}
      <main className="flex-1 overflow-hidden relative z-10">

        {/* RESULT OVERLAYS */}
        {result && (() => {
          const dismiss = () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
            setResult(null); setInput(''); setPlateInput('');
          };
          const unitBg = UNIT_COLOR[result.unit ?? ''] ?? '#4F46E5';

          if (result.type === 'checked_in') return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
                 style={{ background: unitBg }} onClick={dismiss}>
              <div className="text-7xl mb-3">✅</div>
              <p className="text-white/70 font-bold text-sm uppercase tracking-[0.2em] mb-2">Scan 1 · Check-in</p>
              <p className="text-white font-black leading-none font-mono"
                 style={{ fontSize: 'clamp(3rem, 18vw, 6rem)' }}>
                {result.ticketCode}
              </p>
              <p className="text-white/80 text-xl font-bold mt-4">
                {result.vehiclePlate}{result.driverName ? ` · ${result.driverName}` : ''}
              </p>
              <p className="text-white/50 text-sm mt-5">Chờ số thẻ xuất hiện trên màn hình để vào dock</p>
              <p className="text-white/25 text-xs mt-6">Chạm để tiếp tục</p>
            </div>
          );

          if (result.type === 'waiting') return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center cursor-pointer bg-amber-950"
                 onClick={dismiss}>
              <div className="text-7xl mb-3">⏳</div>
              <p className="text-amber-400 font-black text-2xl mb-2">Đang trong hàng chờ</p>
              {result.ticketCode && (
                <p className="text-white font-black font-mono text-4xl mb-2">{result.ticketCode}</p>
              )}
              <p className="text-amber-200/70 text-base px-4">{result.message}</p>
              <p className="text-amber-900 text-xs mt-8">Chạm để tiếp tục</p>
            </div>
          );

          if (result.type === 'receiving_started') return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center cursor-pointer"
                 style={{ background: unitBg }} onClick={dismiss}>
              <div className="text-7xl mb-3">🔧</div>
              <p className="text-white/70 font-bold text-sm uppercase tracking-[0.2em] mb-2">Scan 2 · Bắt đầu nhận hàng</p>
              <p className="text-white font-black text-3xl mb-1">{result.vehiclePlate}</p>
              {result.driverName && <p className="text-white/70 text-lg mb-4">{result.driverName}</p>}
              {result.slotName && (
                <div className="bg-white/20 rounded-2xl px-6 py-4 mt-2">
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Dock nhận hàng</p>
                  <p className="text-white font-black text-2xl">{result.slotName}</p>
                </div>
              )}
              <p className="text-white/25 text-xs mt-8">Chạm để tiếp tục</p>
            </div>
          );

          if (result.type === 'completed') return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center cursor-pointer bg-emerald-950"
                 onClick={dismiss}>
              <div className="text-8xl mb-3">🎉</div>
              <p className="text-emerald-400 font-black text-2xl mb-2">Scan 3 · Hoàn thành!</p>
              <p className="text-white font-bold text-xl">
                {result.vehiclePlate}{result.driverName ? ` · ${result.driverName}` : ''}
              </p>
              <p className="text-emerald-300/60 text-sm mt-4">Xe có thể rời bến — cảm ơn!</p>
              <p className="text-emerald-900 text-xs mt-8">Chạm để tiếp tục</p>
            </div>
          );

          const errorConfig: Record<string, { icon: string; title: string; color: string }> = {
            already:    { icon: '⚠️', title: 'Đã hoàn thành rồi',   color: 'text-yellow-400' },
            wrong_date: { icon: '📅', title: 'Sai ngày đăng ký',     color: 'text-orange-400' },
            error:      { icon: '❌', title: 'Không thể thực hiện',  color: 'text-red-400'    },
          };
          const cfg = errorConfig[result.type] ?? errorConfig.error;
          return (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center cursor-pointer bg-thiso-900"
                 onClick={dismiss}>
              <div className="text-7xl mb-4">{cfg.icon}</div>
              <p className={`font-black text-2xl mb-3 ${cfg.color}`}>{cfg.title}</p>
              <p className="text-white/60 text-base px-4 leading-relaxed">{result.message}</p>
              <p className="text-white/25 text-xs mt-8">Chạm để tiếp tục</p>
            </div>
          );
        })()}

        {/* LOADING */}
        {!result && loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white animate-spin mb-5" />
            <p className="text-white font-bold text-xl">Đang xử lý...</p>
          </div>
        )}

        {/* CAMERA TAB */}
        {!result && !loading && mode === 'camera' && (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 overflow-hidden">
              <CameraScanner active={true} onCode={performCheckin} />
            </div>
            <div className="shrink-0 bg-black/75 backdrop-blur-sm px-4 py-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { performCheckin(input); setInput(''); } }}
                placeholder="Hoặc nhập mã đăng ký..."
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder:text-white/30 focus:outline-none focus:border-white/50 min-w-0"
                autoComplete="off"
              />
              {input && (
                <button
                  onClick={() => { performCheckin(input); setInput(''); }}
                  className="px-4 py-3 bg-sky-500 active:bg-sky-400 rounded-xl text-white font-bold text-sm touch-manipulation shrink-0"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        )}

        {/* CODE TAB — attract screen with clock */}
        {!result && !loading && mode === 'code' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-3">
            {/* Identity */}
            <div className="text-center">
              {brand.logoUrl && (
                <img src={brand.logoUrl} alt="" className="h-9 mx-auto mb-2 object-contain drop-shadow-lg opacity-80" />
              )}
              {!brand.logoUrl && (
                <p className="text-white/30 text-xs font-semibold tracking-widest uppercase mb-1">{brand.mallName}</p>
              )}
              <p className="text-white/25 text-[11px] tracking-widest uppercase">{brand.tagline ?? 'Check-in hệ thống'}</p>
            </div>

            {/* Clock */}
            <p
              className="text-white font-black tabular-nums leading-none select-none"
              style={{ fontSize: 'clamp(3.5rem, 16vw, 6rem)', textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}
            >
              {timeFull}
            </p>
            <p className="text-white/30 text-xs font-medium -mt-1">{dateStr}</p>

            {/* Frosted input card */}
            <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/15 shadow-2xl mt-1">
              <p className="text-center text-white/40 text-xs font-bold uppercase tracking-widest mb-3">
                ⌨ Quét barcode hoặc nhập mã đăng ký
              </p>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { performCheckin(input); setInput(''); } }}
                placeholder="Mã đăng ký..."
                autoComplete="off" autoCorrect="off" spellCheck={false}
                className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-5 py-4 text-white text-center text-xl font-mono font-bold placeholder:text-white/20 focus:outline-none focus:border-sky-400 transition-colors"
              />
              {input && (
                <button
                  onClick={() => { performCheckin(input); setInput(''); }}
                  className="mt-3 w-full py-4 rounded-2xl bg-sky-500 active:bg-sky-400 text-white font-black text-lg transition-colors touch-manipulation"
                >
                  Check-in ↵
                </button>
              )}
            </div>
          </div>
        )}

        {/* PLATE TAB — attract screen with plate input */}
        {!result && !loading && mode === 'plate' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-3">
            <div className="text-center">
              {brand.logoUrl && (
                <img src={brand.logoUrl} alt="" className="h-9 mx-auto mb-2 object-contain drop-shadow-lg opacity-80" />
              )}
              <p className="text-white/25 text-[11px] tracking-widest uppercase">{brand.mallName}</p>
            </div>

            <p
              className="text-white font-black tabular-nums leading-none select-none"
              style={{ fontSize: 'clamp(3.5rem, 16vw, 6rem)', textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}
            >
              {timeFull}
            </p>
            <p className="text-white/30 text-xs font-medium -mt-1">{dateStr}</p>

            {/* Frosted plate card */}
            <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/15 shadow-2xl mt-1">
              <p className="text-center text-white/40 text-xs font-bold uppercase tracking-widest mb-3">
                🚗 Nhập biển số xe để tra cứu
              </p>
              <input
                ref={plateRef}
                type="text"
                value={plateInput}
                onChange={e => { setPlateInput(e.target.value.toUpperCase()); setPlateError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') lookupByPlate(); }}
                placeholder="VD: 51F-123.45"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                inputMode="text"
                className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-5 py-5 text-white text-center font-mono font-black placeholder:text-white/20 placeholder:font-normal focus:outline-none focus:border-sky-400 transition-colors"
                style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)', letterSpacing: '0.15em' }}
              />
              {plateError && (
                <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                  ⚠️ {plateError}
                </div>
              )}
              <button
                onClick={lookupByPlate}
                disabled={!plateInput.trim() || loading}
                className="mt-4 w-full py-4 rounded-2xl font-black text-white text-lg tracking-wider transition-all bg-sky-500 active:bg-sky-400 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
              >
                Tìm & Check-in →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom tab bar ── */}
      <nav
        className="shrink-0 bg-black/75 backdrop-blur-md border-t border-white/10 grid grid-cols-3 relative z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { if (!result && !loading) setMode(tab.id); }}
            className={`flex flex-col items-center justify-center h-16 gap-1 transition-all touch-manipulation active:scale-95 ${
              mode === tab.id && !result && !loading
                ? 'text-sky-400'
                : 'text-white/30'
            }`}
          >
            <span className="text-2xl leading-none">{tab.icon}</span>
            <span className="text-xs font-bold">{tab.label}</span>
            {mode === tab.id && !result && !loading && (
              <span className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] w-8 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Kiosk() {
  const [session, setSession] = useState<KioskSession | null>(
    () => loadSession(),
  );
  const [brand, setBrand] = useState<KioskBrand>({
    mallName: 'THISO GROUP', logoUrl: null, tagline: 'Delivery Management System', kioskBgUrl: null,
  });

  useEffect(() => {
    axios.get(`${BASE}/api/brand`)
      .then(res => setBrand(res.data.mall as KioskBrand))
      .catch(() => {});
  }, []);

  return session ? (
    <ScanPhase
      staffName={session.staffName}
      token={session.token}
      deviceCode={session.deviceCode}
      onExpired={() => setSession(null)}
      brand={brand}
    />
  ) : (
    <AuthPhase onAuth={setSession} brand={brand} />
  );
}
