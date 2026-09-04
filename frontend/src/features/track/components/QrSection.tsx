import type { TrackDelivery } from '../types';

export default function QrSection({ delivery, qrDataUrl, qrExpanded, setQrExpanded }: {
  delivery: TrackDelivery;
  qrDataUrl: string;
  qrExpanded: boolean;
  setQrExpanded: (v: boolean) => void;
}) {
  const qrHint =
    delivery.status === 'REGISTERED'
      ? { who: 'Đến quầy check-in — quét QR này để vào hàng chờ', icon: '📷', color: 'text-thiso-900' }
      : delivery.status === 'WAITING'
      ? { who: 'Đang chờ gọi vào dock — giữ QR sẵn sàng', icon: '⏳', color: 'text-yellow-600' }
      : { who: 'Hiển thị cho nhân viên nhận hàng scan', icon: '📦', color: 'text-thiso-900' };

  return (
    <>
      <button
        onClick={() => setQrExpanded(true)}
        className="w-full bg-white rounded-2xl border border-thiso-100 p-4 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
      >
        <img src={qrDataUrl} alt="QR" className="w-20 h-20 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${qrHint.color}`}>{qrHint.icon} {qrHint.who}</p>
          <p className="text-xs text-thiso-400 mt-1">Nhấn để phóng to QR</p>
          <p className="text-[11px] text-thiso-300 mt-1 font-mono">{delivery.registrationCode}</p>
        </div>
        <span className="text-thiso-300 text-xl flex-shrink-0">⤢</span>
      </button>

      {qrExpanded && (
        <div
          className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6"
          onClick={() => setQrExpanded(false)}
        >
          <p className="text-sm text-thiso-500 mb-2 font-medium">{qrHint.icon} {qrHint.who.split(' — ')[0]}</p>
          <div className="bg-white rounded-3xl shadow-2xl p-4 border-4 border-thiso-100">
            <img src={qrDataUrl} alt="QR" className="w-72 h-72 rounded-2xl" />
          </div>
          <p className="font-mono font-black text-thiso-800 text-2xl tracking-widest mt-6">
            {delivery.registrationCode}
          </p>
          <p className="text-thiso-400 text-sm mt-2">{delivery.vehiclePlate}</p>
          <p className="text-thiso-300 text-xs mt-6">Nhấn bất kỳ để đóng</p>
        </div>
      )}
    </>
  );
}
