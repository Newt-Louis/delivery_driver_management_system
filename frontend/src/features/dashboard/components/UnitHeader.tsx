import type { UnitDispatch } from '../../../lib/types';
import type { UnitKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';

export default function UnitHeader({ unit, unitDispatch }: { unit: UnitKey; unitDispatch: UnitDispatch }) {
  const meta = getUnitMeta(unit, unitDispatch.unitConfig);
  const stats = unitDispatch.insights.stats;

  return (
    <div className="rounded-2xl p-5 mb-4 text-white shadow-lg" style={meta.headerStyle}>
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <UnitBrandMark
            meta={meta}
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15"
            iconClassName="text-3xl leading-none"
          />
          <div>
            <div className="font-black text-2xl tracking-wide">{meta.label.toUpperCase()}</div>
            {stats.avgWaitMinutes !== null && (
              <div className="text-white/70 text-sm">Chờ TB: {stats.avgWaitMinutes} phút</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {unitDispatch.insights.nextHour.count > 0 && (
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="text-2xl font-black">{unitDispatch.insights.nextHour.count}</div>
              <div className="text-xs text-white/70">xe đến 1h tới</div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { value: stats.registered, label: 'Đã đặt', dim: true },
          { value: stats.waiting, label: 'Chờ gọi', dim: false },
          { value: stats.called, label: 'Đã gọi', dim: false },
          { value: stats.receiving, label: 'Nhận hàng', dim: false },
          { value: stats.truckSlotsAvailable ?? stats.truckDocksAvailable, label: '🚛 Slot', dim: false },
          { value: stats.mbSlotsAvailable ?? stats.mbDocksAvailable, label: '🛵 Slot', dim: false },
        ].map((item) => (
          <div key={item.label} className={`bg-white/10 rounded-xl p-2.5 text-center ${item.dim ? 'opacity-70' : ''}`}>
            <div className="text-2xl font-black leading-none">{item.value}</div>
            <div className="text-xs text-white/70 mt-1 leading-tight">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
