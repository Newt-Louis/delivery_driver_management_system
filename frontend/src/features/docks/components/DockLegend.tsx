import { DOCK_LEGEND_ITEMS } from '../constants';

export default function DockLegend() {
  return (
    <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
      {DOCK_LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-full ${item.colorClass} inline-block`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
