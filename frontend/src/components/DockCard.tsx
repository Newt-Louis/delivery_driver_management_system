import type { Slot } from '../lib/types';

const STATUS_CONFIG = {
  AVAILABLE: { label: 'Trống', className: 'bg-green-50 border-green-300 text-green-800' },
  OCCUPIED: { label: 'Đang dùng', className: 'bg-red-50 border-red-300 text-red-800' },
  RESERVED: { label: 'Đặt trước', className: 'bg-yellow-50 border-yellow-300 text-yellow-800' },
  MAINTENANCE: { label: 'Bảo trì', className: 'bg-gray-100 border-gray-300 text-gray-600' },
};

const UNIT_LABELS: Record<string, string> = {
  EMART: 'Emart',
  THISKYHALL: 'Thiskyhall',
  TENANT: 'Mall (Khách thuê)',
};

const VEHICLE_BADGE: Record<string, string> = {
  TRUCK: '🚛',
  MOTORBIKE: '🛵',
  OTHER: '🚗',
};

const GOODS_LABELS: Record<string, string> = {
  FRESH_FOOD:    '🌿 Tươi sống',
  AUTO_WAREHOUSE:'🏭 Kho tự động',
  GENERAL_GOODS: '📦 Hàng thường',
  THI_CONG:      '🔨 Thi công',
};

interface Props {
  slot: Slot;
  onStatusChange?: (slotId: string, status: string) => void;
  canEdit?: boolean;
}

export default function DockCard({ slot, onStatusChange, canEdit }: Props) {
  const cfg = STATUS_CONFIG[slot.status] ?? STATUS_CONFIG.AVAILABLE;
  const activeDeliveries = slot.deliveries?.filter(
    (d) => d.status === 'CALLED' || d.status === 'RECEIVING' || d.status === 'AUTO_WAREHOUSE_RECEIVING',
  ) ?? [];
  const isMultiCapacity = slot.maxCapacity > 1;
  const occupiedCount = activeDeliveries.length;

  return (
    <div className={`border-2 rounded-xl p-4 ${cfg.className} transition-all relative ${!slot.isActive ? 'opacity-50' : ''}`}>
      {!slot.isActive && (
        <span className="absolute top-2 right-2 text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded font-medium">
          Vô hiệu
        </span>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold">{slot.code}</span>
            <span className="text-lg">{VEHICLE_BADGE[slot.vehicleType] ?? '🚗'}</span>
            {isMultiCapacity && (
              <span className="text-xs font-semibold bg-white bg-opacity-60 rounded px-1.5 py-0.5">
                {occupiedCount}/{slot.maxCapacity}
              </span>
            )}
          </div>
          <div className="text-sm opacity-80">{slot.name}</div>
          <div className="text-xs mt-1 font-medium">{UNIT_LABELS[slot.assignedUnit]}</div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white bg-opacity-60">
          {cfg.label}
        </span>
      </div>

      {/* Settings badges: autoAssign and acceptedGoods */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${slot.autoAssign ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {slot.autoAssign ? '🤖 Tự động' : '✋ Thủ công'}
        </span>
        {slot.acceptedGoods && slot.acceptedGoods.length > 0 && slot.acceptedGoods.map((g) => (
          <span key={g} className="text-xs bg-white bg-opacity-50 rounded px-1.5 py-0.5">
            {GOODS_LABELS[g] ?? g}
          </span>
        ))}
      </div>

      {/* Active deliveries list */}
      {activeDeliveries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20 text-xs space-y-1.5">
          {activeDeliveries.map((d, i) => (
            <div key={d.id} className="flex items-start gap-1.5">
              {isMultiCapacity && (
                <span className="opacity-40 font-medium w-3 shrink-0">{i + 1}.</span>
              )}
              <div className="min-w-0">
                <div className="font-semibold">{d.vehiclePlate}</div>
                <div className="opacity-70 truncate">{d.vendorName}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {slot.lastUsedAt && slot.status === 'AVAILABLE' && activeDeliveries.length === 0 && (
        <div className="mt-2 text-xs opacity-60">
          Dùng lần cuối: {new Date(slot.lastUsedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {canEdit && onStatusChange && slot.isActive && (
        <div className="mt-3">
          <select
            className="w-full text-xs border rounded px-2 py-1 bg-white bg-opacity-80"
            value={slot.status}
            onChange={(e) => onStatusChange(slot.id, e.target.value)}
          >
            <option value="AVAILABLE">Trống</option>
            <option value="OCCUPIED">Đang dùng</option>
            <option value="RESERVED">Đặt trước</option>
            <option value="MAINTENANCE">Bảo trì</option>
          </select>
        </div>
      )}
    </div>
  );
}
