import { useState } from 'react';
import { expireStaleDeliveries } from '../api';

export default function ExpiredBanner({ count, onDone }: { count: number; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function runExpire() {
    setLoading(true);
    try {
      const responseMessage = await expireStaleDeliveries();
      setMessage(responseMessage);
      onDone();
    } catch {
      setMessage('Lỗi khi xử lý');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }

  return (
    <div className="bg-thiso-50 border border-thiso-200 text-thiso-800 px-4 py-3 rounded-xl flex flex-wrap items-center gap-3">
      <span className="text-xl shrink-0">🕓</span>
      <span className="font-semibold text-sm flex-1">
        <strong>{count}</strong> đăng ký quá ngày đã tự động lưu vào lịch sử (không check-in hoặc không nhận hàng).
        Tra cứu tại <span className="underline font-bold">Báo cáo → Lịch sử</span>, lọc trạng thái <em>Hết hạn</em>.
      </span>
      {message ? (
        <span className="text-xs font-semibold text-thiso-700">{message}</span>
      ) : (
        <button
          type="button"
          onClick={runExpire}
          disabled={loading}
          className="btn-primary text-xs px-3 py-1.5 shrink-0"
        >
          {loading ? 'Đang xử lý...' : 'Xử lý ngay'}
        </button>
      )}
    </div>
  );
}
