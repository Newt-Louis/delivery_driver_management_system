import { useMemo, useState } from 'react';
import { Button, Empty, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import GoodsBadge from '../../../components/GoodsBadge';
import StatusBadge from '../../../components/StatusBadge';
import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import { downloadCsv } from '../../../lib/export';
import { formatWait } from '../../../lib/utils';
import { DISPATCH_CSV_HEADERS, VEHICLE_LABEL } from '../constants';
import type { DeliveryLifecycleAction, StatusFilter, UnitKey, VehicleTypeFilter } from '../types';
import { buildDispatchCsvRows, filterDispatchDeliveries, getDeliveryWaitState, getTicketCode, getUnitMeta } from '../utils';
import FilterBar from './FilterBar';
import UnitBrandMark from './UnitBrandMark';
interface Props { deliveries: DeliveryRegistration[]; unit?: UnitKey; unitConfig?: UnitDispatch['unitConfig']; unitConfigsByUnit?: Record<string, UnitDispatch['unitConfig'] | undefined>; onCall: (delivery: DeliveryRegistration, slotId?: string) => void; onAction: (id: string, action: DeliveryLifecycleAction) => void; onView: (id: string) => void; actionLoading: string | null; }
export default function QueueTable({ deliveries, unit, unitConfig, unitConfigsByUnit, onCall, onAction, onView, actionLoading }: Props) {
 const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL'); const [vehicleFilter, setVehicleFilter] = useState<VehicleTypeFilter>('ALL');
 const filtered = useMemo(() => filterDispatchDeliveries(deliveries, search, statusFilter, vehicleFilter), [deliveries, search, statusFilter, vehicleFilter]);
 const config = (d: DeliveryRegistration) => d.unitConfig ?? d.assignedSlot?.zone?.unitConfig ?? unitConfig ?? unitConfigsByUnit?.[d.receivingUnit];
 const columns: ColumnsType<DeliveryRegistration> = [
  { title: 'Số thẻ', key: 'ticket', render: (_, d) => getTicketCode(d, config(d)) ?? '—' },
  { title: 'Biển số · Tài xế', key: 'driver', render: (_, d) => <><Typography.Text strong>{d.vehiclePlate}</Typography.Text><br />{d.driverName}<br />{d.driverPhone}{!!d.callCount && <div>Gọi {d.callCount} lần</div>}</> },
  ...(!unit ? [{ title: 'Đơn vị', key: 'unit', render: (_: unknown, d: DeliveryRegistration) => { const meta = getUnitMeta(d.receivingUnit, config(d)); return <Space><UnitBrandMark meta={meta} />{meta.label}</Space>; } }] : []),
  { title: 'Nhà cung cấp', key: 'vendor', render: (_, d) => <>{d.vendorName}{d.poNumber && <div>PO: {d.poNumber}</div>}</> },
  { title: 'Mã ĐK', dataIndex: 'registrationCode' },
  { title: 'Hàng · Xe', key: 'goods', render: (_, d) => <><GoodsBadge type={d.goodsType} /><div>{VEHICLE_LABEL[d.vehicleType]}</div></> },
  { title: 'Thời gian', key: 'wait', render: (_, d) => { const { calledMin, isCritical, isWarning } = getDeliveryWaitState(d); const time = d.status === 'WAITING' ? d.checkinTime : d.status === 'CALLED' ? d.calledTime : d.receivingStartTime; return <Space direction="vertical" size={0}>{time ? formatWait(time) : '—'}{d.status === 'CALLED' && calledMin >= 15 ? <Tag color="error">NO-SHOW</Tag> : (isCritical || isWarning) ? <Tag color={isCritical ? 'error' : 'warning'}>Chờ lâu</Tag> : null}</Space>; } },
  { title: 'Vị trí', key: 'slot', render: (_, d) => d.assignedSlot ? <>{d.assignedSlot.code}{d.assignedSlot.zone && <div>{d.assignedSlot.zone.code}</div>}</> : '—' },
  { title: 'Trạng thái', key: 'status', render: (_, d) => <StatusBadge status={d.status} /> },
  { title: 'Thao tác', key: 'actions', render: (_, d) => <Space wrap><Button onClick={() => onView(d.id)}>Xem</Button>{d.status === 'WAITING' && <Button type="primary" onClick={() => onCall(d)}>Gọi vào vị trí</Button>}{d.status === 'CALLED' && <><Button type="primary" disabled={!!actionLoading} loading={actionLoading === d.id + 'start-receiving'} onClick={() => onAction(d.id, 'start-receiving')}>Bắt đầu nhận</Button><Button disabled={!!actionLoading} onClick={() => onCall(d)}>Gọi lại</Button></>}{['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status) && <Button type="primary" disabled={!!actionLoading} loading={actionLoading === d.id + 'complete'} onClick={() => onAction(d.id, 'complete')}>Hoàn tất</Button>}{!['COMPLETED', 'CANCELLED'].includes(d.status) && <Button danger disabled={!!actionLoading} onClick={() => onAction(d.id, 'cancel')}>Hủy</Button>}</Space> },
 ];
 return <><FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter} vehicleFilter={vehicleFilter} onVehicle={setVehicleFilter} total={filtered.length} onExport={() => downloadCsv('dieu-phoi-hang-cho', DISPATCH_CSV_HEADERS, buildDispatchCsvRows(filtered, unitConfigsByUnit ?? (unitConfig ? { [unit ?? '']: unitConfig } : undefined)))} /><Table rowKey="id" columns={columns} dataSource={filtered} pagination={false} scroll={{ x: 1400 }} locale={{ emptyText: <Empty description={deliveries.length ? 'Không tìm thấy kết quả phù hợp' : 'Không có xe nào đang điều phối'} /> }} /></>;
}
