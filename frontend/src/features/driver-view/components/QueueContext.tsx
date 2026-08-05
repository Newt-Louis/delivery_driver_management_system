import type { DeliveryRegistration } from '../../../lib/types';
import { unitTicketPrefix } from '../../../lib/unitPresentation';
import { GOODS_SHORT } from '../constants';
import type { DriverUnitBrand } from '../types';

export default function QueueContext({
  delivery,
  allDeliveries,
  brand,
  lastUpdated,
}: {
  delivery: DeliveryRegistration;
  allDeliveries: DeliveryRegistration[];
  brand: DriverUnitBrand;
  lastUpdated: Date;
}) {
  const unit = delivery.unitConfigId ?? delivery.receivingUnit;
  const prefix = unitTicketPrefix(delivery.receivingUnit, delivery.unitConfig ?? delivery.assignedSlot?.zone?.unitConfig);

  const unitCalled = allDeliveries.filter((item) => (item.unitConfigId ?? item.receivingUnit) === unit && item.status === 'CALLED');
  const unitWaiting = allDeliveries.filter((item) => (item.unitConfigId ?? item.receivingUnit) === unit && item.status === 'WAITING');
  const allInQueue = [...unitCalled, ...unitWaiting];
  const myIndex = allInQueue.findIndex((item) => item.id === delivery.id);
  if (myIndex < 0) return null;

  function getRowStt(item: DeliveryRegistration): string {
    if (item.status === 'CALLED') {
      const index = unitCalled.findIndex((called) => called.id === item.id);
      return `${prefix}-${index + 1}`;
    }
    const index = unitWaiting.findIndex((waiting) => waiting.id === item.id);
    return `${prefix}-${unitCalled.length + index + 1}`;
  }

  function waitMin(item: DeliveryRegistration): number {
    if (!item.checkinTime) return 0;
    return Math.floor((Date.now() - new Date(item.checkinTime).getTime()) / 60000);
  }

  return (
    <div className="rounded-xl overflow-hidden border border-thiso-100">
      <div className="bg-thiso-50 px-4 py-2.5 flex items-center justify-between">
        <div className="font-black text-xs text-thiso-600 uppercase tracking-widest">
          Vị trí hàng chờ
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-sky-600 font-semibold">
          <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse inline-block" />
          {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      <div className={`px-4 py-2.5 text-xs font-semibold border-b border-thiso-100 ${
        myIndex === 0 ? 'text-sky-700 bg-sky-50' : 'text-amber-700 bg-amber-50'
      }`}>
        {myIndex === 0
          ? '🟢 Bạn đang đứng đầu hàng chờ — chuẩn bị vào dock!'
          : `⏳ Còn ${myIndex} xe phía trước bạn`}
      </div>

      <div className="divide-y divide-thiso-50 max-h-72 overflow-y-auto">
        {allInQueue.map((item, index) => {
          const isMe = item.id === delivery.id;
          const isAhead = index < myIndex;
          const isCalled = item.status === 'CALLED';
          const rowStt = getRowStt(item);
          const wait = waitMin(item);

          return (
            <div
              key={item.id}
              className={`px-3 py-2.5 flex items-center gap-2.5 transition-colors
                ${isMe ? 'bg-amber-50 border-l-4 border-amber-400' : isAhead ? 'bg-white' : 'bg-thiso-50/60'}`}
            >
              <div
                className="shrink-0 rounded-lg px-2 py-1.5 min-w-[44px] text-center"
                style={{ background: brand.sttBg, opacity: isMe ? 1 : isAhead ? 0.85 : 0.45 }}
              >
                <div className="font-black text-xs tabular-nums leading-none" style={{ color: brand.sttColor }}>
                  {rowStt}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-mono font-black text-sm leading-none
                    ${isMe ? 'text-thiso-900' : isAhead ? 'text-thiso-700' : 'text-thiso-300'}`}>
                    {item.vehiclePlate}
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
                  <span>{GOODS_SHORT[item.goodsType] ?? item.goodsType}</span>
                  {wait > 0 && <span>· {wait} phút</span>}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {isCalled && item.assignedSlot ? (
                  <div>
                    <div className="font-black text-sm" style={{ color: brand.sttColor }}>
                      {item.assignedSlot.code}
                    </div>
                    <div className="text-[10px] text-thiso-400">dock</div>
                  </div>
                ) : isMe ? (
                  <span className="text-xs font-bold" style={{ color: brand.sttColor }}>← bạn</span>
                ) : (
                  <span className="text-[11px] text-thiso-300">#{index + 1}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-thiso-50 px-4 py-2 text-[10px] text-thiso-400">
        {allInQueue.length} xe · {unitCalled.length} đã gọi · {unitWaiting.length} đang chờ
      </div>
    </div>
  );
}
