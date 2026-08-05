import type { MallBranding } from '../../../lib/types';

export default function DriverHeader({ mall, now }: { mall: MallBranding; now: Date }) {
  return (
    <div className="bg-thiso-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <span className="text-white font-black text-sm">T</span>
        </div>
        <div>
          <div className="text-white font-black text-sm tracking-widest leading-none">{mall.mallName}</div>
          <div className="text-thiso-400 text-[10px]">{mall.locationName || mall.tagline || 'Theo dõi hàng chờ'}</div>
        </div>
      </div>
      <div className="text-thiso-400 text-xs font-mono">
        {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
