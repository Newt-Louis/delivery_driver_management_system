import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Modal, Result, Space, Typography, type GetRef } from 'antd';
import { BellOutlined, CheckCircleOutlined, NotificationOutlined } from '@ant-design/icons';
import { useSocket } from '../../context/SocketContext';
import api from '../../lib/api';
import { retainTrackRoom } from '../../lib/trackRoom';
import { playChimeWithCtx } from '../../lib/chime';
import { getPushPlatformSupport } from '../../lib/platform';
import { registerAppServiceWorker, urlBase64ToUint8Array } from '../../lib/pwa';
import { removeDeliverySession, saveDeliverySession } from '../../lib/session';
import { fetchDeliveryByCode, fetchVapidKey, postPushSubscription } from '../track/api';
import { buzz, ensureAudio, isDeviceAudioReady, unlockIOSAudio } from './audio';
import type { TrackDelivery } from '../track/types';
import { acceptsNotice, FOLLOW_CHANGED, FOLLOW_KEY, noticeFromDelivery, pendingPushDetaches, readFollowedTrip, savePendingPushDetaches, TERMINAL_STATUSES, writeFollowedTrip, type DriverNotice, type FollowedTrip } from './model';
import PwaInstallGuide from './PwaInstallGuide';

type PushState = 'off' | 'connecting' | 'ready' | 'error';
interface NotificationsContextValue {
  followed: FollowedTrip | null;
  pushState: PushState;
  audioReady: boolean;
  setupOpen: boolean;
  error: string;
  follow: (delivery: TrackDelivery) => void;
  stopFollowing: () => void;
  checkPermissions: () => void;
}
const Context = createContext<NotificationsContextValue | null>(null);

export function DriverNotificationsProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const [followed, setFollowed] = useState(readFollowedTrip);
  const current = useRef(followed);
  const [notice, setNotice] = useState<DriverNotice | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [switchTo, setSwitchTo] = useState<TrackDelivery | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const audioReadyRef = useRef(false);
  const [pushState, setPushState] = useState<PushState>('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stopSound = useRef<(() => void) | null>(null);
  const dismissNoticeButton = useRef<GetRef<typeof Button>>(null);
  const pushQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingDetach = useRef(new Set(pendingPushDetaches()));
  const support = getPushPlatformSupport();

  const silence = useCallback(() => {
    stopSound.current?.();
    stopSound.current = null;
    buzz([]);
  }, []);

  const commit = useCallback((next: FollowedTrip | null) => {
    current.current = next;
    setFollowed(next);
    writeFollowedTrip(next);
  }, []);

  const removePushBinding = useCallback(async (code: string) => {
    const registration = await navigator.serviceWorker?.getRegistration();
    const sub = await registration?.pushManager?.getSubscription();
    if (sub) await api.delete('/api/push/unsubscribe', { data: { endpoint: sub.endpoint, deliveryCode: code } });
  }, []);

  const detachPush = useCallback((code: string) => {
    pendingDetach.current.add(code);
    savePendingPushDetaches(pendingDetach.current);
    const run = async () => {
      // A stopped trip may already have been explicitly followed again.
      if (current.current?.code !== code) await removePushBinding(code);
      pendingDetach.current.delete(code);
      savePendingPushDetaches(pendingDetach.current);
      if (!current.current) setError('');
    };
    pushQueue.current = pushQueue.current.then(run, run);
    return pushQueue.current;
  }, [removePushBinding]);

  useEffect(() => {
    const retry = () => {
      for (const code of pendingDetach.current) void detachPush(code).catch(() => {});
    };
    retry();
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => { window.removeEventListener('online', retry); window.removeEventListener('focus', retry); };
  }, [detachPush]);

  const stopFollowing = useCallback(() => {
    const previous = current.current;
    silence();
    setNotice(null);
    setPushState('off');
    commit(null);
    if (previous) void detachPush(previous.code).catch(() => setError('Đã dừng cảnh báo trong ứng dụng. Chưa liên hệ được máy chủ để tắt thông báo đẩy; hệ thống sẽ thử lại khi có mạng.'));
  }, [commit, detachPush, silence]);

  const connectPush = useCallback((code: string) => {
    const run = async () => {
      if (current.current?.code !== code || !getPushPlatformSupport().supported || Notification.permission !== 'granted') return;
      setPushState('connecting');
      try {
        const { publicKey } = await fetchVapidKey();
        const reg = await registerAppServiceWorker();
        if (!reg || !publicKey) throw new Error('push-unavailable');
        if (!reg.active) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('service-worker-not-ready')), 10_000);
            })]);
          } finally { clearTimeout(timer); }
        }
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        if (current.current?.code !== code) return;
        await postPushSubscription(sub.toJSON(), code);
        if (current.current?.code !== code) { await removePushBinding(code); return; }
        pendingDetach.current.delete(code);
        savePendingPushDetaches(pendingDetach.current);
        setPushState('ready');
        setError('');
      } catch {
        if (current.current?.code !== code) return;
        setPushState('error');
        setError('Chưa bật được thông báo khi ra ngoài ứng dụng. Kiểm tra kết nối rồi thử lại. Cảnh báo trong ứng dụng vẫn hoạt động.');
      }
    };
    pushQueue.current = pushQueue.current.then(run, run);
    return pushQueue.current;
  }, [removePushBinding]);

  // Only invoked from an explicit button: browser permission and audio unlock
  // must start during that same user gesture (especially on iOS).
  const enableDevice = async () => {
    setBusy(true);
    setError('');
    const capabilities = getPushPlatformSupport();
    try {
      const ctx = ensureAudio();
      unlockIOSAudio();
      const permission = capabilities.supported && Notification.permission === 'default'
        ? Notification.requestPermission() : Promise.resolve(typeof Notification === 'undefined' ? 'denied' : Notification.permission);
      if (ctx?.state === 'suspended') await ctx.resume();
      audioReadyRef.current = ctx?.state === 'running';
      setAudioReady(audioReadyRef.current);
      if (audioReadyRef.current) {
        silence();
        stopSound.current = playChimeWithCtx(ctx, 0.5)?.stop ?? null;
      }
      buzz([80]);
      const allowed = await permission;
      if (allowed === 'granted' && current.current) await connectPush(current.current.code);
      if (capabilities.supported && allowed !== 'granted') {
        setError(allowed === 'denied'
          ? 'Thông báo đang bị chặn. Mở cài đặt quyền của website/ứng dụng để cho phép thông báo, rồi thử lại.'
          : 'Bạn chưa cho phép thông báo. Bạn vẫn có thể xem và nhận cảnh báo khi đang mở ứng dụng.');
      } else if (audioReadyRef.current && capabilities.supported) {
        setSetupOpen(false);
      }
      if (!audioReadyRef.current) setError('Trình duyệt chưa cho phát âm thanh. Hãy chạm Bật thông báo và âm báo để thử lại.');
    } catch {
      setError('Chưa bật được âm báo hoặc thông báo. Kiểm tra quyền của trình duyệt rồi thử lại.');
    } finally { setBusy(false); }
  };

  const checkPermissions = useCallback(() => {
    const ready = getPushPlatformSupport().supported && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    audioReadyRef.current = isDeviceAudioReady();
    setAudioReady(audioReadyRef.current);
    if (!ready || !audioReadyRef.current) setSetupOpen(true);
  }, []);

  const selectTrip = (delivery: TrackDelivery) => {
    if (TERMINAL_STATUSES.has(delivery.status)) return;
    const old = current.current;
    silence();
    setNotice(null);
    if (old?.code !== delivery.registrationCode) {
      if (old) void detachPush(old.code).catch(() => {});
      commit({ code: delivery.registrationCode, plate: delivery.vehiclePlate, status: delivery.status, seen: [], lastEventAt: '' });
      setPushState('off');
    }
    saveDeliverySession(delivery.registrationCode);
    if (isDeviceAudioReady() && getPushPlatformSupport().supported && Notification.permission === 'granted') {
      void connectPush(delivery.registrationCode);
    } else {
      setSetupOpen(true);
      void enableDevice();
    }
  };

  const receive = useCallback((incoming: DriverNotice) => {
    // The focused app owns the foreground alert. Other tabs catch up on focus;
    // background notification delivery belongs to the service worker.
    if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
    const trip = current.current;
    if (!trip || !incoming || typeof incoming.eventId !== 'string' || typeof incoming.status !== 'string' || !acceptsNotice(trip, incoming)) return;
    const persisted = readFollowedTrip();
    if (persisted?.code === trip.code && persisted.seen.includes(incoming.eventId)) return;
    const terminal = TERMINAL_STATUSES.has(incoming.status);
    const display = ['WAITING', 'CALLED', 'COMPLETED'].includes(incoming.status);
    const next = { ...trip, status: incoming.status, seen: [...trip.seen, incoming.eventId].slice(-30), lastEventAt: incoming.occurredAt || trip.lastEventAt };
    commit(terminal ? null : next);
    if (terminal) {
      removeDeliverySession(trip.code);
      setPushState('off');
      setSetupOpen(false);
      void detachPush(trip.code).catch(() => {});
    }
    silence();
    setNotice(display ? incoming : null);
    if (display && document.visibilityState === 'visible' && document.hasFocus()) {
      if (audioReadyRef.current) stopSound.current = playChimeWithCtx(ensureAudio(), incoming.status === 'CALLED' ? 10 : 0.5)?.stop ?? null;
      buzz(incoming.status === 'CALLED' ? [300, 150, 300, 150, 600] : [150]);
    }
  }, [commit, detachPush, silence]);

  // Keep the subscription alive through route changes; joining a detail page
  // is only another room lease, never the owner of personal notifications.
  useEffect(() => {
    const code = followed?.code;
    if (!code) return;
    let disposed = false;
    const release = retainTrackRoom(socket, code);
    const handleSnapshot = (delivery: TrackDelivery) => {
      if (delivery.registrationCode !== code) return;
      receive(noticeFromDelivery(delivery));
    };
    const sync = () => {
      void fetchDeliveryByCode(code).then((delivery) => { if (!disposed) handleSnapshot(delivery); }).catch((e: { response?: { status?: number } }) => {
        if (!disposed && e.response?.status === 404 && current.current?.code === code) stopFollowing();
      });
    };
    const reconnect = () => { sync(); void connectPush(code); };
    socket.on('driver_notification', receive);
    socket.on('track_updated', handleSnapshot);
    socket.on('connect', reconnect);
    const onVisible = () => {
      if (document.visibilityState === 'visible') { sync(); void connectPush(code); }
      else silence();
    };
    const onPush = (event: MessageEvent) => {
      if (event.data?.type === 'driver-push-received' && event.data.payload?.deliveryCode === code) sync();
    };
    window.addEventListener('focus', sync);
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onPush);
    sync();
    void connectPush(code);
    return () => {
      disposed = true;
      release();
      socket.off('driver_notification', receive);
      socket.off('track_updated', handleSnapshot);
      socket.off('connect', reconnect);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onPush);
    };
  }, [followed?.code, socket, receive, connectPush, silence, stopFollowing]);

  useEffect(() => {
    const update = (event?: Event) => {
      const next = event?.type === FOLLOW_CHANGED ? (event as CustomEvent<FollowedTrip | null>).detail : readFollowedTrip();
      if (current.current?.code !== next?.code) { silence(); setNotice(null); setPushState('off'); }
      current.current = next;
      setFollowed(next);
    };
    const storage = (event: StorageEvent) => { if (event.key === FOLLOW_KEY || event.key === null) update(); };
    window.addEventListener('storage', storage);
    window.addEventListener(FOLLOW_CHANGED, update);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(FOLLOW_CHANGED, update); silence(); };
  }, [silence]);

  useEffect(() => {
    const context = (event: MessageEvent) => {
      if (event.data?.type === 'driver-notification-context') {
        event.ports[0]?.postMessage({ code: current.current?.code ?? null });
      }
    };
    navigator.serviceWorker?.addEventListener('message', context);
    return () => navigator.serviceWorker?.removeEventListener('message', context);
  }, []);

  useEffect(() => {
    if (followed?.code) checkPermissions();
  }, [followed?.code, checkPermissions]);

  useEffect(() => {
    if (!notice || notice.status === 'CALLED') return;
    const timer = window.setTimeout(() => { silence(); setNotice(null); }, 10_000);
    return () => window.clearTimeout(timer);
  }, [notice, silence]);

  return <Context.Provider value={{ followed, pushState, audioReady, setupOpen, error, follow: (delivery) => {
    if (current.current && current.current.code !== delivery.registrationCode) setSwitchTo(delivery);
    else selectTrip(delivery);
  }, stopFollowing, checkPermissions }}>
    {children}
    <PwaInstallGuide blocked={setupOpen || !!notice || !!switchTo} />
    <Modal open={!!switchTo && !notice} focusable={{ focusTriggerAfterClose: !notice }} title="Chuyển chuyến nhận thông báo?" onCancel={() => setSwitchTo(null)} onOk={() => { if (switchTo) selectTrip(switchTo); setSwitchTo(null); }} okText="Theo dõi chuyến mới" cancelText="Giữ chuyến hiện tại">
      <Typography.Paragraph>Điện thoại đang nhận thông báo cho xe {followed?.plate}. Chuyển sang xe {switchTo?.vehiclePlate} ({switchTo?.registrationCode})?</Typography.Paragraph>
    </Modal>
    <Modal open={setupOpen && !notice} focusable={{ focusTriggerAfterClose: !notice }} centered title="Bật thông báo cho chuyến giao hàng" onCancel={() => setSetupOpen(false)} footer={<Space wrap><Button size="large" onClick={() => setSetupOpen(false)}>Để sau</Button><Button size="large" type="primary" icon={<BellOutlined />} loading={busy} onClick={() => void enableDevice()}>Bật thông báo và âm báo</Button></Space>}>
      <Space orientation="vertical" size="middle" className="w-full">
        <Typography.Paragraph>Nhận báo check-in thành công, gọi vào khu vực nhận hàng và hoàn tất chuyến. Chạm nút bên dưới rồi chọn Cho phép nếu thiết bị hỏi.</Typography.Paragraph>
        {support.reason === 'ios_needs_pwa' && <Alert type="info" showIcon title="Nhận thông báo khi khóa màn hình trên iPhone/iPad" description="Thêm website vào Màn hình chính, mở ứng dụng vừa thêm, chọn lại chuyến và bật thông báo. Trong trình duyệt, hãy giữ ứng dụng mở để xem cảnh báo." />}
        {support.reason === 'missing_browser_api' && <Alert type="warning" showIcon title="Trình duyệt chưa hỗ trợ thông báo đẩy" description="Hãy giữ trang mở hoặc sử dụng trình duyệt hỗ trợ thông báo trên kết nối HTTPS." />}
        {error && <Alert type="warning" showIcon title={error} />}
        <Typography.Text type="secondary">Âm thanh và rung còn phụ thuộc chế độ im lặng và khả năng của thiết bị. Bạn vẫn có thể theo dõi chuyến nếu chưa cấp quyền.</Typography.Text>
      </Space>
    </Modal>
    <Modal open={!!notice} centered zIndex={3000} width={720} closable={false} mask={{ closable: false }} keyboard={false}
      afterOpenChange={(open) => { if (open) dismissNoticeButton.current?.focus(); }}
      footer={<Button ref={dismissNoticeButton} type="primary" size="large" block onClick={() => { silence(); setNotice(null); }}>Đã hiểu — Đóng thông báo</Button>}>
      {notice && <Result status={notice.status === 'CALLED' ? 'warning' : 'success'} icon={notice.status === 'CALLED' ? <NotificationOutlined /> : <CheckCircleOutlined />} title={notice.title} subTitle={<Space orientation="vertical"><Typography.Text strong className="!text-xl">{notice.body}</Typography.Text><Typography.Text type="secondary" className="break-all">Mã chuyến: {notice.deliveryCode}</Typography.Text></Space>} />}
    </Modal>
  </Context.Provider>;
}

export function useDriverNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('DriverNotificationsProvider is missing');
  return context;
}
