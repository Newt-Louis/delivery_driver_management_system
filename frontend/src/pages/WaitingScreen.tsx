import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../lib/api';
import type { DeliveryRegistration } from '../lib/types';
import { playChime } from '../lib/chime';

// ─── Ticket code formatting ───────────────────────────────────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = {
  EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL',
};
const VT_TICKET_PREFIX: Record<string, string> = {
  TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X',
};
function formatTicketCode(unit: string, vehicleType: string, n: number): string {
  const up = UNIT_TICKET_PREFIX[unit] ?? unit;
  const vp = VT_TICKET_PREFIX[vehicleType] ?? 'X';
  return `${up}-${vp}${String(n).padStart(3, '0')}`;
}

// ─── Brand ────────────────────────────────────────────────────────────────────
interface BrandConfig {
  mall: { mallName: string; logoUrl: string | null; tagline: string };
  units: Record<string, {
    displayName: string; shortName: string;
    logoUrl: string | null; primaryColor: string;
  }>;
}

const UNIT_KEYS = ['EMART', 'THISKYHALL', 'TENANT'] as const;
type UnitKey = typeof UNIT_KEYS[number];

const UNIT_DEF: Record<UnitKey, { displayName: string; shortName: string; icon: string; primaryColor: string }> = {
  EMART:      { displayName: 'EMART',            shortName: 'EMART',   icon: '🏬', primaryColor: '#FF9500' },
  THISKYHALL: { displayName: 'THISKYHALL',        shortName: 'SKYHALL', icon: '🏢', primaryColor: '#27A55E' },
  TENANT:     { displayName: 'MALL (KHÁCH THUÊ)', shortName: 'MALL',    icon: '🏪', primaryColor: '#1C1C1C' },
};

function UnitLogo({ logoUrl, icon, px = 28 }: { logoUrl: string | null | undefined; icon: string; px?: number }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" style={{ width: px, height: px, objectFit: 'contain', flexShrink: 0 }} className="rounded" />;
  }
  const em = px <= 20 ? 'text-base' : px <= 30 ? 'text-2xl' : 'text-3xl';
  return <span className={`${em} leading-none`}>{icon}</span>;
}

const GOODS_ICON: Record<string, string> = {
  FRESH_FOOD: '🥬', AUTO_WAREHOUSE: '🏭', GENERAL_GOODS: '📦', THI_CONG: '🔨',
};
const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Hàng tươi', AUTO_WAREHOUSE: 'Kho tự động', GENERAL_GOODS: 'Hàng thường', THI_CONG: 'Thi công',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalledAlert {
  vehiclePlate: string; slotName: string; slotCode: string;
  message: string; id: string; receivingUnit?: string; callCount?: number;
  ticketCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK THEME COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function DarkCalledOverlay({ evt, brand, onDismiss }: {
  evt: CalledAlert; brand: BrandConfig | null; onDismiss: () => void;
}) {
  const unitKey = evt.receivingUnit as UnitKey | undefined;
  const def = unitKey ? UNIT_DEF[unitKey] : UNIT_DEF.TENANT;
  const cfg = unitKey ? brand?.units[unitKey] : null;
  const primaryColor = cfg?.primaryColor ?? def.primaryColor;
  const displayName  = cfg?.displayName  ?? def.displayName;
  const callCount    = evt.callCount ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-3 flex items-center gap-3" style={{ background: primaryColor }}>
          <UnitLogo logoUrl={cfg?.logoUrl} icon={def.icon} px={30} />
          <span className="text-white font-black text-lg tracking-widest">{displayName}</span>
          {callCount > 1 && (
            <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              Lần {callCount}
            </span>
          )}
        </div>
        <div className="bg-white px-8 py-10 text-center">
          <div className="text-xs font-black tracking-widest text-thiso-400 uppercase mb-4 animate-pulse">
            📣 Mời Xe di chuyển vào Vị trí nhận hàng
          </div>
          {evt.ticketCode && (
            <div className="text-[11px] font-mono font-black text-thiso-300 mb-2 tracking-wider">Thẻ {evt.ticketCode}</div>
          )}
          <div className="font-black tracking-widest mb-4 leading-none"
               style={{ fontSize: 'clamp(3rem, 10vw, 5.5rem)', color: primaryColor }}>
            {evt.vehiclePlate}
          </div>
          <div className="text-thiso-400 text-base mb-3">di chuyển vào</div>
          <div className="inline-block font-black rounded-2xl px-10 py-4 mb-2"
               style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', background: `${primaryColor}18`, color: primaryColor, letterSpacing: '0.15em' }}>
            {evt.slotCode}
          </div>
          <div className="text-thiso-400 text-xs font-semibold tracking-widest uppercase mb-1">Vị trí nhận hàng</div>
          <div className="text-thiso-500 text-base font-medium mb-6">{evt.slotName}</div>
          <button className="px-6 py-2 rounded-xl bg-thiso-100 text-thiso-500 text-sm hover:bg-thiso-200 transition-colors"
                  onClick={onDismiss}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

const VTYPE: Record<string, { icon: string; label: string }> = {
  TRUCK:     { icon: '🚛', label: 'XE TẢI' },
  MOTORBIKE: { icon: '🛵', label: 'XE MÁY' },
  OTHER:     { icon: '🚗', label: 'XE KHÁC' },
};

function CalledCard({ d, stt, highlight, primaryColor }: {
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

function WaitingCard({ d, stt, highlight, isNext }: {
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

function ReceivingCard({ d, stt, highlight }: { d: DeliveryRegistration; stt: string; highlight: boolean }) {
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

function VTypeColumn({ items, highlightId, primaryColor, cardType }: {
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
        const ticket = d.ticketNumber ? formatTicketCode(d.receivingUnit, d.vehicleType, d.ticketNumber) : `#${i + 1}`;
        const isHighlight = d.id === highlightId;
        if (cardType === 'called') return <CalledCard key={d.id} d={d} stt={ticket} highlight={isHighlight} primaryColor={primaryColor} />;
        if (cardType === 'waiting') return <WaitingCard key={d.id} d={d} stt={ticket} highlight={isHighlight} isNext={i === 0} />;
        return <ReceivingCard key={d.id} d={d} stt={ticket} highlight={isHighlight} />;
      })}
    </div>
  );
}

function DarkStatusSection({ deliveries, highlightId, primaryColor, status }: {
  deliveries: DeliveryRegistration[]; highlightId: string | null; primaryColor: string;
  status: 'called' | 'waiting' | 'receiving';
}) {
  if (deliveries.length === 0) return null;
  const trucks = deliveries.filter(d => d.vehicleType === 'TRUCK');
  const motorbikes = deliveries.filter(d => d.vehicleType === 'MOTORBIKE');
  const others = deliveries.filter(d => !['TRUCK', 'MOTORBIKE'].includes(d.vehicleType));
  const hasBoth = trucks.length > 0 && motorbikes.length > 0;
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
            {trucks.length > 0 && <div className="flex items-center gap-1 mb-2"><span className="text-sm">{VTYPE.TRUCK.icon}</span><span className="text-[10px] font-black tracking-widest text-thiso-600">{VTYPE.TRUCK.label}</span></div>}
            {motorbikes.length > 0 && <div className="flex items-center gap-1 mb-2"><span className="text-sm">{VTYPE.MOTORBIKE.icon}</span><span className="text-[10px] font-black tracking-widest text-thiso-600">{VTYPE.MOTORBIKE.label}</span></div>}
            <div className="grid grid-cols-2 gap-2">
              {[...trucks, ...motorbikes, ...others].sort((a, b) =>
                status === 'waiting' ? (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999) : (b.ticketNumber ?? 0) - (a.ticketNumber ?? 0),
              ).map((d, i) => {
                const ticket = d.ticketNumber ? formatTicketCode(d.receivingUnit, d.vehicleType, d.ticketNumber) : `#${i + 1}`;
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

function DarkUnitPanel({ unitKey, deliveries, highlightId, brand, compact = false }: {
  unitKey: UnitKey; deliveries: DeliveryRegistration[]; highlightId: string | null;
  brand: BrandConfig | null; compact?: boolean;
}) {
  const def = UNIT_DEF[unitKey];
  const cfg = brand?.units[unitKey];
  const displayName  = cfg?.displayName  || def.displayName;
  const shortName    = cfg?.shortName    || def.shortName;
  const primaryColor = cfg?.primaryColor || def.primaryColor;
  const called    = deliveries.filter(d => d.status === 'CALLED');
  const waiting   = deliveries.filter(d => d.status === 'WAITING');
  const receiving = deliveries.filter(d => ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status));
  const total = called.length + waiting.length + receiving.length;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="rounded-t-2xl px-4 py-3 flex items-center justify-between shrink-0" style={{ background: primaryColor }}>
        <div className="flex items-center gap-2.5">
          <UnitLogo logoUrl={cfg?.logoUrl} icon={def.icon} px={compact ? 22 : 28} />
          <div className="font-black tracking-widest text-white leading-none"
               style={{ fontSize: compact ? '0.85rem' : 'clamp(0.85rem, 1.5vw, 1.1rem)' }}>
            {compact ? shortName : displayName}
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
            <DarkStatusSection deliveries={called}    highlightId={highlightId} primaryColor={primaryColor} status="called" />
            <DarkStatusSection deliveries={waiting}   highlightId={highlightId} primaryColor={primaryColor} status="waiting" />
            <DarkStatusSection deliveries={receiving} highlightId={highlightId} primaryColor={primaryColor} status="receiving" />
          </>
        )}
      </div>
    </div>
  );
}

function KpiStrip({ totalWaiting, totalCalled, totalReceiving, dark = false }: {
  totalWaiting: number; totalCalled: number; totalReceiving: number; dark?: boolean;
}) {
  const items = [
    { label: 'Đang chờ',  value: totalWaiting,   bg: 'rgba(245,158,11,0.18)',  color: '#FBBF24', dot: '#F59E0B' },
    { label: 'Được gọi',  value: totalCalled,    bg: 'rgba(56,189,248,0.18)',  color: '#7DD3FC', dot: '#38BDF8' },
    { label: 'Đang nhận', value: totalReceiving, bg: 'rgba(74,222,128,0.18)', color: '#86EFAC', dot: '#4ADE80' },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map(s => (
        <span key={s.label} className="flex items-center gap-2 font-bold px-3 py-1.5 rounded-full"
              style={{ background: s.bg, color: s.color, fontSize: '0.8rem' }}>
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: s.dot }} />
          <span className="text-lg font-black tabular-nums leading-none">{s.value}</span>
          <span className={dark ? 'opacity-60' : 'opacity-70'}>{s.label}</span>
        </span>
      ))}
    </div>
  );
}

function GoodsLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-thiso-600">
      {Object.entries(GOODS_LABEL).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1">
          <span>{GOODS_ICON[k]}</span><span>{v}</span>
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIGHT THEME COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function BrightCalledOverlay({ evt, brand, onDismiss }: {
  evt: CalledAlert; brand: BrandConfig | null; onDismiss: () => void;
}) {
  const unitKey = evt.receivingUnit as UnitKey | undefined;
  const def = unitKey ? UNIT_DEF[unitKey] : UNIT_DEF.TENANT;
  const cfg = unitKey ? brand?.units[unitKey] : null;
  const primaryColor = cfg?.primaryColor ?? def.primaryColor;
  const callCount = evt.callCount ?? 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
      style={{ background: primaryColor }}
      onClick={onDismiss}
    >
      {/* Animated pulse ring */}
      <div className="absolute inset-0 animate-ping opacity-[0.08] bg-white pointer-events-none" />

      <div className="relative z-10 text-center px-8 w-full max-w-5xl mx-auto">
        {/* Unit + instruction */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <UnitLogo logoUrl={cfg?.logoUrl} icon={def.icon} px={38} />
          <div className="text-left">
            <p className="text-white/70 font-black text-base uppercase tracking-[0.25em]">
              📣 Mời xe di chuyển vào vị trí nhận hàng
            </p>
            {callCount > 1 && (
              <p className="text-white/40 text-sm mt-1 font-semibold">Lần gọi thứ {callCount}</p>
            )}
          </div>
        </div>

        {/* Ticket code */}
        {evt.ticketCode && (
          <p className="text-white/50 font-mono font-black tracking-[0.3em] text-xl mb-3 uppercase">
            Số thẻ: {evt.ticketCode}
          </p>
        )}

        {/* Vehicle plate — HUGE */}
        <p className="font-black text-white tracking-widest leading-none mb-6 drop-shadow-2xl"
           style={{ fontSize: 'clamp(5rem, 18vw, 10rem)' }}>
          {evt.vehiclePlate}
        </p>

        <p className="text-white/50 text-2xl font-medium mb-6">di chuyển vào</p>

        {/* Slot code */}
        <div className="inline-block bg-white/20 border-4 border-white/30 rounded-3xl px-14 py-5 font-black text-white tracking-[0.15em] backdrop-blur-sm"
             style={{ fontSize: 'clamp(3rem, 10vw, 6rem)' }}>
          {evt.slotCode}
        </div>

        <p className="text-white/60 text-xl font-semibold mt-5">{evt.slotName}</p>
        <p className="text-white/25 text-sm mt-10">Chạm để đóng</p>
      </div>
    </div>
  );
}

// Single section (called OR waiting) for one vehicle type
function BrightVehicleSection({ items, primaryColor, highlightId, isCalled, compact = false }: {
  items: DeliveryRegistration[]; primaryColor: string; highlightId: string | null;
  isCalled: boolean; compact?: boolean;
}) {
  if (items.length === 0) return null;

  // Desktop cols (inside half-width column): ticket | plate | [slot]
  const deskCols = isCalled ? '6rem 1fr 3.5rem' : '6rem 1fr';
  // Mobile cols (full panel width): wider ticket, spacious plate, slot
  const mobCols  = isCalled ? '7.5rem 1fr 4rem' : '7.5rem 1fr';
  const cols     = compact ? mobCols : deskCols;
  const colGap   = compact ? '1rem' : '0.75rem';

  const sectionBg  = isCalled ? `${primaryColor}14` : '#fefce8';
  const sectionBdr = isCalled ? `${primaryColor}30` : '#fde68a';

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-2 px-4 border-b"
           style={{ background: sectionBg, borderColor: sectionBdr, paddingTop: compact ? '0.6rem' : '0.5rem', paddingBottom: compact ? '0.6rem' : '0.5rem' }}>
        <span className="rounded-full shrink-0 animate-pulse"
              style={{ width: compact ? 8 : 7, height: compact ? 8 : 7, background: isCalled ? primaryColor : '#f59e0b',
                       animationPlayState: isCalled ? 'running' : 'paused' }} />
        <span className="font-black uppercase tracking-widest"
              style={{ fontSize: compact ? '0.75rem' : '0.78rem', color: isCalled ? primaryColor : '#92400e' }}>
          {isCalled ? `Mời vào (${items.length})` : `Đang chờ (${items.length})`}
        </span>
      </div>

      {/* Column header */}
      <div className="grid items-center px-4 bg-gray-50 border-b border-gray-200"
           style={{ gridTemplateColumns: cols, columnGap: colGap, paddingTop: compact ? '0.45rem' : '0.4rem', paddingBottom: compact ? '0.45rem' : '0.4rem' }}>
        <span className="font-black text-gray-400 uppercase tracking-wide" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>Số thẻ</span>
        <span className="font-black text-gray-400 uppercase tracking-wide" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>Biển số</span>
        {isCalled && <span className="font-black text-gray-400 uppercase tracking-wide text-right" style={{ fontSize: compact ? '0.68rem' : '0.72rem' }}>Vị trí</span>}
      </div>

      {/* Data rows */}
      {items.map((d, i) => {
        const ticket = d.ticketNumber ? formatTicketCode(d.receivingUnit, d.vehicleType, d.ticketNumber) : `#${i + 1}`;
        const isHl   = d.id === highlightId;
        const isNext = !isCalled && i === 0;
        return (
          <div key={d.id}
               className="grid items-center px-4 border-b border-gray-100 last:border-0"
               style={{
                 gridTemplateColumns: cols,
                 columnGap: colGap,
                 paddingTop:    compact ? '0.85rem' : '0.7rem',
                 paddingBottom: compact ? '0.85rem' : '0.7rem',
                 background: isHl
                   ? (isCalled ? `${primaryColor}1a` : 'rgba(251,191,36,0.18)')
                   : isNext ? '#fffbeb'
                   : isCalled ? `${primaryColor}07` : 'white',
               }}>

            {/* Ticket — full code */}
            <div className="flex items-center gap-1 min-w-0">
              {isNext && (
                <span className="font-black bg-amber-400 text-white rounded shrink-0"
                      style={{ fontSize: compact ? '0.6rem' : '0.55rem', padding: compact ? '2px 4px' : '2px 4px' }}>▶</span>
              )}
              <span className="font-mono font-bold leading-none"
                    style={{
                      fontSize: compact ? '0.8rem' : '0.88rem',
                      color: isCalled ? primaryColor : '#b45309',
                      whiteSpace: 'nowrap',
                    }}>
                {ticket}
              </span>
            </div>

            {/* Plate */}
            <span className="font-black tracking-wider text-gray-900 leading-none truncate"
                  style={{ fontSize: compact ? '1.15rem' : 'clamp(1.15rem, 2vw, 1.55rem)' }}>
              {d.vehiclePlate}
            </span>

            {/* Slot */}
            {isCalled && (
              <span className="font-black text-right leading-none"
                    style={{ color: primaryColor, fontSize: compact ? '1.1rem' : 'clamp(1.1rem, 1.9vw, 1.45rem)' }}>
                {d.assignedSlot?.code ?? '?'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BrightUnitPanel({ unitKey, deliveries, highlightId, brand, compact = false }: {
  unitKey: UnitKey; deliveries: DeliveryRegistration[]; highlightId: string | null;
  brand: BrandConfig | null; compact?: boolean;
}) {
  const def = UNIT_DEF[unitKey];
  const cfg = brand?.units[unitKey];
  const displayName  = cfg?.displayName  || def.displayName;
  const shortName    = cfg?.shortName    || def.shortName;
  const primaryColor = cfg?.primaryColor || def.primaryColor;

  const trucks     = deliveries.filter(d => d.vehicleType !== 'MOTORBIKE');
  const motorbikes = deliveries.filter(d => d.vehicleType === 'MOTORBIKE');

  const truckCalled    = [...trucks.filter(d => d.status === 'CALLED')].sort((a, b) => (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0));
  const truckWaiting   = [...trucks.filter(d => d.status === 'WAITING')].sort((a, b) => (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999));
  const mbCalled       = [...motorbikes.filter(d => d.status === 'CALLED')].sort((a, b) => (a.ticketNumber ?? 0) - (b.ticketNumber ?? 0));
  const mbWaiting      = [...motorbikes.filter(d => d.status === 'WAITING')].sort((a, b) => (a.ticketNumber ?? 9999) - (b.ticketNumber ?? 9999));

  const calledCount = deliveries.filter(d => d.status === 'CALLED').length;
  const activeCount = deliveries.filter(d => ['CALLED', 'WAITING'].includes(d.status)).length;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm overflow-hidden border-2"
         style={{ borderColor: `${primaryColor}50` }}>

      {/* Unit header — logo+name centered, badges pinned right */}
      <div className="relative flex items-center flex-shrink-0 px-3"
           style={{ background: primaryColor, paddingTop: compact ? '0.9rem' : '0.85rem', paddingBottom: compact ? '0.9rem' : '0.85rem' }}>
        {/* Centered logo + name */}
        <div className="absolute inset-0 flex items-center justify-center gap-3 pointer-events-none">
          <UnitLogo logoUrl={cfg?.logoUrl} icon={def.icon} px={compact ? 32 : 38} />
          <span className="leading-none"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 800,
                  color: '#111',
                  fontSize: compact ? '1.25rem' : 'clamp(1.2rem, 2vw, 1.65rem)',
                  letterSpacing: '0.04em',
                }}>
            {displayName}
          </span>
        </div>
        {/* Badges — right aligned, above the centered layer */}
        <div className="ml-auto flex items-center gap-2 relative z-10">
          {calledCount > 0 && (
            <span className="bg-white/25 text-white font-black px-2.5 py-1 rounded-full animate-pulse"
                  style={{ fontSize: compact ? '0.82rem' : '0.78rem' }}>📣 {calledCount}</span>
          )}
          <span className="bg-black/20 text-white font-bold px-2.5 py-1 rounded-full"
                style={{ fontSize: compact ? '0.82rem' : '0.78rem' }}>{activeCount}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {compact ? (
          /* ── Mobile: truck → motorbike stacked, full-width rows ── */
          <div>
            {/* Xe Tải header — centered */}
            <div className="flex items-center justify-center gap-3 py-3 bg-gray-100 border-b-2 border-gray-300">
              <span className="text-2xl leading-none">🚛</span>
              <span className="text-base font-black text-gray-700 uppercase tracking-widest">Xe Tải</span>
              <span className="text-sm font-bold text-gray-400 tabular-nums">
                ({truckCalled.length + truckWaiting.length})
              </span>
            </div>
            <BrightVehicleSection items={truckCalled}  primaryColor={primaryColor} highlightId={highlightId} isCalled compact />
            <BrightVehicleSection items={truckWaiting} primaryColor={primaryColor} highlightId={highlightId} isCalled={false} compact />
            {truckCalled.length === 0 && truckWaiting.length === 0 && (
              <div className="flex items-center justify-center py-6 text-gray-300 text-sm border-b border-gray-100">—</div>
            )}

            {/* Xe Máy header — centered */}
            <div className="flex items-center justify-center gap-3 py-3 bg-gray-100 border-y-2 border-gray-300">
              <span className="text-2xl leading-none">🛵</span>
              <span className="text-base font-black text-gray-700 uppercase tracking-widest">Xe Máy</span>
              <span className="text-sm font-bold text-gray-400 tabular-nums">
                ({mbCalled.length + mbWaiting.length})
              </span>
            </div>
            <BrightVehicleSection items={mbCalled}  primaryColor={primaryColor} highlightId={highlightId} isCalled compact />
            <BrightVehicleSection items={mbWaiting} primaryColor={primaryColor} highlightId={highlightId} isCalled={false} compact />
            {mbCalled.length === 0 && mbWaiting.length === 0 && (
              <div className="flex items-center justify-center py-6 text-gray-300 text-sm">—</div>
            )}
          </div>
        ) : (
          /* ── Desktop: two columns side by side ── */
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
                <BrightVehicleSection items={truckCalled}  primaryColor={primaryColor} highlightId={highlightId} isCalled />
                <BrightVehicleSection items={truckWaiting} primaryColor={primaryColor} highlightId={highlightId} isCalled={false} />
                {truckCalled.length === 0 && truckWaiting.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-gray-300 text-xs">—</div>
                )}
              </div>
              <div>
                <BrightVehicleSection items={mbCalled}  primaryColor={primaryColor} highlightId={highlightId} isCalled />
                <BrightVehicleSection items={mbWaiting} primaryColor={primaryColor} highlightId={highlightId} isCalled={false} />
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

// ─── Theme toggle button (floating, works on both themes) ─────────────────────
function ThemeToggle({ view, onToggle }: { view: 'dark' | 'bright'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={view === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all touch-manipulation"
      style={view === 'dark'
        ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }
        : { background: 'rgba(28,28,28,0.08)', color: '#374151', border: '1px solid rgba(0,0,0,0.12)' }
      }
    >
      {view === 'dark' ? '🌞' : '🌑'}
      <span className="hidden sm:inline">{view === 'dark' ? 'Sáng' : 'Tối'}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function WaitingScreen() {
  const socket = useSocket();
  const [deliveries, setDeliveries] = useState<DeliveryRegistration[]>([]);
  const [calledEvt, setCalledEvt]   = useState<CalledAlert | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now, setNow]               = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brand, setBrand]           = useState<BrandConfig | null>(null);
  const [isMobile, setIsMobile]     = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [activeTab, setActiveTab]   = useState<UnitKey>('EMART');
  const [view, setView]             = useState<'dark' | 'bright'>(() =>
    (localStorage.getItem('ws_view') as 'dark' | 'bright') ?? 'bright',
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { localStorage.setItem('ws_view', view); }, [view]);
  const toggleView = () => setView(v => v === 'dark' ? 'bright' : 'dark');

  useEffect(() => { api.get<BrandConfig>('/api/brand').then(r => setBrand(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchQueue = useCallback(async () => {
    try { setDeliveries((await api.get('/api/deliveries/queue')).data); } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    socket.on('queue_updated', (data: DeliveryRegistration[]) => setDeliveries(data));
    socket.on('delivery_called', (data: CalledAlert & { id: string }) => {
      playChime();
      setCalledEvt(data);
      setHighlightId(data.id);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setCalledEvt(null); setHighlightId(null); }, 14000);
    });
    socket.on('delivery_completed', fetchQueue);
    return () => { socket.off('queue_updated'); socket.off('delivery_called'); socket.off('delivery_completed'); };
  }, [socket, fetchQueue]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  const mallName = brand?.mall.mallName ?? 'THISO GROUP';
  const tagline  = brand?.mall.tagline  ?? 'Hệ thống điều phối giao-nhận hàng thông minh';
  const mallLogo = brand?.mall.logoUrl ?? null;
  const totalWaiting   = deliveries.filter(d => d.status === 'WAITING').length;
  const totalCalled    = deliveries.filter(d => d.status === 'CALLED').length;
  const totalReceiving = deliveries.filter(d => ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)).length;
  const driverUrl = `${window.location.origin}/register`;
  const dismissAlert = () => { setCalledEvt(null); setHighlightId(null); };

  const FullscreenBtn = () => (
    <button onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg transition-colors ${view === 'dark' ? 'text-thiso-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
      {isFullscreen ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0h5M4 4v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      )}
    </button>
  );

  // ─── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    const brightMobile = view === 'bright';
    return (
      <div className={`min-h-screen flex flex-col ${brightMobile ? 'bg-gray-100' : 'bg-thiso-50'}`}>
        {calledEvt && (brightMobile
          ? <BrightCalledOverlay evt={calledEvt} brand={brand} onDismiss={dismissAlert} />
          : <DarkCalledOverlay   evt={calledEvt} brand={brand} onDismiss={dismissAlert} />
        )}
        {calledEvt && (
          <div className="fixed inset-0 z-40 pointer-events-none animate-pulse"
               style={{ boxShadow: 'inset 0 0 0 10px rgba(56,189,248,0.75)' }} />
        )}

        {/* Header */}
        <div className={`px-4 py-3 sticky top-0 z-10 flex items-center justify-between ${brightMobile ? 'bg-white border-b border-gray-200 shadow-sm' : 'bg-thiso-900'}`}>
          <div className="flex items-center gap-2.5">
            {mallLogo ? (
              <img src={mallLogo} alt="" className="h-7 object-contain rounded" />
            ) : (
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${brightMobile ? 'bg-thiso-800' : 'bg-white/10'}`}>
                <span className="text-white font-black text-xs">T</span>
              </div>
            )}
            <div>
              <div className={`font-black text-xs tracking-widest leading-none ${brightMobile ? 'text-gray-800' : 'text-white'}`}>{mallName}</div>
              <div className={`text-[9px] ${brightMobile ? 'text-gray-400' : 'text-thiso-400'}`}>Màn hình theo dõi</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: 'Chờ', v: totalWaiting, color: brightMobile ? '#D97706' : '#FBBF24' },
              { label: 'Gọi', v: totalCalled,  color: brightMobile ? '#0284C7' : '#7DD3FC' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="font-black text-sm leading-none tabular-nums" style={{ color: s.color }}>{s.v}</div>
                <div className={`text-[9px] ${brightMobile ? 'text-gray-400' : 'text-thiso-500'}`}>{s.label}</div>
              </div>
            ))}
            <div className={`font-mono font-black text-sm leading-none ml-1 ${brightMobile ? 'text-gray-700' : 'text-white'}`}>
              {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <ThemeToggle view={view} onToggle={toggleView} />
          </div>
        </div>

        {/* Tab bar */}
        <div className={`border-b flex shrink-0 ${brightMobile ? 'bg-white border-gray-200' : 'bg-thiso-800 border-thiso-700'}`}>
          {UNIT_KEYS.map(u => {
            const def = UNIT_DEF[u];
            const cfg = brand?.units[u];
            const color = cfg?.primaryColor || def.primaryColor;
            const cnt = deliveries.filter(d =>
              d.receivingUnit === u && ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status),
            ).length;
            const calledCnt = deliveries.filter(d => d.receivingUnit === u && d.status === 'CALLED').length;
            const isActive = activeTab === u;
            return (
              <button key={u} onClick={() => setActiveTab(u)}
                      className={`flex-1 py-2.5 px-1 text-xs font-black tracking-wide transition-all relative
                        ${isActive ? (brightMobile ? 'text-gray-800' : 'text-white') : brightMobile ? 'text-gray-400' : 'text-thiso-500'}`}>
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ background: color }} />}
                {calledCnt > 0 && <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                <span className="mr-1 inline-flex items-center"><UnitLogo logoUrl={cfg?.logoUrl} icon={def.icon} px={16} /></span>
                {cfg?.shortName || def.shortName}
                {cnt > 0 && <span className="ml-1 opacity-60 text-[10px]">({cnt})</span>}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-hidden p-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
          {brightMobile ? (
            <BrightUnitPanel
              key={activeTab}
              unitKey={activeTab}
              deliveries={deliveries.filter(d => d.receivingUnit === activeTab)}
              highlightId={highlightId}
              brand={brand}
              compact
            />
          ) : (
            <DarkUnitPanel
              key={activeTab}
              unitKey={activeTab}
              deliveries={deliveries.filter(d => d.receivingUnit === activeTab)}
              highlightId={highlightId}
              brand={brand}
              compact
            />
          )}
        </div>
      </div>
    );
  }

  // ─── BRIGHT DESKTOP ──────────────────────────────────────────────────────────
  if (view === 'bright') {
    return (
      <div className="h-screen bg-gray-100 flex flex-col overflow-hidden select-none font-sans">
        {calledEvt && <BrightCalledOverlay evt={calledEvt} brand={brand} onDismiss={dismissAlert} />}

        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-200 shadow-sm px-5 py-3 flex items-center justify-between">
          {/* Left: logo + name */}
          <div className="flex items-center gap-3">
            {mallLogo
              ? <img src={mallLogo} alt={mallName} className="h-10 object-contain rounded" />
              : <div className="w-10 h-10 rounded-xl bg-thiso-800 flex items-center justify-center">
                  <span className="text-white font-black text-base">T</span>
                </div>}
            <div>
              <div className="font-black text-gray-900 leading-none" style={{ fontSize: 'clamp(0.9rem, 1.4vw, 1.1rem)' }}>
                {mallName}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">{tagline}</div>
            </div>
          </div>

          {/* Center: KPI — only waiting & called (no receiving) */}
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

          {/* Right: clock + actions */}
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
            <FullscreenBtn />
            <ThemeToggle view={view} onToggle={toggleView} />
          </div>
        </div>

        {/* 3 columns */}
        <div className="flex-1 grid grid-cols-3 gap-3 p-3 min-h-0">
          {UNIT_KEYS.map(u => (
            <BrightUnitPanel
              key={u}
              unitKey={u}
              deliveries={deliveries.filter(d => d.receivingUnit === u)}
              highlightId={highlightId}
              brand={brand}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-white border-t border-gray-200 px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            {Object.entries(GOODS_LABEL).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span>{GOODS_ICON[k]}</span><span>{v}</span>
              </span>
            ))}
          </div>
          <span className="text-gray-400 text-xs">
            📱 Đăng ký:{' '}
            <a href={driverUrl} target="_blank" rel="noreferrer" className="text-sky-500 font-mono underline">
              {driverUrl}
            </a>
          </span>
          <span className="text-gray-300 text-xs">● Realtime</span>
        </div>
      </div>
    );
  }

  // ─── DARK DESKTOP (original) ─────────────────────────────────────────────────
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
            {UNIT_KEYS.map(u => {
              const def = UNIT_DEF[u];
              const cfg = brand?.units[u];
              const color = cfg?.primaryColor || def.primaryColor;
              const cnt = deliveries.filter(d => d.receivingUnit === u && ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)).length;
              const calledCnt = deliveries.filter(d => d.receivingUnit === u && d.status === 'CALLED').length;
              return (
                <div key={u} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full inline-block ${calledCnt > 0 ? 'animate-pulse' : ''}`} style={{ background: color }} />
                  <span className="text-thiso-400 text-xs font-semibold">{cfg?.shortName || def.shortName}</span>
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
          <FullscreenBtn />
          <ThemeToggle view={view} onToggle={toggleView} />
        </div>
      </div>

      {/* 3 unit columns */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 min-h-0">
        {UNIT_KEYS.map(u => (
          <DarkUnitPanel
            key={u}
            unitKey={u}
            deliveries={deliveries.filter(d => d.receivingUnit === u)}
            highlightId={highlightId}
            brand={brand}
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
