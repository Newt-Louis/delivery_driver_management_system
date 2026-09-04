import { STATUS_FILTER_OPTIONS, VEHICLE_FILTER_OPTIONS } from '../constants';
import type { StatusFilter, VehicleTypeFilter } from '../types';

interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  statusFilter: StatusFilter;
  onStatus: (filter: StatusFilter) => void;
  vehicleFilter: VehicleTypeFilter;
  onVehicle: (filter: VehicleTypeFilter) => void;
  total: number;
  onExport: () => void;
}

export default function FilterBar({
  search,
  onSearch,
  statusFilter,
  onStatus,
  vehicleFilter,
  onVehicle,
  total,
  onExport,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-thiso-400 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Tìm biển số, số thẻ, nhà CC..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-thiso-200 rounded-xl bg-white focus:outline-none focus:border-thiso-500 transition-colors placeholder:text-thiso-300"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-thiso-300 hover:text-thiso-600 text-base"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((option) => (
          <button
            key={option.k}
            type="button"
            onClick={() => onStatus(option.k)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap
              ${statusFilter === option.k ? `${option.color} ring-2 ring-offset-1 ring-thiso-300` : 'bg-thiso-50 text-thiso-500 hover:bg-thiso-100'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        {VEHICLE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.k}
            type="button"
            onClick={() => onVehicle(option.k)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap
              ${vehicleFilter === option.k ? 'bg-thiso-800 text-white' : 'bg-thiso-50 text-thiso-500 hover:bg-thiso-100'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {(search || statusFilter !== 'ALL' || vehicleFilter !== 'ALL') && (
        <span className="text-xs text-thiso-400">{total} kết quả</span>
      )}

      <button
        type="button"
        onClick={onExport}
        className="btn-success ml-auto gap-1.5 px-3 py-1.5 text-xs"
      >
        ⬇ Xuất Excel
      </button>
    </div>
  );
}
