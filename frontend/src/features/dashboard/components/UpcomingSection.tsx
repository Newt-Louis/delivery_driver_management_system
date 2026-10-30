import { useEffect } from 'react';
import { Collapse, Descriptions, Grid, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import GoodsBadge from '../../../components/GoodsBadge';
import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import { VEHICLE_LABEL } from '../constants';
import type { UnitKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';
import { LoadMoreTrigger } from './LoadMoreTrigger';
import { useProgressiveRows } from '../hooks/useProgressiveRows';

function localDateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
export default function UpcomingSection({ deliveries, unit, unitConfig, unitConfigsByUnit }: { deliveries: DeliveryRegistration[]; unit?: UnitKey; unitConfig?: UnitDispatch['unitConfig']; unitConfigsByUnit?: Record<string, UnitDispatch['unitConfig'] | undefined> }) {
 const screens = Grid.useBreakpoint();
 const { limit, hasMore, loadMore, reset } = useProgressiveRows(deliveries.length);
 useEffect(() => { reset(); }, [unit, reset]);
 const visible = deliveries.slice(0, limit);
 if (!deliveries.length) return null;
 function date(d: DeliveryRegistration) { const past = d.requestedTime && localDateKey(new Date(d.requestedTime)) < localDateKey(new Date()); return <>{d.requestedTime ? new Date(d.requestedTime).toLocaleDateString('vi-VN') : '—'} {past && <Tag color="warning">Quá ngày</Tag>}</>; }
 function unitName(d: DeliveryRegistration) { return getUnitMeta(d.receivingUnit, d.unitConfig ?? d.assignedSlot?.zone?.unitConfig ?? unitConfig ?? unitConfigsByUnit?.[d.receivingUnit]); }
 const columns: ColumnsType<DeliveryRegistration> = [
  { title: 'Ngày giao', key: 'date', render: (_, d) => date(d) },
  { title: 'Biển số', dataIndex: 'vehiclePlate' },
  ...(!unit ? [{ title: 'Đơn vị', key: 'unit', render: (_: unknown, d: DeliveryRegistration) => { const meta = unitName(d); return <Space><UnitBrandMark meta={meta} />{meta.label}</Space>; } }] : []),
  { title: 'Nhà cung cấp', dataIndex: 'vendorName' }, { title: 'Loại xe', key: 'vehicle', render: (_, d) => VEHICLE_LABEL[d.vehicleType] }, { title: 'Hàng', key: 'goods', render: (_, d) => <GoodsBadge type={d.goodsType} /> }, { title: 'Mã ĐK', dataIndex: 'registrationCode' },
 ];
 const content = screens.lg ? <Table rowKey="id" columns={columns} dataSource={visible} pagination={false} scroll={{ x: 900 }} /> : <Collapse items={visible.map(d => ({ key: d.id, label: <Space orientation="vertical" size={0}><Typography.Text strong>{d.vehiclePlate}</Typography.Text><Typography.Text type="secondary">{unitName(d).label}</Typography.Text></Space>, children: <Descriptions size="small" column={1} items={[{ key: 'date', label: 'Ngày giao', children: date(d) }, ...(!unit ? [{ key: 'unit', label: 'Đơn vị', children: unitName(d).label }] : []), { key: 'vendor', label: 'Nhà cung cấp', children: d.vendorName }, { key: 'vehicle', label: 'Loại xe', children: VEHICLE_LABEL[d.vehicleType] }, { key: 'goods', label: 'Hàng', children: <GoodsBadge type={d.goodsType} /> }, { key: 'registration', label: 'Mã ĐK', children: d.registrationCode }]} /> }))} />;
 return <Collapse className="mt-5" defaultActiveKey={['upcoming']} items={[{ key: 'upcoming', label: `Đã đặt — chưa check-in (${deliveries.length})`, children: <>{content}<LoadMoreTrigger key={limit} hasMore={hasMore} onLoadMore={loadMore} /></> }]} />;
}
