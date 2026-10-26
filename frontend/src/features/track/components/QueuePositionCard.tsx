import { ClockCircleOutlined, HourglassOutlined } from '@ant-design/icons';
import { Card, Progress, Statistic, Tag, Typography } from 'antd';
import type { QueueInfo } from '../types';

export default function QueuePositionCard({ queueInfo }: { queueInfo: QueueInfo }) {
  const near = queueInfo.position <= 5;
  const percent = Math.max(4, 100 - ((queueInfo.position - 1) / Math.max(queueInfo.totalWaiting, 1)) * 100);
  return <Card size="small" title={<><HourglassOutlined /> {near ? 'Sắp đến lượt bạn' : 'Vị trí hàng chờ'}</>} extra={near ? <Tag color="warning">Chuẩn bị sẵn sàng</Tag> : undefined}><div className="grid grid-cols-2 gap-3"><Statistic title="Vị trí" value={queueInfo.position} suffix={`/ ${queueInfo.totalWaiting}`} /><Statistic title="Chờ ước tính" value={queueInfo.estimatedWaitMinutes === 0 ? 'Sắp gọi' : `~${Math.round(queueInfo.estimatedWaitMinutes)} phút`} /></div>{queueInfo.estimatedCallTime && <Typography.Text type="secondary" className="mt-3 block"><ClockCircleOutlined /> Dự kiến gọi: {new Date(queueInfo.estimatedCallTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Typography.Text>}<Progress className="mt-3" percent={percent} showInfo={false} status={near ? 'active' : 'normal'} /><div className="mt-2 flex justify-between text-xs text-[var(--ant-color-text-secondary)]"><span>{queueInfo.availableSlots} slot trống</span><span>{queueInfo.totalWaiting - queueInfo.position} xe sau bạn</span></div></Card>;
}
