import { BulbOutlined, WifiOutlined } from '@ant-design/icons';
import { Badge, Typography } from 'antd';

export default function TrackFooter({ wakeLockActive }: { wakeLockActive: boolean }) {
  return (
    <div className="space-y-1.5 pb-2">
      <Typography.Text type="secondary" className="block text-center text-xs"><WifiOutlined /> Trang nhận trạng thái realtime khi có thay đổi.</Typography.Text>
      <div className="text-center"><Badge status={wakeLockActive ? 'success' : 'warning'} text={<Typography.Text type={wakeLockActive ? 'success' : 'warning'} className="text-xs"><BulbOutlined /> {wakeLockActive ? 'Màn hình đang được giữ sáng' : 'Giữ màn hình sáng để nhận cảnh báo âm thanh'}</Typography.Text>} /></div>
    </div>
  );
}
