import { DOCK_STAT_ITEMS } from '../constants';
import type { DockStats } from '../types';

export default function DockStatsGrid({ stats }: { stats: DockStats }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
      {DOCK_STAT_ITEMS.map((item) => {
        const value = stats[item.key];
        const prefix = 'prefix' in item ? item.prefix : null;
        const valueText = prefix ? `${prefix} ${value}` : value;
        const valueSize = prefix ? 'text-2xl' : 'text-3xl';

        return (
          <div key={item.key} className={`${item.frameClass} border rounded-xl p-4 text-center`}>
            <div className={`${valueSize} font-bold ${item.valueClass}`}>{valueText}</div>
            <div className={`text-xs ${item.labelClass} mt-1 font-medium`}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}
