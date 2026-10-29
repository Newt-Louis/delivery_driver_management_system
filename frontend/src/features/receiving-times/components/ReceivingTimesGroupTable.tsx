import { Button, Card, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReceivingTimeConfig } from '../../../lib/types';
import { CONF_LABEL, GOODS_LABEL, VT_LABEL } from '../constants';
import { groupReceivingTimeConfigs } from '../utils';
type Group = ReturnType<typeof groupReceivingTimeConfigs>[number];
export default function ReceivingTimesGroupTable({ group, canManageConfig, acceptingId, onAcceptOne }: { group: Group; canManageConfig: boolean; acceptingId: string | null; onAcceptOne: (id: string) => void }) {
 const columns: ColumnsType<ReceivingTimeConfig> = [
 { title: 'Loại xe', dataIndex: 'vehicleType', render: (v: string) => VT_LABEL[v] ?? v }, { title: 'Loại hàng', dataIndex: 'goodsType', render: (v: string) => GOODS_LABEL[v] ?? v }, { title: 'Cấu hình hiện tại', dataIndex: 'configuredMinutes', render: (v: number) => `${v} phút` }, { title: 'AI khuyến nghị', dataIndex: 'liveAvgMinutes', render: (v: number | null) => v === null ? 'Chưa có dữ liệu' : `${v} phút` }, { title: 'Số mẫu', dataIndex: 'liveSampleCount' }, { title: 'Độ tin cậy', dataIndex: 'confidence', render: (v: string) => <Tag>{CONF_LABEL[v]?.text ?? v}</Tag> }, { title: 'Chênh lệch', dataIndex: 'diffMinutes', render: (v: number | null) => v === null ? '—' : `${v > 0 ? '+' : ''}${v} phút` }, { title: 'Hành động', key: 'action', render: (_, c) => { const canAccept = c.recommendedMinutes !== null && c.shouldUpdate; return canManageConfig && canAccept ? <Button loading={acceptingId === c.id} onClick={() => onAcceptOne(c.id)}>Chấp nhận {c.liveAvgMinutes} phút</Button> : c.recommendedMinutes !== null && !c.shouldUpdate ? 'Đã tối ưu' : !canManageConfig && canAccept ? 'Chờ ADMIN_LOC áp dụng' : 'Chạy phân tích trước'; } },
 ]; const pending = group.items.filter(c => c.shouldUpdate).length;
 return <Card title={<Space><span style={{ width: 8, height: 24, display: 'inline-block', backgroundColor: group.meta.color }} /><Typography.Text>{group.meta.label}</Typography.Text></Space>} extra={pending > 0 && <Tag color="warning">{pending} chờ chấp nhận</Tag>}><Table rowKey="id" columns={columns} dataSource={group.items} pagination={false} scroll={{ x: 1000 }} /></Card>;
}
