import { GOODS_LABEL } from '../constants';
import { getTrackUnit, fmtDate } from '../utils';
import type { TrackDelivery } from '../types';

type UnitMeta = ReturnType<typeof getTrackUnit>;

export default function DeliveryInfoCard({ delivery, unitMeta }: {
  delivery: TrackDelivery;
  unitMeta: UnitMeta;
}) {
  const rows = [
    { label: 'Biển số xe',   value: delivery.vehiclePlate, mono: true },
    { label: 'Tài xế',       value: delivery.driverName },
    { label: 'Nhà cung cấp', value: delivery.vendorName },
    { label: 'Đơn vị nhận',  value: unitMeta.label },
    { label: 'Loại hàng',    value: GOODS_LABEL[delivery.goodsType] ?? delivery.goodsType },
    ...(delivery.poNumber    ? [{ label: 'Số PO / Mã thi công', value: delivery.poNumber, mono: true }] : []),
    ...(delivery.requestedTime ? [{ label: 'Giờ đăng ký',      value: fmtDate(delivery.requestedTime) }] : []),
    ...(delivery.note        ? [{ label: 'Ghi chú',             value: delivery.note }] : []),
  ];

  return (
    <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-thiso-50">
        <p className="text-[11px] font-semibold text-thiso-400 uppercase tracking-wider">Thông tin giao hàng</p>
      </div>
      <div className="divide-y divide-thiso-50">
        {rows.map(({ label, value, mono }) => (
          <div key={label} className="flex items-start justify-between gap-3 px-5 py-3">
            <span className="text-xs text-thiso-400 flex-shrink-0 pt-0.5 min-w-[100px]">{label}</span>
            <span className={`text-sm font-semibold text-thiso-800 text-right ${mono ? 'font-mono' : ''}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
