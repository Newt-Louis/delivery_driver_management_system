import type { DeliveryRegistration } from '../../../../lib/types';
import UnitLogo from '../UnitLogo';
import { getUnitBrand } from '../../utils';
import type { BrandConfig, UnitKey } from '../../types';
import DarkStatusSection from './StatusSection';

export default function DarkUnitPanel({ unitKey, deliveries, highlightId, brand, compact = false }: {
  unitKey: UnitKey; deliveries: DeliveryRegistration[]; highlightId: string | null;
  brand: BrandConfig | null; compact?: boolean;
}) {
  const cfg = getUnitBrand(brand, unitKey);
  const called    = deliveries.filter((d) => d.status === 'CALLED');
  const waiting   = deliveries.filter((d) => d.status === 'WAITING');
  const receiving = deliveries.filter((d) => ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status));
  const total = called.length + waiting.length + receiving.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="rounded-t-2xl px-4 py-3 flex items-center justify-between shrink-0" style={{ background: cfg.primaryColor }}>
        <div className="flex items-center gap-2.5">
          <UnitLogo logoUrl={cfg.logoUrl} icon={cfg.icon} px={compact ? 22 : 28} />
          <div className="font-black tracking-widest text-white leading-none"
               style={{ fontSize: compact ? '0.85rem' : 'clamp(0.85rem, 1.5vw, 1.1rem)' }}>
            {compact ? cfg.shortName : cfg.displayName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {called.length > 0 && (
            <span className="bg-white/25 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">📣 {called.length}</span>
          )}
          <span className="bg-black/20 text-white/90 text-xs font-bold px-2.5 py-1 rounded-full">{total}</span>
        </div>
      </div>
      <div className="flex-1 bg-thiso-50 border-x border-b border-thiso-200 rounded-b-2xl p-3 overflow-y-auto min-h-0 space-y-3">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-thiso-300">
            <div className="text-3xl mb-1">✓</div>
            <div className="text-sm">Không có xe</div>
          </div>
        ) : (
          <>
            <DarkStatusSection deliveries={called}    highlightId={highlightId} primaryColor={cfg.primaryColor} status="called" />
            <DarkStatusSection deliveries={waiting}   highlightId={highlightId} primaryColor={cfg.primaryColor} status="waiting" />
            <DarkStatusSection deliveries={receiving} highlightId={highlightId} primaryColor={cfg.primaryColor} status="receiving" />
          </>
        )}
      </div>
    </div>
  );
}
