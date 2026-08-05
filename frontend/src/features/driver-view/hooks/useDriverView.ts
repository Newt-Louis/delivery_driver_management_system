import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../../context/SocketContext';
import type { DeliveryRegistration } from '../../../lib/types';
import { fetchDriverQueue } from '../api';
import { NOTIF_KEY, STORAGE_KEY } from '../constants';
import type { AppNotification } from '../types';
import {
  formatTime,
  getDriverDeliveries,
  minutesUntil,
  requestNotifPermission,
  sendNotif,
  vibrate,
} from '../utils';

export function useDriverView() {
  const socket = useSocket();
  const [plate, setPlate] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [inputPlate, setInputPlate] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [allDeliveries, setAllDeliveries] = useState<DeliveryRegistration[]>([]);
  const [notifGranted, setNotifGranted] = useState(
    () => localStorage.getItem(NOTIF_KEY) === 'true' || Notification.permission === 'granted',
  );
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [now, setNow] = useState(new Date());
  const notifId = useRef(0);
  const seenCalled = useRef<Set<string>>(new Set());
  const warnedUpcoming = useRef<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      setAllDeliveries(await fetchDriverQueue());
    } catch {
      // public driver view keeps stale data if queue refresh fails
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    const queueUpdated = (data: DeliveryRegistration[]) => {
      setAllDeliveries(data);
      setLastUpdated(new Date());
    };
    socket.on('queue_updated', queueUpdated);
    socket.on('delivery_completed', fetchQueue);
    return () => {
      socket.off('queue_updated', queueUpdated);
      socket.off('delivery_completed', fetchQueue);
    };
  }, [socket, fetchQueue]);

  const pushNotif = useCallback((type: AppNotification['type'], message: string) => {
    const id = ++notifId.current;
    setNotifications((prev) => [{ id, type, message }, ...prev].slice(0, 5));
    setTimeout(() => setNotifications((prev) => prev.filter((item) => item.id !== id)), 8000);
  }, []);

  useEffect(() => {
    const handler = (data: { vehiclePlate: string; slotCode: string; slotName: string; id: string }) => {
      if (!plate) return;
      if (data.vehiclePlate.toUpperCase() !== plate.toUpperCase()) return;
      if (seenCalled.current.has(data.id)) return;
      seenCalled.current.add(data.id);

      vibrate([300, 100, 300, 100, 600]);
      sendNotif('📣 Xe của bạn được gọi!', `Vui lòng vào ${data.slotCode} — ${data.slotName}`);
      pushNotif('called', `📣 Xe ${data.vehiclePlate} được gọi vào ${data.slotCode}!`);
    };
    socket.on('delivery_called', handler);
    return () => {
      socket.off('delivery_called', handler);
    };
  }, [socket, plate, pushNotif]);

  useEffect(() => {
    if (!plate) return;
    const check = () => {
      const myDelivery = allDeliveries.find(
        (delivery) => delivery.vehiclePlate.toUpperCase() === plate.toUpperCase()
          && delivery.status === 'REGISTERED',
      );
      if (!myDelivery?.requestedTime) return;
      const minsLeft = minutesUntil(myDelivery.requestedTime);
      if (minsLeft === null) return;
      const key = `${myDelivery.id}-${Math.floor(minsLeft / 10)}`;
      if (warnedUpcoming.current.has(key)) return;

      if (minsLeft >= 0 && minsLeft <= 45) {
        warnedUpcoming.current.add(key);
        vibrate([200, 100, 200]);
        sendNotif(
          '⏰ Sắp đến giờ giao hàng',
          `Còn khoảng ${minsLeft} phút — vui lòng di chuyển đến cổng mall`,
        );
        pushNotif('upcoming', `⏰ Còn ~${minsLeft} phút đến giờ hẹn lúc ${formatTime(myDelivery.requestedTime)}`);
      }
    };

    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [allDeliveries, plate, pushNotif]);

  function submitPlate(event: React.FormEvent) {
    event.preventDefault();
    const normalized = inputPlate.trim().toUpperCase();
    if (!normalized) return;
    setPlate(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);
    seenCalled.current.clear();
    warnedUpcoming.current.clear();
  }

  function clearPlate() {
    setPlate('');
    setInputPlate('');
    localStorage.removeItem(STORAGE_KEY);
  }

  async function enableNotifications() {
    const granted = await requestNotifPermission();
    setNotifGranted(granted);
    if (granted) localStorage.setItem(NOTIF_KEY, 'true');
  }

  return {
    plate,
    inputPlate,
    setInputPlate,
    allDeliveries,
    notifGranted,
    notifications,
    now,
    lastUpdated,
    ...getDriverDeliveries(plate, allDeliveries),
    submitPlate,
    clearPlate,
    enableNotifications,
  };
}
