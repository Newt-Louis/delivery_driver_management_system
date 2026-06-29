import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../lib/api';
import { playChimeWithCtx } from '../lib/chime';
import { registerAppServiceWorker, urlBase64ToUint8Array } from '../lib/pwa';
import { getPushPlatformSupport } from '../lib/platform';
import { useSocket } from '../context/SocketContext';
import { saveDeliverySession, removeDeliverySession } from '../lib/session';

interface TrackCallLog {
  id: string;
  calledAt: string;
  message: string;
  slot: { id: string; code: string; name: string } | null;
}

interface TrackSlot {
  id: string;
  code: string;
  name: string;
  zone: { id: string; code: string; name: string } | null;
}

interface QueueInfo {
  position: number;
  totalWaiting: number;
  estimatedWaitMinutes: number;
  availableSlots: number;
  avgReceivingMinutes: number;
  sampleCount: number;
  confidence: 'high' | 'medium' | 'low';
  estimatedCallTime: string | null;
}

interface TrackDelivery {
  id: string;
  registrationCode: string;
  vendorName: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  receivingUnit: string;
  goodsType: string;
  vehicleType: string;
  poNumber: string | null;
  requestedTime: string | null;
  checkinTime: string | null;
  calledTime: string | null;
  receivingStartTime: string | null;
  completedTime: string | null;
  status: string;
  assignedSlot: TrackSlot | null;
  callLogs: TrackCallLog[];
  autoWarehouse: boolean;
  ticketNumber: number | null;
  note: string | null;
  createdAt: string;
  queueInfo: QueueInfo | null;
}

// ─── Ticket code formatting ───────────────────────────────────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = {
  EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL',
};
const VT_TICKET_PREFIX: Record<string, string> = {
  TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X',
};
function formatTicketCode(unit: string, vehicleType: string, n: number): string {
  const up = UNIT_TICKET_PREFIX[unit] ?? unit;
  const vp = VT_TICKET_PREFIX[vehicleType] ?? 'X';
  return `${up}-${vp}${String(n).padStart(3, '0')}`;
}

const STATUS_INFO: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  REGISTERED:               { icon: '🕐', label: 'Chờ check-in tại cổng',      color: 'text-thiso-600',  bg: 'bg-thiso-50',    border: 'border-thiso-200'  },
  WAITING:                  { icon: '⏳', label: 'Đã check-in — Đang chờ gọi', color: 'text-yellow-700', bg: 'bg-yellow-50',   border: 'border-yellow-200' },
  CALLED:                   { icon: '📢', label: 'Được gọi vào dock',           color: 'text-sky-700',    bg: 'bg-sky-50',      border: 'border-sky-200'    },
  RECEIVING:                { icon: '📦', label: 'Đang nhận hàng',              color: 'text-blue-700',   bg: 'bg-blue-50',     border: 'border-blue-200'   },
  AUTO_WAREHOUSE_RECEIVING: { icon: '🏭', label: 'Đang nhận — Kho tự động',    color: 'text-purple-700', bg: 'bg-purple-50',   border: 'border-purple-200' },
  COMPLETED:                { icon: '✅', label: 'Giao hàng hoàn thành',        color: 'text-green-700',  bg: 'bg-green-50',    border: 'border-green-200'  },
  CANCELLED:                { icon: '❌', label: 'Đã hủy',                      color: 'text-red-700',    bg: 'bg-red-50',      border: 'border-red-200'    },
};


const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD:    '🌿 Tươi sống',
  AUTO_WAREHOUSE:'🏭 Kho tự động',
  GENERAL_GOODS: '📦 Hàng thường',
  THI_CONG:      '🔨 Thi công',
};

const UNIT_LABEL: Record<string, string> = {
  EMART:      'Emart',
  THISKYHALL: 'Thiskyhall',
  TENANT:     'Mall (Khách thuê)',
};

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  });
}


// ─── Alert helpers ────────────────────────────────────────────────────────────

// iOS requires AudioContext to be created from a user gesture, so we init it
// lazily on the first touch/click and reuse the instance afterwards.
const audioCtxRef: { current: AudioContext | null } = { current: null };

function ensureAudio(): AudioContext | null {
  if (!audioCtxRef.current) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) audioCtxRef.current = new AC();
  }
  if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
  return audioCtxRef.current ?? null;
}

// Play a 0-volume buffer to fully unlock AudioContext on iOS Safari.
// Must be called inside a user-gesture handler (touchstart / click).
function unlockIOSAudio() {
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

function playBeeps(pattern: { freq: number; start: number; dur: number }[]) {
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

function buzz(pattern: number[]) {
  const vibrate = (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate;
  if (typeof vibrate !== 'function') return false;
  try {
    return vibrate.call(navigator, pattern);
  } catch {
    return false;
  }
}

function sendNotification(title: string, body: string, tag: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag, icon: '/icons/icon-192.png' }); } catch {}
  }
}

// ─── Main Track page ──────────────────────────────────────────────────────────

// ─── Lookup form (when /track is accessed without a code) ────────────────────

// Registration codes look like E260612001 / T260612001 / M260612001 (letter + 9+ chars).
// Everything else is treated as a plate number.
function looksLikeCode(val: string): boolean {
  return /^[ETM]\d{7,}/.test(val);
}

function TrackLookup() {
  const navigate = useNavigate();
  const [input, setInput]       = useState('');
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim().toUpperCase();
    if (!val) return;
    setError('');
    setChecking(true);
    try {
      if (looksLikeCode(val)) {
        await api.get(`/api/track/${val}`);
        navigate(`/track/${val}`);
      } else {
        const res = await api.get<{ registrationCode: string }>('/api/track/search', { params: { plate: val } });
        navigate(`/track/${res.data.registrationCode}`);
      }
    } catch {
      setError('Không tìm thấy. Kiểm tra lại mã đăng ký hoặc biển số xe.');
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-thiso-900 flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="text-center">
          <div className="text-4xl mb-3">🚛</div>
          <h1 className="text-white font-black text-xl mb-1">Theo dõi giao hàng</h1>
          <p className="text-thiso-400 text-sm">Nhập mã đăng ký hoặc biển số xe</p>
        </div>

        {/* Input card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-xl space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(''); }}
            placeholder="Mã đăng ký hoặc biển số xe..."
            className="w-full border-2 border-thiso-200 rounded-xl px-4 py-3.5 text-base font-mono font-black tracking-widest text-thiso-900 placeholder:text-thiso-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-thiso-500 transition-colors"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            style={{ fontSize: '16px' }}
          />

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!input.trim() || checking}
            className="w-full py-3.5 rounded-xl font-black text-white text-base transition-all
              bg-thiso-800 hover:bg-thiso-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {checking ? 'Đang tìm...' : 'Xem trạng thái →'}
          </button>

          <p className="text-center text-[11px] text-thiso-400">
            Chưa đăng ký?{' '}
            <a href="/register" className="text-thiso-600 underline font-semibold">Đăng ký ngay</a>
          </p>
        </form>
      </div>
    </div>
  );
}

function TrackContent({ code }: { code: string }) {
  const socket = useSocket();
  const pushSupport = getPushPlatformSupport();
  const [delivery, setDelivery]           = useState<TrackDelivery | null>(null);
  const [loading, setLoading]             = useState(true);
  const [fetchErr, setFetchErr]           = useState('');
  const [qrDataUrl, setQrDataUrl]         = useState('');
  const [qrExpanded, setQrExpanded]       = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [statusAlert, setStatusAlert] = useState<{
    title: string; body: string; level: 'urgent' | 'info';
  } | null>(null);
  const [queueBanner, setQueueBanner] = useState<{
    pos: number; diff: number; isUrgent: boolean;
  } | null>(null);
  const prevStatusRef   = useRef<string | null>(null);
  const prevPositionRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release(): Promise<void> } | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [deviceAlertsReady, setDeviceAlertsReady] = useState(
    () => localStorage.getItem('track_device_alerts_ready') === '1',
  );
  const normalizedCode = code.trim().toUpperCase();
  const trackUrl = `${window.location.origin}/track/${code}`;

  function primeDeviceAlerts() {
    ensureAudio();
    unlockIOSAudio();
    buzz([40]);
    localStorage.setItem('track_device_alerts_ready', '1');
    setDeviceAlertsReady(true);
  }

  // Unlock AudioContext on first user touch (required by iOS Safari).
  // Also call unlockIOSAudio to play a silent buffer so subsequent
  // programmatic sounds work without another gesture.
  useEffect(() => {
    const init = () => { primeDeviceAlerts(); };
    document.addEventListener('touchstart', init, { once: true });
    document.addEventListener('click',      init, { once: true });
    return () => {
      document.removeEventListener('touchstart', init);
      document.removeEventListener('click',      init);
    };
  }, []);

  // Register Service Worker and subscribe to push notifications
  const subscribePush = useCallback(async (deliveryRegistrationCode: string) => {
    if (!pushSupport.supported) {
      console.warn('[Push] unsupported platform:', pushSupport);
      return;
    }
    try {
      const { data } = await api.get<{ publicKey: string }>('/api/push/vapid-public-key');
      if (!data.publicKey) return;
      const reg = await registerAppServiceWorker();
      if (!reg) return;
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
      }
      await api.post('/api/push/subscribe', {
        subscription: sub.toJSON(),
        deliveryCode: deliveryRegistrationCode,
      });
      setPushEnabled(true);
    } catch (err) {
      console.warn('[Push] subscription failed:', err);
    }
  }, [pushSupport.supported]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-subscribe when permission already granted
  useEffect(() => {
    if (!delivery || pushEnabled) return;
    if (delivery.status === 'COMPLETED' || delivery.status === 'CANCELLED') return;
    if (notifPermission === 'granted') void subscribePush(delivery.registrationCode);
  }, [delivery?.registrationCode, delivery?.status, notifPermission, pushEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-request notification permission on component mount (if not already decided)
  useEffect(() => {
    if (!pushSupport.supported || typeof Notification === 'undefined') return;
    if (pushSupport.platform === 'ios') return;
    if (notifPermission !== 'default') return; // Already granted or denied

    // Auto-request after a short delay to let page settle
    const timer = setTimeout(() => {
      console.log('[Track] Auto-requesting notification permission');
      Notification.requestPermission().then((p) => {
        console.log('[Track] Notification permission result:', p);
        setNotifPermission(p);
        if (p === 'granted' && delivery) {
          void subscribePush(delivery.registrationCode);
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [pushSupport.supported, notifPermission, delivery, subscribePush]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss non-urgent status alerts after 10 s
  useEffect(() => {
    if (!statusAlert || statusAlert.level === 'urgent') return;
    const t = setTimeout(() => setStatusAlert(null), 10_000);
    return () => clearTimeout(t);
  }, [statusAlert]);

  // Auto-dismiss queue banner after 7 s
  useEffect(() => {
    if (!queueBanner) return;
    const t = setTimeout(() => setQueueBanner(null), 7_000);
    return () => clearTimeout(t);
  }, [queueBanner]);

  // Screen Wake Lock — keeps the phone screen on while delivery is active.
  // Supports: Chrome Android 84+, Safari iOS 16.4+.
  useEffect(() => {
    const terminal = !delivery ||
      delivery.status === 'COMPLETED' ||
      delivery.status === 'CANCELLED';

    async function acquire() {
      if (!('wakeLock' in navigator) || wakeLockRef.current) return;
      try {
        type WL = { release(): Promise<void>; addEventListener(e: string, h: () => void): void };
        const wl = await (navigator as unknown as { wakeLock: { request(t: string): Promise<WL> } })
          .wakeLock.request('screen') as WL;
        wakeLockRef.current = wl;
        setWakeLockActive(true);
        // System can revoke the lock (battery saver, tab switch)
        wl.addEventListener('release', () => {
          wakeLockRef.current = null;
          setWakeLockActive(false);
        });
      } catch { /* not supported or permission denied */ }
    }

    function release() {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }

    if (terminal) { release(); return; }

    acquire();

    // Re-acquire after coming back to foreground (system revokes lock on tab switch)
    // Also immediately re-fetch so any missed status changes trigger alerts.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        acquire();
        fetchDelivery();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      // Release only when delivery becomes terminal or component unmounts
      release();
    };
  }, [delivery?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    QRCode.toDataURL(trackUrl, {
      width: 320, margin: 2,
      color: { dark: '#1C1C1C', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [trackUrl]);

  const fetchDelivery = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const res = await api.get<TrackDelivery>(`/api/track/${normalizedCode}`);
      setDelivery(res.data);
      setFetchErr('');
      if (res.data.status === 'COMPLETED' || res.data.status === 'CANCELLED' || res.data.status === 'EXPIRED') {
        removeDeliverySession(normalizedCode);
      } else {
        saveDeliverySession(normalizedCode);
      }
    } catch {
      setFetchErr('Không tìm thấy lượt đăng ký.');
      removeDeliverySession(normalizedCode);
    } finally {
      setLoading(false);
    }
  }, [normalizedCode]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  useEffect(() => {
    if (!normalizedCode) return;

    const joinTrackRoom = () => {
      if (!socket.connected) socket.connect();
      socket.emit('track:join', normalizedCode, (ack?: { ok: boolean; error?: string }) => {
        if (ack && !ack.ok) console.warn('[Track] join failed:', ack.error);
      });
    };

    const handleTrackUpdated = (next: TrackDelivery) => {
      if (next.registrationCode?.toUpperCase() !== normalizedCode) return;
      setDelivery(next);
      setFetchErr('');
      setLoading(false);
    };

    const syncNow = () => {
      joinTrackRoom();
      void fetchDelivery();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncNow();
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'track-push-received') syncNow();
    };

    joinTrackRoom();
    socket.on('connect', joinTrackRoom);
    socket.io.on('reconnect', syncNow);
    socket.on('track_updated', handleTrackUpdated);
    window.addEventListener('focus', syncNow);
    window.addEventListener('pageshow', syncNow);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      socket.emit('track:leave', normalizedCode);
      socket.off('connect', joinTrackRoom);
      socket.io.off('reconnect', syncNow);
      socket.off('track_updated', handleTrackUpdated);
      window.removeEventListener('focus', syncNow);
      window.removeEventListener('pageshow', syncNow);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [socket, normalizedCode, fetchDelivery]);

  // Detect status transitions and fire alerts
  useEffect(() => {
    if (!delivery) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = delivery.status;
    if (prev === null || prev === delivery.status) return; // skip first load

    if (delivery.status === 'CALLED') {
      const slot = delivery.assignedSlot?.code ?? 'dock';
      buzz([300, 150, 300, 150, 600, 150, 600]);
      playChimeWithCtx(ensureAudio(), 10); // 10-second bell, same as waiting screen
      sendNotification(`🚛 Xe bạn được gọi vào ${slot}!`, delivery.vehiclePlate, 'called');
      setStatusAlert({ title: `🚛 Được gọi vào ${slot}!`, body: `${delivery.vehiclePlate} — Di chuyển vào dock ngay`, level: 'urgent' });
    } else if (delivery.status === 'WAITING') {
      buzz([120]);
      playBeeps([{ freq: 660, start: 0, dur: 0.3 }]);
      sendNotification('✅ Check-in thành công!', `${delivery.vehiclePlate} đang chờ gọi vào dock`, 'waiting');
      setStatusAlert({ title: '✅ Check-in thành công!', body: 'Vui lòng vào khu vực chờ xe', level: 'info' });
    } else if (delivery.status === 'COMPLETED') {
      buzz([200, 100, 400]);
      playBeeps([{ freq: 880, start: 0, dur: 0.15 }, { freq: 1100, start: 0.2, dur: 0.5 }]);
      sendNotification('✅ Giao hàng hoàn thành!', delivery.vehiclePlate, 'completed');
      setStatusAlert({ title: '✅ Giao hàng hoàn thành!', body: 'Cảm ơn bạn — bạn có thể rời đi', level: 'info' });
    }
  }, [delivery?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track queue position changes for WAITING deliveries
  useEffect(() => {
    if (delivery?.status !== 'WAITING' || !delivery.queueInfo) {
      if (delivery?.status !== 'WAITING') prevPositionRef.current = null;
      return;
    }
    const newPos = delivery.queueInfo.position;
    const prevPos = prevPositionRef.current;
    prevPositionRef.current = newPos;

    if (prevPos === null || prevPos === newPos) return; // first load or no change

    const isUrgent = newPos <= 5;
    const diff = prevPos - newPos; // positive = moved forward

    if (isUrgent) {
      buzz([200, 100, 200, 100, 400]);
      playBeeps([
        { freq: 880,  start: 0,    dur: 0.15 },
        { freq: 1100, start: 0.2,  dur: 0.15 },
        { freq: 1320, start: 0.4,  dur: 0.35 },
      ]);
      sendNotification(
        `⚡ Sắp đến lượt bạn! Vị trí #${newPos}`,
        `Còn ${newPos} lượt nữa — chuẩn bị sẵn sàng`,
        'queue-urgent',
      );
    } else if (diff > 0) {
      buzz([80]);
      playBeeps([{ freq: 660, start: 0, dur: 0.15 }]);
      sendNotification(
        `🔢 Hàng chờ cập nhật — Vị trí #${newPos}`,
        `Tiến lên ${diff} lượt`,
        'queue-update',
      );
    }

    setQueueBanner({ pos: newPos, diff, isUrgent });
  }, [delivery?.queueInfo?.position]); // eslint-disable-line react-hooks/exhaustive-deps

  function requestNotif() {
    if (!pushSupport.supported || typeof Notification === 'undefined') return;
    primeDeviceAlerts();
    Notification.requestPermission().then(p => {
      setNotifPermission(p);
      if (p === 'granted' && delivery) void subscribePush(delivery.registrationCode);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-thiso-50">
        <p className="text-thiso-400 text-sm animate-pulse">Đang tải...</p>
      </div>
    );
  }

  if (fetchErr || !delivery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-thiso-50 p-8 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-bold text-thiso-700">Không tìm thấy lượt đăng ký</p>
        <p className="text-thiso-400 text-sm mt-1 font-mono">{code}</p>
      </div>
    );
  }

  const si = STATUS_INFO[delivery.status] ?? STATUS_INFO.REGISTERED;
  const isTerminal = delivery.status === 'COMPLETED' || delivery.status === 'CANCELLED';
  const isUrgentQueue = delivery.status === 'WAITING' && (delivery.queueInfo?.position ?? 99) <= 5;

  const timeline = [
    {
      icon: '📝', label: 'Đăng ký',
      time: delivery.createdAt, done: true,
      detail: null,
    },
    {
      icon: '🔐', label: 'Check-in cổng',
      time: delivery.checkinTime, done: !!delivery.checkinTime,
      detail: null,
    },
    {
      icon: '📢',
      label: delivery.assignedSlot
        ? `Được gọi vào ${delivery.assignedSlot.code}`
        : 'Được gọi vào dock',
      time: delivery.calledTime, done: !!delivery.calledTime,
      detail: delivery.assignedSlot
        ? `${delivery.assignedSlot.name}${delivery.assignedSlot.zone ? ' · ' + delivery.assignedSlot.zone.name : ''}`
        : null,
    },
    {
      icon: '📦', label: 'Bắt đầu nhận hàng',
      time: delivery.receivingStartTime, done: !!delivery.receivingStartTime,
      detail: null,
    },
    {
      icon: '✅', label: 'Hoàn thành',
      time: delivery.completedTime, done: !!delivery.completedTime,
      detail: null,
    },
  ];

  return (
    <div className="min-h-screen bg-thiso-50 flex flex-col">

      {/* Full-screen status alert overlay */}
      {statusAlert && (
        <div
          className={`fixed inset-0 z-[60] flex flex-col items-center justify-center p-8 text-center
            ${statusAlert.level === 'urgent' ? 'bg-sky-600' : 'bg-green-600'}
          `}
          onClick={() => setStatusAlert(null)}
        >
          {statusAlert.level === 'urgent' && (
            <div className="absolute inset-0 animate-ping opacity-20 rounded-none bg-white pointer-events-none" />
          )}
          <div className="text-6xl mb-6 animate-bounce">
            {statusAlert.level === 'urgent' ? '🚛' : '✅'}
          </div>
          <p className="text-white font-black text-2xl leading-tight mb-3">{statusAlert.title}</p>
          <p className="text-white/80 text-base mb-10">{statusAlert.body}</p>
          <button className="bg-white/20 border border-white/40 text-white font-bold px-8 py-3 rounded-2xl text-sm active:scale-95 transition-transform">
            Nhấn để đóng
          </button>
          {statusAlert.level !== 'urgent' && (
            <p className="text-white/50 text-xs mt-4">Tự động đóng sau 10 giây</p>
          )}
        </div>
      )}

      {/* Queue position update banner — slides down from top */}
      {queueBanner && (
        <div
          className={`fixed top-0 left-0 right-0 z-[55] flex items-center gap-3 px-4 py-3.5 shadow-lg
            animate-in slide-in-from-top-3 duration-300 cursor-pointer
            ${queueBanner.isUrgent ? 'bg-amber-500' : 'bg-sky-600'}`}
          onClick={() => setQueueBanner(null)}
        >
          <span className={`text-2xl flex-shrink-0 ${queueBanner.isUrgent ? 'animate-bounce' : ''}`}>
            {queueBanner.isUrgent ? '⚡' : '🔢'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm leading-tight">
              {queueBanner.isUrgent
                ? `Sắp đến lượt! Còn ${queueBanner.pos} lượt nữa`
                : `Hàng chờ cập nhật — Vị trí #${queueBanner.pos}`}
            </p>
            {queueBanner.diff > 0 && (
              <p className="text-white/80 text-xs mt-0.5">
                Tiến lên {queueBanner.diff} lượt ▲ · Nhấn để đóng
              </p>
            )}
          </div>
          <span className="text-white/60 text-lg flex-shrink-0">×</span>
        </div>
      )}

      {/* Sticky header */}
      <div className={`bg-white border-b border-thiso-100 px-4 py-3 sticky top-0 z-10 flex items-center justify-between
        ${isUrgentQueue ? 'ring-2 ring-amber-400' : ''}`}>
        <div>
          <p className="text-[11px] text-thiso-400 leading-none mb-1">Theo dõi giao hàng</p>
          <p className="font-mono font-black text-thiso-800 tracking-widest text-base leading-none">
            {delivery.registrationCode}
          </p>
        </div>
        <span className="text-xs font-semibold bg-thiso-100 text-thiso-600 px-2.5 py-1 rounded-full">
          {UNIT_LABEL[delivery.receivingUnit] ?? delivery.receivingUnit}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full space-y-4"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>

        {/* Notification permission banner */}
        {!isTerminal && pushSupport.reason === 'ios_needs_pwa' && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">Bật thông báo trên iPhone/iPad</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Mở bằng Safari, nhấn Chia sẻ, chọn Thêm vào Màn hình chính, rồi mở app từ icon mới để bật thông báo.
              </p>
            </div>
          </div>
        )}
        {!isTerminal && pushSupport.supported && notifPermission === 'default' && (
          <button
            onClick={requestNotif}
            className="w-full bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl flex-shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-indigo-800">Bật thông báo hệ thống</p>
              <p className="text-xs text-indigo-500 mt-0.5">
                Nhận cảnh báo ngay kể cả khi màn hình tắt
              </p>
            </div>
            <span className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1 rounded-lg flex-shrink-0">
              Bật
            </span>
          </button>
        )}
        {!isTerminal && notifPermission === 'granted' && pushEnabled && (
          <div className="w-full bg-green-50 border border-green-200 rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔔</span>
            <p className="text-xs text-green-700 font-medium flex-1">
              Thông báo hệ thống đã bật — sẽ nhận cảnh báo kể cả khi tắt màn hình
            </p>
          </div>
        )}
        {!isTerminal && !deviceAlertsReady && (
          <button
            onClick={primeDeviceAlerts}
            className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl flex-shrink-0">📳</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-800">Bật rung và âm báo trong màn hình</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Chạm một lần để trình duyệt cho phép rung/chuông khi trạng thái thay đổi
              </p>
            </div>
          </button>
        )}

        {/* Status card */}
        <div className={`rounded-2xl p-5 border ${si.bg} ${si.border}`}>
          <div className="text-center">
            <div className="text-5xl mb-3">{si.icon}</div>
            <p className={`text-lg font-bold ${si.color}`}>{si.label}</p>

            {/* Ticket code — shown for all post-checkin statuses */}
            {delivery.ticketNumber && !isTerminal && (
              <div className="mt-4 inline-flex flex-col items-center bg-white rounded-2xl px-8 py-4 shadow-sm border border-thiso-100">
                <p className="text-[10px] font-black tracking-widest text-thiso-400 uppercase mb-2">
                  🎫 Số thẻ của bạn
                </p>
                <p className="text-3xl font-black text-thiso-800 tracking-widest leading-none font-mono">
                  {formatTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber)}
                </p>
                <p className="text-[10px] text-thiso-400 mt-2">Nhìn số thẻ này trên màn hình chờ</p>
              </div>
            )}

            {delivery.status === 'CALLED' && delivery.assignedSlot && (
              <div className="mt-3 inline-block bg-sky-50 rounded-2xl px-8 py-4 shadow-sm border border-sky-200">
                <p className="text-[10px] font-black tracking-widest text-sky-400 uppercase mb-1">
                  Vị trí nhận hàng
                </p>
                <p className="text-4xl font-black text-sky-700 tracking-widest">
                  {delivery.assignedSlot.code}
                </p>
                <p className="text-sm text-thiso-500 mt-1">{delivery.assignedSlot.name}</p>
                {delivery.assignedSlot.zone && (
                  <p className="text-xs text-thiso-400">{delivery.assignedSlot.zone.name}</p>
                )}
              </div>
            )}
            {delivery.status === 'WAITING' && !delivery.queueInfo && (
              <p className="text-sm text-yellow-600 mt-2">
                Vui lòng chờ — hệ thống sẽ tự động gọi khi có vị trí trống
              </p>
            )}
          </div>
        </div>

        {/* Queue position — WAITING only */}
        {delivery.status === 'WAITING' && delivery.queueInfo && (() => {
            <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2
              ${nearFront ? 'border-amber-400' : 'border-yellow-200'}`}>
              {/* Pulsing top bar when ≤ 5 */}
              {nearFront && (
                <div className="h-1 bg-amber-400 animate-pulse" />
              )}
              <div className={`px-4 py-3 border-b flex items-center gap-2
                ${nearFront ? 'bg-amber-50 border-amber-100' : 'bg-yellow-50 border-yellow-100'}`}>
                <span className={`text-lg ${nearFront ? 'animate-bounce' : ''}`}>
                  {nearFront ? '⚡' : '🔢'}
                </span>
                <span className={`font-bold text-sm ${nearFront ? 'text-amber-800' : 'text-yellow-800'}`}>
                  {nearFront ? 'Sắp đến lượt bạn!' : 'Vị trí hàng chờ'}
                </span>
                {isFront && (
                  <span className="ml-auto text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full animate-pulse">
                    ▶ Sắp được gọi!
                  </span>
                )}
              </div>
              <div className="px-4 py-4 space-y-4">

                {/* Position + ETA hero */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center bg-yellow-50 rounded-2xl py-3">
                    <p className="text-4xl font-black text-yellow-700 leading-none">#{q.position}</p>
                    <p className="text-xs text-yellow-600 mt-1 font-medium">trong số {q.totalWaiting} xe chờ</p>
                  </div>
                  <div className="flex-1 text-center bg-sky-50 rounded-2xl py-3">
                    {q.estimatedWaitMinutes === 0 ? (
                      <>
                        <p className="text-2xl font-black text-green-600 leading-none">Sắp gọi</p>
                        <p className="text-xs text-green-500 mt-1 font-medium">có slot trống ngay</p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-black text-sky-700 leading-none">
                          {q.estimatedWaitMinutes < 60
                            ? `~${Math.round(q.estimatedWaitMinutes)} phút`
                            : `~${Math.ceil(q.estimatedWaitMinutes / 60)} giờ`}
                        </p>
                        <p className="text-xs text-sky-500 mt-1 font-medium">thời gian chờ ước tính</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Estimated call time */}
                {callTimeStr && q.estimatedWaitMinutes > 0 && (
                  <div className="flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3">
                    <span className="text-xl">🕐</span>
                    <div>
                      <p className="text-xs text-indigo-500 font-medium">Dự kiến được gọi vào khoảng</p>
                      <p className="text-xl font-black text-indigo-700 leading-none">{callTimeStr}</p>
                    </div>
                  </div>
                )}

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: String(q.availableSlots), label: 'Slot trống', color: q.availableSlots > 0 ? 'text-green-600' : 'text-red-500' },
                    { value: `~${q.avgReceivingMinutes}'`, label: 'TB nhận/xe', color: 'text-thiso-600' },
                    { value: String(q.totalWaiting - q.position), label: 'Xe sau bạn', color: 'text-thiso-500' },
                  ].map(({ value, label, color }) => (
                    <div key={label} className="text-center bg-thiso-50 rounded-xl py-2 px-1">
                      <p className={`font-black text-lg ${color}`}>{value}</p>
                      <p className="text-[10px] text-thiso-400 mt-0.5 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-thiso-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(4, 100 - ((q.position - 1) / Math.max(q.totalWaiting, 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-thiso-400 flex-shrink-0 font-mono">{q.position}/{q.totalWaiting}</span>
                  </div>

                </div>

              </div>
            </div>
          );
        })()}

        {/* QR code — tap to fullscreen, shown when not terminal */}
        {!isTerminal && qrDataUrl && (() => {
          const qrHint = delivery.status === 'REGISTERED'
            ? { who: 'Đến kiosk check-in — quét QR này để vào hàng chờ', icon: '📷', color: 'text-sky-600' }
            : delivery.status === 'WAITING'
            ? { who: 'Đang chờ gọi vào dock — giữ QR sẵn sàng', icon: '⏳', color: 'text-yellow-600' }
            : { who: 'Hiển thị cho nhân viên nhận hàng scan', icon: '📦', color: 'text-sky-600' };
          return (
            <>
              <button
                onClick={() => setQrExpanded(true)}
                className="w-full bg-white rounded-2xl border border-thiso-100 p-4 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
              >
                <img src={qrDataUrl} alt="QR" className="w-20 h-20 rounded-xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${qrHint.color}`}>
                    {qrHint.icon} {qrHint.who}
                  </p>
                  <p className="text-xs text-thiso-400 mt-1">Nhấn để phóng to QR</p>
                  <p className="text-[11px] text-thiso-300 mt-1 font-mono">{delivery.registrationCode}</p>
                </div>
                <span className="text-thiso-300 text-xl flex-shrink-0">⤢</span>
              </button>

              {/* Fullscreen QR overlay */}
              {qrExpanded && (
                <div
                  className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6"
                  onClick={() => setQrExpanded(false)}
                >
                  <p className="text-sm text-thiso-500 mb-2 font-medium">{qrHint.icon} {qrHint.who.split(' — ')[0]}</p>
                  <div className="bg-white rounded-3xl shadow-2xl p-4 border-4 border-thiso-100">
                    <img src={qrDataUrl} alt="QR" className="w-72 h-72 rounded-2xl" />
                  </div>
                  <p className="font-mono font-black text-thiso-800 text-2xl tracking-widest mt-6">
                    {delivery.registrationCode}
                  </p>
                  <p className="text-thiso-400 text-sm mt-2">{delivery.vehiclePlate}</p>
                  <p className="text-thiso-300 text-xs mt-6">Nhấn bất kỳ để đóng</p>
                </div>
              )}
            </>
          );
        })()}

        {/* Delivery info */}
        <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-thiso-50">
            <p className="text-[11px] font-semibold text-thiso-400 uppercase tracking-wider">
              Thông tin giao hàng
            </p>
          </div>
          <div className="divide-y divide-thiso-50">
            {[
              { label: 'Biển số xe', value: delivery.vehiclePlate, mono: true },
              { label: 'Tài xế', value: delivery.driverName },
              { label: 'Nhà cung cấp', value: delivery.vendorName },
              { label: 'Loại hàng', value: GOODS_LABEL[delivery.goodsType] ?? delivery.goodsType },
              ...(delivery.poNumber ? [{ label: 'Số PO / Mã thi công', value: delivery.poNumber, mono: true }] : []),
              ...(delivery.requestedTime ? [{ label: 'Giờ đăng ký', value: fmt(delivery.requestedTime) }] : []),
              ...(delivery.note ? [{ label: 'Ghi chú', value: delivery.note }] : []),
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-start justify-between gap-3 px-5 py-3">
                <span className="text-xs text-thiso-400 flex-shrink-0 pt-0.5 min-w-[100px]">{label}</span>
                <span className={`text-sm font-semibold text-thiso-800 text-right ${mono ? 'font-mono' : ''}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Journey timeline */}
        <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-thiso-50">
            <p className="text-[11px] font-semibold text-thiso-400 uppercase tracking-wider">
              Hành trình
            </p>
          </div>
          <div className="px-5 py-4 space-y-0">
            {timeline.map((ev, i) => (
              <div key={i} className="flex gap-3">
                {/* dot + connector */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                    ${ev.done ? 'bg-green-100 text-green-700' : 'bg-thiso-100 text-thiso-300'}`}>
                    {ev.done ? '✓' : <span className="text-base">{ev.icon}</span>}
                  </div>
                  {i < timeline.length - 1 && (
                    <div className={`w-0.5 flex-1 min-h-[18px] my-1 rounded-full
                      ${ev.done ? 'bg-green-200' : 'bg-thiso-100'}`} />
                  )}
                </div>
                {/* content */}
                <div className="pb-4 flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight
                    ${ev.done ? 'text-thiso-800' : 'text-thiso-300'}`}>
                    {ev.label}
                  </p>
                  {ev.detail && (
                    <p className="text-xs text-thiso-400 mt-0.5">{ev.detail}</p>
                  )}
                  {ev.time && (
                    <p className="text-xs text-thiso-400 mt-0.5">{fmt(ev.time)}</p>
                  )}
                  {!ev.done && !ev.time && (
                    <p className="text-xs text-thiso-300 mt-0.5">Đang chờ…</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isTerminal && (
          <div className="space-y-1.5 pb-2">
            <p className="text-center text-[11px] text-thiso-300">
              Trang nhận trạng thái realtime khi có thay đổi
            </p>
            {wakeLockActive ? (
              <p className="text-center text-[11px] text-green-500 font-medium">
                🔆 Màn hình đang được giữ sáng
              </p>
            ) : (
              <p className="text-center text-[11px] text-amber-500 font-medium">
                ⚠ Giữ màn hình sáng để nhận cảnh báo âm thanh — nhấn vào trang để bật
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Track() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <TrackLookup />;
  return <TrackContent code={code} />;
}
