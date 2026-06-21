import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../lib/api';
import type { DeliveryRegistration } from '../lib/types';

// ─── Brand ─────────────────────────────────────────────────────────────────────

type UnitKey = 'EMART' | 'THISKYHALL' | 'TENANT';

const UNIT_BRAND: Record<UnitKey, { label: string; icon: string; bg: string; border: string; text: string; sttBg: string; sttColor: string }> = {
  EMART:      { label: 'Emart',             icon: '🏬', bg: 'bg-emart-50',  border: 'border-emart-300', text: 'text-emart-700',  sttBg: '#FFF6E6', sttColor: '#E08000' },
  THISKYHALL: { label: 'Thiskyhall',        icon: '🏢', bg: 'bg-sky-50',    border: 'border-sky-300',   text: 'text-sky-700',    sttBg: '#E8F5EE', sttColor: '#14753D' },
  TENANT:     { label: 'Mall (Khách thuê)', icon: '🏪', bg: 'bg-thiso-50',  border: 'border-thiso-300', text: 'text-thiso-600',  sttBg: '#F6F6F6', sttColor: '#2C2C2C' },
};

const UNIT_PREFIX: Record<UnitKey, string> = { EMART: 'E', THISKYHALL: 'TH', TENANT: 'TE' };

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  REGISTERED:              { label: 'Đã đặt slot',  color: 'text-thiso-600',  bg: 'bg-thiso-100' },
  WAITING:                 { label: 'Đang chờ',      color: 'text-amber-700',  bg: 'bg-amber-100' },
  CALLED:                  { label: '📣 Vào dock!', color: 'text-sky-700',    bg: 'bg-sky-100' },
  RECEIVING:               { label: 'Đang nhận hàng', color: 'text-emart-700', bg: 'bg-emart-100' },
  AUTO_WAREHOUSE_RECEIVING:{ label: 'Kho tự động',  color: 'text-emart-700',  bg: 'bg-emart-100' },
  COMPLETED:               { label: '✓ Hoàn tất',   color: 'text-sky-700',    bg: 'bg-sky-100' },
  CANCELLED:               { label: 'Đã hủy',        color: 'text-red-600',    bg: 'bg-red-100' },
};

const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: '🥬 Tươi sống', AUTO_WAREHOUSE: '🏭 Kho tự động', GENERAL_GOODS: '📦 Hàng thường',
};
const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe tải', MOTORBIKE: '🛵 Xe máy', OTHER: '🚗 Khác',
};

const STORAGE_KEY = 'thiso_driver_plate';
const NOTIF_KEY   = 'thiso_driver_notif_granted';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vibrate(pattern: number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

async function requestNotifPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendNotif(title: string, body: string) {
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/icons/icon-192.png' }); } catch { /* swallow */ }
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
}

// Compute STT for a delivery within its unit queue
function computeStt(delivery: DeliveryRegistration, allDeliveries: DeliveryRegistration[]): string {
  const unit = delivery.receivingUnit as UnitKey;
  const prefix = UNIT_PREFIX[unit] ?? '?';

  const unitDeliveries = allDeliveries.filter((d) => d.receivingUnit === unit);
  const called  = unitDeliveries.filter((d) => d.status === 'CALLED');
  const waiting = unitDeliveries.filter((d) => d.status === 'WAITING');

  if (['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status)) return `${prefix}-✓`;
  if (delivery.status === 'CALLED') {
    const idx = called.findIndex((d) => d.id === delivery.id);
    if (idx < 0) return `${prefix}`;
    return `${prefix}-${idx + 1}`;
  }
  if (delivery.status === 'WAITING') {
    const idx = waiting.findIndex((d) => d.id === delivery.id);
    if (idx < 0) return `${prefix}`;
    return `${prefix}-${called.length + idx + 1}`;
  }
  return `${prefix}`;
}

// ─── In-page notification banner ──────────────────────────────────────────────

interface AppNotif { id: number; type: 'called' | 'upcoming' | 'info'; message: string }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DriverView() {
  const socket = useSocket();
  const [plate, setPlate] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [inputPlate, setInputPlate] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [allDeliveries, setAllDeliveries] = useState<DeliveryRegistration[]>([]);
  const [notifGranted, setNotifGranted] = useState(
    () => localStorage.getItem(NOTIF_KEY) === 'true' || Notification.permission === 'granted',
  );
  const [notifications, setNotifications] = useState<AppNotif[]>([]);
  const [now, setNow] = useState(new Date());
  const notifId = useRef(0);
  const seenCalled = useRef<Set<string>>(new Set());
  const warnedUpcoming = useRef<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Fetch full queue
  const fetchQueue = useCallback(async () => {
    try {
      setAllDeliveries((await api.get('/api/deliveries/queue')).data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Socket: live queue updates
  useEffect(() => {
    socket.on('queue_updated', (data: DeliveryRegistration[]) => {
      setAllDeliveries(data);
      setLastUpdated(new Date());
    });
    socket.on('delivery_completed', fetchQueue);
    return () => { socket.off('queue_updated'); socket.off('delivery_completed'); };
  }, [socket, fetchQueue]);

  // Socket: called event → vibrate + notify if it's this driver
  useEffect(() => {
    const handler = (data: { vehiclePlate: string; slotCode: string; slotName: string; id: string }) => {
      if (!plate) return;
      if (data.vehiclePlate.toUpperCase() !== plate.toUpperCase()) return;
      if (seenCalled.current.has(data.id)) return;
      seenCalled.current.add(data.id);

      vibrate([300, 100, 300, 100, 600]);
      sendNotif(
        '📣 Xe của bạn được gọi!',
        `Vui lòng vào ${data.slotCode} — ${data.slotName}`,
      );
      pushNotif('called', `📣 Xe ${data.vehiclePlate} được gọi vào ${data.slotCode}!`);
    };
    socket.on('delivery_called', handler);
    return () => { socket.off('delivery_called', handler); };
  }, [socket, plate]);

  // Periodic check: upcoming appointment warning
  useEffect(() => {
    if (!plate) return;
    const check = () => {
      const myDelivery = allDeliveries.find(
        (d) => d.vehiclePlate.toUpperCase() === plate.toUpperCase()
          && d.status === 'REGISTERED',
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
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [allDeliveries, plate]);

  function pushNotif(type: AppNotif['type'], message: string) {
    const id = ++notifId.current;
    setNotifications((prev) => [{ id, type, message }, ...prev].slice(0, 5));
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 8000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = inputPlate.trim().toUpperCase();
    if (!normalized) return;
    setPlate(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);
    seenCalled.current.clear();
    warnedUpcoming.current.clear();
  }

  async function handleEnableNotif() {
    const granted = await requestNotifPermission();
    setNotifGranted(granted);
    if (granted) localStorage.setItem(NOTIF_KEY, 'true');
  }

  // Find this driver's deliveries
  const myDeliveries = plate
    ? allDeliveries.filter((d) => d.vehiclePlate.toUpperCase() === plate.toUpperCase())
    : [];
  const myActive = myDeliveries.filter(
    (d) => !['COMPLETED', 'CANCELLED'].includes(d.status),
  );

  return (
    <div className="min-h-screen bg-thiso-50 font-sans">
      {/* Header */}
      <div className="bg-thiso-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white font-black text-sm">T</span>
          </div>
          <div>
            <div className="text-white font-black text-sm tracking-widest leading-none">THISO MALL</div>
            <div className="text-thiso-400 text-[10px]">Tây Hồ Tây · Theo dõi hàng chờ</div>
          </div>
        </div>
        <div className="text-thiso-400 text-xs font-mono">
          {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* In-page notification banners */}
      {notifications.length > 0 && (
        <div className="fixed top-14 inset-x-0 z-40 px-3 pt-2 space-y-2 pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-card-lg pointer-events-auto
                ${n.type === 'called' ? 'bg-sky-600 text-white' : n.type === 'upcoming' ? 'bg-amber-500 text-white' : 'bg-thiso-700 text-white'}`}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Mall tagline */}
        <div className="text-center pt-1">
          <div className="text-2xl font-black text-thiso-800 tracking-tight leading-snug">
            THISO MALL<br />
            <span className="text-base font-semibold text-thiso-400 tracking-widest">TÂY HỒ TÂY</span>
          </div>
          <div className="text-xs text-thiso-400 mt-1">Tra cứu vị trí hàng chờ của tài xế</div>
        </div>

        {/* Plate input */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="label">Nhập biển số xe của bạn</label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-xl font-black font-mono uppercase tracking-widest"
                value={inputPlate}
                onChange={(e) => setInputPlate(e.target.value.toUpperCase())}
                placeholder="51C-123.45"
                autoCapitalize="characters"
                autoCorrect="off"
              />
              <button type="submit" className="btn-primary px-5 text-base shrink-0">
                Tìm
              </button>
            </div>
            {plate && (
              <div className="text-xs text-thiso-400 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-sky-400 rounded-full animate-pulse inline-block" />
                Đang theo dõi:{' '}
                <span className="font-mono font-bold text-thiso-700">{plate}</span>
                <button
                  type="button"
                  className="ml-auto text-thiso-300 hover:text-red-500 transition-colors"
                  onClick={() => { setPlate(''); setInputPlate(''); localStorage.removeItem(STORAGE_KEY); }}
                >
                  ✕ Xóa
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Notification permission */}
        {!notifGranted && 'Notification' in window && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🔔</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-800 text-sm">Bật thông báo</div>
              <div className="text-xs text-amber-600 mt-0.5 mb-2">
                Cho phép thông báo để nhận rung + cảnh báo khi xe bạn được gọi hoặc sắp đến giờ hẹn.
              </div>
              <button
                onClick={handleEnableNotif}
                className="text-xs px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                Bật thông báo
              </button>
            </div>
          </div>
        )}

        {/* My deliveries */}
        {plate && myActive.length === 0 && myDeliveries.length === 0 && (
          <div className="card text-center py-8">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-thiso-500 text-sm font-medium">
              Không tìm thấy xe <span className="font-mono font-bold text-thiso-700">{plate}</span>
            </div>
            <div className="text-thiso-400 text-xs mt-1">
              Xe chưa check-in hoặc chưa đăng ký giao hàng hôm nay
            </div>
          </div>
        )}

        {myActive.map((delivery) => {
          const unit = delivery.receivingUnit as UnitKey;
          const brand = UNIT_BRAND[unit] ?? UNIT_BRAND.TENANT;
          const st = STATUS_LABEL[delivery.status] ?? { label: delivery.status, color: 'text-thiso-600', bg: 'bg-thiso-100' };
          const stt = computeStt(delivery, allDeliveries);
          const minsUntil = minutesUntil(delivery.requestedTime);
          const isCalled = delivery.status === 'CALLED';
          const isReceiving = ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status);

          return (
            <div
              key={delivery.id}
              className={`rounded-2xl overflow-hidden border-2 shadow-card
                ${isCalled ? 'border-sky-400 animate-pulse' : brand.border}`}
            >
              {/* Unit header */}
              <div className={`px-4 py-2.5 flex items-center gap-2 ${brand.bg} border-b ${brand.border}`}>
                <span className="text-lg">{brand.icon}</span>
                <span className={`font-black text-sm tracking-widest ${brand.text}`}>{brand.label}</span>
                <span
                  className="ml-auto font-black text-xs px-3 py-1 rounded-full"
                  style={{ background: st.bg.replace('bg-', ''), color: brand.sttColor }}
                >
                  <span className={`${st.bg} ${st.color} px-2.5 py-0.5 rounded-full font-bold text-xs`}>
                    {st.label}
                  </span>
                </span>
              </div>

              <div className="bg-white px-5 py-4 space-y-3">
                {/* STT + Plate row */}
                <div className="flex items-start gap-4">
                  <div
                    className="rounded-2xl px-4 py-3 text-center shrink-0"
                    style={{ background: brand.sttBg }}
                  >
                    <div className="text-[10px] font-black tracking-widest uppercase mb-1"
                      style={{ color: brand.sttColor, opacity: 0.7 }}>
                      Số thẻ
                    </div>
                    <div className="font-black text-2xl tabular-nums leading-none"
                      style={{ color: brand.sttColor }}>
                      {stt}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-3xl tracking-widest text-thiso-800 leading-none">
                      {delivery.vehiclePlate}
                    </div>
                    <div className="text-xs text-thiso-400 mt-1.5">{delivery.vendorName}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-thiso-400">
                      <span>{GOODS_LABEL[delivery.goodsType]}</span>
                      <span>·</span>
                      <span>{VEHICLE_LABEL[delivery.vehicleType]}</span>
                    </div>
                  </div>
                </div>

                {/* Called: dock info */}
                {(isCalled || isReceiving) && delivery.assignedSlot && (
                  <div
                    className="rounded-xl p-4 text-center"
                    style={{ background: brand.sttBg }}
                  >
                    <div className="text-[10px] font-black tracking-widest uppercase mb-1.5"
                      style={{ color: brand.sttColor, opacity: 0.7 }}>
                      {isCalled ? 'Di chuyển vào' : 'Đang nhận hàng tại'}
                    </div>
                    <div className="font-black text-4xl tracking-widest"
                      style={{ color: brand.sttColor }}>
                      {delivery.assignedSlot.code}
                    </div>
                    <div className="text-xs mt-1" style={{ color: brand.sttColor, opacity: 0.7 }}>
                      {delivery.assignedSlot.name}
                      {delivery.assignedSlot.zone && ` · ${delivery.assignedSlot.zone.code}`}
                    </div>
                  </div>
                )}

                {/* Time info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {delivery.requestedTime && (
                    <div className="bg-thiso-50 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-thiso-400 font-black tracking-widest uppercase mb-1">Giờ hẹn</div>
                      <div className="font-black text-lg text-thiso-800 tabular-nums">
                        {formatTime(delivery.requestedTime)}
                      </div>
                      {minsUntil !== null && minsUntil > 0 && minsUntil <= 120 && (
                        <div className={`text-xs font-semibold mt-0.5 ${minsUntil <= 30 ? 'text-amber-600' : 'text-thiso-400'}`}>
                          còn ~{minsUntil} phút
                        </div>
                      )}
                    </div>
                  )}
                  {delivery.checkinTime && (
                    <div className="bg-thiso-50 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-thiso-400 font-black tracking-widest uppercase mb-1">Check-in</div>
                      <div className="font-black text-lg text-thiso-800 tabular-nums">
                        {formatTime(delivery.checkinTime)}
                      </div>
                      <div className="text-xs text-thiso-400 mt-0.5">
                        {Math.floor((Date.now() - new Date(delivery.checkinTime).getTime()) / 60000)} phút trước
                      </div>
                    </div>
                  )}
                </div>

                {/* Position in queue context */}
                {delivery.status === 'WAITING' && (
                  <QueueContext delivery={delivery} allDeliveries={allDeliveries} brand={brand} lastUpdated={lastUpdated} />
                )}
              </div>
            </div>
          );
        })}

        {/* Completed deliveries */}
        {myDeliveries.filter((d) => ['COMPLETED', 'CANCELLED'].includes(d.status)).map((delivery) => (
          <div key={delivery.id} className="bg-white rounded-2xl border border-thiso-100 p-4 opacity-60">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono font-bold text-thiso-700">{delivery.vehiclePlate}</div>
                <div className="text-xs text-thiso-400">{UNIT_BRAND[delivery.receivingUnit as UnitKey]?.label}</div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_LABEL[delivery.status]?.bg} ${STATUS_LABEL[delivery.status]?.color}`}>
                {STATUS_LABEL[delivery.status]?.label}
              </span>
            </div>
          </div>
        ))}

        {/* Info card */}
        <div className="bg-thiso-800 rounded-2xl p-5 text-white/80 text-sm space-y-2.5">
          <div className="text-white font-black text-base mb-3">📋 Hướng dẫn</div>
          {[
            ['1', 'Nhập biển số xe để xem vị trí hàng chờ'],
            ['2', 'Bật thông báo để nhận rung điện thoại khi được gọi'],
            ['3', 'Khi số thẻ được hiển thị màu nổi → chuẩn bị di chuyển vào dock'],
            ['4', 'Màn hình TV tại bãi đỗ cũng hiển thị số thẻ theo thứ tự'],
          ].map(([n, text]) => (
            <div key={n} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-white/20 rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                {n}
              </span>
              <span className="text-white/70 text-xs">{text}</span>
            </div>
          ))}
        </div>

        <div className="text-center text-thiso-400 text-xs pb-4">
          TRUNG TÂM THƯƠNG MẠI THISO MALL TÂY HỒ TÂY
        </div>
      </div>
    </div>
  );
}

// ─── Queue Context (full vertical list: called + waiting) ─────────────────────

const GOODS_SHORT: Record<string, string> = {
  FRESH_FOOD: '🥬 Tươi sống',
  AUTO_WAREHOUSE: '🏭 Kho TĐ',
  GENERAL_GOODS: '📦 Thường',
};

function QueueContext({
  delivery, allDeliveries, brand, lastUpdated,
}: {
  delivery: DeliveryRegistration;
  allDeliveries: DeliveryRegistration[];
  brand: typeof UNIT_BRAND[UnitKey];
  lastUpdated: Date;
}) {
  const unit    = delivery.receivingUnit as UnitKey;
  const prefix  = UNIT_PREFIX[unit] ?? '?';

  const unitCalled  = allDeliveries.filter((d) => d.receivingUnit === unit && d.status === 'CALLED');
  const unitWaiting = allDeliveries.filter((d) => d.receivingUnit === unit && d.status === 'WAITING');
  const allInQueue  = [...unitCalled, ...unitWaiting];

  const myIdx = allInQueue.findIndex((d) => d.id === delivery.id);
  if (myIdx < 0) return null;

  function getRowStt(d: DeliveryRegistration): string {
    if (d.status === 'CALLED') {
      const i = unitCalled.findIndex((c) => c.id === d.id);
      return `${prefix}-${i + 1}`;
    }
    const i = unitWaiting.findIndex((w) => w.id === d.id);
    return `${prefix}-${unitCalled.length + i + 1}`;
  }

  function waitMin(d: DeliveryRegistration): number {
    if (!d.checkinTime) return 0;
    return Math.floor((Date.now() - new Date(d.checkinTime).getTime()) / 60000);
  }

  const aheadCount = myIdx;

  return (
    <div className="rounded-xl overflow-hidden border border-thiso-100">
      {/* Header with real-time indicator */}
      <div className="bg-thiso-50 px-4 py-2.5 flex items-center justify-between">
        <div className="font-black text-xs text-thiso-600 uppercase tracking-widest">
          Vị trí hàng chờ
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-sky-600 font-semibold">
          <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse inline-block" />
          {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* Summary */}
      <div className={`px-4 py-2.5 text-xs font-semibold border-b border-thiso-100 ${
        aheadCount === 0 ? 'text-sky-700 bg-sky-50' : 'text-amber-700 bg-amber-50'
      }`}>
        {aheadCount === 0
          ? '🟢 Bạn đang đứng đầu hàng chờ — chuẩn bị vào dock!'
          : `⏳ Còn ${aheadCount} xe phía trước bạn`}
      </div>

      {/* Full queue list */}
      <div className="divide-y divide-thiso-50 max-h-72 overflow-y-auto">
        {allInQueue.map((d, i) => {
          const isMe     = d.id === delivery.id;
          const isAhead  = i < myIdx;
          const isCalled = d.status === 'CALLED';
          const rowStt   = getRowStt(d);
          const wait     = waitMin(d);

          return (
            <div
              key={d.id}
              className={`px-3 py-2.5 flex items-center gap-2.5 transition-colors
                ${isMe
                  ? 'bg-amber-50 border-l-4 border-amber-400'
                  : isAhead ? 'bg-white' : 'bg-thiso-50/60'}`}
            >
              {/* STT badge */}
              <div
                className="shrink-0 rounded-lg px-2 py-1.5 min-w-[44px] text-center"
                style={{ background: brand.sttBg, opacity: isMe ? 1 : isAhead ? 0.85 : 0.45 }}
              >
                <div className="font-black text-xs tabular-nums leading-none" style={{ color: brand.sttColor }}>
                  {rowStt}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-mono font-black text-sm leading-none
                    ${isMe ? 'text-thiso-900' : isAhead ? 'text-thiso-700' : 'text-thiso-300'}`}>
                    {d.vehiclePlate}
                  </span>
                  {isMe && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-white leading-none">
                      BẠN
                    </span>
                  )}
                  {isCalled && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-sky-500 text-white leading-none animate-pulse">
                      📣 GỌI VÀO
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-thiso-400 mt-0.5 flex items-center gap-1.5 leading-none">
                  <span>{GOODS_SHORT[d.goodsType] ?? d.goodsType}</span>
                  {wait > 0 && <span>· {wait} phút</span>}
                </div>
              </div>

              {/* Right side: dock code if called, else position number */}
              <div className="shrink-0 text-right">
                {isCalled && d.assignedSlot ? (
                  <div>
                    <div className="font-black text-sm" style={{ color: brand.sttColor }}>
                      {d.assignedSlot.code}
                    </div>
                    <div className="text-[10px] text-thiso-400">dock</div>
                  </div>
                ) : isMe ? (
                  <span className="text-xs font-bold" style={{ color: brand.sttColor }}>← bạn</span>
                ) : (
                  <span className="text-[11px] text-thiso-300">#{i + 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-thiso-50 px-4 py-2 text-[10px] text-thiso-400">
        {allInQueue.length} xe · {unitCalled.length} đã gọi · {unitWaiting.length} đang chờ
      </div>
    </div>
  );
}
