import { Typography } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import DockCard from '../../../components/DockCard';
import type { Slot } from '../../../lib/types';
interface Props { title: string; count: number; slots: Slot[]; canEdit: boolean; onStatusChange: (slotId: string, status: string) => void; }
export default function SlotVehicleSection({ title, count, slots, canEdit, onStatusChange }: Props) {
  if (!slots.length) return null;
  return <section className="mb-5"><Typography.Title level={5}>{title} ({count})</Typography.Title><AdaptiveGrid minColumnWidth={240}>{slots.map((slot) => <DockCard key={slot.id} slot={slot} canEdit={canEdit} onStatusChange={onStatusChange} />)}</AdaptiveGrid></section>;
}
