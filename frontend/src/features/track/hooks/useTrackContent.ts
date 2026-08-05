import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { playChimeWithCtx } from '../../../lib/chime';
import { registerAppServiceWorker, urlBase64ToUint8Array } from '../../../lib/pwa';
import { getPushPlatformSupport } from '../../../lib/platform';
import { useSocket } from '../../../context/SocketContext';
import { saveDeliverySession, removeDeliverySession } from '../../../lib/session';
import { fetchDeliveryByCode, fetchVapidKey, postPushSubscription } from '../api';
import { ensureAudio, unlockIOSAudio, buzz, playBeeps, sendNotification } from '../audio';
import { STATUS_INFO } from '../constants';
import { getTrackUnit, fmtDate } from '../utils';
import type { TrackDelivery, StatusAlert, QueueBannerState, TimelineEvent } from '../types';

export function useTrackContent(code: string) {
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
  const [statusAlert, setStatusAlert]     = useState<StatusAlert | null>(null);
  const [queueBanner, setQueueBanner]     = useState<QueueBannerState | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [pushEnabled, setPushEnabled]     = useState(false);
  const [deviceAlertsReady, setDeviceAlertsReady] = useState(
    () => localStorage.getItem('track_device_alerts_ready') === '1',
  );

  const normalizedCode = code.trim().toUpperCase();
  const trackUrl = `${window.location.origin}/track/${code}`;

  const prevStatusRef   = useRef<string | null>(null);
  const prevPositionRef = useRef<number | null>(null);
  const wakeLockRef     = useRef<{ release(): Promise<void> } | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  function primeDeviceAlerts() {
    ensureAudio();
    unlockIOSAudio();
    buzz([40]);
    localStorage.setItem('track_device_alerts_ready', '1');
    setDeviceAlertsReady(true);
  }

  function stopCalledAlerts() {
    if (vibrationIntervalRef.current) { clearInterval(vibrationIntervalRef.current); vibrationIntervalRef.current = null; }
    if (audioIntervalRef.current)     { clearInterval(audioIntervalRef.current);     audioIntervalRef.current = null;     }
    buzz([]);
  }

  const subscribePush = useCallback(async (deliveryCode: string) => {
    if (!pushSupport.supported) return;
    try {
      const { publicKey } = await fetchVapidKey();
      if (!publicKey) return;
      const reg = await registerAppServiceWorker();
      if (!reg) return;
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await postPushSubscription(sub.toJSON(), deliveryCode);
      setPushEnabled(true);
    } catch (err) {
      console.warn('[Push] subscription failed:', err);
    }
  }, [pushSupport.supported]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDelivery = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const data = await fetchDeliveryByCode(normalizedCode);
      setDelivery(data);
      setFetchErr('');
      if (data.status === 'COMPLETED' || data.status === 'CANCELLED' || data.status === 'EXPIRED') {
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

  // Unlock audio on first user touch (iOS Safari)
  useEffect(() => {
    const init = () => { primeDeviceAlerts(); };
    document.addEventListener('touchstart', init, { once: true });
    document.addEventListener('click',      init, { once: true });
    return () => {
      document.removeEventListener('touchstart', init);
      document.removeEventListener('click',      init);
    };
  }, []);

  // Auto-subscribe when permission already granted
  useEffect(() => {
    if (!delivery || pushEnabled) return;
    if (delivery.status === 'COMPLETED' || delivery.status === 'CANCELLED') return;
    if (notifPermission === 'granted') void subscribePush(delivery.registrationCode);
  }, [delivery?.registrationCode, delivery?.status, notifPermission, pushEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-request notification permission on mount (non-iOS)
  useEffect(() => {
    if (!pushSupport.supported || typeof Notification === 'undefined') return;
    if (pushSupport.platform === 'ios') return;
    if (notifPermission !== 'default') return;
    const timer = setTimeout(() => {
      Notification.requestPermission().then((p) => {
        setNotifPermission(p);
        if (p === 'granted' && delivery) void subscribePush(delivery.registrationCode);
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

  // Screen Wake Lock
  useEffect(() => {
    const terminal = !delivery || delivery.status === 'COMPLETED' || delivery.status === 'CANCELLED';

    async function acquire() {
      if (!('wakeLock' in navigator) || wakeLockRef.current) return;
      try {
        type WL = { release(): Promise<void>; addEventListener(e: string, h: () => void): void };
        const wl = await (navigator as unknown as { wakeLock: { request(t: string): Promise<WL> } })
          .wakeLock.request('screen') as WL;
        wakeLockRef.current = wl;
        setWakeLockActive(true);
        wl.addEventListener('release', () => { wakeLockRef.current = null; setWakeLockActive(false); });
      } catch { /* not supported */ }
    }

    function release() {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }

    if (terminal) { release(); return; }
    acquire();

    const onVisible = () => { if (document.visibilityState === 'visible') { acquire(); fetchDelivery(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      release();
    };
  }, [delivery?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // QR code generation
  useEffect(() => {
    QRCode.toDataURL(trackUrl, {
      width: 320, margin: 2,
      color: { dark: '#1C1C1C', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [trackUrl]);

  // Initial fetch
  useEffect(() => { fetchDelivery(); }, [fetchDelivery]);

  // Socket subscription + visibility/push sync
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

    const syncNow = () => { joinTrackRoom(); void fetchDelivery(); };
    const handleVisibility = () => { if (document.visibilityState === 'visible') syncNow(); };
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

  // Status transition alerts
  useEffect(() => {
    if (!delivery) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = delivery.status;
    if (prev === null || prev === delivery.status) return;

    if (delivery.status === 'CALLED') {
      const slot = delivery.assignedSlot?.code ?? 'dock';
      buzz([300, 150, 300, 150, 600, 150, 600]);
      playChimeWithCtx(ensureAudio(), 10);
      sendNotification(`🚛 Xe bạn được gọi vào ${slot}!`, delivery.vehiclePlate, 'called');
      setStatusAlert({ title: `🚛 Được gọi vào ${slot}!`, body: `${delivery.vehiclePlate} — Di chuyển vào dock ngay`, level: 'urgent' });
      vibrationIntervalRef.current = setInterval(() => { buzz([300, 150, 300, 150, 600]); }, 3000);
      audioIntervalRef.current = setInterval(() => { playChimeWithCtx(ensureAudio(), 10); }, 10000);
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

  // Stop repeating alerts when not CALLED
  useEffect(() => {
    if (!delivery || delivery.status !== 'CALLED') stopCalledAlerts();
    return () => { stopCalledAlerts(); };
  }, [delivery?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Queue position change alerts
  useEffect(() => {
    if (delivery?.status !== 'WAITING' || !delivery.queueInfo) {
      if (delivery?.status !== 'WAITING') prevPositionRef.current = null;
      return;
    }
    const newPos = delivery.queueInfo.position;
    const prevPos = prevPositionRef.current;
    prevPositionRef.current = newPos;
    if (prevPos === null || prevPos === newPos) return;

    const isUrgent = newPos <= 5;
    const diff = prevPos - newPos;

    if (isUrgent) {
      buzz([200, 100, 200, 100, 400]);
      playBeeps([{ freq: 880, start: 0, dur: 0.15 }, { freq: 1100, start: 0.2, dur: 0.15 }, { freq: 1320, start: 0.4, dur: 0.35 }]);
      sendNotification(`⚡ Sắp đến lượt bạn! Vị trí #${newPos}`, `Còn ${newPos} lượt nữa — chuẩn bị sẵn sàng`, 'queue-urgent');
    } else if (diff > 0) {
      buzz([80]);
      playBeeps([{ freq: 660, start: 0, dur: 0.15 }]);
      sendNotification(`🔢 Hàng chờ cập nhật — Vị trí #${newPos}`, `Tiến lên ${diff} lượt`, 'queue-update');
    }
    setQueueBanner({ pos: newPos, diff, isUrgent });
  }, [delivery?.queueInfo?.position]); // eslint-disable-line react-hooks/exhaustive-deps

  function requestNotif() {
    if (!pushSupport.supported || typeof Notification === 'undefined') return;
    primeDeviceAlerts();
    Notification.requestPermission().then((p) => {
      setNotifPermission(p);
      if (p === 'granted' && delivery) void subscribePush(delivery.registrationCode);
    });
  }

  // Derived values
  const si = delivery ? (STATUS_INFO[delivery.status] ?? STATUS_INFO.REGISTERED) : STATUS_INFO.REGISTERED;
  const isTerminal = delivery?.status === 'COMPLETED' || delivery?.status === 'CANCELLED';
  const isUrgentQueue = delivery?.status === 'WAITING' && (delivery.queueInfo?.position ?? 99) <= 5;
  const unitMeta = delivery ? getTrackUnit(delivery) : null;

  const timeline: TimelineEvent[] = delivery ? [
    { icon: '📝', label: 'Đăng ký',         time: delivery.createdAt,           done: true,                          detail: null },
    { icon: '🔐', label: 'Check-in cổng',    time: delivery.checkinTime,          done: !!delivery.checkinTime,        detail: null },
    {
      icon: '📢',
      label: delivery.assignedSlot ? `Được gọi vào ${delivery.assignedSlot.code}` : 'Được gọi vào dock',
      time: delivery.calledTime, done: !!delivery.calledTime,
      detail: delivery.assignedSlot
        ? `${delivery.assignedSlot.name}${delivery.assignedSlot.zone ? ' · ' + delivery.assignedSlot.zone.name : ''}`
        : null,
    },
    { icon: '📦', label: 'Bắt đầu nhận hàng', time: delivery.receivingStartTime, done: !!delivery.receivingStartTime, detail: null },
    { icon: '✅', label: 'Hoàn thành',         time: delivery.completedTime,       done: !!delivery.completedTime,      detail: null },
  ] : [];

  return {
    delivery,
    loading,
    fetchErr,
    qrDataUrl,
    qrExpanded,
    setQrExpanded,
    notifPermission,
    statusAlert,
    setStatusAlert,
    queueBanner,
    setQueueBanner,
    wakeLockActive,
    pushEnabled,
    deviceAlertsReady,
    pushSupport,
    si,
    isTerminal,
    isUrgentQueue,
    unitMeta,
    timeline,
    trackUrl,
    primeDeviceAlerts,
    stopCalledAlerts,
    requestNotif,
    fmtDate,
  };
}
