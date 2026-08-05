import type { UnitDispatch } from '../../../lib/types';

export default function AICard({
  unitDispatch,
  onAction,
}: {
  unitDispatch: UnitDispatch;
  onAction: (id: string, slotId?: string) => void;
}) {
  const { alerts, recommendations } = unitDispatch.insights;
  if (alerts.length === 0 && recommendations.length === 0) return null;
  const criticals = alerts.filter((alert) => alert.level === 'critical');
  const warnings = alerts.filter((alert) => alert.level === 'warning');

  return (
    <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center gap-2">
        <span>🤖</span>
        <span className="text-white font-bold text-sm">AI Điều phối</span>
        {criticals.length > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full animate-pulse font-bold">
            {criticals.length} KHẨN CẤP
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {criticals.map((alert, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 bg-red-50">
            <div className="flex-1 text-sm text-red-800 font-medium">{alert.message}</div>
            {alert.deliveryId && (
              <button type="button" className="shrink-0 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-red-700" onClick={() => onAction(alert.deliveryId!)}>Xử lý ngay</button>
            )}
          </div>
        ))}
        {warnings.map((alert, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 bg-yellow-50">
            <div className="flex-1 text-sm text-yellow-800">{alert.message}</div>
            {alert.deliveryId && (
              <button type="button" className="shrink-0 bg-yellow-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-yellow-600" onClick={() => onAction(alert.deliveryId!)}>Xử lý</button>
            )}
          </div>
        ))}
        {recommendations.map((recommendation, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 text-sm text-slate-700">{recommendation.message}</div>
            {recommendation.deliveryId && (
              <button type="button" className="shrink-0 bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-700" onClick={() => onAction(recommendation.deliveryId!, recommendation.slotId)}>Gọi ngay</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
