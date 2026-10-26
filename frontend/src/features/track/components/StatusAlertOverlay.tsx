import { CheckCircleOutlined, CloseOutlined, NotificationOutlined } from '@ant-design/icons';
import { Button, Modal, Result } from 'antd';
import type { StatusAlert } from '../types';

export default function StatusAlertOverlay({ statusAlert, onClose }: {
  statusAlert: StatusAlert;
  onClose: () => void;
}) {
  return (
    <Modal open centered closable={false} footer={<Button type="primary" icon={<CloseOutlined />} onClick={onClose}>Đóng thông báo</Button>}>
      <Result status={statusAlert.level === 'urgent' ? 'warning' : 'success'} icon={statusAlert.level === 'urgent' ? <NotificationOutlined /> : <CheckCircleOutlined />} title={statusAlert.title} subTitle={statusAlert.body} />
    </Modal>
  );
}
