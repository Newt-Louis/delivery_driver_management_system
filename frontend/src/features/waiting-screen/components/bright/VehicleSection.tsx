import { ArrowRightOutlined, NotificationOutlined } from '@ant-design/icons';
import { Badge, Empty, Table, Typography, theme, type TableColumnsType } from 'antd';
import type { DeliveryRegistration } from '../../../../lib/types';
import { formatTicketForDelivery } from '../../utils';

export type WaitingVehicleSectionStatus = 'called' | 'waiting';

type BrightVehicleSectionProps = {
  items: DeliveryRegistration[];
  highlightId: string | null;
  status: WaitingVehicleSectionStatus;
  waitingCount?: number;
};

export default function BrightVehicleSection({ items, highlightId, status, waitingCount = 0 }: BrightVehicleSectionProps) {
  const { token } = theme.useToken();
  const isWaiting = status === 'waiting';
  const emptyText = isWaiting
    ? 'Chưa có xe CHECK-IN'
    : waitingCount > 0 ? 'Chưa có khu vực giao hàng TRỐNG' : 'Không tìm thấy xe sẵn sàng';
  const sectionLabel = isWaiting ? `Đã check-in và đang chờ (${items.length})` : `Đang gọi vào (${items.length})`;
  const statusColor = isWaiting ? token.colorWarning : token.colorPrimary;
  const columns: TableColumnsType<DeliveryRegistration> = [
    {
      title: 'Số thứ tự',
      key: 'ticket',
      width: '35%',
      render: (_, delivery) => {
        const ticket = formatTicketForDelivery(delivery) ?? delivery.registrationCode;
        const isNext = isWaiting && items[0]?.id === delivery.id;
        return (
          <Typography.Text strong className="break-words" title={ticket}>
            {isNext && <ArrowRightOutlined className="mr-1 text-[var(--ant-color-warning)]" />}
            {ticket}
          </Typography.Text>
        );
      },
    },
    {
      title: 'Biển số xe',
      dataIndex: 'vehiclePlate',
      key: 'vehiclePlate',
      width: '45%',
      render: (plate: string) => <Typography.Text strong className="break-words text-base" title={plate}>{plate}</Typography.Text>,
    },
    {
      title: 'Vị trí',
      key: 'slot',
      width: '20%',
      render: (_, delivery) => {
        const slotCode = delivery.assignedSlot?.code;
        return slotCode ? <Typography.Text strong className="break-words" title={slotCode}>{slotCode}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
  ];

  return (
    <section className="border-t border-[var(--ant-color-border-secondary)] first:border-t-0">
      <div className="flex items-center gap-2 px-3 py-3">
        <Badge status={isWaiting ? 'warning' : 'processing'} />
        <Typography.Text strong style={{ color: statusColor, fontSize: 'clamp(1rem, 2.5vw, 1.3125rem)' }} className="!inline-flex !items-center !leading-none">
          {!isWaiting && <NotificationOutlined className="mr-1" style={{ fontSize: '1em' }} />}
          {sectionLabel}
        </Typography.Text>
      </div>
      {items.length ? (
        <Table
          className="waiting-vehicle-table"
          columns={columns}
          dataSource={items}
          rowKey="id"
          pagination={false}
          size="small"
          tableLayout="fixed"
          rowClassName={(delivery) => delivery.id === highlightId ? 'waiting-vehicle-table-highlight' : ''}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} className="my-5" />
      )}
    </section>
  );
}
