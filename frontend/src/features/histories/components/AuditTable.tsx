import { Button, Table } from 'antd';
import type { AuditLogItem, AuditSortField, SortDir } from '../types';
import { ACTOR_TYPE_LABEL } from '../constants';
import { formatDateTime } from '../formatters';
import { CellHeader, Pagination, SortHeader } from './TableParts';

interface AuditTableProps {
  items: AuditLogItem[];
  isLoading: boolean;
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  sortField: AuditSortField;
  sortDir: SortDir;
  onSort: (field: AuditSortField) => void;
  onRowDoubleClick: (item: AuditLogItem) => void;
  visibleColumns: string[];
}

export default function AuditTable({
  items, isLoading, page, pages, total, onPageChange,
  sortField, sortDir, onSort, onRowDoubleClick, visibleColumns,
}: AuditTableProps) {
  const COL_MAP: Record<string, { header: React.ReactNode; render: (d: AuditLogItem) => React.ReactNode }> = {
    createdAt: { header: <SortHeader field="createdAt" label="Thời gian" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{formatDateTime(d.createdAt)}</span> },
    actorLabel: { header: <CellHeader label="Actor" />, render: (d) => <span className="text-xs font-medium">{d.actorLabel ?? '—'}</span> },
    actorType: { header: <SortHeader field="actorType" label="Loại actor" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs">{ACTOR_TYPE_LABEL[d.actorType] ?? d.actorType}</span> },
    action: { header: <SortHeader field="action" label="Hành động" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs font-medium text-thiso-700">{d.action}</span> },
    targetType: { header: <SortHeader field="targetType" label="Đối tượng" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs">{d.targetType}</span> },
    targetId: { header: <CellHeader label="ID đối tượng" />, render: (d) => <span className="text-xs font-mono text-thiso-400 truncate max-w-[120px] block" title={d.targetId ?? ''}>{d.targetId ?? '—'}</span> },
    before: { header: <CellHeader label="Trước" />, render: (d) => d.before ? <span>Có</span> : <span className="text-xs text-thiso-300">—</span> },
    after: { header: <CellHeader label="Sau" />, render: (d) => d.after ? <span>Có</span> : <span className="text-xs text-thiso-300">—</span> },
  };

  return <div><Table<AuditLogItem> rowKey="id" loading={isLoading} dataSource={items} pagination={false} scroll={{ x: 'max-content' }} columns={[...visibleColumns.filter(key => COL_MAP[key]).map(key => ({ key, title: COL_MAP[key].header, render: (_: unknown, item: AuditLogItem) => COL_MAP[key].render(item) })), { key: 'detail', title: 'Chi tiết', render: (_: unknown, item: AuditLogItem) => <Button onClick={() => onRowDoubleClick(item)}>Xem</Button> }]} /><Pagination page={page} pages={pages} total={total} onPageChange={onPageChange} /></div>;
}
