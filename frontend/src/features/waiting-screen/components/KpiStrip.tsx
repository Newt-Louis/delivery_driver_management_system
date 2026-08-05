export default function KpiStrip({ totalWaiting, totalCalled, totalReceiving, dark = false }: {
  totalWaiting: number; totalCalled: number; totalReceiving: number; dark?: boolean;
}) {
  const items = [
    { label: 'Đang chờ',  value: totalWaiting,   bg: 'rgba(245,158,11,0.18)',  color: '#FBBF24', dot: '#F59E0B' },
    { label: 'Được gọi',  value: totalCalled,    bg: 'rgba(56,189,248,0.18)',  color: '#7DD3FC', dot: '#38BDF8' },
    { label: 'Đang nhận', value: totalReceiving, bg: 'rgba(74,222,128,0.18)', color: '#86EFAC', dot: '#4ADE80' },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((s) => (
        <span key={s.label} className="flex items-center gap-2 font-bold px-3 py-1.5 rounded-full"
              style={{ background: s.bg, color: s.color, fontSize: '0.8rem' }}>
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: s.dot }} />
          <span className="text-lg font-black tabular-nums leading-none">{s.value}</span>
          <span className={dark ? 'opacity-60' : 'opacity-70'}>{s.label}</span>
        </span>
      ))}
    </div>
  );
}
