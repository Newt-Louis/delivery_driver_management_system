import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, EnvironmentOutlined, IdcardOutlined, NotificationOutlined, ShoppingOutlined } from '@ant-design/icons';
import { Avatar, Card, Result, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { formatTicketCode, getTrackUnit } from '../utils';
import type { TrackDelivery, StatusInfo } from '../types';

type UnitMeta = ReturnType<typeof getTrackUnit>;

function statusPresentation(status: string) {
  if (status === 'COMPLETED') return { result: 'success' as const, icon: <CheckCircleOutlined /> };
  if (status === 'CANCELLED') return { result: 'error' as const, icon: <CloseCircleOutlined /> };
  if (status === 'WAITING') return { result: 'warning' as const, icon: <ClockCircleOutlined /> };
  if (status === 'CALLED') return { result: 'info' as const, icon: <NotificationOutlined /> };
  if (status === 'RECEIVING' || status === 'AUTO_WAREHOUSE_RECEIVING') return { result: 'info' as const, icon: <ShoppingOutlined /> };
  return { result: 'info' as const, icon: <ClockCircleOutlined /> };
}

export default function StatusCard({ delivery, si, unitMeta, isTerminal }: { delivery: TrackDelivery; si: StatusInfo; unitMeta: UnitMeta; isTerminal: boolean }) {
  const presentation = statusPresentation(delivery.status);
  return <>
    <Card>
      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><Typography.Text type="secondary" className="text-xs">Mã đăng ký</Typography.Text><Typography.Text className="block truncate font-mono text-base font-bold" copyable>{delivery.registrationCode}</Typography.Text></div><Space size={6} className="shrink-0"><Avatar size="small" src={unitMeta.logoUrl ?? undefined} icon={<EnvironmentOutlined />}>{unitMeta.logoUrl ? undefined : unitMeta.icon}</Avatar><Typography.Text className="max-w-28 truncate text-xs font-medium sm:max-w-44">{unitMeta.shortName}</Typography.Text></Space></div>
      <Result className="!pb-4" status={presentation.result} icon={presentation.icon} title={si.label} subTitle={delivery.locationName ? `Khu vực giao hàng: ${delivery.locationName}` : unitMeta.label} />
      {delivery.ticketNumber && !isTerminal && <Card size="small" className="text-center"><Space direction="vertical" size={2}><Typography.Text type="secondary"><IdcardOutlined /> Số thẻ của bạn</Typography.Text><Typography.Text className="font-mono text-2xl font-bold">{formatTicketCode(delivery)}</Typography.Text><Typography.Text type="secondary" className="text-xs">Theo dõi số thẻ này trên màn hình chờ.</Typography.Text></Space></Card>}
      {delivery.status === 'CALLED' && delivery.assignedSlot && <Card size="small" className="mt-3 text-center"><Typography.Text type="secondary"><EnvironmentOutlined /> Vị trí nhận hàng</Typography.Text><Typography.Title level={1} className="!my-1">{delivery.assignedSlot.code}</Typography.Title><Typography.Text className="text-base">{delivery.assignedSlot.name}</Typography.Text>{delivery.assignedSlot.zone && <Typography.Text type="secondary" className="block text-sm">{delivery.assignedSlot.zone.name}</Typography.Text>}</Card>}
      {delivery.status === 'WAITING' && !delivery.queueInfo && <Typography.Text type="warning" className="mt-3 block text-center">Vui lòng chờ — hệ thống sẽ tự động gọi khi có vị trí trống.</Typography.Text>}
    </Card>
    {delivery.status === 'REGISTERED' && <Card size="small"><Typography.Text type="secondary">Nhập sai thông tin? Bạn có thể <Link to={`/cancelled?code=${encodeURIComponent(delivery.registrationCode)}`} className="underline" style={{ color: 'var(--ant-color-error)' }}>hủy chuyến</Link> và đăng ký lại.</Typography.Text></Card>}
  </>;
}
