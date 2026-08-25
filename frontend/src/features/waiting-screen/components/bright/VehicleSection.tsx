import type { DeliveryRegistration } from '../../../../lib/types';
import { formatTicketForDelivery } from '../../utils';

type SectionStatus = 'called' | 'waiting';

export default function BrightVehicleSection({ items, primaryColor, highlightId, isCalled, status, compact = false }: {
  items: DeliveryRegistration[]; primaryColor: string; highlightId: string | null;
  isCalled?: boolean; status?: SectionStatus; compact?: boolean;
}) {
  if (items.length === 0) return null;

  const sectionStatus = status ?? (isCalled ? 'called' : 'waiting');
  const showsSlot = sectionStatus === 'called';
  const isWaiting = sectionStatus === 'waiting';
  const statusColor = sectionStatus === 'waiting' ? '#f59e0b' : primaryColor;
  const sectionLabel = {
    called: `Đang gọi vào (${items.length})`,
    waiting: `Đang chờ (${items.length})`,
  }[sectionStatus];

  const deskCols = showsSlot ? '6rem 1fr 3.5rem' : '6rem 1fr';
  const mobCols  = showsSlot ? '7.5rem 1fr 4rem' : '7.5rem 1fr';
  const cols     = compact ? mobCols : deskCols;
  const colGap   = compact ? '1rem' : '0.75rem';
  const sectionBg = sectionStatus === 'called' ? `${primaryColor}14` : '#fefce8';
  const sectionBdr = sectionStatus === 'called' ? `${primaryColor}30` : '#fde68a';

  return (
    <div>
      <div className="flex items-center gap-2 px-4 border-b"
           style={{ background: sectionBg, borderColor: sectionBdr, paddingTop: compact ? '0.6rem' : '0.5rem', paddingBottom: compact ? '0.6rem' : '0.5rem' }}>
        <span className="rounded-full shrink-0 animate-pulse"
              style={{ width: compact ? 8 : 7, height: compact ? 8 : 7, background: statusColor,
                       animationPlayState: sectionStatus === 'called' ? 'running' : 'paused' }} />
        <span className="font-black uppercase tracking-widest"
              style={{ fontSize: compact ? '0.75rem' : '0.78rem', color: sectionStatus === 'waiting' ? '#92400e' : statusColor }}>
          {sectionLabel}
        </span>
      </div>

      <div className="grid items-center px-4 bg-gray-50 border-b border-gray-200"
           style={{ gridTemplateColumns: cols, columnGap: colGap, paddingTop: compact ? '0.45rem' : '0.4rem', paddingBottom: compact ? '0.45rem' : '0.4rem' }}>
        <span className="font-black text-gray-400 uppercase tracking-wide" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>Số thẻ</span>
        <span className="font-black text-gray-400 uppercase tracking-wide" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>Biển số</span>
        {showsSlot && <span className="font-black text-gray-400 uppercase tracking-wide text-right" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>Vị trí</span>}
      </div>

      {items.map((d, i) => {
        const ticket = formatTicketForDelivery(d) ?? `#${i + 1}`;
        const isHl   = d.id === highlightId;
        const isNext = isWaiting && i === 0;
        return (
          <div key={d.id}
               className="grid items-center px-4 border-b border-gray-100 last:border-0"
               style={{
                 gridTemplateColumns: cols, columnGap: colGap,
                 paddingTop:    compact ? '0.85rem' : '0.7rem',
                 paddingBottom: compact ? '0.85rem' : '0.7rem',
                 background: isHl
                   ? (sectionStatus === 'called' ? `${primaryColor}1a` : 'rgba(251,191,36,0.18)')
                   : isNext ? '#fffbeb'
                   : sectionStatus === 'called' ? `${primaryColor}07`
                   : 'white',
               }}>
            <div className="flex items-center gap-1 min-w-0">
              {isNext && (
                <span className="font-black bg-amber-400 text-white rounded shrink-0"
                      style={{ fontSize: compact ? '0.6rem' : '0.55rem', padding: '2px 4px' }}>▶</span>
              )}
              <span className="font-mono font-bold leading-none"
                    style={{ fontSize: compact ? '0.8rem' : '0.88rem', color: sectionStatus === 'waiting' ? '#b45309' : statusColor, whiteSpace: 'nowrap' }}>
                {ticket}
              </span>
            </div>
            <span className="font-black tracking-wider text-gray-900 leading-none truncate"
                  style={{ fontSize: compact ? '1.15rem' : 'clamp(1.15rem, 2vw, 1.55rem)' }}>
              {d.vehiclePlate}
            </span>
            {showsSlot && (
              <span className="font-black text-right leading-none"
                    style={{ color: statusColor, fontSize: compact ? '1.1rem' : 'clamp(1.1rem, 1.9vw, 1.45rem)' }}>
                {d.assignedSlot?.code ?? '?'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
