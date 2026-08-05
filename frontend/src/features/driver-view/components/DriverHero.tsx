import type { MallBranding } from '../../../lib/types';

export default function DriverHero({ mall }: { mall: MallBranding }) {
  return (
    <div className="text-center pt-1">
      <div className="text-2xl font-black text-thiso-800 tracking-tight leading-snug">
        {mall.mallName}<br />
        <span className="text-base font-semibold text-thiso-400 tracking-widest">{mall.locationName || mall.tagline || 'THEO DÕI HÀNG CHỜ'}</span>
      </div>
      <div className="text-xs text-thiso-400 mt-1">Tra cứu vị trí hàng chờ của tài xế</div>
    </div>
  );
}
