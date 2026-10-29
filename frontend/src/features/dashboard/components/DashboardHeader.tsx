import { Badge, Space, Typography } from 'antd';
export default function DashboardHeader() {
  return <div className="flex items-center justify-between mb-4 flex-wrap gap-3"><Typography.Title level={2} style={{ margin: 0 }}>Điều phối nhận hàng</Typography.Title><Space><Badge status="processing" /><Typography.Text type="secondary">Realtime · cập nhật 15s</Typography.Text></Space></div>;
}
