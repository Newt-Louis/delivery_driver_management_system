import { CheckCircleOutlined, ClockCircleOutlined, InboxOutlined, LoginOutlined } from '@ant-design/icons';
import { Modal, Steps, Typography } from 'antd';

type ProcessGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

const PROCESS_STEPS = [
  { title: 'Đăng ký', description: 'Điền thông tin và nhận mã QR', icon: <InboxOutlined /> },
  { title: 'Check-in', description: 'Đưa QR cho bảo vệ tại cổng', icon: <LoginOutlined /> },
  { title: 'Chờ gọi', description: 'Theo dõi màn hình khu chờ', icon: <ClockCircleOutlined /> },
  { title: 'Vào dock', description: 'Giao hàng và hoàn tất', icon: <CheckCircleOutlined /> },
];

export default function ProcessGuideModal({ open, onClose }: ProcessGuideModalProps) {
  return (
    <Modal title="Quy trình giao hàng" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Steps direction="vertical" items={PROCESS_STEPS} />
      <Typography.Paragraph type="secondary" className="!mb-0 !mt-6">
        Đăng ký trước giúp hệ thống điều phối thứ tự gọi xe. Mã QR nhận được dùng để check-in tại cổng.
      </Typography.Paragraph>
    </Modal>
  );
}
