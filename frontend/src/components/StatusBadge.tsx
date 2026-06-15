import type { DeliveryStatus } from '../lib/types';

const CONFIG: Record<DeliveryStatus, { label: string; dot: string; bg: string; text: string }> = {
  REGISTERED:             { label: 'Đã đăng ký',    dot: 'bg-thiso-300',  bg: 'bg-thiso-100',  text: 'text-thiso-600' },
  WAITING:                { label: 'Đang chờ',       dot: 'bg-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  CALLED:                 { label: 'Đã gọi',         dot: 'bg-blue-500',   bg: 'bg-blue-50',    text: 'text-blue-700'  },
  RECEIVING:              { label: 'Đang nhận',      dot: 'bg-emart-500',  bg: 'bg-emart-50',   text: 'text-emart-700' },
  AUTO_WAREHOUSE_RECEIVING:{ label: 'Kho tự động',   dot: 'bg-purple-500', bg: 'bg-purple-50',  text: 'text-purple-700'},
  COMPLETED:              { label: 'Hoàn tất',       dot: 'bg-sky-500',    bg: 'bg-sky-50',     text: 'text-sky-700'   },
  CANCELLED:              { label: 'Đã hủy',         dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-600'   },
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
