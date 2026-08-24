import UnitLogo from '../UnitLogo';
import { formatTicketForDelivery, getUnitBrand } from '../../utils';
import type { BrandConfig, CalledAlert } from '../../types';

export default function BrightCalledOverlay({ evt, brand, onDismiss }: {
  evt: CalledAlert; brand: BrandConfig | null; onDismiss: () => void;
}) {
  const unitConfig = evt.delivery?.unitConfig ?? evt.delivery?.assignedSlot?.zone?.unitConfig ?? null;
  const cfg = getUnitBrand(brand, evt.receivingUnit, unitConfig);
  const callCount = evt.callCount ?? 1;
  const ticketCode = evt.delivery ? formatTicketForDelivery(evt.delivery) ?? evt.ticketCode : evt.ticketCode;
  const vehiclePlate = evt.delivery?.vehiclePlate ?? evt.vehiclePlate;
  const slotCode = evt.delivery?.assignedSlot?.code ?? evt.slotCode;
  const slotName = evt.delivery?.assignedSlot?.name ?? evt.slotName;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
      style={{ background: cfg.primaryColor }}
      onClick={onDismiss}
    >
      <div className="absolute inset-0 animate-ping opacity-[0.08] bg-white pointer-events-none" />
      <div className="relative z-10 text-center px-8 w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-8">
          <UnitLogo logoUrl={cfg.logoUrl} icon={cfg.icon} px={38} />
          <div className="text-left">
            <p className="text-white font-black text-xl uppercase tracking-[0.18em]">
              {cfg.displayName}
            </p>
            <p className="text-white/70 font-black text-base uppercase tracking-[0.25em]">
              📣 Mời xe di chuyển vào vị trí nhận hàng
            </p>
            {callCount > 1 && (
              <p className="text-white/40 text-sm mt-1 font-semibold">Lần gọi thứ {callCount}</p>
            )}
          </div>
        </div>
        {ticketCode && (
          <p className="text-white/50 font-mono font-black tracking-[0.3em] text-xl mb-3 uppercase">
            Số thẻ: {ticketCode}
          </p>
        )}
        <p className="font-black text-white tracking-widest leading-none mb-6 drop-shadow-2xl"
           style={{ fontSize: 'clamp(5rem, 18vw, 10rem)' }}>
          {vehiclePlate}
        </p>
        <p className="text-white/50 text-2xl font-medium mb-6">di chuyển vào</p>
        <div className="inline-block bg-white/20 border-4 border-white/30 rounded-3xl px-14 py-5 font-black text-white tracking-[0.15em] backdrop-blur-sm"
             style={{ fontSize: 'clamp(3rem, 10vw, 6rem)' }}>
          {slotCode}
        </div>
        <p className="text-white/60 text-xl font-semibold mt-5">{slotName}</p>
        <p className="text-white/25 text-sm mt-10">Chạm để đóng</p>
      </div>
    </div>
  );
}
