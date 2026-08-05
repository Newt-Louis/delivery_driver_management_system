import DockLegend from '../features/docks/components/DockLegend';
import DockStatsGrid from '../features/docks/components/DockStatsGrid';
import SlotGroupSection from '../features/docks/components/SlotGroupSection';
import { useDockManagement } from '../features/docks/hooks/useDockManagement';

export default function DockManagement() {
  const {
    canEdit,
    stats,
    slotGroups,
    handleStatusChange,
  } = useDockManagement();

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Slot nhận hàng</h1>

      <DockStatsGrid stats={stats} />

      {slotGroups.map((group) => (
        <SlotGroupSection
          key={group.key}
          group={group}
          canEdit={canEdit}
          onStatusChange={handleStatusChange}
        />
      ))}

      <DockLegend />
    </div>
  );
}
