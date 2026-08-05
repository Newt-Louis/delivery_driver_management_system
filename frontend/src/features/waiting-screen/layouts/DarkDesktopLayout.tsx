import type { useWaitingScreen } from '../hooks/useWaitingScreen';
import KpiStrip from '../components/KpiStrip';
import GoodsLegend from '../components/GoodsLegend';
import ThemeToggle from '../components/ThemeToggle';
import FullscreenBtn from '../components/FullscreenBtn';
import NoUnitsState from '../components/NoUnitsState';
import UnitLogo from '../components/UnitLogo';
import DarkCalledOverlay from '../components/dark/CalledOverlay';
import DarkUnitPanel from '../components/dark/UnitPanel';
import { getUnitBrand, getDeliveryUnitKey } from '../utils';

type Hook = ReturnType<typeof useWaitingScreen>;

export default function DarkDesktopLayout(hook: Hook) {
  const {
    deliveries, calledEvt, highlightId, now, brand,
    isFullscreen, view, toggleView, toggleFullscreen, dismissAlert,
    unitKeys, desktopGridStyle, mallName, tagline, mallLogo, driverUrl,
    totalWaiting, totalCalled, totalReceiving,
  } = hook;

  return (
    <div className="h-screen bg-thiso-900 flex flex-col overflow-hidden select-none font-sans">
      {calledEvt && <DarkCalledOverlay evt={calledEvt} brand={brand} onDismiss={dismissAlert} />}
      {calledEvt && (
        <div className="fixed inset-0 z-40 pointer-events-none animate-pulse"
             style={{ boxShadow: 'inset 0 0 0 14px rgba(56,189,248,0.80)' }} />
      )}

      {/* Scrolling marquee */}
      <div className="shrink-0 bg-thiso-800 border-b border-thiso-700 py-1.5 marquee-track overflow-hidden">
        <span className="marquee-content text-sm font-black tracking-[0.25em] text-thiso-300 uppercase">
          ⭐&nbsp;&nbsp;{mallName}&nbsp;&nbsp;·&nbsp;&nbsp;{tagline}&nbsp;&nbsp;·&nbsp;&nbsp;
          {mallName}&nbsp;&nbsp;·&nbsp;&nbsp;{tagline}&nbsp;&nbsp;·&nbsp;&nbsp;⭐
        </span>
      </div>

      {/* Header */}
      <div className="shrink-0 bg-thiso-800 border-b border-thiso-700 px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            {mallLogo
              ? <img src={mallLogo} alt={mallName} className="h-9 object-contain rounded" />
              : <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-white font-black text-base">T</span>
                </div>}
            <div>
              <div className="text-white font-black tracking-widest leading-none"
                   style={{ fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)' }}>{mallName}</div>
              <div className="text-thiso-400 tracking-wider mt-0.5"
                   style={{ fontSize: 'clamp(0.65rem, 0.9vw, 0.78rem)' }}>{tagline}</div>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-3">
            {unitKeys.map((u) => {
              const cfg = getUnitBrand(brand, u);
              const cnt = deliveries.filter((d) => getDeliveryUnitKey(d) === u && ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)).length;
              const calledCnt = deliveries.filter((d) => getDeliveryUnitKey(d) === u && d.status === 'CALLED').length;
              return (
                <div key={u} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full inline-block ${calledCnt > 0 ? 'animate-pulse' : ''}`} style={{ background: cfg.primaryColor }} />
                  <span className="text-thiso-400 text-xs font-semibold">{cfg.shortName}</span>
                  {cnt > 0 && <span className="text-thiso-600 text-xs tabular-nums">({cnt})</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <KpiStrip totalWaiting={totalWaiting} totalCalled={totalCalled} totalReceiving={totalReceiving} dark />
          <div className="text-right">
            <div className="font-mono font-black text-white leading-none tabular-nums"
                 style={{ fontSize: 'clamp(1.2rem, 2.2vw, 1.7rem)' }}>
              {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-thiso-500 mt-0.5" style={{ fontSize: '0.7rem' }}>
              {now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </div>
          </div>
          <FullscreenBtn isFullscreen={isFullscreen} onToggle={toggleFullscreen} view={view} />
          <ThemeToggle view={view} onToggle={toggleView} />
        </div>
      </div>

      {/* Unit columns */}
      <div className="flex-1 grid gap-3 p-3 min-h-0 overflow-y-auto" style={desktopGridStyle}>
        {unitKeys.length === 0 ? <NoUnitsState dark /> : unitKeys.map((u) => (
          <DarkUnitPanel
            key={u} unitKey={u}
            deliveries={deliveries.filter((d) => getDeliveryUnitKey(d) === u)}
            highlightId={highlightId} brand={brand}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 bg-thiso-800 border-t border-thiso-700 px-5 py-2 flex items-center justify-between">
        <GoodsLegend />
        <span className="text-thiso-500 text-xs">
          📱 Đăng ký giao hàng:{' '}
          <a href={driverUrl} target="_blank" rel="noreferrer" className="text-thiso-300 hover:text-white font-mono underline">
            {driverUrl}
          </a>
        </span>
        <span className="text-thiso-700 text-xs">● Realtime</span>
      </div>
    </div>
  );
}
