import type { SlotInfo } from '../../../lib/types';

type OtherTimeModalProps = {
  slots: SlotInfo[];
  deliveryDate: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function OtherTimeModal({
  slots,
  deliveryDate,
  onConfirm,
  onClose,
}: OtherTimeModalProps) {
  const available = slots.filter(s => !s.isPast && s.available);
  const firstTime = slots[0]?.time;
  const lastTime = slots[slots.length - 1]?.time;
  const dateLabel = deliveryDate.split('-').reverse().join('/');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-amber-500 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">⚠</span>
            <div>
              <p className="font-bold text-base leading-tight">Đăng ký không có giờ cụ thể</p>
              <p className="text-amber-100 text-xs mt-0.5">Ngày {dateLabel}</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {firstTime && lastTime ? (
            <div className="bg-thiso-50 rounded-xl p-3.5 border border-thiso-100">
              <p className="text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1.5">Khung giờ nhận hàng</p>
              <p className="text-base font-mono font-black text-thiso-800">{firstTime} — {lastTime}</p>
              {available.length === 0
                ? <p className="text-xs text-amber-600 font-semibold mt-1.5">Tất cả slot đã đầy trong ngày này</p>
                : <p className="text-xs text-green-600 mt-1.5">Còn {available.length} khung giờ trống — hãy chọn nếu có thể</p>
              }
            </div>
          ) : (
            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
              <p className="text-xs font-semibold text-amber-700">Không tìm thấy khung giờ nhận hàng cho ngày này.</p>
              <p className="text-xs text-amber-500 mt-1">Đơn vị có thể không nhận hàng hoặc chưa cấu hình lịch cho ngày này.</p>
            </div>
          )}
          <div className="space-y-1.5 text-sm text-thiso-600">
            <p>Xe của bạn sẽ được đăng ký <strong>không có giờ hẹn cụ thể</strong> và xếp vào hàng chờ theo thứ tự check-in.</p>
            <p className="text-xs text-thiso-400">Xe đã đặt giờ sẽ được ưu tiên gọi vào trước trong khung giờ của họ.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">← Quay lại</button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 h-11 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors text-sm"
            >
              Xác nhận →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
