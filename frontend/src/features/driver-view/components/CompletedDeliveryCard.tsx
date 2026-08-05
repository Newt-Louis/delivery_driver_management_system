import type { DeliveryRegistration } from '../../../lib/types';
import { deliveryUnitPresentation } from '../../../lib/unitPresentation';
import { STATUS_LABEL } from '../constants';

export default function CompletedDeliveryCard({ delivery }: { delivery: DeliveryRegistration }) {
  const status = STATUS_LABEL[delivery.status];

  return (
    <div className="bg-white rounded-2xl border border-thiso-100 p-4 opacity-60">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono font-bold text-thiso-700">{delivery.vehiclePlate}</div>
          <div className="text-xs text-thiso-400">{deliveryUnitPresentation(delivery).label}</div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status?.bg} ${status?.color}`}>
          {status?.label}
        </span>
      </div>
    </div>
  );
}
