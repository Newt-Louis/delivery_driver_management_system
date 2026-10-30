import { Typography } from 'antd';
import type { DashboardSummary, DeliveryRegistration, DispatchData } from '../../../lib/types';
import type { DeliveryLifecycleAction } from '../types';
import { getAllActiveDeliveries, getAllUpcomingDeliveries } from '../utils';
import QueueTable from './QueueTable';
import UpcomingSection from './UpcomingSection';
import AllTabOverview from './AllTabOverview';
interface Props { dispatch: DispatchData; summary?: DashboardSummary; onSuggestionAction: (id: string, slotId?: string) => void; onCall: (delivery: DeliveryRegistration, slotId?: string) => void; onAction: (id: string, action: DeliveryLifecycleAction) => void; onView: (id: string) => void; actionLoading: string | null; }
export default function AllTabView({ dispatch, summary, onSuggestionAction, onCall, onAction, onView, actionLoading }: Props) {
 const active = getAllActiveDeliveries(dispatch); const upcoming = getAllUpcomingDeliveries(dispatch); const configs = Object.fromEntries(Object.entries(dispatch).map(([unit, data]) => [unit, data.unitConfig]));
 return <><AllTabOverview dispatch={dispatch} summary={summary} onAction={onSuggestionAction} /><Typography.Title level={4}>Tất cả xe đang điều phối ({active.length})</Typography.Title><QueueTable deliveries={active} unitConfigsByUnit={configs} onCall={onCall} onAction={onAction} onView={onView} actionLoading={actionLoading} /><UpcomingSection deliveries={upcoming} unitConfigsByUnit={configs} /></>;
}
