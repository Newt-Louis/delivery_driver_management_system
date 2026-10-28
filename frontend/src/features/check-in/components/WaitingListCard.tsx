import { Alert, Button, Card, ConfigProvider, Table, Tag, theme } from 'antd';
import type { DeliveryRegistration } from '../../../lib/types';
import { GOODS_LABEL } from '../constants';
import { getTicketCode, getUnitMeta, getWaitingMinutes } from '../utils';
interface Props { title: string; deliveries: DeliveryRegistration[]; loading: boolean; error: boolean; onRetry: () => void; onExport?: () => void }
export default function WaitingListCard({ title, deliveries, loading, error, onRetry, onExport }: Props) {
  return <Card title={<span>{title} <Tag>{deliveries.length} xe</Tag></span>} extra={onExport && <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}><Button color="green" variant="solid" style={{ boxShadow: 'none', borderColor: 'transparent' }} onClick={onExport} disabled={!deliveries.length}>Xuất Excel</Button></ConfigProvider>}>
    {error ? <Alert type="error" showIcon title="Không tải được danh sách" action={<Button onClick={onRetry}>Thử lại</Button>} /> :
      <Table<DeliveryRegistration> rowKey="id" dataSource={deliveries} loading={loading} scroll={{ x: 760 }} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: 'Không có xe trong danh sách' }} columns={[
        ...(onExport ? [{ title: 'Số thẻ', key: 'ticket', render: (_: unknown, d: DeliveryRegistration) => d.ticketNumber != null ? getTicketCode(d) : '—' }] : []),
        { title: 'Biển số · Tài xế', key: 'driver', render: (_: unknown, d: DeliveryRegistration) => <span>{d.vehiclePlate}<br />{d.driverName}</span> },
        { title: 'Mã ĐK', dataIndex: 'registrationCode', key: 'code' }, { title: 'Đơn vị', key: 'unit', render: (_: unknown, d: DeliveryRegistration) => getUnitMeta(d).label },
        { title: 'Loại hàng', key: 'goods', render: (_: unknown, d: DeliveryRegistration) => GOODS_LABEL[d.goodsType] ?? d.goodsType },
        ...(onExport ? [{ title: 'Check-in', key: 'time', render: (_: unknown, d: DeliveryRegistration) => d.checkinTime ? new Date(d.checkinTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—' }, { title: 'Trạng thái', key: 'status', render: (_: unknown, d: DeliveryRegistration) => d.status }, { title: 'Chờ', key: 'wait', render: (_: unknown, d: DeliveryRegistration) => d.status === 'WAITING' && getWaitingMinutes(d) != null ? `${getWaitingMinutes(d)} phút` : '—' }] : []),
      ]} />}
  </Card>;
}
