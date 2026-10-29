import { Button, Table, Tag } from 'antd';
import type { DeliveryHistoryItem, DeliverySortField, SortDir } from '../types';
import { STATUS_LABEL, GOODS_LABEL, VEHICLE_LABEL } from '../constants';
import { formatDateTime } from '../formatters';
import { CellHeader, Pagination, SortHeader } from './TableParts';
import { unitPresentation } from '../../../lib/unitPresentation';

interface DeliveryTableProps {
  items: DeliveryHistoryItem[];
  isLoading: boolean;
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  sortField: DeliverySortField;
  sortDir: SortDir;
  onSort: (field: DeliverySortField) => void;
  onRowDoubleClick: (item: DeliveryHistoryItem) => void;
  visibleColumns: string[];
}

export default function DeliveryTable({
  items, isLoading, page, pages, total, onPageChange,
  sortField, sortDir, onSort, onRowDoubleClick, visibleColumns,
}: DeliveryTableProps) {
  const COL_MAP: Record<string, { header: React.ReactNode; render: (d: DeliveryHistoryItem) => React.ReactNode }> = {
    registrationCode: { header: <SortHeader field="registrationCode" label="Mã chuyến" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="font-mono text-xs text-thiso-600">{d.registrationCode}</span> },
    vendorName: { header: <CellHeader label="Nhà cung cấp" />, render: (d) => <span className="text-xs">{d.vendorName}</span> },
    driverName: { header: <CellHeader label="Tài xế" />, render: (d) => <span className="text-xs">{d.driverName}</span> },
    vehiclePlate: { header: <CellHeader label="Biển số" />, render: (d) => <span className="font-mono text-xs font-bold text-thiso-700">{d.vehiclePlate}</span> },
    receivingUnit: {
      header: <SortHeader field="receivingUnit" label="Đơn vị nhận" sortField={sortField} sortDir={sortDir} onSort={onSort} />,
      render: (d) => <span className="text-xs">{unitPresentation(d.receivingUnit, d.unitConfig).shortName}</span>,
    },
    goodsType: { header: <SortHeader field="goodsType" label="Loại hàng" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs">{GOODS_LABEL[d.goodsType] ?? d.goodsType}</span> },
    vehicleType: { header: <SortHeader field="vehicleType" label="Loại xe" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs">{VEHICLE_LABEL[d.vehicleType] ?? d.vehicleType}</span> },
    finalStatus: { header: <SortHeader field="finalStatus" label="Trạng thái" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <Tag color={d.finalStatus === 'COMPLETED' ? 'success' : 'default'}>{STATUS_LABEL[d.finalStatus] ?? d.finalStatus}</Tag> },
    ticketNumber: { header: <SortHeader field="ticketNumber" label="Số phiếu" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs font-mono">{d.ticketNumber ?? '—'}</span> },
    assignedSlotCode: { header: <CellHeader label="Slot" />, render: (d) => <span className="text-xs font-mono text-thiso-500">{d.assignedSlotCode ?? '—'}</span> },
    callCount: { header: <SortHeader field="callCount" label="Số lần gọi" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs">{d.callCount}</span> },
    registeredAt: { header: <SortHeader field="registeredAt" label="Giờ đăng ký" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.registeredAt)}</span> },
    checkinTime: { header: <SortHeader field="checkinTime" label="Giờ check-in" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.checkinTime)}</span> },
    calledTime: { header: <SortHeader field="calledTime" label="Giờ gọi" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.calledTime)}</span> },
    receivingStartTime: { header: <SortHeader field="receivingStartTime" label="Giờ bắt đầu nhận" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.receivingStartTime)}</span> },
    completedTime: { header: <SortHeader field="completedTime" label="Giờ hoàn tất" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.completedTime)}</span> },
    closeReason: { header: <CellHeader label="Lý do đóng" />, render: (d) => <span className="text-xs text-thiso-500 truncate max-w-[150px] block" title={d.closeReason ?? ''}>{d.closeReason ?? '—'}</span> },
    archivedAt: { header: <SortHeader field="archivedAt" label="Thời gian lưu trữ" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.archivedAt)}</span> },
  };

  return <div><Table<DeliveryHistoryItem> rowKey="id" loading={isLoading} dataSource={items} pagination={false} scroll={{ x: 'max-content' }} columns={[...visibleColumns.filter(key => COL_MAP[key]).map(key => ({ key, title: COL_MAP[key].header, render: (_: unknown, item: DeliveryHistoryItem) => COL_MAP[key].render(item) })), { key: 'detail', title: 'Chi tiết', render: (_: unknown, item: DeliveryHistoryItem) => <Button onClick={() => onRowDoubleClick(item)}>Xem</Button> }]} /><Pagination page={page} pages={pages} total={total} onPageChange={onPageChange} /></div>;
}
