import { Card, Statistic } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import type { DashboardSummary } from '../../../lib/types';
export default function KpiSummary({ summary }: { summary?: DashboardSummary }) {
 const items = [ ['Đã đặt', summary?.registeredToday], ['Chờ gọi', summary?.waiting], ['FF chờ', summary?.freshFoodWaiting], ['Đang nhận', summary?.receiving], ['Slot trống', summary?.slotsAvailable ?? summary?.docksAvailable], ['Slot dùng', summary?.slotsOccupied ?? summary?.docksOccupied], ['Tổng hôm nay', summary?.totalToday], ['Hoàn tất', summary?.completedToday], ['Đã hủy', summary?.cancelledToday], ['Hết hạn', summary?.expiredToday] ] as const;
 return <div className="mb-5"><AdaptiveGrid minColumnWidth={130}>{items.map(([label, value]) => <Card key={label} size="small"><Statistic title={label} value={value ?? '–'} /></Card>)}</AdaptiveGrid></div>;
}
