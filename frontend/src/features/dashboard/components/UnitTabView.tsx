import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import type { DeliveryLifecycleAction, UnitKey } from '../types';
import { Empty, Typography } from 'antd';
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
    return <Empty description="Không có dữ liệu" />;
  }

  return (
    <div>
      <UnitHeader unit={unit} unitDispatch={unitDispatch} />
      <AICard unitDispatch={unitDispatch} onAction={onSuggestionAction} />
      <Typography.Title level={4}>Đang điều phối ({unitDispatch.active.length})</Typography.Title>
      <QueueTable
        deliveries={unitDispatch.active}
        unit={unit}
        unitConfig={unitDispatch.unitConfig}
        onCall={onCall}
        onAction={onAction}
        onView={onView}
        actionLoading={actionLoading}
      />
      <UpcomingSection deliveries={unitDispatch.upcoming} unit={unit} unitConfig={unitDispatch.unitConfig} />
    </div>
  );
}
