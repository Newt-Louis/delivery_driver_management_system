export default function NotificationPermissionCard({
  notifGranted,
  onEnable,
}: {
  notifGranted: boolean;
  onEnable: () => void;
}) {
  if (notifGranted || !('Notification' in window)) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
      <span className="text-2xl shrink-0">🔔</span>
      <div className="flex-1">
        <div className="font-semibold text-amber-800 text-sm">Bật thông báo</div>
        <div className="text-xs text-amber-600 mt-0.5 mb-2">
          Cho phép thông báo để nhận rung + cảnh báo khi xe bạn được gọi hoặc sắp đến giờ hẹn.
        </div>
        <button
          type="button"
          onClick={onEnable}
          className="text-xs px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors"
        >
          Bật thông báo
        </button>
      </div>
    </div>
  );
}
