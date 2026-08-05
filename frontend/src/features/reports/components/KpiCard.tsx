export default function KpiCard({ label, value, sub, color = 'text-thiso-800' }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-thiso-100 px-5 py-4 shadow-sm">
      <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-3xl font-black leading-none ${color}`}>{value}</div>
      {sub && <div className="text-xs text-thiso-400 mt-1.5">{sub}</div>}
    </div>
  );
}
