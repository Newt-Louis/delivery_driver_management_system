import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Empty, Modal, Spin, Timeline, Typography } from 'antd';
import { getDeliveryHistoryEvents } from '../api';
import type { DeliveryHistoryItem, DeliveryHistoryEventItem } from '../types';
import { STATUS_LABEL } from '../constants';
import { formatDateTime, formatEventText } from '../formatters';
export default function TimelineModal({ item, onClose }: { item: DeliveryHistoryItem; onClose: () => void }) {
 const { data: events = [], isLoading, isError, refetch } = useQuery<DeliveryHistoryEventItem[]>({ queryKey: ['histories-timeline', item.id], queryFn: () => getDeliveryHistoryEvents(item.id) });
 return <Modal open title={`Lịch sử ${item.registrationCode}`} onCancel={onClose} footer={null} width={720}><Typography.Title level={4}>{item.vehiclePlate}</Typography.Title><Typography.Paragraph>{item.vendorName} · {item.driverName}</Typography.Paragraph><Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[{ key: 'status', label: 'Trạng thái', children: STATUS_LABEL[item.finalStatus] ?? item.finalStatus }, { key: 'calls', label: 'Số lần gọi', children: item.callCount }, { key: 'slot', label: 'Slot', children: item.assignedSlotCode ?? '—' }, { key: 'time', label: 'Lưu lúc', children: formatDateTime(item.archivedAt) }, ...(item.closeReason ? [{ key: 'reason', label: 'Lý do', children: item.closeReason }] : [])]} />{isLoading ? <Spin /> : isError ? <Alert type="error" message="Không thể tải lịch sử" action={<Button onClick={() => refetch()}>Thử lại</Button>} /> : events.length ? <Timeline className="mt-5" items={events.map(ev => ({ children: <>{formatEventText(ev)}{ev.message && <div>{ev.message}</div>}<Typography.Text type="secondary">{formatDateTime(ev.occurredAt)}</Typography.Text></> }))} /> : <Empty description="Chưa có timeline" />}</Modal>;
}
