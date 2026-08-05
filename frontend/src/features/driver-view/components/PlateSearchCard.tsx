interface PlateSearchCardProps {
  plate: string;
  inputPlate: string;
  onInputPlateChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClear: () => void;
}

export default function PlateSearchCard({
  plate,
  inputPlate,
  onInputPlateChange,
  onSubmit,
  onClear,
}: PlateSearchCardProps) {
  return (
    <div className="card">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="label">Nhập biển số xe của bạn</label>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-xl font-black font-mono uppercase tracking-widest"
            value={inputPlate}
            onChange={(event) => onInputPlateChange(event.target.value.toUpperCase())}
            placeholder="51C-123.45"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button type="submit" className="btn-primary px-5 text-base shrink-0">
            Tìm
          </button>
        </div>
        {plate && (
          <div className="text-xs text-thiso-400 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-sky-400 rounded-full animate-pulse inline-block" />
            Đang theo dõi:{' '}
            <span className="font-mono font-bold text-thiso-700">{plate}</span>
            <button
              type="button"
              className="ml-auto text-thiso-300 hover:text-red-500 transition-colors"
              onClick={onClear}
            >
              ✕ Xóa
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
