import type { DeliveryRegistration } from '../../../../lib/types';
import { GOODS_ICON, VTYPE } from '../../constants';
import { formatTicketForDelivery } from '../../utils';

export function CalledCard({ d, stt, highlight, primaryColor }: {
  d: DeliveryRegistration; stt: string; highlight: boolean; primaryColor: string;
}) {
  const waitMin = d.checkinTime ? Math.floor((Date.now() - new Date(d.checkinTime).getTime()) / 60000) : null;
  return (
    <div className={`rounded-xl border-2 flex flex-col overflow-hidden transition-all ${highlight ? 'ring-4 ring-amber-400/70 scale-[1.02]' : ''}`}
         style={{ borderColor: primaryColor, background: `${primaryColor}10` }}>
      <div className="px-2 py-1.5 text-center font-mono font-black tracking-widest leading-none"
           style={{ background: primaryColor, color: 'white', fontSize: 'clamp(0.7rem, 1.4vw, 0.95rem)' }}>{stt}</div>
      <div className="px-2 py-2.5 text-center font-black tracking-wider leading-none"
           style={{ fontSize: 'clamp(1rem, 2.2vw, 1.55rem)', color: '#111' }}>{d.vehiclePlate}</div>
      <div className="px-2 pb-2.5 flex items-center justify-between gap-1">
        <span className="text-base leading-none">{GOODS_ICON[d.goodsType]}</span>
        <div className="text-right">
          <div className="font-black leading-none tracking-widest"
               style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: primaryColor }}>{d.assignedSlot?.code ?? '?'}</div>
          <div className="text-[9px] tracking-widest mt-0.5" style={{ color: primaryColor, opacity: 0.7 }}>VỊ TRÍ</div>
        </div>
      </div>
      {waitMin !== null && (
        <div className="text-[10px] text-center pb-1.5 leading-none tabular-nums" style={{ color: primaryColor, opacity: 0.6 }}>
          {waitMin} phút chờ
        </div>
      )}
    </div>
  );
}

export function WaitingCard({ d, stt, highlight, isNext }: {
  d: DeliveryRegistration; stt: string; highlight: boolean; isNext: boolean;
}) {
  const waitMin = d.checkinTime ? Math.floor((Date.now() - new Date(d.checkinTime).getTime()) / 60000) : null;
  const isUrgent = d.goodsType === 'FRESH_FOOD' && waitMin !== null && waitMin >= 25;
  return (
    <div className={`rounded-xl border-2 flex flex-col overflow-hidden transition-all
      ${highlight ? 'ring-4 ring-amber-400/70 scale-[1.02]' : ''}
      ${isUrgent ? 'border-red-400 bg-red-50' : isNext ? 'border-amber-500 bg-amber-50' : 'border-amber-200 bg-amber-50/50'}`}>
      {isNext && (
        <div className={`px-2 py-1 text-center text-[10px] font-black tracking-widest leading-none animate-pulse
          ${isUrgent ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>▶ TIẾP THEO</div>
      )}
      <div className={`px-2 py-1.5 text-center font-mono font-black tracking-widest leading-none
        ${isUrgent ? 'bg-red-400 text-white' : 'bg-amber-400 text-white'}`}
           style={{ fontSize: 'clamp(0.7rem, 1.4vw, 0.95rem)' }}>{stt}</div>
      <div className="px-2 py-2.5 text-center font-black tracking-wider leading-none"
           style={{ fontSize: 'clamp(1rem, 2.2vw, 1.55rem)', color: '#111' }}>{d.vehiclePlate}</div>
      <div className="px-2 pb-2.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {isUrgent && <span className="text-[11px] animate-pulse">🔴</span>}
          <span className="text-base leading-none">{GOODS_ICON[d.goodsType]}</span>
        </div>
        {waitMin !== null && (
          <div className={`text-sm font-black tabular-nums leading-none ${isUrgent ? 'text-red-500' : 'text-amber-500'}`}>
            {waitMin}p
          </div>
        )}
      </div>
    </div>
  );
}

export function ReceivingCard({ d, stt, highlight }: { d: DeliveryRegistration; stt: string; highlight: boolean }) {
  return (
    <div className={`rounded-xl border-2 border-green-400 bg-green-50 flex flex-col overflow-hidden transition-all
      ${highlight ? 'ring-4 ring-green-300/70 scale-[1.02]' : ''}`}>
      <div className="px-2 py-1.5 text-center font-mono font-black tracking-widest leading-none bg-green-500 text-white"
           style={{ fontSize: 'clamp(0.7rem, 1.4vw, 0.95rem)' }}>{stt}</div>
      <div className="px-2 py-2.5 text-center font-black tracking-wider leading-none"
           style={{ fontSize: 'clamp(1rem, 2.2vw, 1.55rem)', color: '#111' }}>{d.vehiclePlate}</div>
      <div className="px-2 pb-2.5 flex items-center justify-between gap-1">
        <span className="text-base leading-none">{GOODS_ICON[d.goodsType]}</span>
        <div className="text-right">
          {d.assignedSlot ? (
            <>
              <div className="font-black text-green-600 leading-none tracking-widest"
                   style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)' }}>{d.assignedSlot.code}</div>
              <div className="text-[9px] text-green-400 tracking-widest mt-0.5">NHẬN HÀNG</div>
            </>
          ) : (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">Nhận</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function VTypeColumn({ items, highlightId, primaryColor, cardType }: {
  items: DeliveryRegistration[]; highlightId: string | null; primaryColor: string;
  cardType: 'called' | 'waiting' | 'receiving';
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-thiso-300 rounded-lg border border-dashed border-thiso-200">
        <div className="text-xs">—</div>
      </div>
    );
  }
  const sorted = [...items].sort((a, b) =>
    cardType === 'waiting' ? (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999)
      : (b.ticketNumber ?? 0) - (a.ticketNumber ?? 0),
  );
  return (
    <div className="space-y-2">
      {sorted.map((d, i) => {
        const ticket = formatTicketForDelivery(d) ?? `#${i + 1}`;
        const isHighlight = d.id === highlightId;
        if (cardType === 'called') return <CalledCard key={d.id} d={d} stt={ticket} highlight={isHighlight} primaryColor={primaryColor} />;
        if (cardType === 'waiting') return <WaitingCard key={d.id} d={d} stt={ticket} highlight={isHighlight} isNext={i === 0} />;
        return <ReceivingCard key={d.id} d={d} stt={ticket} highlight={isHighlight} />;
      })}
    </div>
  );
}

export { VTYPE };
