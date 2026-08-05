import type { DeliveryRegistration } from '../../../../lib/types';
import { VTYPE } from '../../constants';
import { formatTicketForDelivery } from '../../utils';
import { CalledCard, WaitingCard, ReceivingCard, VTypeColumn } from './Cards';

export default function DarkStatusSection({ deliveries, highlightId, primaryColor, status }: {
  deliveries: DeliveryRegistration[]; highlightId: string | null; primaryColor: string;
  status: 'called' | 'waiting' | 'receiving';
}) {
  if (deliveries.length === 0) return null;
  const trucks    = deliveries.filter((d) => d.vehicleType === 'TRUCK');
  const motorbikes = deliveries.filter((d) => d.vehicleType === 'MOTORBIKE');
  const others    = deliveries.filter((d) => !['TRUCK', 'MOTORBIKE'].includes(d.vehicleType));
  const hasBoth   = trucks.length > 0 && motorbikes.length > 0;

  const headerCfg = {
    called:    { dot: <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: primaryColor }} />, label: 'Mời vào Vị trí nhận hàng', color: primaryColor },
    waiting:   { dot: <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />, label: `Đang chờ (${deliveries.length})`, color: '#F59E0B' },
    receiving: { dot: <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />, label: `Đang nhận hàng (${deliveries.length})`, color: '#22C55E' },
  }[status];

  return (
    <div className="rounded-xl overflow-hidden border border-thiso-200/60 bg-white/40">
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: `${headerCfg.color}18` }}>
        {headerCfg.dot}
        <span className="text-xs font-black tracking-widest uppercase leading-none" style={{ color: headerCfg.color }}>
          {headerCfg.label}
        </span>
      </div>
      <div className="p-2">
        {hasBoth ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-center gap-1 mb-2 py-1 rounded-lg bg-thiso-100">
                <span className="text-sm leading-none">{VTYPE.TRUCK.icon}</span>
                <span className="text-[10px] font-black tracking-widest text-thiso-600">{VTYPE.TRUCK.label}</span>
                <span className="text-[10px] text-thiso-400">({trucks.length})</span>
              </div>
              <VTypeColumn items={trucks} highlightId={highlightId} primaryColor={primaryColor} cardType={status} />
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-2 py-1 rounded-lg bg-thiso-100">
                <span className="text-sm leading-none">{VTYPE.MOTORBIKE.icon}</span>
                <span className="text-[10px] font-black tracking-widest text-thiso-600">{VTYPE.MOTORBIKE.label}</span>
                <span className="text-[10px] text-thiso-400">({motorbikes.length})</span>
              </div>
              <VTypeColumn items={motorbikes} highlightId={highlightId} primaryColor={primaryColor} cardType={status} />
            </div>
          </div>
        ) : (
          <div>
            {trucks.length > 0 && (
              <div className="flex items-center gap-1 mb-2">
                <span className="text-sm">{VTYPE.TRUCK.icon}</span>
                <span className="text-[10px] font-black tracking-widest text-thiso-600">{VTYPE.TRUCK.label}</span>
              </div>
            )}
            {motorbikes.length > 0 && (
              <div className="flex items-center gap-1 mb-2">
                <span className="text-sm">{VTYPE.MOTORBIKE.icon}</span>
                <span className="text-[10px] font-black tracking-widest text-thiso-600">{VTYPE.MOTORBIKE.label}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {[...trucks, ...motorbikes, ...others].sort((a, b) =>
                status === 'waiting' ? (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999) : (b.ticketNumber ?? 0) - (a.ticketNumber ?? 0),
              ).map((d, i) => {
                const ticket = formatTicketForDelivery(d) ?? `#${i + 1}`;
                const isHighlight = d.id === highlightId;
                if (status === 'called') return <CalledCard key={d.id} d={d} stt={ticket} highlight={isHighlight} primaryColor={primaryColor} />;
                if (status === 'waiting') return <WaitingCard key={d.id} d={d} stt={ticket} highlight={isHighlight} isNext={i === 0} />;
                return <ReceivingCard key={d.id} d={d} stt={ticket} highlight={isHighlight} />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
