import { GOODS_ICON, GOODS_LABEL } from '../constants';

export default function GoodsLegend({ bright = false }: { bright?: boolean }) {
  return (
    <div className={`flex items-center gap-3 text-[10px] ${bright ? 'text-gray-500' : 'text-thiso-600'}`}>
      {Object.entries(GOODS_LABEL).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1">
          <span>{GOODS_ICON[k]}</span><span>{v}</span>
        </span>
      ))}
    </div>
  );
}
