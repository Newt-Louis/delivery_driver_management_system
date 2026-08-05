export default function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'bg-red-500' : pct >= 65 ? 'bg-amber-500' : pct >= 30 ? 'bg-green-500' : 'bg-thiso-300';
  const textColor = pct >= 85 ? 'text-red-600' : pct >= 65 ? 'text-amber-600' : 'text-thiso-600';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-thiso-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${textColor}`}>{pct}%</span>
    </div>
  );
}
