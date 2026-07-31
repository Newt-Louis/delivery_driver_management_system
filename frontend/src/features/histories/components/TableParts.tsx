import type { ReactNode } from 'react';
import type { SortDir } from '../types';

interface SortHeaderProps<T extends string> {
  field: T;
  label: string;
  sortField: T;
  sortDir: SortDir;
  onSort: (field: T) => void;
}

export function SortHeader<T extends string>({ field, label, sortField, sortDir, onSort }: SortHeaderProps<T>) {
  const active = sortField === field;
  return (
    <button
      type="button"
      className="w-full text-left cursor-pointer hover:text-sky-700 select-none whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <span className={active ? 'text-sky-700 font-bold' : ''}>{label}</span>
      {active && <span className="ml-1 text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );
}

export function CellHeader({ label }: { label: string }) {
  return <span className="whitespace-nowrap">{label}</span>;
}

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-thiso-100 bg-thiso-50">
      <span className="text-xs text-thiso-400">Tổng: {total.toLocaleString()} · Trang {page}/{pages}</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1 text-xs border border-thiso-200 rounded-lg bg-white hover:bg-thiso-50 disabled:opacity-40"
        >
          ← Trước
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1 text-xs border border-thiso-200 rounded-lg bg-white hover:bg-thiso-50 disabled:opacity-40"
        >
          Tiếp →
        </button>
      </div>
    </div>
  );
}

export function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-bold text-thiso-500 mb-1">{label}</div>
      <pre className="bg-thiso-50 rounded-xl p-3 text-xs text-thiso-700 overflow-x-auto max-h-48 overflow-y-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function EmptyStateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-thiso-400">
        {children}
      </td>
    </tr>
  );
}
