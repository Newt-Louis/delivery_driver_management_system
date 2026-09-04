import type { Slot } from '../lib/types';
import { unitPresentation } from '../lib/unitPresentation';

const STATUS_CONFIG = {
  AVAILABLE: { label: 'Trống', badgeClass: 'bg-green-50 text-green-700' },
  OCCUPIED: { label: 'Đang dùng', badgeClass: 'bg-red-50 text-red-700' },
  RESERVED: { label: 'Đặt trước', badgeClass: 'bg-amber-50 text-amber-700' },
  MAINTENANCE: { label: 'Bảo trì', badgeClass: 'bg-thiso-100 text-thiso-600' },
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
  const unit = unitPresentation(slot.assignedUnit, slot.zone?.unitConfig);
  const activeDeliveries = slot.deliveries?.filter(
    (d) => d.status === 'CALLED' || d.status === 'RECEIVING' || d.status === 'AUTO_WAREHOUSE_RECEIVING',
  ) ?? [];
  const isMultiCapacity = slot.maxCapacity > 1;
  const occupiedCount = activeDeliveries.length;

  return (
    <div className={`relative rounded-xl border border-thiso-200 bg-white p-4 shadow-card transition-all ${!slot.isActive ? 'bg-thiso-50 opacity-60' : ''}`}>
      {!slot.isActive && (
        <span className="absolute top-2 right-2 text-xs bg-thiso-800 text-white px-1.5 py-0.5 rounded font-medium">
          Vô hiệu
        </span>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold">{slot.code}</span>
            <span className="text-lg">{VEHICLE_BADGE[slot.vehicleType] ?? '🚗'}</span>
            {isMultiCapacity && (
              <span className="text-xs font-semibold bg-thiso-100 text-thiso-700 rounded px-1.5 py-0.5">
                {occupiedCount}/{slot.maxCapacity}
              </span>
            )}
          </div>
          <div className="text-sm opacity-80">{slot.name}</div>
          <div className="text-xs mt-1 font-medium">{unit.shortName || unit.label}</div>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* Settings badges: autoAssign and acceptedGoods */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${slot.autoAssign ? 'bg-thiso-100 text-thiso-700' : 'bg-thiso-50 text-thiso-500'}`}>
          {slot.autoAssign ? '🤖 Tự động' : '✋ Thủ công'}
        </span>
        {slot.acceptedGoods && slot.acceptedGoods.length > 0 && slot.acceptedGoods.map((g) => (
          <span key={g} className="text-xs bg-thiso-50 text-thiso-600 rounded px-1.5 py-0.5">
            {GOODS_LABELS[g] ?? g}
          </span>
        ))}
      </div>

      {/* Active deliveries list */}
      {activeDeliveries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-thiso-100 text-xs space-y-1.5">
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
            className="w-full rounded border border-thiso-200 bg-white px-2 py-1 text-xs text-thiso-700"
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
