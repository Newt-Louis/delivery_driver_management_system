export default function NoUnitsState({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`h-full min-h-[220px] flex items-center justify-center text-center rounded-2xl border ${dark ? 'border-thiso-700 text-thiso-400 bg-thiso-800/40' : 'border-gray-200 text-gray-400 bg-white'}`}>
      <div>
        <div className="text-3xl mb-2">✓</div>
        <div className="text-sm font-semibold">Khu vực kinh doanh đang chưa có đơn vị vận hành.</div>
      </div>
    </div>
  );
}
