import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Spin, Timeline, Typography } from 'antd';
import type { DeliveryRegistration } from '../../../lib/types';
import { fetchDeliveryDetail } from '../api';
import { GOODS_LABEL, VEHICLE_FULL } from '../constants';
import { formatDateOnly, formatDateTime, getDeliveryTimeline, getUnitMeta } from '../utils';

interface Props {
  id: string;
}

/**
 * Read-only delivery details shown when a dispatch row is expanded.
 * Fetches GET /api/deliveries/:id only when mounted (row opened), because the
 * history timeline is not part of the dispatch payload. No action buttons here:
 * actions stay in the row itself.
 */
export default function DeliveryDetailPanel({ id }: Props) {
  const { data: d, isLoading, isError, refetch } = useQuery<DeliveryRegistration>({
    queryKey: ['delivery', id],
    queryFn: () => fetchDeliveryDetail(id),
    staleTime: 5000,
  });

  if (isLoading) return <Spin size="small"><div style={{ minHeight: 80 }} /></Spin>;
  if (isError || !d) {
    return <Alert type="error" showIcon title="Không thể tải chi tiết" action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>} />;
  }

  const meta = getUnitMeta(d.receivingUnit, d.unitConfig ?? d.assignedSlot?.zone?.unitConfig ?? undefined);
  const timeline = getDeliveryTimeline(d);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2, xl: 3 }}
        items={[
          { key: 'vendor', label: 'Nhà cung cấp', children: d.vendorName },
          { key: 'registration', label: 'Mã đăng ký', children: d.registrationCode },
          { key: 'driver', label: 'Tài xế', children: d.driverName },
          { key: 'phone', label: 'Điện thoại', children: <a href={`tel:${d.driverPhone}`}>{d.driverPhone}</a> },
          { key: 'plate', label: 'Biển số xe', children: d.vehiclePlate },
          { key: 'vehicle', label: 'Loại xe', children: VEHICLE_FULL[d.vehicleType] },
          { key: 'unit', label: 'Đơn vị nhận', children: meta.label },
          { key: 'goods', label: 'Loại hàng', children: GOODS_LABEL[d.goodsType] ?? d.goodsType },
          { key: 'calls', label: 'Số lần gọi', children: d.callCount ?? 0 },
          ...(d.poNumber ? [{ key: 'po', label: 'Số PO', children: d.poNumber }] : []),
          ...(d.note ? [{ key: 'note', label: 'Ghi chú', children: d.note }] : []),
          ...(d.cancelReason ? [{ key: 'reason', label: 'Lý do hủy', children: d.cancelReason }] : []),
          { key: 'date', label: 'Ngày giao', children: formatDateOnly(d.requestedTime) },
          { key: 'created', label: 'Giờ đăng ký', children: formatDateTime(d.createdAt) },
          { key: 'checkin', label: 'Check-in', children: formatDateTime(d.checkinTime) },
          { key: 'called', label: 'Được gọi', children: formatDateTime(d.calledTime) },
          { key: 'start', label: 'Bắt đầu nhận', children: formatDateTime(d.receivingStartTime) },
          { key: 'completed', label: 'Hoàn tất', children: formatDateTime(d.completedTime) },
          ...(d.assignedSlot ? [{ key: 'slot', label: 'Vị trí được phân công', children: `${d.assignedSlot.name}${d.assignedSlot.zone ? ` (${d.assignedSlot.zone.code})` : ''}` }] : []),
        ]}
      />
      <div className="min-w-0">
        <Typography.Title level={5} className="!mt-0">Lịch sử hoạt động</Typography.Title>
        {timeline.length
          ? <Timeline items={timeline.map((e) => ({ children: <>{e.label}<br /><Typography.Text type="secondary">{formatDateTime(e.time)}</Typography.Text></> }))} />
          : <Typography.Text type="secondary">Chưa có lịch sử</Typography.Text>}
      </div>
    </div>
  );
}
