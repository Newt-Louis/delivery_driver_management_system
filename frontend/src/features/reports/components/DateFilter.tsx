import type { UnitConfig } from '../../../lib/types';
import { defaultTo } from '../utils';

export default function DateFilter({ from, to, unit, units, onFrom, onTo, onUnit }: {
  from: string; to: string; unit: string;
  units: UnitConfig[];
  onFrom: (v: string) => void; onTo: (v: string) => void; onUnit: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
        <span className="text-xs text-thiso-400">Từ</span>
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
          className="text-sm text-thiso-700 bg-transparent outline-none" />
      </div>
      <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
        <span className="text-xs text-thiso-400">Đến</span>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
          className="text-sm text-thiso-700 bg-transparent outline-none" />
      </div>
      <select value={unit} onChange={(e) => onUnit(e.target.value)}
        className="bg-white border border-thiso-200 rounded-xl px-3 py-1.5 text-sm text-thiso-700 outline-none">
        <option value="">Tất cả đơn vị</option>
        {units.map((item) => (
          <option key={item.id} value={item.unit}>{item.shortName || item.displayName || item.unit}</option>
        ))}
      </select>
      {[7, 30, 90].map((d) => (
        <button key={d} onClick={() => {
          onFrom(new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10));
          onTo(defaultTo());
        }} className="px-3 py-1.5 text-xs bg-white border border-thiso-200 rounded-xl text-thiso-600 hover:bg-thiso-50 transition-colors">
          {d} ngày
        </button>
      ))}
    </div>
  );
}
