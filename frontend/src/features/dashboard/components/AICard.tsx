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
    <div className="mb-4 overflow-hidden rounded-2xl border border-thiso-200 bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-thiso-100 px-4 py-3">
        <span className="text-thiso-900 font-bold text-sm">Gợi ý điều phối</span>
        {criticals.length > 0 && (
          <span className="ml-auto bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
            {criticals.length} KHẨN CẤP
          </span>
        )}
      </div>
      <div className="divide-y divide-thiso-100">
        {criticals.map((alert, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 bg-red-50">
            <div className="flex-1 text-sm text-red-800 font-medium">{alert.message}</div>
            {alert.deliveryId && (
              <button type="button" className="btn-danger shrink-0 px-3 py-1.5 text-xs" onClick={() => onAction(alert.deliveryId!)}>Xử lý ngay</button>
            )}
          </div>
        ))}
        {warnings.map((alert, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 bg-amber-50">
            <div className="flex-1 text-sm text-amber-800">{alert.message}</div>
            {alert.deliveryId && (
              <button type="button" className="btn-warning shrink-0 px-3 py-1.5 text-xs" onClick={() => onAction(alert.deliveryId!)}>Xử lý</button>
            )}
          </div>
        ))}
        {recommendations.map((recommendation, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 text-sm text-thiso-700">{recommendation.message}</div>
            {recommendation.deliveryId && (
              <button type="button" className="btn-primary shrink-0 px-3 py-1.5 text-xs" onClick={() => onAction(recommendation.deliveryId!, recommendation.slotId)}>Gọi ngay</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
