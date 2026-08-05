import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import type { DeliveryLifecycleAction, UnitKey } from '../types';
import { getUnitMeta } from '../utils';
import AICard from './AICard';
import QueueTable from './QueueTable';
import UnitHeader from './UnitHeader';
import UpcomingSection from './UpcomingSection';

interface UnitTabViewProps {
  unit: UnitKey;
  unitDispatch?: UnitDispatch;
  actionLoading: string | null;
  onSuggestionAction: (id: string, slotId?: string) => void;
  onCall: (delivery: DeliveryRegistration, slotId?: string) => void;
  onAction: (id: string, action: DeliveryLifecycleAction) => void;
  onView: (id: string) => void;
}

export default function UnitTabView({
  unit,
  unitDispatch,
  actionLoading,
  onSuggestionAction,
  onCall,
  onAction,
  onView,
}: UnitTabViewProps) {
  if (!unitDispatch) {
    return <div className="py-8 text-center text-gray-400">Không có dữ liệu</div>;
  }

  return (
    <div>
      <UnitHeader unit={unit} unitDispatch={unitDispatch} />
      <AICard unitDispatch={unitDispatch} onAction={onSuggestionAction} />
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-black text-thiso-500 uppercase tracking-wider flex items-center gap-2">
          Đang điều phối
          {unitDispatch.active.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${getUnitMeta(unit, unitDispatch.unitConfig).badge}`}>
              {unitDispatch.active.length}
            </span>
          )}
        </h3>
      </div>
      <QueueTable
        deliveries={unitDispatch.active}
        unit={unit}
        onCall={onCall}
        onAction={onAction}
        onView={onView}
        actionLoading={actionLoading}
      />
      <UpcomingSection deliveries={unitDispatch.upcoming} unit={unit} />
    </div>
  );
}
