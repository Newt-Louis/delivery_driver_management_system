import type { AuditLogItem, AuditSortField, SortDir } from '../types';
import { ACTOR_TYPE_LABEL } from '../constants';

function fmtDt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function SortHeader({ field, label, sortField, sortDir, onSort }: {
  field: AuditSortField; label: string; sortField: AuditSortField; sortDir: SortDir; onSort: (f: AuditSortField) => void;
}) {
  const active = sortField === field;
  return (
    <th className="px-3 py-3 cursor-pointer hover:bg-thiso-100 select-none whitespace-nowrap" onClick={() => onSort(field)}>
      <span className={active ? 'text-sky-700 font-bold' : ''}>{label}</span>
      {active && <span className="ml-1 text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

function CellHeader({ label }: { label: string }) {
  return <th className="px-3 py-3 whitespace-nowrap">{label}</th>;
}

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
    createdAt: { header: <SortHeader field="createdAt" label="Thời gian" sortField={sortField} sortDir={sortDir} onSort={onSort} />, render: (d) => <span className="text-xs text-thiso-500">{fmtDt(d.createdAt)}</span> },
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
                <th key={key} className="px-3 py-3">{COL_MAP[key]?.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={visibleColumns.length} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={visibleColumns.length} className="py-12 text-center text-thiso-400">Không có dữ liệu</td></tr>
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
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-thiso-100 bg-thiso-50">
          <span className="text-xs text-thiso-400">Tổng: {total.toLocaleString()} · Trang {page}/{pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
              className="px-3 py-1 text-xs border border-thiso-200 rounded-lg bg-white hover:bg-thiso-50 disabled:opacity-40">← Trước</button>
            <button disabled={page >= pages} onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 text-xs border border-thiso-200 rounded-lg bg-white hover:bg-thiso-50 disabled:opacity-40">Tiếp →</button>
          </div>
        </div>
      )}
    </div>
  );
}
