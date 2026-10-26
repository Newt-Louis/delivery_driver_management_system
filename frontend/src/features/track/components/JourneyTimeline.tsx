import { CheckCircleOutlined, ClockCircleOutlined, LoginOutlined, NotificationOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Card, Timeline } from 'antd';
import type { TrackDelivery } from '../types';
import { fmtDate } from '../utils';

export default function JourneyTimeline({ delivery }: { delivery: TrackDelivery }) {
  const events = [{ label: 'Đăng ký', time: delivery.createdAt, icon: <CheckCircleOutlined /> }, { label: 'Check-in cổng', time: delivery.checkinTime, icon: <LoginOutlined /> }, { label: delivery.assignedSlot ? `Được gọi vào ${delivery.assignedSlot.code}` : 'Được gọi vào dock', time: delivery.calledTime, icon: <NotificationOutlined /> }, { label: 'Bắt đầu nhận hàng', time: delivery.receivingStartTime, icon: <ShoppingOutlined /> }, { label: 'Hoàn thành', time: delivery.completedTime, icon: <CheckCircleOutlined /> }];
  return <Card size="small" title="Hành trình"><Timeline items={events.map((event, index) => ({ color: event.time || index === 0 ? 'green' : 'gray', dot: event.icon, children: <><strong>{event.label}</strong><div className="text-xs text-[var(--ant-color-text-secondary)]">{event.time ? fmtDate(event.time) : 'Đang chờ'}</div></> }))} /></Card>;
}
