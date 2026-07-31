import type { AuditLogItem, AuditSortField, SortDir } from '../types';
import { ACTOR_TYPE_LABEL } from '../constants';
import { formatDateTime } from '../formatters';
import { CellHeader, EmptyStateRow, Pagination, SortHeader } from './TableParts';

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
    before: { header: <CellHeader label="Trước" />, render: (d) => d.before ? <span className="text-xs text-green-600">✓</span> : <span className="text-xs text-thiso-300">—</span> },
    after: { header: <CellHeader label="Sau" />, render: (d) => d.after ? <span className="text-xs text-sky-600">✓</span> : <span className="text-xs text-thiso-300">—</span> },
  };

  return (
    <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
              {visibleColumns.map((key) => (
                <th key={key} className="px-3 py-3 hover:bg-thiso-100">{COL_MAP[key]?.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <EmptyStateRow colSpan={visibleColumns.length}>Đang tải...</EmptyStateRow>
            )}
            {!isLoading && items.length === 0 && (
              <EmptyStateRow colSpan={visibleColumns.length}>Không có dữ liệu</EmptyStateRow>
            )}
            {items.map((d) => (
              <tr
                key={d.id}
                className="border-b border-thiso-50 last:border-0 hover:bg-thiso-50/40 transition-colors cursor-pointer"
                onDoubleClick={() => onRowDoubleClick(d)}
                title="Double-click để xem chi tiết"
              >
                {visibleColumns.map((key) => (
                  <td key={key} className="px-3 py-2.5">{COL_MAP[key]?.render(d)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={pages} total={total} onPageChange={onPageChange} />
    </div>
  );
}
