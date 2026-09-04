import type { DeliveryStatus } from '../lib/types';

const CONFIG: Record<DeliveryStatus, { label: string; dot: string; bg: string; text: string }> = {
  REGISTERED:             { label: 'Đã đăng ký',    dot: 'bg-thiso-300',  bg: 'bg-thiso-100',  text: 'text-thiso-600' },
  WAITING:                { label: 'Đang chờ',       dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  CALLED:                 { label: 'Đã gọi',         dot: 'bg-thiso-500',  bg: 'bg-thiso-100',  text: 'text-thiso-700'  },
  RECEIVING:              { label: 'Đang nhận',      dot: 'bg-thiso-500',  bg: 'bg-thiso-100',  text: 'text-thiso-700' },
  AUTO_WAREHOUSE_RECEIVING:{ label: 'Kho tự động',   dot: 'bg-thiso-500', bg: 'bg-thiso-100',  text: 'text-thiso-700'},
  COMPLETED:              { label: 'Hoàn tất',       dot: 'bg-green-500',  bg: 'bg-green-50',   text: 'text-green-700' },
  CANCELLED:              { label: 'Đã hủy',         dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-600'   },
  EXPIRED:                { label: 'Hết hạn',        dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-600'   },
  INCOMPLETED:            { label: 'Chưa hoàn tất',  dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700' },
};

export default function StatusBadge({ status }: { status: DeliveryStatus }) {
  const c = CONFIG[status] ?? { label: status, dot: 'bg-thiso-300', bg: 'bg-thiso-100', text: 'text-thiso-600' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}
