import { useQuery } from '@tanstack/react-query';
import { getDeliveryHistoryEvents } from '../api';
import type { DeliveryHistoryItem, DeliveryHistoryEventItem } from '../types';
import { EVENT_LABEL, STATUS_LABEL } from '../constants';

function fmtDt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function eventText(ev: DeliveryHistoryEventItem): string {
  const base = EVENT_LABEL[ev.eventType]?.label ?? ev.eventType;
  const slot = ev.slotCode ? ` → ${ev.slotCode}` : '';
  const actor = ev.actorLabel ? ` (${ev.actorLabel})` : '';
  const reason = ev.reason ? `: ${ev.reason}` : '';
  return `${base}${slot}${actor}${reason}`;
}

interface TimelineModalProps {
  item: DeliveryHistoryItem;
  onClose: () => void;
}

export default function TimelineModal({ item, onClose }: TimelineModalProps) {
  const { data: events = [], isLoading } = useQuery<DeliveryHistoryEventItem[]>({
    queryKey: ['histories-timeline', item.id],
    queryFn: () => getDeliveryHistoryEvents(item.id),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-thiso-100 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-sky-700 font-black">{item.registrationCode}</div>
            <h3 className="text-xl font-black text-thiso-900">{item.vehiclePlate}</h3>
            <p className="text-sm text-thiso-500">{item.vendorName} · {item.driverName}</p>
          </div>
          <button className="text-2xl text-thiso-300 hover:text-thiso-600 leading-none" onClick={onClose}>×</button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div><span className="text-thiso-400">Trạng thái: </span><strong>{STATUS_LABEL[item.finalStatus] ?? item.finalStatus}</strong></div>
            <div><span className="text-thiso-400">Số lần gọi: </span><strong>{item.callCount}</strong></div>
            <div><span className="text-thiso-400">Slot: </span><strong>{item.assignedSlotCode ?? '—'}</strong></div>
            <div><span className="text-thiso-400">Lưu lúc: </span><strong>{fmtDt(item.archivedAt)}</strong></div>
            {item.closeReason && <div className="col-span-2"><span className="text-thiso-400">Lý do: </span><strong>{item.closeReason}</strong></div>}
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-thiso-400">Đang tải timeline...</div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-thiso-400">Chưa có timeline</div>
          ) : (
            <ol className="relative border-l-2 border-thiso-100 space-y-4 ml-3">
              {events.map((ev) => {
                const meta = EVENT_LABEL[ev.eventType] ?? { icon: '•' };
                return (
                  <li key={ev.id} className="relative pl-5">
                    <span className="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-white border-2 border-thiso-200 flex items-center justify-center text-[11px]">{meta.icon}</span>
                    <div className={`text-sm font-medium ${meta.accent ?? 'text-thiso-700'}`}>{eventText(ev)}</div>
                    {ev.message && <div className="text-xs text-thiso-500 mt-0.5">{ev.message}</div>}
                    <div className="text-xs text-thiso-400 mt-0.5">{fmtDt(ev.occurredAt)}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
