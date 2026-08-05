import type { ReactNode } from 'react';

export default function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-thiso-400 font-semibold uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-thiso-800">{value}</div>
    </div>
  );
}
