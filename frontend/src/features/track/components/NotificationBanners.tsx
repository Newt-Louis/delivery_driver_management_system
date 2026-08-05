import type { getPushPlatformSupport } from '../../../lib/platform';

type PushSupport = ReturnType<typeof getPushPlatformSupport>;

export default function NotificationBanners({ isTerminal, pushSupport, notifPermission, pushEnabled, deviceAlertsReady, onRequestNotif, onPrimeAlerts }: {
  isTerminal: boolean;
  pushSupport: PushSupport;
  notifPermission: NotificationPermission;
  pushEnabled: boolean;
  deviceAlertsReady: boolean;
  onRequestNotif: () => void;
  onPrimeAlerts: () => void;
}) {
  if (isTerminal) return null;

  return (
    <>
      {pushSupport.reason === 'ios_needs_pwa' && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">Bật thông báo trên iPhone/iPad</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Mở bằng Safari, nhấn Chia sẻ, chọn Thêm vào Màn hình chính, rồi mở app từ icon mới để bật thông báo.
            </p>
          </div>
        </div>
      )}
      {pushSupport.supported && notifPermission === 'default' && (
        <button
          onClick={onRequestNotif}
          className="w-full bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
        >
          <span className="text-2xl flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-indigo-800">Bật thông báo hệ thống</p>
            <p className="text-xs text-indigo-500 mt-0.5">Nhận cảnh báo ngay kể cả khi màn hình tắt</p>
          </div>
          <span className="text-xs font-semibold bg-indigo-600 text-white px-3 py-1 rounded-lg flex-shrink-0">Bật</span>
        </button>
      )}
      {notifPermission === 'granted' && pushEnabled && (
        <div className="w-full bg-green-50 border border-green-200 rounded-2xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-lg flex-shrink-0">🔔</span>
          <p className="text-xs text-green-700 font-medium flex-1">
            Thông báo hệ thống đã bật — sẽ nhận cảnh báo kể cả khi tắt màn hình
          </p>
        </div>
      )}
      {!deviceAlertsReady && (
        <button
          onClick={onPrimeAlerts}
          className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
        >
          <span className="text-2xl flex-shrink-0">📳</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-800">Bật rung và âm báo trong màn hình</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Chạm một lần để trình duyệt cho phép rung/chuông khi trạng thái thay đổi
            </p>
          </div>
        </button>
      )}
    </>
  );
}
