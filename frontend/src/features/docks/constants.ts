export const UNIT_COLORS = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-thiso-500',
];

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
    frameClass: 'bg-yellow-50 border-yellow-200',
    valueClass: 'text-yellow-700',
    labelClass: 'text-yellow-600',
  },
  {
    key: 'maintenance',
    label: 'Bảo trì',
    frameClass: 'bg-gray-100 border-gray-200',
    valueClass: 'text-gray-600',
    labelClass: 'text-gray-500',
  },
  {
    key: 'trucks',
    label: 'Slot Xe Tải',
    prefix: '🚛',
    frameClass: 'bg-orange-50 border-orange-200',
    valueClass: 'text-orange-700',
    labelClass: 'text-orange-600',
  },
  {
    key: 'motorbikes',
    label: 'Slot Xe Máy',
    prefix: '🛵',
    frameClass: 'bg-indigo-50 border-indigo-200',
    valueClass: 'text-indigo-700',
    labelClass: 'text-indigo-600',
  },
] as const;

export const DOCK_LEGEND_ITEMS = [
  { label: 'Trống', colorClass: 'bg-green-400' },
  { label: 'Đang dùng', colorClass: 'bg-red-400' },
  { label: 'Đặt trước', colorClass: 'bg-yellow-400' },
  { label: 'Bảo trì', colorClass: 'bg-gray-400' },
];
