import { Link } from 'react-router-dom';
import { formatTicketCode } from '../utils';
import type { TrackDelivery, StatusInfo } from '../types';

export default function StatusCard({ delivery, si, isTerminal }: {
  delivery: TrackDelivery;
  si: StatusInfo;
  isTerminal: boolean;
}) {
  return (
    <>
      <div className={`rounded-2xl p-5 border ${si.bg} ${si.border}`}>
        <div className="text-center">
          <div className="text-5xl mb-3">{si.icon}</div>
          <p className={`text-lg font-bold ${si.color}`}>{si.label}</p>

          {delivery.ticketNumber && !isTerminal && (
            <div className="mt-4 inline-flex flex-col items-center bg-white rounded-2xl px-8 py-4 shadow-sm border border-thiso-100">
              <p className="text-[10px] font-black tracking-widest text-thiso-400 uppercase mb-2">🎫 Số thẻ của bạn</p>
              <p className="text-3xl font-black text-thiso-800 tracking-widest leading-none font-mono">
                {formatTicketCode(delivery)}
              </p>
              <p className="text-[10px] text-thiso-400 mt-2">Nhìn số thẻ này trên màn hình chờ</p>
            </div>
          )}

          {delivery.status === 'CALLED' && delivery.assignedSlot && (
            <div className="mt-3 inline-block bg-sky-50 rounded-2xl px-8 py-4 shadow-sm border border-sky-200">
              <p className="text-[10px] font-black tracking-widest text-sky-400 uppercase mb-1">Vị trí nhận hàng</p>
              <p className="text-4xl font-black text-sky-700 tracking-widest">{delivery.assignedSlot.code}</p>
              <p className="text-sm text-thiso-500 mt-1">{delivery.assignedSlot.name}</p>
              {delivery.assignedSlot.zone && (
                <p className="text-xs text-thiso-400">{delivery.assignedSlot.zone.name}</p>
              )}
            </div>
          )}
          {delivery.status === 'WAITING' && !delivery.queueInfo && (
            <p className="text-sm text-yellow-600 mt-2">
              Vui lòng chờ — hệ thống sẽ tự động gọi khi có vị trí trống
            </p>
          )}
        </div>
      </div>

      {delivery.status === 'REGISTERED' && (
        <div className="bg-white rounded-2xl border border-thiso-100 px-4 py-3 text-center text-xs text-thiso-500">
          Nhập sai thông tin? Bạn có thể{' '}
          <Link
            to={`/cancelled?code=${encodeURIComponent(delivery.registrationCode)}`}
            className="font-bold text-red-600 underline"
          >
            hủy chuyến
          </Link>
          {' '}và đăng ký lại.
        </div>
      )}
    </>
  );
}
