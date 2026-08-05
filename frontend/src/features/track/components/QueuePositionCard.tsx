import type { QueueInfo } from '../types';

export default function QueuePositionCard({ queueInfo }: { queueInfo: QueueInfo }) {
  const q = queueInfo;
  const isFront  = q.position <= (q.availableSlots || 1);
  const nearFront = q.position <= 5;
  const callAt    = q.estimatedCallTime ? new Date(q.estimatedCallTime) : null;
  const callTimeStr = callAt
    ? callAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 ${nearFront ? 'border-amber-400' : 'border-yellow-200'}`}>
      {nearFront && <div className="h-1 bg-amber-400 animate-pulse" />}
      <div className={`px-4 py-3 border-b flex items-center gap-2 ${nearFront ? 'bg-amber-50 border-amber-100' : 'bg-yellow-50 border-yellow-100'}`}>
        <span className={`text-lg ${nearFront ? 'animate-bounce' : ''}`}>{nearFront ? '⚡' : '🔢'}</span>
        <span className={`font-bold text-sm ${nearFront ? 'text-amber-800' : 'text-yellow-800'}`}>
          {nearFront ? 'Sắp đến lượt bạn!' : 'Vị trí hàng chờ'}
        </span>
        {isFront && (
          <span className="ml-auto text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full animate-pulse">
            ▶ Sắp được gọi!
          </span>
        )}
      </div>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center bg-yellow-50 rounded-2xl py-3">
            <p className="text-4xl font-black text-yellow-700 leading-none">#{q.position}</p>
            <p className="text-xs text-yellow-600 mt-1 font-medium">trong số {q.totalWaiting} xe chờ</p>
          </div>
          <div className="flex-1 text-center bg-sky-50 rounded-2xl py-3">
            {q.estimatedWaitMinutes === 0 ? (
              <>
                <p className="text-2xl font-black text-green-600 leading-none">Sắp gọi</p>
                <p className="text-xs text-green-500 mt-1 font-medium">có slot trống ngay</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-sky-700 leading-none">
                  {q.estimatedWaitMinutes < 60
                    ? `~${Math.round(q.estimatedWaitMinutes)} phút`
                    : `~${Math.ceil(q.estimatedWaitMinutes / 60)} giờ`}
                </p>
                <p className="text-xs text-sky-500 mt-1 font-medium">thời gian chờ ước tính</p>
              </>
            )}
          </div>
        </div>

        {callTimeStr && q.estimatedWaitMinutes > 0 && (
          <div className="flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3">
            <span className="text-xl">🕐</span>
            <div>
              <p className="text-xs text-indigo-500 font-medium">Dự kiến được gọi vào khoảng</p>
              <p className="text-xl font-black text-indigo-700 leading-none">{callTimeStr}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { value: String(q.availableSlots), label: 'Slot trống', color: q.availableSlots > 0 ? 'text-green-600' : 'text-red-500' },
            { value: `~${q.avgReceivingMinutes}'`, label: 'TB nhận/xe', color: 'text-thiso-600' },
            { value: String(q.totalWaiting - q.position), label: 'Xe sau bạn', color: 'text-thiso-500' },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-center bg-thiso-50 rounded-xl py-2 px-1">
              <p className={`font-black text-lg ${color}`}>{value}</p>
              <p className="text-[10px] text-thiso-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-2 bg-thiso-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, 100 - ((q.position - 1) / Math.max(q.totalWaiting, 1)) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-thiso-400 flex-shrink-0 font-mono">{q.position}/{q.totalWaiting}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
