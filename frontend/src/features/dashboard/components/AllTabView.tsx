import { Card, Space, Statistic, Typography } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import type { DeliveryRegistration, DispatchData } from '../../../lib/types';
import type { DeliveryLifecycleAction } from '../types';
import { getAllActiveDeliveries, getAllUpcomingDeliveries, getUnitMeta } from '../utils';
import QueueTable from './QueueTable';
import UnitBrandMark from './UnitBrandMark';
import UpcomingSection from './UpcomingSection';
interface Props { dispatch: DispatchData; onCall: (delivery: DeliveryRegistration, slotId?: string) => void; onAction: (id: string, action: DeliveryLifecycleAction) => void; onView: (id: string) => void; actionLoading: string | null; }
export default function AllTabView({ dispatch, onCall, onAction, onView, actionLoading }: Props) {
 const active = getAllActiveDeliveries(dispatch); const upcoming = getAllUpcomingDeliveries(dispatch); const configs = Object.fromEntries(Object.entries(dispatch).map(([unit, data]) => [unit, data.unitConfig]));
 return <><div className="mb-5"><AdaptiveGrid minColumnWidth={260}>{Object.entries(dispatch).map(([unit, data]) => { const meta = getUnitMeta(unit, data.unitConfig); const s = data.insights.stats; return <Card key={unit} size="small" title={<Space><span style={{ display: 'inline-block', width: 8, height: 24, backgroundColor: meta.color }} /><UnitBrandMark meta={meta} />{meta.label}</Space>}><Space wrap size="large"><Statistic title="Chờ gọi" value={s.waiting} /><Statistic title="Đã gọi" value={s.called} /><Statistic title="Nhận hàng" value={s.receiving} /></Space><Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>🚛 {s.truckSlotsAvailable ?? s.truckDocksAvailable ?? 0} slot tải · 🛵 {s.mbSlotsAvailable ?? s.mbDocksAvailable ?? 0} slot máy</Typography.Paragraph></Card>; })}</AdaptiveGrid></div><Typography.Title level={4}>Tất cả xe đang điều phối ({active.length})</Typography.Title><QueueTable deliveries={active} unitConfigsByUnit={configs} onCall={onCall} onAction={onAction} onView={onView} actionLoading={actionLoading} /><UpcomingSection deliveries={upcoming} unitConfigsByUnit={configs} /></>;
}
