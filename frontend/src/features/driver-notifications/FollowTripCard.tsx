import { BellOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { useDriverNotifications } from './DriverNotificationsProvider';
import type { TrackDelivery } from '../track/types';

export default function FollowTripCard({ delivery }: { delivery: TrackDelivery }) {
  const alerts = useDriverNotifications();
  const selected = alerts.followed?.code === delivery.registrationCode;
  return <Card size="small" title={selected ? 'Đang theo dõi chuyến trên thiết bị này' : 'Nhận thông báo cho chuyến này'}>
    <Space orientation="vertical" size="middle" className="w-full">
      <Typography.Text>Xe {delivery.vehiclePlate} — nhận báo khi check-in, được gọi vào nhận hàng và hoàn thành chuyến.</Typography.Text>
      {selected && <Alert showIcon type={alerts.pushState === 'ready' ? 'success' : 'info'}
        title={alerts.pushState === 'ready' ? 'Đã bật thông báo đẩy cho chuyến này' : 'Đang theo dõi trong ứng dụng'}
        description={alerts.audioReady ? 'Âm báo đã sẵn sàng. Bạn có thể chuyển sang trang khác trong ứng dụng.' : 'Chạm Bật thông báo và âm báo để cho phép điện thoại phát âm thanh.'} />}
      {alerts.error && <Alert type="warning" showIcon title={alerts.error} />}
      {(!selected || !alerts.audioReady || alerts.pushState !== 'ready') && <Button type="primary" size="large" block icon={<BellOutlined />} onClick={() => alerts.follow(delivery)}>
        {selected ? 'Bật thông báo và âm báo' : 'Theo dõi chuyến giao hàng này'}
      </Button>}
      {selected && <Button size="large" block onClick={alerts.stopFollowing}>Dừng nhận thông báo chuyến này</Button>}
    </Space>
  </Card>;
}
