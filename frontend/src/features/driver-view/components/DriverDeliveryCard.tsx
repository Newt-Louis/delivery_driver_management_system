import type { DeliveryRegistration } from '../../../lib/types';
import { GOODS_LABEL, STATUS_LABEL, VEHICLE_LABEL } from '../constants';
import { computeStt, formatTime, getDriverBrand, minutesUntil } from '../utils';
import QueueContext from './QueueContext';

export default function DriverDeliveryCard({
  delivery,
  allDeliveries,
  lastUpdated,
}: {
  delivery: DeliveryRegistration;
  allDeliveries: DeliveryRegistration[];
  lastUpdated: Date;
}) {
  const brand = getDriverBrand(delivery);
  const status = STATUS_LABEL[delivery.status] ?? { label: delivery.status, color: 'text-thiso-600', bg: 'bg-thiso-100' };
  const stt = computeStt(delivery, allDeliveries);
  const minsUntil = minutesUntil(delivery.requestedTime);
  const isCalled = delivery.status === 'CALLED';
  const isReceiving = ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status);

  return (
    <div
      className={`rounded-2xl overflow-hidden border-2 shadow-card
        ${isCalled ? 'border-sky-400 animate-pulse' : brand.border}`}
    >
      <div className={`px-4 py-2.5 flex items-center gap-2 ${brand.bg} border-b ${brand.border}`}>
        <span className="text-lg">{brand.icon}</span>
        <span className={`font-black text-sm tracking-widest ${brand.text}`}>{brand.label}</span>
        <span className="ml-auto font-black text-xs px-3 py-1 rounded-full" style={{ color: brand.sttColor }}>
          <span className={`${status.bg} ${status.color} px-2.5 py-0.5 rounded-full font-bold text-xs`}>
            {status.label}
          </span>
        </span>
      </div>

      <div className="bg-white px-5 py-4 space-y-3">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl px-4 py-3 text-center shrink-0" style={{ background: brand.sttBg }}>
            <div
              className="text-[10px] font-black tracking-widest uppercase mb-1"
              style={{ color: brand.sttColor, opacity: 0.7 }}
            >
              Số thẻ
            </div>
            <div className="font-black text-2xl tabular-nums leading-none" style={{ color: brand.sttColor }}>
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

        {(isCalled || isReceiving) && delivery.assignedSlot && (
          <div className="rounded-xl p-4 text-center" style={{ background: brand.sttBg }}>
            <div
              className="text-[10px] font-black tracking-widest uppercase mb-1.5"
              style={{ color: brand.sttColor, opacity: 0.7 }}
            >
              {isCalled ? 'Di chuyển vào' : 'Đang nhận hàng tại'}
            </div>
            <div className="font-black text-4xl tracking-widest" style={{ color: brand.sttColor }}>
              {delivery.assignedSlot.code}
            </div>
            <div className="text-xs mt-1" style={{ color: brand.sttColor, opacity: 0.7 }}>
              {delivery.assignedSlot.name}
              {delivery.assignedSlot.zone && ` · ${delivery.assignedSlot.zone.code}`}
            </div>
          </div>
        )}

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

        {delivery.status === 'WAITING' && (
          <QueueContext delivery={delivery} allDeliveries={allDeliveries} brand={brand} lastUpdated={lastUpdated} />
        )}
      </div>
    </div>
  );
}
