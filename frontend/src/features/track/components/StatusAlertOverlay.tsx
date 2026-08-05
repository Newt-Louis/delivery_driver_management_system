import type { StatusAlert } from '../types';

export default function StatusAlertOverlay({ statusAlert, onClose }: {
  statusAlert: StatusAlert;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-8 text-center bg-green-600"
      onClick={onClose}
    >
      {statusAlert.level === 'urgent' && (
        <div className="absolute inset-0 animate-ping opacity-20 rounded-none bg-white pointer-events-none" />
      )}
      <div className="text-6xl mb-6 animate-bounce">
        {statusAlert.level === 'urgent' ? '🚛' : '✅'}
      </div>
      <p className="text-white font-black text-2xl leading-tight mb-3">{statusAlert.title}</p>
      <p className="text-white/80 text-base mb-10">{statusAlert.body}</p>
      <button className="bg-white/20 border border-white/40 text-white font-bold px-8 py-3 rounded-2xl text-sm active:scale-95 transition-transform">
        Nhấn để đóng
      </button>
      {statusAlert.level !== 'urgent' && (
        <p className="text-white/50 text-xs mt-4">Tự động đóng sau 10 giây</p>
      )}
    </div>
  );
}
