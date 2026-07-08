import type { AuditLogItem } from '../types';
import { ACTOR_TYPE_LABEL } from '../constants';

function fmtDt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-bold text-thiso-500 mb-1">{label}</div>
      <pre className="bg-thiso-50 rounded-xl p-3 text-xs text-thiso-700 overflow-x-auto max-h-48 overflow-y-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

interface AuditDetailModalProps {
  item: AuditLogItem;
  onClose: () => void;
}

export default function AuditDetailModal({ item, onClose }: AuditDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-thiso-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-thiso-900">Chi tiết Audit Log</h3>
            <p className="text-xs text-thiso-400 mt-0.5">{fmtDt(item.createdAt)}</p>
          </div>
          <button className="text-2xl text-thiso-300 hover:text-thiso-600 leading-none" onClick={onClose}>×</button>
        </div>
        <div className="p-5 overflow-y-auto text-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-thiso-400">Actor: </span><strong>{item.actorLabel ?? '—'}</strong></div>
            <div><span className="text-thiso-400">Loại: </span><strong>{ACTOR_TYPE_LABEL[item.actorType] ?? item.actorType}</strong></div>
            <div><span className="text-thiso-400">Hành động: </span><strong>{item.action}</strong></div>
            <div><span className="text-thiso-400">Đối tượng: </span><strong>{item.targetType}</strong></div>
            {item.targetId && <div className="col-span-2"><span className="text-thiso-400">Target ID: </span><strong className="font-mono text-xs">{item.targetId}</strong></div>}
          </div>
          <JsonBlock label="Trước (before)" data={item.before} />
          <JsonBlock label="Sau (after)" data={item.after} />
          <JsonBlock label="Metadata" data={item.metadata} />
        </div>
      </div>
    </div>
  );
}
