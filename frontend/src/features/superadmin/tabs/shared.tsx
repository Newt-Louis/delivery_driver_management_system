import type { ReactNode } from 'react';

export function StatusBadge({ active }: { active?: boolean }) {
  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-thiso-100 text-thiso-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function EmptyState({ text = 'Chưa có dữ liệu.' }: { text?: string }) {
  return <div className="border border-dashed border-thiso-200 rounded-lg p-6 text-sm text-thiso-500">{text}</div>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto border border-thiso-100 rounded-lg bg-white">{children}</div>;
}
