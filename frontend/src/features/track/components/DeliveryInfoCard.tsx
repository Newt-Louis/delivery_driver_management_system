import { Card, Descriptions, Typography } from 'antd';
import { GOODS_LABEL } from '../constants';
import { getTrackUnit, fmtDateOnly } from '../utils';
import type { TrackDelivery } from '../types';

type UnitMeta = ReturnType<typeof getTrackUnit>;

export default function DeliveryInfoCard({ delivery, unitMeta }: {
  delivery: TrackDelivery;
  unitMeta: UnitMeta;
}) {
  const rows = [
    ...(delivery.locationName ? [{ label: 'Khu vực giao hàng', value: delivery.locationName }] : []),
    { label: 'Biển số xe',   value: delivery.vehiclePlate, mono: true },
    { label: 'Tài xế',       value: delivery.driverName },
    { label: 'Nhà cung cấp', value: delivery.vendorName },
    { label: 'Đơn vị nhận',  value: unitMeta.label },
    { label: 'Loại hàng',    value: GOODS_LABEL[delivery.goodsType] ?? delivery.goodsType },
    ...(delivery.poNumber    ? [{ label: 'Mã đối chiếu / PO / Thi công', value: delivery.poNumber, mono: true }] : []),
    ...(delivery.requestedTime ? [{ label: 'Ngày giao',        value: fmtDateOnly(delivery.requestedTime) }] : []),
    ...(delivery.note        ? [{ label: 'Ghi chú',             value: delivery.note }] : []),
  ];

  return (
    <Card size="small" title="Thông tin giao hàng"><Descriptions size="small" column={1} bordered items={rows.map(({ label, value, mono }) => ({ key: label, label, children: mono ? <Typography.Text className="font-mono" copyable>{value}</Typography.Text> : value }))} /></Card>
  );
}
