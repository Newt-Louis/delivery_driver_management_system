import { BellOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useDriverNotifications } from './DriverNotificationsProvider';
import type { TrackDelivery } from '../track/types';

export default function FollowTripCard({ delivery }: { delivery: TrackDelivery }) {
  const alerts = useDriverNotifications();
  const selected = alerts.followed?.code === delivery.registrationCode;
  return selected
    ? <Button size="large" block onClick={alerts.stopFollowing}>Dừng nhận thông báo chuyến này</Button>
    : <Button type="primary" size="large" block icon={<BellOutlined />} onClick={() => alerts.follow(delivery)}>Bật thông báo và âm báo</Button>;
}
