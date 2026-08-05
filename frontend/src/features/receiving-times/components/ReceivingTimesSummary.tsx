import type { ReceivingTimeConfig } from '../../../lib/types';
import { getReceivingTimesSummary } from '../utils';

export default function ReceivingTimesSummary({
  configs,
  totalCompleted,
}: {
  configs: ReceivingTimeConfig[];
  totalCompleted?: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {getReceivingTimesSummary(configs, totalCompleted).map((item) => (
        <div key={item.label} className={`rounded-xl border p-3 text-center ${item.alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-thiso-100'}`}>
          <div className="text-2xl mb-0.5">{item.icon}</div>
          <div className="text-xl font-black text-thiso-800">{item.value}</div>
          <div className="text-xs text-thiso-500 mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
