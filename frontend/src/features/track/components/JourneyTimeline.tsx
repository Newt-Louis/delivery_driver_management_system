import { CheckCircleFilled, CloseCircleOutlined, InboxOutlined, LoginOutlined, NotificationOutlined, ShoppingOutlined, SolutionOutlined } from '@ant-design/icons';
import { Card, Steps, Typography, theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import type { TrackDelivery } from '../types';
import { fmtDate } from '../utils';

type JourneyStep = { title: string; time: string | null; detail?: string | null; icon: ReactNode };

function currentStep(status: string) {
  if (status === 'REGISTERED') return 0;
  if (status === 'WAITING') return 1;
  if (status === 'CALLED') return 2;
  if (status === 'RECEIVING' || status === 'AUTO_WAREHOUSE_RECEIVING') return 3;
  return 4;
}

export default function JourneyTimeline({ delivery }: { delivery: TrackDelivery }) {
  const { token } = theme.useToken();
  const cancelled = delivery.status === 'CANCELLED';
  const current = currentStep(delivery.status);
  const steps: JourneyStep[] = [
    { title: 'Đăng ký giao hàng', time: delivery.createdAt, icon: <SolutionOutlined /> },
    { title: 'Check-in tại cổng', time: delivery.checkinTime, icon: <LoginOutlined /> },
    { title: delivery.assignedSlot ? `Được gọi vào ${delivery.assignedSlot.code}` : 'Được gọi vào dock', time: delivery.calledTime, detail: delivery.assignedSlot ? `${delivery.assignedSlot.name}${delivery.assignedSlot.zone ? ` · ${delivery.assignedSlot.zone.name}` : ''}` : null, icon: <NotificationOutlined /> },
    { title: delivery.status === 'AUTO_WAREHOUSE_RECEIVING' ? 'Đang nhận tại kho tự động' : 'Bắt đầu nhận hàng', time: delivery.receivingStartTime, icon: <ShoppingOutlined /> },
    cancelled ? { title: 'Chuyến đã hủy', time: null, detail: 'Lượt giao hàng này không tiếp tục xử lý.', icon: <CloseCircleOutlined /> } : { title: 'Hoàn thành giao hàng', time: delivery.completedTime, icon: <CheckCircleFilled /> },
  ];
  const style = { '--track-step-finish-color': token.colorSuccess, '--track-step-finish-icon-color': token.colorTextLightSolid } as CSSProperties;

  return (
    <Card size="small" title="Tiến trình giao hàng">
      <Steps className="track-journey-steps" style={style} direction="vertical" size="small" current={current} items={steps.map((step, index) => {
        const done = !cancelled && index < current;
        const active = index === current;
        const status = cancelled && index === 4 ? 'error' : done ? 'finish' : active ? 'process' : 'wait';
        return {
          title: <Typography.Text strong={active || done}>{step.title}</Typography.Text>,
          description: <div className="pb-2"><Typography.Text type="secondary" className="block text-xs">{step.time ? fmtDate(step.time) : active ? step.detail ?? 'Đang xử lý' : 'Chưa thực hiện'}</Typography.Text>{step.detail && step.time && <Typography.Text type="secondary" className="block text-xs">{step.detail}</Typography.Text>}</div>,
          icon: done ? <CheckCircleFilled /> : step.icon,
          status,
        };
      })} />
    </Card>
  );
}
