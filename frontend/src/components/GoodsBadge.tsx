import type { GoodsType } from '../lib/types';

const CONFIG: Record<GoodsType, { icon: string; label: string; bg: string; text: string }> = {
  FRESH_FOOD:     { icon: '🥬', label: 'Tươi sống',    bg: 'bg-sky-50',     text: 'text-sky-700'    },
  AUTO_WAREHOUSE: { icon: '🏭', label: 'Kho tự động',  bg: 'bg-blue-50',    text: 'text-blue-700'   },
  GENERAL_GOODS:  { icon: '📦', label: 'Hàng thường',  bg: 'bg-thiso-100',  text: 'text-thiso-600'  },
  THI_CONG:       { icon: '🔨', label: 'Thi công',     bg: 'bg-amber-50',   text: 'text-amber-700'  },
};

export default function GoodsBadge({ type }: { type: GoodsType }) {
  const c = CONFIG[type] ?? { icon: '📦', label: type, bg: 'bg-thiso-100', text: 'text-thiso-600' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}
