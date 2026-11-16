import { Table, Tag, Typography } from 'antd';
import type { RegistrationHistoryItem, RegistrationSortField, SortDir } from '../types';
import { GOODS_LABEL, REGISTRATION_DEVICE_LABEL, REGISTRATION_SOURCE_LABEL, VEHICLE_LABEL } from '../constants';
import { formatDateTime } from '../formatters';
import { CellHeader, Pagination, SortHeader } from './TableParts';
import { unitPresentation } from '../../../lib/unitPresentation';

interface RegistrationTableProps {
  items: RegistrationHistoryItem[];
  isLoading: boolean;
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  sortField: RegistrationSortField;
  sortDir: SortDir;
  onSort: (field: RegistrationSortField) => void;
  visibleColumns: string[];
}

function StatusCell({ item }: { item: RegistrationHistoryItem }) {
  if (!item.supersededAt) return <Tag color="success">Lượt được sử dụng</Tag>;
  return (
    <div className="space-y-0.5">
      <Tag color="default">Đã bị thay thế</Tag>
      <div className="text-xs text-thiso-500">
        bởi <span className="font-mono">{item.supersededByCode ?? '—'}</span> lúc {formatDateTime(item.supersededAt)}
      </div>
    </div>
  );
}

export default function RegistrationTable({
  items, isLoading, page, pages, total, onPageChange,
  sortField, sortDir, onSort, visibleColumns,
}: RegistrationTableProps) {
  const sortHeader = (field: RegistrationSortField, label: string) => (
    <SortHeader field={field} label={label} sortField={sortField} sortDir={sortDir} onSort={onSort} />
  );
  const COL_MAP: Record<string, { header: React.ReactNode; render: (d: RegistrationHistoryItem) => React.ReactNode }> = {
    registeredAt: { header: sortHeader('registeredAt', 'Giờ đăng ký'), render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.registeredAt, 'medium')}</span> },
    registrationCode: { header: sortHeader('registrationCode', 'Mã đăng ký'), render: (d) => <span className="font-mono text-xs text-thiso-600">{d.registrationCode}</span> },
    vehiclePlate: { header: sortHeader('vehiclePlate', 'Biển số'), render: (d) => <span className="font-mono text-xs font-bold text-thiso-700">{d.vehiclePlate}</span> },
    dailyRegistrationCount: {
      header: <CellHeader label="Số lần đăng ký trong ngày" />,
      render: (d) => d.dailyRegistrationCount > 1
        ? <Tag color="warning">{d.dailyRegistrationCount} lần</Tag>
        : <span className="text-xs">1 lần</span>,
    },
    status: { header: <CellHeader label="Trạng thái" />, render: (d) => <StatusCell item={d} /> },
    deviceType: { header: <CellHeader label="Thiết bị" />, render: (d) => <span className="text-xs">{d.deviceType ? REGISTRATION_DEVICE_LABEL[d.deviceType] : 'Không xác định'}</span> },
    registrationSource: { header: <CellHeader label="Hình thức" />, render: (d) => <span className="text-xs">{d.registrationSource ? REGISTRATION_SOURCE_LABEL[d.registrationSource] : 'Không xác định'}</span> },
    poNumber: { header: <CellHeader label="Mã PO / Thi Công" />, render: (d) => <span className="font-mono text-xs">{d.poNumber || '—'}</span> },
    driverName: { header: <CellHeader label="Tài xế" />, render: (d) => <span className="text-xs">{d.driverName || '—'}</span> },
    driverPhone: { header: <CellHeader label="Số điện thoại" />, render: (d) => <span className="font-mono text-xs">{d.driverPhone}</span> },
    vendorName: { header: <CellHeader label="Nhà cung cấp" />, render: (d) => <span className="text-xs">{d.vendorName || '—'}</span> },
    receivingUnit: { header: sortHeader('receivingUnit', 'Đơn vị nhận'), render: (d) => <span className="text-xs">{unitPresentation(d.receivingUnit, d.unitConfig).shortName}</span> },
    vehicleType: { header: sortHeader('vehicleType', 'Loại xe'), render: (d) => <span className="text-xs">{VEHICLE_LABEL[d.vehicleType] ?? d.vehicleType}</span> },
    goodsType: { header: <CellHeader label="Loại hàng" />, render: (d) => <span className="text-xs">{GOODS_LABEL[d.goodsType] ?? d.goodsType}</span> },
    note: { header: <CellHeader label="Ghi chú" />, render: (d) => d.note ? <Typography.Text className="!text-xs block max-w-[220px]" ellipsis={{ tooltip: d.note }}>{d.note}</Typography.Text> : <span className="text-xs">—</span> },
  };

  return (
    <div>
      <Table<RegistrationHistoryItem>
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={visibleColumns.filter((key) => COL_MAP[key]).map((key) => ({
          key,
          title: COL_MAP[key].header,
          render: (_: unknown, item: RegistrationHistoryItem) => COL_MAP[key].render(item),
        }))}
      />
      <Pagination page={page} pages={pages} total={total} onPageChange={onPageChange} />
    </div>
  );
}
