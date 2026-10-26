import { AudioOutlined, BellOutlined, MobileOutlined } from '@ant-design/icons';
import { Alert, Button, Space } from 'antd';
import type { getPushPlatformSupport } from '../../../lib/platform';
type PushSupport = ReturnType<typeof getPushPlatformSupport>;

export default function NotificationBanners({ isTerminal, pushSupport, notifPermission, pushEnabled, deviceAlertsReady, onRequestNotif, onPrimeAlerts }: { isTerminal: boolean; pushSupport: PushSupport; notifPermission: NotificationPermission; pushEnabled: boolean; deviceAlertsReady: boolean; onRequestNotif: () => void; onPrimeAlerts: () => void }) {
  if (isTerminal) return null;
  return <Space direction="vertical" size="middle" className="w-full">{pushSupport.reason === 'ios_needs_pwa' && <Alert type="warning" showIcon icon={<MobileOutlined />} message="Bật thông báo trên iPhone/iPad" description="Mở bằng Safari, thêm vào Màn hình chính, rồi mở ứng dụng từ icon mới để bật thông báo." />}{pushSupport.supported && notifPermission === 'default' && <Alert type="info" showIcon icon={<BellOutlined />} message="Bật thông báo hệ thống" description="Nhận cảnh báo ngay cả khi ứng dụng đang ở nền." action={<Button size="small" onClick={onRequestNotif}>Bật</Button>} />}{notifPermission === 'granted' && pushEnabled && <Alert type="success" showIcon message="Thông báo hệ thống đã bật" />}{!deviceAlertsReady && <Alert type="info" showIcon icon={<AudioOutlined />} message="Bật rung và âm báo" description="Chạm một lần để trình duyệt cho phép cảnh báo khi trạng thái thay đổi." action={<Button size="small" onClick={onPrimeAlerts}>Bật</Button>} />}</Space>;
}
