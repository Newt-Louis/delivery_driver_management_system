import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Collapse, Empty, Grid, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import StatusBadge from '../../../components/StatusBadge';
import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import { downloadCsv } from '../../../lib/export';
import { formatWait } from '../../../lib/utils';
import { DISPATCH_CSV_HEADERS, GOODS_CSV_LABEL, VEHICLE_FULL } from '../constants';
import type { DeliveryLifecycleAction, StatusFilter, UnitKey, VehicleTypeFilter } from '../types';
import { buildDispatchCsvRows, filterDispatchDeliveries, getDeliveryWaitState, getTicketCode, getUnitMeta } from '../utils';
import FilterBar from './FilterBar';
import UnitBrandMark from './UnitBrandMark';
import DeliveryDetailPanel from './DeliveryDetailPanel';
import { LoadMoreTrigger } from './LoadMoreTrigger';
import { useProgressiveRows } from '../hooks/useProgressiveRows';

interface Props {
  deliveries: DeliveryRegistration[];
  unit?: UnitKey;
  unitConfig?: UnitDispatch['unitConfig'];
  unitConfigsByUnit?: Record<string, UnitDispatch['unitConfig'] | undefined>;
  onCall: (delivery: DeliveryRegistration, slotId?: string) => void;
  onAction: (id: string, action: DeliveryLifecycleAction) => void;
  onRecall: (delivery: DeliveryRegistration) => void;
  actionLoading: string | null;
}

export default function QueueTable({ deliveries, unit, unitConfig, unitConfigsByUnit, onCall, onAction, onRecall, actionLoading }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleTypeFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const screens = Grid.useBreakpoint();
  const filtered = useMemo(() => filterDispatchDeliveries(deliveries, search, statusFilter, vehicleFilter), [deliveries, search, statusFilter, vehicleFilter]);
  const { limit, hasMore, loadMore, reset } = useProgressiveRows(filtered.length);
  useEffect(() => { reset(); }, [unit, reset]);
  const visible = filtered.slice(0, limit);
  const config = (d: DeliveryRegistration) => d.unitConfig ?? d.assignedSlot?.zone?.unitConfig ?? unitConfig ?? unitConfigsByUnit?.[d.receivingUnit];

  function waitInfo(d: DeliveryRegistration) {
    const { calledMin, isCritical, isWarning } = getDeliveryWaitState(d);
    const time = d.status === 'WAITING' ? d.checkinTime : d.status === 'CALLED' ? d.calledTime : d.receivingStartTime;
    return <Space orientation="vertical" size={0}><span>{time ? formatWait(time) : '—'}</span>{d.status === 'CALLED' && calledMin >= 15 ? <Tag color="error">Chưa vào</Tag> : (isCritical || isWarning) ? <Tag color={isCritical ? 'error' : 'warning'}>Chờ lâu</Tag> : null}</Space>;
  }

  function actions(d: DeliveryRegistration) {
    return <Space wrap size="small" style={{ maxWidth: 170 }} onClick={event => event.stopPropagation()}>
      {d.status === 'WAITING' && <Button color="cyan" variant="solid" onClick={() => onCall(d)} size="small">Gọi vào vị trí</Button>}
      {d.status === 'CALLED' && <><Button type="primary" disabled={!!actionLoading} loading={actionLoading === d.id + 'start-receiving'} onClick={() => onAction(d.id, 'start-receiving')} size="small">Bắt đầu nhận</Button><Button color="orange" variant="solid" disabled={!!actionLoading} loading={actionLoading === d.id + 'recall'} onClick={() => onRecall(d)} size="small">Gọi lại</Button></>}
      {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status) && <Button color="green" variant="solid" disabled={!!actionLoading} loading={actionLoading === d.id + 'complete'} onClick={() => onAction(d.id, 'complete')} size="small">Hoàn tất</Button>}
      {!['COMPLETED', 'CANCELLED'].includes(d.status) && <Button danger disabled={!!actionLoading} onClick={() => onAction(d.id, 'cancel')} size="small">Hủy</Button>}
    </Space>;
  }

  const columns: ColumnsType<DeliveryRegistration> = [
    // { title: 'Mã ĐK', dataIndex: 'registrationCode', width: 80 },
    // { title: 'Nhà cung cấp', key: 'vendor', width: 100, render: (_, d) => <>{d.vendorName}{d.poNumber && <div>PO: {d.poNumber}</div>}</> },
    { title: 'Số thẻ', key: 'ticket', width: 120, render: (_, d) => getTicketCode(d, config(d)) ?? '—' },
    { title: 'Biển số · Tài xế', key: 'driver', width: 160, render: (_, d) => <><Typography.Text strong>{d.vehiclePlate}</Typography.Text><br />{d.driverName}<br />{d.driverPhone}{!!d.callCount && <div>Gọi {d.callCount} lần</div>}</> },
    ...(!unit ? [{ title: 'Đơn vị', key: 'unit', width: 60, render: (_: unknown, d: DeliveryRegistration) => { const meta = getUnitMeta(d.receivingUnit, config(d)); return <Space><UnitBrandMark meta={meta} />{meta.label}</Space>; } }] : []),
    { title: 'Vị trí', key: 'slot', width: 60, render: (_, d) => d.assignedSlot ? <>{d.assignedSlot.name}</> : '—' },
    { title: 'Loại hàng giao', key: 'goods', width: 100, render: (_, d) => <Typography.Text strong>{GOODS_CSV_LABEL[d.goodsType] ?? d.goodsType}</Typography.Text> },
    { title: 'Loại xe', key: 'vehicle', width: 60, render: (_, d) => VEHICLE_FULL[d.vehicleType] },
    { title: 'Thời gian', key: 'wait', width: 40, render: (_, d) => waitInfo(d) },
    { title: 'Trạng thái', key: 'status', width: 30, render: (_, d) => <StatusBadge status={d.status} /> },
    { title: 'Thao tác', key: 'actions', width: 80, render: (_, d) => actions(d) },
  ];
  const emptyText = deliveries.length ? 'Không tìm thấy kết quả phù hợp' : 'Không có xe nào đang điều phối';
  return <Space orientation="vertical" size="middle" className="w-full">
    <FilterBar search={search} onSearch={value => { setSearch(value); reset(); }} statusFilter={statusFilter} onStatus={value => { setStatusFilter(value); reset(); }} vehicleFilter={vehicleFilter} onVehicle={value => { setVehicleFilter(value); reset(); }} total={filtered.length} onExport={() => downloadCsv('dieu-phoi-hang-cho', DISPATCH_CSV_HEADERS, buildDispatchCsvRows(filtered, unitConfigsByUnit ?? (unitConfig ? { [unit ?? '']: unitConfig } : undefined)))} />
    {screens.lg
      ? <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<DeliveryRegistration>
          rowKey="id"
          columns={columns}
          dataSource={visible}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description={emptyText} /> }}
          rowClassName={d => d.id === expandedId ? 'cursor-pointer [&>td]:!bg-[var(--ant-color-primary-bg)]' : 'cursor-pointer'}
          expandable={{
            expandRowByClick: true,
            expandedRowKeys: expandedId ? [expandedId] : [],
            onExpand: (expanded, d) => setExpandedId(expanded ? d.id : null),
            expandedRowRender: d => <DeliveryDetailPanel id={d.id} />,
          }}
        />
      </Card>
      : filtered.length === 0
        ? <Empty description={emptyText} />
        : <Collapse
          accordion
          activeKey={expandedId ? [expandedId] : []}
          onChange={key => setExpandedId((Array.isArray(key) ? key[0] : key) ?? null)}
          items={visible.map(d => {
            const meta = getUnitMeta(d.receivingUnit, config(d));
            return {
              key: d.id,
              label: <Space orientation="vertical" size={2} className="min-w-0"><Space wrap><Typography.Text strong>{d.vehiclePlate}</Typography.Text><StatusBadge status={d.status} /></Space><Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>{getTicketCode(d, config(d)) ?? 'Chưa có số thẻ'} · {meta.label}</Typography.Text></Space>,
              children: <Space orientation="vertical" size="middle" className="w-full"><Space align="start"><Typography.Text type="secondary">Thời gian:</Typography.Text>{waitInfo(d)}</Space><DeliveryDetailPanel id={d.id} />{actions(d)}</Space>,
            };
          })}
        />}
    <LoadMoreTrigger key={limit} hasMore={hasMore} onLoadMore={loadMore} />
  </Space>;
}
