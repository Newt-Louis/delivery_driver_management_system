import type { ReactNode } from 'react';

export default function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-thiso-400 mb-0.5">{label}</div>
      <div className="text-sm text-thiso-800 font-medium break-words">{value ?? <span className="text-thiso-300">—</span>}</div>
    </div>
  );
}
