import type { TrackDelivery, TimelineEvent } from '../types';
import { fmtDate } from '../utils';

function buildTimeline(delivery: TrackDelivery): TimelineEvent[] {
  return [
    { icon: '📝', label: 'Đăng ký',         time: delivery.createdAt,           done: true,                          detail: null },
    { icon: '🔐', label: 'Check-in cổng',    time: delivery.checkinTime,          done: !!delivery.checkinTime,        detail: null },
    {
      icon: '📢',
      label: delivery.assignedSlot ? `Được gọi vào ${delivery.assignedSlot.code}` : 'Được gọi vào dock',
      time: delivery.calledTime, done: !!delivery.calledTime,
      detail: delivery.assignedSlot
        ? `${delivery.assignedSlot.name}${delivery.assignedSlot.zone ? ' · ' + delivery.assignedSlot.zone.name : ''}`
        : null,
    },
    { icon: '📦', label: 'Bắt đầu nhận hàng', time: delivery.receivingStartTime, done: !!delivery.receivingStartTime, detail: null },
    { icon: '✅', label: 'Hoàn thành',         time: delivery.completedTime,       done: !!delivery.completedTime,      detail: null },
  ];
}

export default function JourneyTimeline({ delivery }: { delivery: TrackDelivery }) {
  const timeline = buildTimeline(delivery);

  return (
    <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-thiso-50">
        <p className="text-[11px] font-semibold text-thiso-400 uppercase tracking-wider">Hành trình</p>
      </div>
      <div className="px-5 py-4 space-y-0">
        {timeline.map((ev, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${ev.done ? 'bg-green-100 text-green-700' : 'bg-thiso-100 text-thiso-300'}`}>
                {ev.done ? '✓' : <span className="text-base">{ev.icon}</span>}
              </div>
              {i < timeline.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[18px] my-1 rounded-full ${ev.done ? 'bg-green-200' : 'bg-thiso-100'}`} />
              )}
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-tight ${ev.done ? 'text-thiso-800' : 'text-thiso-300'}`}>
                {ev.label}
              </p>
              {ev.detail && <p className="text-xs text-thiso-400 mt-0.5">{ev.detail}</p>}
              {ev.time   && <p className="text-xs text-thiso-400 mt-0.5">{fmtDate(ev.time)}</p>}
              {!ev.done && !ev.time && <p className="text-xs text-thiso-300 mt-0.5">Đang chờ…</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
