import type { DashboardSummary } from '../../../lib/types';

export default function KpiSummary({ summary }: { summary?: DashboardSummary }) {
  const items = [
    { label: 'Đã đặt', value: summary?.registeredToday, dim: true },
    { label: 'Chờ gọi', value: summary?.waiting, dim: false },
    { label: 'FF chờ', value: summary?.freshFoodWaiting, dim: false },
    { label: 'Đang nhận', value: summary?.receiving, dim: false },
    { label: 'Slot trống', value: summary?.slotsAvailable ?? summary?.docksAvailable, dim: false },
    { label: 'Slot dùng', value: summary?.slotsOccupied ?? summary?.docksOccupied, dim: false },
    { label: 'Tổng hôm nay', value: summary?.totalToday, dim: true },
    { label: 'Hoàn tất', value: summary?.completedToday, dim: true },
    { label: 'Đã hủy', value: summary?.cancelledToday, dim: true },
    { label: '🕓 Hết hạn', value: summary?.expiredToday, expired: true },
  ];

  return (
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-5">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border p-2 text-center
            ${'expired' in item && item.expired && (item.value ?? 0) > 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'dim' in item && item.dim
                ? 'bg-thiso-50 border-thiso-100 text-thiso-400'
                : 'bg-white border-thiso-100 text-thiso-700 shadow-sm'}`}
        >
          <div className="text-xl font-black leading-none">{item.value ?? '–'}</div>
          <div className="text-xs mt-1 font-medium leading-tight">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
