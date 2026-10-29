import { Alert, Space } from 'antd';
import type { DashboardSummary } from '../../../lib/types';
import ExpiredBanner from './ExpiredBanner';
export default function DashboardAlerts({ summary, onExpireDone }: { summary?: DashboardSummary; onExpireDone: () => void }) {
 return <Space direction="vertical" className="mb-4" style={{ width: '100%' }}>{(summary?.urgentFreshFood ?? 0) > 0 && <Alert type="error" showIcon message={`${summary!.urgentFreshFood} xe hàng TƯƠI SỐNG chờ hơn 25 phút – gọi ngay!`} />}{(summary?.noShowRisk ?? 0) > 0 && <Alert type="warning" showIcon message={`${summary!.noShowRisk} xe gọi hơn 15 phút chưa vào vị trí – gọi lại hoặc hủy.`} />}{(summary?.expiredToday ?? 0) > 0 && <ExpiredBanner count={summary!.expiredToday} onDone={onExpireDone} />}</Space>;
}
