import { Descriptions, Modal } from 'antd';
import type { AuditLogItem } from '../types';
import { ACTOR_TYPE_LABEL } from '../constants';
import { formatDateTime } from '../formatters';
import { JsonBlock } from './TableParts';
export default function AuditDetailModal({ item, onClose }: { item: AuditLogItem; onClose: () => void }) {
 return <Modal open title="Chi tiết Audit Log" onCancel={onClose} footer={null} width={720}><Descriptions column={{ xs: 1, sm: 2 }} size="small" items={[{ key: 'date', label: 'Thời gian', children: formatDateTime(item.createdAt, 'medium') }, { key: 'actor', label: 'Actor', children: item.actorLabel ?? '—' }, { key: 'type', label: 'Loại', children: ACTOR_TYPE_LABEL[item.actorType] ?? item.actorType }, { key: 'action', label: 'Hành động', children: item.action }, { key: 'target', label: 'Đối tượng', children: item.targetType }, ...(item.targetId ? [{ key: 'id', label: 'Target ID', children: item.targetId }] : [])]} /><JsonBlock label="Trước (before)" data={item.before} /><JsonBlock label="Sau (after)" data={item.after} /><JsonBlock label="Metadata" data={item.metadata} /></Modal>;
}
