export const DOCK_STAT_ITEMS = [
  {
    key: 'available',
    label: 'Trống',
    frameClass: 'bg-green-50 border-green-200',
    valueClass: 'text-green-700',
    labelClass: 'text-green-600',
  },
  {
    key: 'occupied',
    label: 'Đang dùng',
    frameClass: 'bg-red-50 border-red-200',
    valueClass: 'text-red-700',
    labelClass: 'text-red-600',
  },
  {
    key: 'reserved',
    label: 'Đặt trước',
    frameClass: 'bg-amber-50 border-amber-200',
    valueClass: 'text-amber-700',
    labelClass: 'text-amber-600',
  },
  {
    key: 'maintenance',
    label: 'Bảo trì',
    frameClass: 'bg-thiso-100 border-thiso-200',
    valueClass: 'text-thiso-700',
    labelClass: 'text-thiso-500',
  },
  {
    key: 'trucks',
    label: 'Slot Xe Tải',
    prefix: '🚛',
    frameClass: 'bg-white border-thiso-200',
    valueClass: 'text-thiso-800',
    labelClass: 'text-thiso-500',
  },
  {
    key: 'motorbikes',
    label: 'Slot Xe Máy',
    prefix: '🛵',
    frameClass: 'bg-white border-thiso-200',
    valueClass: 'text-thiso-800',
    labelClass: 'text-thiso-500',
  },
] as const;

export const DOCK_LEGEND_ITEMS = [
  { label: 'Trống', colorClass: 'bg-green-400' },
  { label: 'Đang dùng', colorClass: 'bg-red-400' },
  { label: 'Đặt trước', colorClass: 'bg-amber-400' },
  { label: 'Bảo trì', colorClass: 'bg-thiso-400' },
];
