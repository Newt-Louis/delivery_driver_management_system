import UnitLogo from '../UnitLogo';
import { getUnitBrand } from '../../utils';
import type { BrandConfig, CalledAlert } from '../../types';

export default function DarkCalledOverlay({ evt, brand, onDismiss }: {
  evt: CalledAlert; brand: BrandConfig | null; onDismiss: () => void;
}) {
  const cfg = getUnitBrand(brand, evt.receivingUnit);
  const callCount = evt.callCount ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-3 flex items-center gap-3" style={{ background: cfg.primaryColor }}>
          <UnitLogo logoUrl={cfg.logoUrl} icon={cfg.icon} px={30} />
          <span className="text-white font-black text-lg tracking-widest">{cfg.displayName}</span>
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
               style={{ fontSize: 'clamp(3rem, 10vw, 5.5rem)', color: cfg.primaryColor }}>
            {evt.vehiclePlate}
          </div>
          <div className="text-thiso-400 text-base mb-3">di chuyển vào</div>
          <div className="inline-block font-black rounded-2xl px-10 py-4 mb-2"
               style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', background: `${cfg.primaryColor}18`, color: cfg.primaryColor, letterSpacing: '0.15em' }}>
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
