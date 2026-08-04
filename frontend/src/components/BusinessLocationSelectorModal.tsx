import type { BusinessLocation } from '../lib/types';

interface BusinessLocationSelectorModalProps {
  open: boolean;
  title?: string;
  description?: string;
  locations: BusinessLocation[];
  currentId?: string | null;
  loading?: boolean;
  saving?: boolean;
  required?: boolean;
  error?: string | null;
  onSelect: (businessLocationId: string) => void;
  onClose?: () => void;
}

export default function BusinessLocationSelectorModal({
  open,
  title = 'Chọn khu vực vận hành',
  description = 'Chọn một BusinessLocation để bắt đầu làm việc trong phạm vi dữ liệu của khu vực đó.',
  locations,
  currentId,
  loading = false,
  saving = false,
  required = false,
  error,
  onSelect,
  onClose,
}: BusinessLocationSelectorModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-thiso-900/60 px-4 py-6"
      onClick={(event) => {
        if (!required && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-thiso-100 overflow-hidden">
        <div className="flex items-start gap-4 border-b border-thiso-100 px-5 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-black text-thiso-900">{title}</h2>
            <p className="mt-1 text-sm text-thiso-500">{description}</p>
          </div>
          {!required && (
            <button
              type="button"
              className="h-9 w-9 rounded-lg text-thiso-400 hover:bg-thiso-100 hover:text-thiso-800"
              onClick={onClose}
              aria-label="Đóng"
            >
              ×
            </button>
          )}
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-xl border border-thiso-100 bg-thiso-50 px-4 py-8 text-center text-sm text-thiso-500">
              Đang tải danh sách khu vực...
            </div>
          ) : locations.length === 0 ? (
            <div className="rounded-xl border border-thiso-100 bg-thiso-50 px-4 py-8 text-center text-sm text-thiso-500">
              Chưa có BusinessLocation nào đang hoạt động.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {locations.map((location) => {
                const selected = currentId === location.id;
                const unitCount = location.unitConfigs?.length ?? 0;
                return (
                  <button
                    key={location.id}
                    type="button"
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-thiso-800 bg-thiso-50 shadow-sm'
                        : 'border-thiso-100 bg-white hover:border-thiso-300 hover:bg-thiso-50'
                    }`}
                    disabled={saving}
                    onClick={() => onSelect(location.id)}
                  >
                    <div className="flex items-start gap-3">
                      {location.logoUrl ? (
                        <img
                          src={location.logoUrl}
                          alt={location.locationName}
                          className="h-10 w-10 rounded-lg border border-thiso-100 object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-thiso-900 text-xs font-black text-white">
                          {location.code.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-thiso-900">
                          {location.locationName}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-semibold text-thiso-400">
                          {location.code}
                        </div>
                        <div className="mt-2 text-xs text-thiso-500">
                          {unitCount} đơn vị đang hoạt động
                        </div>
                      </div>
                    </div>
                    {selected && (
                      <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-thiso-700">
                        Đang là khu vực làm việc hiện tại
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
