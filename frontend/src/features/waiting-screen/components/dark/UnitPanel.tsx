import type { DeliveryRegistration } from '../../../../lib/types';
import UnitLogo from '../UnitLogo';
import { getUnitBrand } from '../../utils';
import type { BrandConfig, UnitKey } from '../../types';
import DarkVehicleSection from './StatusSection';

export default function DarkUnitPanel({ unitKey, deliveries, highlightId, brand, compact = false }: {
  unitKey: UnitKey; deliveries: DeliveryRegistration[]; highlightId: string | null;
  brand: BrandConfig | null; compact?: boolean;
}) {
  const cfg = getUnitBrand(brand, unitKey);

  const trucks     = deliveries.filter((d) => d.vehicleType !== 'MOTORBIKE');
  const motorbikes = deliveries.filter((d) => d.vehicleType === 'MOTORBIKE');

  const truckCalled    = [...trucks.filter((d) => d.status === 'CALLED')].sort((a, b) => (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0));
  const truckWaiting   = [...trucks.filter((d) => d.status === 'WAITING')].sort((a, b) => (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999));
  const truckReceiving = [...trucks.filter((d) => ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status))].sort((a, b) => (b.ticketNumber ?? 0) - (a.ticketNumber ?? 0));
  const mbCalled       = [...motorbikes.filter((d) => d.status === 'CALLED')].sort((a, b) => (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0));
  const mbWaiting      = [...motorbikes.filter((d) => d.status === 'WAITING')].sort((a, b) => (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999));
  const mbReceiving    = [...motorbikes.filter((d) => ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status))].sort((a, b) => (b.ticketNumber ?? 0) - (a.ticketNumber ?? 0));

  const calledCount  = deliveries.filter((d) => d.status === 'CALLED').length;
  const activeCount  = deliveries.filter((d) => ['CALLED', 'WAITING', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)).length;
  const truckCount = truckCalled.length + truckWaiting.length + truckReceiving.length;
  const motorbikeCount = mbCalled.length + mbWaiting.length + mbReceiving.length;

  return (
    <div className="flex flex-col h-full bg-thiso-950 rounded-2xl shadow-sm overflow-hidden border-2"
         style={{ borderColor: `${cfg.primaryColor}65` }}>

      <div className="relative flex items-center flex-shrink-0 px-3"
           style={{ background: cfg.primaryColor, paddingTop: compact ? '0.9rem' : '0.85rem', paddingBottom: compact ? '0.9rem' : '0.85rem' }}>
        <div className="absolute inset-0 flex items-center justify-center gap-3 pointer-events-none">
          <UnitLogo logoUrl={cfg.logoUrl} icon={cfg.icon} px={compact ? 32 : 38} />
          <span className="leading-none"
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, color: '#fff', fontSize: compact ? '1.25rem' : 'clamp(1.2rem, 2vw, 1.65rem)', letterSpacing: '0.04em' }}>
            {cfg.displayName}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2 relative z-10">
          {calledCount > 0 && (
            <span className="bg-white/25 text-white font-black px-2.5 py-1 rounded-full animate-pulse"
                  style={{ fontSize: compact ? '0.82rem' : '0.78rem' }}>📣 {calledCount}</span>
          )}
          <span className="bg-black/25 text-white font-bold px-2.5 py-1 rounded-full"
                style={{ fontSize: compact ? '0.82rem' : '0.78rem' }}>{activeCount}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {compact ? (
          <div>
            <div className="flex items-center justify-center gap-3 py-3 bg-thiso-900 border-b-2 border-thiso-700">
              <span className="text-2xl leading-none">🚛</span>
              <span className="text-base font-black text-thiso-200 uppercase tracking-widest">Xe Tải</span>
              <span className="text-sm font-bold text-thiso-500 tabular-nums">({truckCount})</span>
            </div>
            <DarkVehicleSection items={truckCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled compact />
            <DarkVehicleSection items={truckWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} compact />
            <DarkVehicleSection items={truckReceiving} primaryColor={cfg.primaryColor} highlightId={highlightId} status="receiving" compact />
            {truckCount === 0 && (
              <div className="flex items-center justify-center py-6 text-thiso-600 text-sm border-b border-thiso-800">—</div>
            )}
            <div className="flex items-center justify-center gap-3 py-3 bg-thiso-900 border-y-2 border-thiso-700">
              <span className="text-2xl leading-none">🛵</span>
              <span className="text-base font-black text-thiso-200 uppercase tracking-widest">Xe Máy</span>
              <span className="text-sm font-bold text-thiso-500 tabular-nums">({motorbikeCount})</span>
            </div>
            <DarkVehicleSection items={mbCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled compact />
            <DarkVehicleSection items={mbWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} compact />
            <DarkVehicleSection items={mbReceiving} primaryColor={cfg.primaryColor} highlightId={highlightId} status="receiving" compact />
            {motorbikeCount === 0 && (
              <div className="flex items-center justify-center py-6 text-thiso-600 text-sm">—</div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 border-b-2 border-thiso-700 bg-thiso-900 flex-shrink-0">
              <div className="flex items-center justify-center gap-2.5 px-3 py-2.5 border-r border-thiso-700">
                <span className="text-xl leading-none">🚛</span>
                <span className="text-sm font-black text-thiso-200 uppercase tracking-widest">Xe Tải</span>
                <span className="text-sm font-bold text-thiso-500">({truckCount})</span>
              </div>
              <div className="flex items-center justify-center gap-2.5 px-3 py-2.5">
                <span className="text-xl leading-none">🛵</span>
                <span className="text-sm font-black text-thiso-200 uppercase tracking-widest">Xe Máy</span>
                <span className="text-sm font-bold text-thiso-500">({motorbikeCount})</span>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-thiso-800">
              <div>
                <DarkVehicleSection items={truckCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled />
                <DarkVehicleSection items={truckWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} />
                <DarkVehicleSection items={truckReceiving} primaryColor={cfg.primaryColor} highlightId={highlightId} status="receiving" />
                {truckCount === 0 && (
                  <div className="flex items-center justify-center py-8 text-thiso-600 text-xs">—</div>
                )}
              </div>
              <div>
                <DarkVehicleSection items={mbCalled}  primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled />
                <DarkVehicleSection items={mbWaiting} primaryColor={cfg.primaryColor} highlightId={highlightId} isCalled={false} />
                <DarkVehicleSection items={mbReceiving} primaryColor={cfg.primaryColor} highlightId={highlightId} status="receiving" />
                {motorbikeCount === 0 && (
                  <div className="flex items-center justify-center py-8 text-thiso-600 text-xs">—</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
