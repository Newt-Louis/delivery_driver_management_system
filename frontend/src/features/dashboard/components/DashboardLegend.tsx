import { Space, Tag, Typography } from 'antd';
export default function DashboardLegend() {
 return <Space wrap className="mt-6"><Tag color="error">FF &gt;30 phút (khẩn)</Tag><Tag color="warning">FF &gt;20 phút / No-show &gt;15 phút</Tag><Typography.Text type="secondary">Số thẻ dùng prefix từ tên rút gọn của đơn vị · T=Xe tải · M=Xe máy</Typography.Text></Space>;
}
