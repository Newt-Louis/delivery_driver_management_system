import { useState } from 'react';

interface CancelReasonModalProps {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}

export default function CancelReasonModal({ onClose, onSubmit, loading }: CancelReasonModalProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-thiso-100">
          <h3 className="text-lg font-black text-thiso-900">Lý do hủy lượt giao hàng</h3>
        </div>
        <div className="p-5">
          <label className="label" htmlFor="cancel-reason">Lý do hủy</label>
          <textarea
            id="cancel-reason"
            className="input min-h-[120px] resize-none"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>
        <div className="px-5 py-4 border-t border-thiso-100 flex justify-end gap-2 bg-thiso-50/60">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Đóng</button>
          <button
            type="button"
            className="btn-danger"
            disabled={loading || trimmed.length < 3}
            onClick={() => onSubmit(trimmed)}
          >
            {loading ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}
