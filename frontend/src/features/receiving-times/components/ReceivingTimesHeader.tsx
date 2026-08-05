import type { FlashMessage } from '../types';

interface ReceivingTimesHeaderProps {
  canManageConfig: boolean;
  pendingCount: number;
  analyzing: boolean;
  acceptingAll: boolean;
  message: FlashMessage;
  onAnalyze: () => void;
  onAcceptAll: () => void;
  onExport: () => void;
}

export default function ReceivingTimesHeader({
  canManageConfig,
  pendingCount,
  analyzing,
  acceptingAll,
  message,
  onAnalyze,
  onAcceptAll,
  onExport,
}: ReceivingTimesHeaderProps) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
      <div>
        <div className="section-heading mb-1">Cài đặt điều hành</div>
        <h1 className="page-title">📊 Thời gian nhận hàng trung bình</h1>
        <p className="text-sm text-thiso-500 mt-1">
          Hệ thống tự học từ lịch sử để ước tính thời gian chờ cho tài xế
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {canManageConfig && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              <span className={analyzing ? 'animate-spin' : ''}>🔬</span>
              {analyzing ? 'Đang phân tích...' : 'Phân tích lịch sử'}
            </button>
          )}
          {canManageConfig && pendingCount > 0 && (
            <button
              type="button"
              onClick={onAcceptAll}
              disabled={acceptingAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              ✅ Chấp nhận tất cả ({pendingCount})
            </button>
          )}
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
          >
            ⬇ Xuất Excel
          </button>
        </div>
        {message && (
          <div className={`text-xs px-3 py-1.5 rounded-full font-semibold ${message.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
