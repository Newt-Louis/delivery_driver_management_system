import { useState } from 'react';
import GoodsBadge from '../../../components/GoodsBadge';
import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import { VEHICLE_LABEL } from '../constants';
import type { UnitKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export default function UpcomingSection({
  deliveries,
  unit,
  unitConfig,
  unitConfigsByUnit,
}: {
  deliveries: DeliveryRegistration[];
  unit?: UnitKey;
  unitConfig?: UnitDispatch['unitConfig'];
  unitConfigsByUnit?: Record<string, UnitDispatch['unitConfig'] | undefined>;
}) {
  const [open, setOpen] = useState(true);
  if (deliveries.length === 0) return null;
  const meta = unit ? getUnitMeta(unit, unitConfig) : null;

  return (
    <div className="mt-5">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-semibold text-thiso-500 mb-2 hover:text-thiso-700"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{open ? '▼' : '▶'}</span>
          <span>Đã đặt — chưa check-in</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${meta ? '' : 'bg-thiso-200 text-thiso-700'}`}
          style={meta ? meta.badgeStyle : undefined}
        >
          {deliveries.length}
        </span>
      </button>
      {open && (
        <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                <th className="px-4 py-2">Ngày giao</th>
                <th className="px-4 py-2">Biển số</th>
                {!unit && <th className="px-4 py-2">Đơn vị</th>}
                <th className="px-4 py-2">Nhà cung cấp</th>
                <th className="px-4 py-2">Loại xe</th>
                <th className="px-4 py-2">Hàng</th>
                <th className="px-4 py-2">Mã ĐK</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const deliveryUnitConfig = delivery.unitConfig
                  ?? delivery.assignedSlot?.zone?.unitConfig
                  ?? unitConfig
                  ?? unitConfigsByUnit?.[delivery.receivingUnit];
                const deliveryMeta = getUnitMeta(delivery.receivingUnit, deliveryUnitConfig);
                const dateLabel = delivery.requestedTime
                  ? new Date(delivery.requestedTime).toLocaleDateString('vi-VN')
                  : '—';
                const isPast = delivery.requestedTime ? localDateKey(new Date(delivery.requestedTime)) < localDateKey(new Date()) : false;
                return (
                  <tr key={delivery.id} className={`border-b border-thiso-50 last:border-0 ${isPast ? 'bg-amber-50' : 'hover:bg-thiso-50'}`}>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-bold ${isPast ? 'text-amber-700' : 'text-thiso-700'}`}>{dateLabel}</span>
                      {isPast && <div className="text-xs text-amber-600">Quá ngày</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-black text-thiso-800">{delivery.vehiclePlate}</td>
                    {!unit && (
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={deliveryMeta.badgeStyle}>
                          <UnitBrandMark
                            meta={deliveryMeta}
                            className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-white/70"
                            iconClassName="text-sm leading-none"
                          />
                          {deliveryMeta.label}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-thiso-600 truncate max-w-[140px]">{delivery.vendorName}</td>
                    <td className="px-4 py-2.5 text-xs text-thiso-400">{VEHICLE_LABEL[delivery.vehicleType]}</td>
                    <td className="px-4 py-2.5"><GoodsBadge type={delivery.goodsType} /></td>
                    <td className="px-4 py-2.5 text-xs font-mono text-thiso-400">{delivery.registrationCode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
