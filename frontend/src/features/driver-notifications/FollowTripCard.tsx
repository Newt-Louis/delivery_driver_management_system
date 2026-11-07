import { BellOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Typography } from 'antd';
import { useDriverNotifications } from './DriverNotificationsProvider';
import { getPushPlatformSupport } from '../../lib/platform';
import { notificationReadiness } from './model';
import type { TrackDelivery } from '../track/types';

export default function FollowTripCard({ delivery }: { delivery: Pick<TrackDelivery, 'registrationCode' | 'vehiclePlate' | 'status'> }) {
  const alerts = useDriverNotifications();
  const selected = alerts.followed?.code === delivery.registrationCode;
  if (!selected) return <Button type="primary" size="large" block icon={<BellOutlined />} onClick={() => alerts.follow(delivery)}>Nhận thông báo cho chuyến này</Button>;

  const support = getPushPlatformSupport();
  const readiness = notificationReadiness(support.supported, alerts.notificationPermission, alerts.pushState);
  let status: string;
  let type: 'success' | 'info' | 'warning';
  let retry = false;
  if (readiness === 'unsupported') {
    type = 'warning';
    status = support.reason === 'ios_needs_pwa'
      ? 'Đã chọn chuyến. Để nhận thông báo khi không mở trang trên iPhone/iPad, hãy mở ứng dụng từ Màn hình chính và chọn lại chuyến.'
      : 'Đã chọn chuyến. Trình duyệt này chưa hỗ trợ thông báo đẩy; hãy giữ trang mở để theo dõi.';
  } else if (readiness === 'denied') {
    type = 'warning';
    status = 'Đã chọn chuyến nhưng thông báo đang bị chặn. Hãy cho phép thông báo trong cài đặt của trình duyệt hoặc ứng dụng.';
    retry = true;
  } else if (readiness === 'permission') {
    type = 'warning';
    status = 'Đã chọn chuyến nhưng chưa được cấp quyền thông báo.';
    retry = true;
  } else if (readiness === 'ready') {
    type = 'success';
    status = 'Đã bật nhận thông báo cho chuyến này.';
  } else if (readiness === 'error') {
    type = 'warning';
    status = 'Đã chọn chuyến nhưng chưa kết nối được thông báo đẩy. Vui lòng thử lại.';
    retry = true;
  } else {
    type = 'info';
    status = 'Đã chọn chuyến. Đang kết nối thông báo đẩy...';
  }

  return <Space orientation="vertical" size="small" className="w-full">
    <Alert type={type} showIcon title={status} />
    {readiness === 'ready' && !alerts.audioReady && <Typography.Text type="secondary">Âm báo chưa sẵn sàng. Chạm thử lại để bật âm báo.</Typography.Text>}
    {(retry || !alerts.audioReady) && <Button size="large" block loading={alerts.busy} onClick={alerts.retrySetup}>Thử lại thông báo và âm báo</Button>}
    <Button size="large" block onClick={alerts.stopFollowing}>Dừng nhận thông báo chuyến này</Button>
  </Space>;
}
