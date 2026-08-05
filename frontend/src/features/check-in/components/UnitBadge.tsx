import type { DeliveryRegistration } from '../../../lib/types';
import { getUnitMeta } from '../utils';

export default function UnitBadge({ delivery, strong = false }: { delivery: DeliveryRegistration; strong?: boolean }) {
  const unit = getUnitMeta(delivery);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${strong ? 'text-xs font-bold' : 'text-xs font-semibold'}`}
      style={{ color: unit.color, background: `${unit.color}18` }}
    >
      {unit.logoUrl ? <img src={unit.logoUrl} alt="" className="w-4 h-4 object-contain rounded" /> : <span>{unit.icon}</span>}
      {unit.shortName}
    </span>
  );
}
