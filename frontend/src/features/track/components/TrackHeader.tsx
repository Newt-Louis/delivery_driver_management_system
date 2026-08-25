import { getTrackUnit } from '../utils';
import type { TrackDelivery } from '../types';

type UnitMeta = ReturnType<typeof getTrackUnit>;

export default function TrackHeader({ delivery, unitMeta, isUrgentQueue }: {
  delivery: TrackDelivery;
  unitMeta: UnitMeta;
  isUrgentQueue: boolean;
}) {
  return (
    <div className={`bg-white border-b border-thiso-100 px-4 py-4 sticky top-0 z-10 flex items-center justify-between ${isUrgentQueue ? 'ring-2 ring-amber-400' : ''}`}>
      <div>
        <p className="text-[11px] text-thiso-400 leading-none mb-1">Theo dõi giao hàng</p>
        <p className="font-mono font-black text-thiso-800 tracking-widest text-base leading-none">
          {delivery.registrationCode}
        </p>
      </div>
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-thiso-100 text-thiso-600 px-2.5 py-1 rounded-full"
        style={{ color: unitMeta.primaryColor }}
      >
        {unitMeta.logoUrl ? (
          <img src={unitMeta.logoUrl} alt="" className="w-4 h-4 object-contain rounded" />
        ) : (
          <span>{unitMeta.icon}</span>
        )}
        {unitMeta.shortName}
      </span>
    </div>
  );
}
