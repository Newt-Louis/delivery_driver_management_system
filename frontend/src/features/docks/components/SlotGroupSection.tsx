import type { SlotGroup } from '../types';
import { splitSlotsByVehicle } from '../utils';
import SlotVehicleSection from './SlotVehicleSection';

interface SlotGroupSectionProps {
  group: SlotGroup;
  canEdit: boolean;
  onStatusChange: (slotId: string, status: string) => void;
}

export default function SlotGroupSection({ group, canEdit, onStatusChange }: SlotGroupSectionProps) {
  const { truckSlots, motorbikeSlots, otherSlots } = splitSlotsByVehicle(group.slots);

  return (
    <div className="mb-10">
      <h2 className="text-lg font-bold text-thiso-800 mb-4 flex items-center gap-2">
        <span className="inline-block h-6 w-[26px] rounded-lg" style={{ backgroundColor: group.color }} />
        <span>{group.icon}</span>
        {group.label}
        <span className="text-sm font-normal text-thiso-400">({group.slots.length} slots)</span>
      </h2>

      <SlotVehicleSection
        title="🚛 Xe Tải"
        count={truckSlots.length}
        slots={truckSlots}
        canEdit={canEdit}
        onStatusChange={onStatusChange}
      />
      <SlotVehicleSection
        title="🛵 Xe Máy"
        count={motorbikeSlots.length}
        slots={motorbikeSlots}
        canEdit={canEdit}
        onStatusChange={onStatusChange}
      />
      <SlotVehicleSection
        title="🚗 Khác"
        count={otherSlots.length}
        slots={otherSlots}
        canEdit={canEdit}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
