import type { GoodsType } from '../lib/types';

const CONFIG: Record<GoodsType, { label: string; bg: string; text: string }> = {
  FRESH_FOOD:     { label: 'Tươi sống',    bg: 'bg-thiso-100',  text: 'text-thiso-700'   },
  AUTO_WAREHOUSE: { label: 'Kho tự động',  bg: 'bg-thiso-100',  text: 'text-thiso-700'   },
  GENERAL_GOODS:  { label: 'Hàng thường',  bg: 'bg-thiso-100',  text: 'text-thiso-600'  },
  THI_CONG:       { label: 'Thi công',     bg: 'bg-thiso-100',  text: 'text-thiso-600'   },
};

export default function GoodsBadge({ type }: { type: GoodsType }) {
  const c = CONFIG[type] ?? { label: type, bg: 'bg-thiso-100', text: 'text-thiso-600' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
