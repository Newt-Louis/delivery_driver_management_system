import type { QueueBannerState } from '../types';

export default function QueueBanner({ queueBanner, onClose }: {
  queueBanner: QueueBannerState;
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[55] flex items-center gap-3 px-4 py-3.5 shadow-lg animate-in slide-in-from-top-3 duration-300 cursor-pointer ${queueBanner.isUrgent ? 'bg-amber-500' : 'bg-sky-600'}`}
      onClick={onClose}
    >
      <span className={`text-2xl flex-shrink-0 ${queueBanner.isUrgent ? 'animate-bounce' : ''}`}>
        {queueBanner.isUrgent ? '⚡' : '🔢'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-sm leading-tight">
          {queueBanner.isUrgent
            ? `Sắp đến lượt! Còn ${queueBanner.pos} lượt nữa`
            : `Hàng chờ cập nhật — Vị trí #${queueBanner.pos}`}
        </p>
        {queueBanner.diff > 0 && (
          <p className="text-white/80 text-xs mt-0.5">Tiến lên {queueBanner.diff} lượt ▲ · Nhấn để đóng</p>
        )}
      </div>
      <span className="text-white/60 text-lg flex-shrink-0">×</span>
    </div>
  );
}
