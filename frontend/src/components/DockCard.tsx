import { Card, Select, Space, Tag, Typography } from 'antd';
import type { Slot } from '../lib/types';
import { unitPresentation } from '../lib/unitPresentation';

const statuses = {
  AVAILABLE: { label: 'Trống', color: 'success' },
  OCCUPIED: { label: 'Đang dùng', color: 'processing' },
  RESERVED: { label: 'Đặt trước', color: 'warning' },
  MAINTENANCE: { label: 'Bảo trì', color: 'default' },
};
const goods: Record<string, string> = { FRESH_FOOD: 'Tươi sống', AUTO_WAREHOUSE: 'Kho tự động', GENERAL_GOODS: 'Hàng thường', THI_CONG: 'Thi công' };

interface Props {
  slot: Slot;
  onStatusChange?: (slotId: string, status: string) => void;
  canEdit?: boolean;
}

export default function DockCard({ slot, onStatusChange, canEdit }: Props) {
  const status = statuses[slot.status] ?? statuses.AVAILABLE;
  const unit = unitPresentation(slot.assignedUnit, slot.zone?.unitConfig);
  const deliveries = slot.deliveries?.filter((d) => ['CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)) ?? [];
  return (
    <Card size="small" title={slot.code} extra={<Tag color={status.color}>{status.label}</Tag>}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Typography.Text>{slot.name}</Typography.Text>
        <Typography.Text type="secondary">{unit.shortName || unit.label} · {slot.vehicleType === 'TRUCK' ? 'Xe tải' : 'Xe máy'} · {deliveries.length}/{slot.maxCapacity} xe</Typography.Text>
        <Space wrap size={[4, 4]}>
          <Tag>{slot.autoAssign ? 'Tự động' : 'Thủ công'}</Tag>
          {slot.acceptedGoods?.map((g) => <Tag key={g}>{goods[g] ?? g}</Tag>)}
        </Space>
        {deliveries.map((d) => <div key={d.id}><Typography.Text strong>{d.vehiclePlate}</Typography.Text><br /><Typography.Text type="secondary">{d.vendorName}</Typography.Text></div>)}
        {slot.lastUsedAt && slot.status === 'AVAILABLE' && deliveries.length === 0 && <Typography.Text type="secondary">Dùng lần cuối: {new Date(slot.lastUsedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Typography.Text>}
        {canEdit && onStatusChange && slot.isActive && <Select aria-label={`Trạng thái slot ${slot.code}`} style={{ width: '100%' }} value={slot.status} onChange={(value) => onStatusChange(slot.id, value)} options={[
          ...(slot.status === 'AVAILABLE' ? [{ value: 'AVAILABLE', label: 'Trống', disabled: true }] : []),
          { value: 'OCCUPIED', label: 'Đang dùng' }, { value: 'RESERVED', label: 'Đặt trước' }, { value: 'MAINTENANCE', label: 'Bảo trì' },
        ]} />}
      </Space>
    </Card>
  );
}
