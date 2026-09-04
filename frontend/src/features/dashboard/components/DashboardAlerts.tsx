import type { DashboardSummary } from '../../../lib/types';
import ExpiredBanner from './ExpiredBanner';

export default function DashboardAlerts({
  summary,
  onExpireDone,
}: {
  summary?: DashboardSummary;
  onExpireDone: () => void;
}) {
  return (
    <div className="space-y-2 mb-4">
      {(summary?.urgentFreshFood ?? 0) > 0 && (
        <div className="border border-red-200 bg-red-50 text-red-800 px-4 py-3 rounded-xl flex items-center gap-3">
          <span className="text-xl shrink-0">🚨</span>
          <span className="font-bold">{summary!.urgentFreshFood} xe hàng TƯƠI SỐNG chờ hơn 25 phút – gọi ngay!</span>
        </div>
      )}
      {(summary?.noShowRisk ?? 0) > 0 && (
        <div className="border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <span className="font-bold">{summary!.noShowRisk} xe gọi hơn 15 phút chưa vào vị trí – gọi lại hoặc hủy.</span>
        </div>
      )}
      {(summary?.expiredToday ?? 0) > 0 && (
        <ExpiredBanner count={summary!.expiredToday} onDone={onExpireDone} />
      )}
    </div>
  );
}
