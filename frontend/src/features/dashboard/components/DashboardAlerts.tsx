import { Alert, Space } from 'antd';
import type { DashboardSummary } from '../../../lib/types';
import ExpiredBanner from './ExpiredBanner';
export default function DashboardAlerts({ summary, onExpireDone, showOperationalAlerts = true }: { summary?: DashboardSummary; onExpireDone: () => void; showOperationalAlerts?: boolean }) {
 return <Space orientation="vertical" className="mb-4" style={{ width: '100%' }}>{showOperationalAlerts && (summary?.urgentFreshFood ?? 0) > 0 && <Alert type="error" showIcon title={`${summary!.urgentFreshFood} xe hàng tươi sống chờ hơn 25 phút – gọi ngay!`} />}{showOperationalAlerts && (summary?.noShowRisk ?? 0) > 0 && <Alert type="warning" showIcon title={`${summary!.noShowRisk} xe gọi hơn 15 phút chưa vào vị trí – gọi lại hoặc hủy.`} />}{(summary?.expiredToday ?? 0) > 0 && <ExpiredBanner count={summary!.expiredToday} onDone={onExpireDone} />}</Space>;
}
