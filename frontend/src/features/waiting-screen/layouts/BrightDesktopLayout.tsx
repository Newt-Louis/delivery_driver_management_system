import type { useWaitingScreen } from '../hooks/useWaitingScreen';
import GoodsLegend from '../components/GoodsLegend';
import ThemeToggle from '../components/ThemeToggle';
import FullscreenBtn from '../components/FullscreenBtn';
import NoUnitsState from '../components/NoUnitsState';
import BrightCalledOverlay from '../components/bright/CalledOverlay';
import BrightUnitPanel from '../components/bright/UnitPanel';
import { getDeliveryUnitKey } from '../utils';

type Hook = ReturnType<typeof useWaitingScreen>;

export default function BrightDesktopLayout(hook: Hook) {
  const {
    deliveries, calledEvt, highlightId, now, brand,
    isFullscreen, view, toggleView, toggleFullscreen, dismissAlert,
    unitKeys, desktopGridStyle, mallName, tagline, mallLogo, driverUrl,
    totalWaiting, totalCalled, totalReceiving,
  } = hook;

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden select-none font-sans">
      {calledEvt && <BrightCalledOverlay evt={calledEvt} brand={brand} onDismiss={dismissAlert} />}

      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {mallLogo
            ? <img src={mallLogo} alt={mallName} className="h-10 object-contain rounded" />
            : <div className="w-10 h-10 rounded-xl bg-thiso-800 flex items-center justify-center">
                <span className="text-white font-black text-base">T</span>
              </div>}
          <div>
            <div className="font-black text-gray-900 leading-none" style={{ fontSize: 'clamp(0.9rem, 1.4vw, 1.1rem)' }}>{mallName}</div>
            <div className="text-gray-400 text-xs mt-0.5">{tagline}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-3xl font-black tabular-nums leading-none text-amber-700">{totalWaiting}</span>
            <span className="text-xs font-semibold text-amber-600 opacity-80">Đang chờ</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
            <span className="text-3xl font-black tabular-nums leading-none text-sky-700">{totalCalled}</span>
            <span className="text-xs font-semibold text-sky-600 opacity-80">Được gọi</span>
          </div>
          {totalReceiving > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
              <span className="text-3xl font-black tabular-nums leading-none text-green-700">{totalReceiving}</span>
              <span className="text-xs font-semibold text-green-600 opacity-80">Đang nhận</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono font-black text-gray-800 leading-none tabular-nums"
                 style={{ fontSize: 'clamp(1.3rem, 2vw, 1.8rem)' }}>
              {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              {now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </div>
          </div>
          <FullscreenBtn isFullscreen={isFullscreen} onToggle={toggleFullscreen} view={view} />
          <ThemeToggle view={view} onToggle={toggleView} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 grid gap-3 p-3 min-h-0 overflow-y-auto" style={desktopGridStyle}>
        {unitKeys.length === 0 ? <NoUnitsState /> : unitKeys.map((u) => (
          <BrightUnitPanel
            key={u} unitKey={u}
            deliveries={deliveries.filter((d) => getDeliveryUnitKey(d) === u)}
            highlightId={highlightId} brand={brand}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-5 py-2 flex items-center justify-between">
        <GoodsLegend bright />
        <span className="text-gray-400 text-xs">
          📱 Đăng ký:{' '}
          <a href={driverUrl} target="_blank" rel="noreferrer" className="text-sky-500 font-mono underline">{driverUrl}</a>
        </span>
        <span className="text-gray-300 text-xs">● Realtime</span>
      </div>
    </div>
  );
}
