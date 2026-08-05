import type { DeliveryRegistration } from '../../../../lib/types';
import UnitLogo from '../UnitLogo';
import { getUnitBrand } from '../../utils';
import type { BrandConfig, UnitKey } from '../../types';
import BrightVehicleSection from './VehicleSection';

export default function BrightUnitPanel({ unitKey, deliveries, highlightId, brand, compact = false }: {
  unitKey: UnitKey; deliveries: DeliveryRegistration[]; highlightId: string | null;
  brand: BrandConfig | null; compact?: boolean;
}) {
  const cfg = getUnitBrand(brand, unitKey);

  const trucks     = deliveries.filter((d) => d.vehicleType !== 'MOTORBIKE');
  const motorbikes = deliveries.filter((d) => d.vehicleType === 'MOTORBIKE');

  const truckCalled    = [...trucks.filter((d) => d.status === 'CALLED')].sort((a, b) => (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0));
  const truckWaiting   = [...trucks.filter((d) => d.status === 'WAITING')].sort((a, b) => (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999));
  const mbCalled       = [...motorbikes.filter((d) => d.status === 'CALLED')].sort((a, b) => (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0));
  const mbWaiting      = [...motorbikes.filter((d) => d.status === 'WAITING')].sort((a, b) => (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999));

  const calledCount  = deliveries.filter((d) => d.status === 'CALLED').length;
  const activeCount  = deliveries.filter((d) => ['CALLED', 'WAITING'].includes(d.status)).length;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm overflow-hidden border-2"
         style={{ borderColor: `${cfg.primaryColor}50` }}>

      <div className="relative flex items-center flex-shrink-0 px-3"
           style={{ background: cfg.primaryColor, paddingTop: compact ? '0.9rem' : '0.85rem', paddingBottom: compact ? '0.9rem' : '0.85rem' }}>
        <div className="absolute inset-0 flex items-center justify-center gap-3 pointer-events-none">
          <UnitLogo logoUrl={cfg.logoUrl} icon={cfg.icon} px={compact ? 32 : 38} />
          <span className="leading-none"
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, color: '#111', fontSize: compact ? '1.25rem' : 'clamp(1.2rem, 2vw, 1.65rem)', letterSpacing: '0.04em' }}>
            {cfg.displayName}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 relative z-10">
          {calledCount > 0 && (
            <span className="bg-white/25 text-white font-black px-2.5 py-1 rounded-full animate-pulse"
                  style={{ fontSize: compact ? '0.82rem' : '0.78rem' }}>📣 {calledCount}</span>
          )}
          <span className="bg-black/20 text-white font-bold px-2.5 py-1 rounded-full"
                style={{ fontSize: compact ? '0.82rem' : '0.78rem' }}>{activeCount}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {compact ? (
          <div>
            <div className="flex items-center justify-center gap-3 py-3 bg-gray-100 border-b-2 border-gray-300">
              <span className="text-2xl leading-none">🚛</span>
              <span className="text-base font-black text-gray-700 uppercase tracking-widest">Xe Tải</span>
              <span className="text-sm font-bold text-gray-400 tabular-nums">({truckCalled.length + truckWaiting.length})</span>
            </div>
            <BrightVehicleSection items={truckCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled compact />
            <BrightVehicleSection items={truckWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} compact />
            {truckCalled.length === 0 && truckWaiting.length === 0 && (
              <div className="flex items-center justify-center py-6 text-gray-300 text-sm border-b border-gray-100">—</div>
            )}
            <div className="flex items-center justify-center gap-3 py-3 bg-gray-100 border-y-2 border-gray-300">
              <span className="text-2xl leading-none">🛵</span>
              <span className="text-base font-black text-gray-700 uppercase tracking-widest">Xe Máy</span>
              <span className="text-sm font-bold text-gray-400 tabular-nums">({mbCalled.length + mbWaiting.length})</span>
            </div>
            <BrightVehicleSection items={mbCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled compact />
            <BrightVehicleSection items={mbWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} compact />
            {mbCalled.length === 0 && mbWaiting.length === 0 && (
              <div className="flex items-center justify-center py-6 text-gray-300 text-sm">—</div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 border-b-2 border-gray-300 bg-gray-100 flex-shrink-0">
              <div className="flex items-center justify-center gap-2.5 px-3 py-2.5 border-r border-gray-300">
                <span className="text-xl leading-none">🚛</span>
                <span className="text-sm font-black text-gray-700 uppercase tracking-widest">Xe Tải</span>
                <span className="text-sm font-bold text-gray-400">({truckCalled.length + truckWaiting.length})</span>
              </div>
              <div className="flex items-center justify-center gap-2.5 px-3 py-2.5">
                <span className="text-xl leading-none">🛵</span>
                <span className="text-sm font-black text-gray-700 uppercase tracking-widest">Xe Máy</span>
                <span className="text-sm font-bold text-gray-400">({mbCalled.length + mbWaiting.length})</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-200">
              <div>
                <BrightVehicleSection items={truckCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled />
                <BrightVehicleSection items={truckWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} />
                {truckCalled.length === 0 && truckWaiting.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-gray-300 text-xs">—</div>
                )}
              </div>
              <div>
                <BrightVehicleSection items={mbCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled />
                <BrightVehicleSection items={mbWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} />
                {mbCalled.length === 0 && mbWaiting.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-gray-300 text-xs">—</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
