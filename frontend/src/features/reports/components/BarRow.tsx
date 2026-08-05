export default function BarRow({ label, value, max, color = 'bg-sky-500' }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-36 text-sm text-thiso-700 truncate shrink-0">{label}</div>
      <div className="flex-1 bg-thiso-100 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-sm font-bold text-thiso-700 w-10 text-right shrink-0">{value}</div>
    </div>
  );
}
