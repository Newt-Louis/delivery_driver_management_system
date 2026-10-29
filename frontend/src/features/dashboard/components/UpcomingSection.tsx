import { Collapse, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import GoodsBadge from '../../../components/GoodsBadge';
import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import { VEHICLE_LABEL } from '../constants';
import type { UnitKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';
function localDateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
export default function UpcomingSection({ deliveries, unit, unitConfig, unitConfigsByUnit }: { deliveries: DeliveryRegistration[]; unit?: UnitKey; unitConfig?: UnitDispatch['unitConfig']; unitConfigsByUnit?: Record<string, UnitDispatch['unitConfig'] | undefined> }) {
 if (!deliveries.length) return null;
 const columns: ColumnsType<DeliveryRegistration> = [
 { title: 'Ngày giao', key: 'date', render: (_, d) => { const past = d.requestedTime && localDateKey(new Date(d.requestedTime)) < localDateKey(new Date()); return <>{d.requestedTime ? new Date(d.requestedTime).toLocaleDateString('vi-VN') : '—'} {past && <Tag color="warning">Quá ngày</Tag>}</>; } },
 { title: 'Biển số', dataIndex: 'vehiclePlate' }, ...(!unit ? [{ title: 'Đơn vị', key: 'unit', render: (_: unknown, d: DeliveryRegistration) => { const meta = getUnitMeta(d.receivingUnit, d.unitConfig ?? d.assignedSlot?.zone?.unitConfig ?? unitConfig ?? unitConfigsByUnit?.[d.receivingUnit]); return <Space><UnitBrandMark meta={meta} />{meta.label}</Space>; } }] : []),
 { title: 'Nhà cung cấp', dataIndex: 'vendorName' }, { title: 'Loại xe', key: 'vehicle', render: (_, d) => VEHICLE_LABEL[d.vehicleType] }, { title: 'Hàng', key: 'goods', render: (_, d) => <GoodsBadge type={d.goodsType} /> }, { title: 'Mã ĐK', dataIndex: 'registrationCode' } ];
 return <Collapse className="mt-5" defaultActiveKey={['upcoming']} items={[{ key: 'upcoming', label: `Đã đặt — chưa check-in (${deliveries.length})`, children: <Table rowKey="id" columns={columns} dataSource={deliveries} pagination={false} scroll={{ x: 900 }} /> }]} />;
}
