import { useState } from 'react';
import type { useWaitingScreen } from '../hooks/useWaitingScreen';
import UnitLogo from '../components/UnitLogo';
import ThemeToggle from '../components/ThemeToggle';
import NoUnitsState from '../components/NoUnitsState';
import DarkCalledOverlay from '../components/dark/CalledOverlay';
import DarkUnitPanel from '../components/dark/UnitPanel';
import BrightCalledOverlay from '../components/bright/CalledOverlay';
import BrightUnitPanel from '../components/bright/UnitPanel';
import { getUnitBrand, getDeliveryUnitKey } from '../utils';

type Hook = ReturnType<typeof useWaitingScreen>;

export default function MobileLayout(hook: Hook) {
  const {
    deliveries, calledEvt, highlightId, now, brand,
    activeTab, setActiveTab, view, toggleView, dismissAlert,
    unitKeys, mallName, mallLogo, totalWaiting, totalCalled,
    locations, selectedBusinessLocationId, changeBusinessLocation,
  } = hook;

  const isBright = view === 'bright';
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const selectedLocation = locations.find((item) => item.id === selectedBusinessLocationId);
  const locationLabel = selectedLocation?.locationName ?? mallName;
  const locationCode = selectedLocation?.code ?? brand?.mall.code;
  const locationLogo = selectedLocation?.logoUrl ?? mallLogo;

  return (
    <div className={`min-h-screen flex flex-col ${isBright ? 'bg-gray-100' : 'bg-thiso-50'}`}>
      {calledEvt && (isBright
        ? <BrightCalledOverlay evt={calledEvt} brand={brand} onDismiss={dismissAlert} />
        : <DarkCalledOverlay   evt={calledEvt} brand={brand} onDismiss={dismissAlert} />
      )}
      {calledEvt && (
        <div className="fixed inset-0 z-40 pointer-events-none animate-pulse"
             style={{ boxShadow: 'inset 0 0 0 10px rgba(56,189,248,0.75)' }} />
      )}

      {/* Header */}
      <div className={`px-4 py-3 sticky top-0 z-10 flex items-center justify-between ${isBright ? 'bg-white border-b border-gray-200 shadow-sm' : 'bg-thiso-900'}`}>
        <div className="relative min-w-0">
          <button
            type="button"
            className={`flex min-w-0 items-center gap-2.5 rounded-xl pr-2 transition-colors ${isBright ? 'hover:bg-gray-50' : 'hover:bg-white/5'}`}
            onClick={() => setLocationMenuOpen((open) => !open)}
          >
            {locationLogo ? (
              <img src={locationLogo} alt="" className="h-7 object-contain rounded" />
            ) : (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isBright ? 'bg-thiso-800' : 'bg-white/10'}`}>
                <span className="text-white font-black text-xs">T</span>
              </div>
            )}
            <div className="min-w-0 text-left">
              <div className={`truncate font-black text-xs tracking-widest leading-none ${isBright ? 'text-gray-800' : 'text-white'}`}>{locationLabel}</div>
              <div className={`truncate text-[9px] ${isBright ? 'text-gray-400' : 'text-thiso-400'}`}>
                {locationCode ? `${locationCode} · ` : ''}Màn hình theo dõi
              </div>
            </div>
            <span className={`text-[10px] ${isBright ? 'text-gray-400' : 'text-thiso-500'}`}>▾</span>
          </button>

          {locationMenuOpen && (
            <div className={`absolute left-0 top-full mt-2 w-[min(86vw,22rem)] overflow-hidden rounded-2xl border shadow-xl ${isBright ? 'border-gray-200 bg-white' : 'border-thiso-700 bg-thiso-900'}`}>
              <div className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest ${isBright ? 'bg-gray-50 text-gray-400' : 'bg-thiso-800 text-thiso-500'}`}>
                Chọn khu vực
              </div>
              <div className="max-h-72 overflow-y-auto">
                {locations.map((item) => {
                  const active = item.id === selectedBusinessLocationId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${isBright ? 'hover:bg-gray-50' : 'hover:bg-white/5'} ${active ? (isBright ? 'bg-sky-50' : 'bg-white/10') : ''}`}
                      onClick={() => {
                        setLocationMenuOpen(false);
                        changeBusinessLocation(item.id);
                      }}
                    >
                      {item.logoUrl ? (
                        <img src={item.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
                      ) : (
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${isBright ? 'bg-gray-100 text-gray-500' : 'bg-thiso-800 text-thiso-300'}`}>
                          {item.code.charAt(0)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs font-black ${isBright ? 'text-gray-800' : 'text-white'}`}>{item.locationName}</span>
                        <span className={`block truncate text-[10px] font-mono ${isBright ? 'text-gray-400' : 'text-thiso-500'}`}>{item.code}</span>
                      </span>
                      {active && <span className={`text-xs font-black ${isBright ? 'text-sky-500' : 'text-sky-300'}`}>Active</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: 'Chờ', v: totalWaiting, color: isBright ? '#D97706' : '#FBBF24' },
            { label: 'Gọi', v: totalCalled,  color: isBright ? '#0284C7' : '#7DD3FC' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-black text-sm leading-none tabular-nums" style={{ color: s.color }}>{s.v}</div>
              <div className={`text-[9px] ${isBright ? 'text-gray-400' : 'text-thiso-500'}`}>{s.label}</div>
            </div>
          ))}
          <div className={`font-mono font-black text-sm leading-none ml-1 ${isBright ? 'text-gray-700' : 'text-white'}`}>
            {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <ThemeToggle view={view} onToggle={toggleView} />
        </div>
      </div>

      {/* Tab bar */}
      <div className={`border-b flex shrink-0 ${isBright ? 'bg-white border-gray-200' : 'bg-thiso-800 border-thiso-700'}`}>
        {unitKeys.map((u) => {
          const cfg = getUnitBrand(brand, u);
          const cnt = deliveries.filter((d) =>
            getDeliveryUnitKey(d) === u && ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status),
          ).length;
          const calledCnt = deliveries.filter((d) => getDeliveryUnitKey(d) === u && d.status === 'CALLED').length;
          const isActive  = activeTab === u;
          return (
            <button key={u} onClick={() => setActiveTab(u)}
                    className={`flex-1 py-2.5 px-1 text-xs font-black tracking-wide transition-all relative
                      ${isActive ? (isBright ? 'text-gray-800' : 'text-white') : isBright ? 'text-gray-400' : 'text-thiso-500'}`}>
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: cfg.primaryColor }} />}
              {calledCnt > 0 && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              <span className="mr-1 inline-flex items-center"><UnitLogo logoUrl={cfg.logoUrl} icon={cfg.icon} px={16} /></span>
              {cfg.shortName}
              {cnt > 0 && <span className="ml-1 opacity-60 text-[10px]">({cnt})</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden p-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
        {unitKeys.length === 0 ? (
          <NoUnitsState dark={!isBright} />
        ) : isBright ? (
          <BrightUnitPanel
            key={activeTab} unitKey={activeTab}
            deliveries={deliveries.filter((d) => getDeliveryUnitKey(d) === activeTab)}
            highlightId={highlightId} brand={brand} compact
          />
        ) : (
          <DarkUnitPanel
            key={activeTab} unitKey={activeTab}
            deliveries={deliveries.filter((d) => getDeliveryUnitKey(d) === activeTab)}
            highlightId={highlightId} brand={brand} compact
          />
        )}
      </div>
    </div>
  );
}
