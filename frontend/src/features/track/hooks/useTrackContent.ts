import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useSocket } from '../../../context/SocketContext';
import { retainTrackRoom } from '../../../lib/trackRoom';
import { saveDeliverySession, removeDeliverySession } from '../../../lib/session';
import { fetchDeliveryByCode } from '../api';
import { TERMINAL_STATUSES } from '../../driver-notifications/model';
import { STATUS_INFO } from '../constants';
import { getTrackUnit, fmtDate } from '../utils';
import type { TrackDelivery, QueueBannerState } from '../types';

// Detail owns presentation and read updates only. Personal alerts and push are
// owned by DriverNotificationsProvider, independently of the current route.
export function useTrackContent(code: string) {
  const socket = useSocket();
  const [delivery, setDelivery] = useState<TrackDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  const [queueBanner, setQueueBanner] = useState<QueueBannerState | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const prevPositionRef = useRef<number | null>(null);
  const normalizedCode = code.trim().toUpperCase();
  const trackUrl = window.location.origin + '/track/' + normalizedCode;

  const fetchDelivery = useCallback(async () => {
    try {
      const data = await fetchDeliveryByCode(normalizedCode);
      setDelivery(data);
      setFetchErr('');
      if (TERMINAL_STATUSES.has(data.status)) removeDeliverySession(normalizedCode);
      else saveDeliverySession(normalizedCode);
    } catch {
      setFetchErr('Không thể tải chuyến. Kiểm tra mã đăng ký và kết nối mạng.');
    } finally { setLoading(false); }
  }, [normalizedCode]);

  useEffect(() => {
    const release = retainTrackRoom(socket, normalizedCode);
    const update = (next: TrackDelivery) => {
      if (next.registrationCode !== normalizedCode) return;
      setDelivery(next);
      setFetchErr('');
      setLoading(false);
    };
    const sync = () => { void fetchDelivery(); };
    const visible = () => { if (document.visibilityState === 'visible') sync(); };
    const push = (event: MessageEvent) => { if (event.data?.type === 'driver-push-received' && event.data.payload?.deliveryCode === normalizedCode) sync(); };
    socket.on('track_updated', update);
    socket.on('connect', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    document.addEventListener('visibilitychange', visible);
    navigator.serviceWorker?.addEventListener('message', push);
    sync();
    return () => {
      release();
      socket.off('track_updated', update);
      socket.off('connect', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
      document.removeEventListener('visibilitychange', visible);
      navigator.serviceWorker?.removeEventListener('message', push);
    };
  }, [socket, normalizedCode, fetchDelivery]);

  useEffect(() => {
    let disposed = false;
    // qrcode requires hex input, not CSS theme variables.
    const hex = (digits: string) => String.fromCharCode(35) + digits;
    QRCode.toDataURL(trackUrl, { width: 320, margin: 2, color: { dark: hex('1C1C1C'), light: hex('ffffff') }, errorCorrectionLevel: 'M' })
      .then((url) => { if (!disposed) setQrDataUrl(url); }).catch(console.error);
    return () => { disposed = true; };
  }, [trackUrl]);

  useEffect(() => {
    if (!delivery || TERMINAL_STATUSES.has(delivery.status)) return;
    let disposed = false;
    let lock: { release(): Promise<void> } | null = null;
    let acquiring = false;
    async function acquire() {
      if (!('wakeLock' in navigator) || lock || acquiring || document.visibilityState !== 'visible') return;
      acquiring = true;
      try {
        const next = await (navigator as unknown as { wakeLock: { request(t: string): Promise<{ release(): Promise<void>; addEventListener(t: string, f: () => void): void }> } }).wakeLock.request('screen');
        if (disposed) { await next.release(); return; }
        lock = next;
        setWakeLockActive(true);
        next.addEventListener('release', () => { lock = null; if (!disposed) setWakeLockActive(false); });
      } catch { /* optional device feature */ }
      finally { acquiring = false; }
    }
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => {});
      setWakeLockActive(false);
    };
  }, [delivery?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (delivery?.status !== 'WAITING' || !delivery.queueInfo) { prevPositionRef.current = null; return; }
    const pos = delivery.queueInfo.position;
    const previous = prevPositionRef.current;
    prevPositionRef.current = pos;
    if (previous !== null && previous !== pos) setQueueBanner({ pos, diff: previous - pos, isUrgent: pos <= 5 });
  }, [delivery?.status, delivery?.queueInfo?.position]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!queueBanner) return;
    const timer = setTimeout(() => setQueueBanner(null), 7000);
    return () => clearTimeout(timer);
  }, [queueBanner]);

  return { delivery, loading, fetchErr, qrDataUrl, qrExpanded, setQrExpanded, queueBanner, setQueueBanner, wakeLockActive,
    si: delivery ? STATUS_INFO[delivery.status] ?? STATUS_INFO.REGISTERED : STATUS_INFO.REGISTERED,
    isTerminal: !!delivery && TERMINAL_STATUSES.has(delivery.status),
    isUrgentQueue: delivery?.status === 'WAITING' && (delivery.queueInfo?.position ?? 99) <= 5,
    unitMeta: delivery ? getTrackUnit(delivery) : null, trackUrl, fmtDate };
}
