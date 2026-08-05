export default function ExportBtn({ onClick, label = 'Xuất Excel' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
    >
      <span>⬇</span>{label}
    </button>
  );
}
