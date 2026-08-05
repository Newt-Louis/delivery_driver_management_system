import DockCard from '../../../components/DockCard';
import type { Slot } from '../../../lib/types';

interface SlotVehicleSectionProps {
  title: string;
  count: number;
  slots: Slot[];
  canEdit: boolean;
  onStatusChange: (slotId: string, status: string) => void;
}

export default function SlotVehicleSection({
  title,
  count,
  slots,
  canEdit,
  onStatusChange,
}: SlotVehicleSectionProps) {
  if (slots.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
        {title} <span className="font-normal text-gray-300">({count})</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {slots.map((slot) => (
          <DockCard key={slot.id} slot={slot} canEdit={canEdit} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  );
}
