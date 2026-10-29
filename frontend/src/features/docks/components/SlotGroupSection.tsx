import { Space, Typography } from 'antd';
import type { SlotGroup } from '../types';
import { splitSlotsByVehicle } from '../utils';
import SlotVehicleSection from './SlotVehicleSection';
interface Props { group: SlotGroup; canEdit: boolean; onStatusChange: (slotId: string, status: string) => void; }
export default function SlotGroupSection({ group, canEdit, onStatusChange }: Props) {
  const { truckSlots, motorbikeSlots } = splitSlotsByVehicle(group.slots);
  return <section className="mb-10"><Typography.Title level={4}><Space><span aria-hidden style={{ display: 'inline-block', width: 12, height: 24, backgroundColor: group.color }} />{group.icon} {group.label} ({group.slots.length} slots)</Space></Typography.Title><SlotVehicleSection title="Xe tải" count={truckSlots.length} slots={truckSlots} canEdit={canEdit} onStatusChange={onStatusChange} /><SlotVehicleSection title="Xe máy" count={motorbikeSlots.length} slots={motorbikeSlots} canEdit={canEdit} onStatusChange={onStatusChange} /></section>;
}
