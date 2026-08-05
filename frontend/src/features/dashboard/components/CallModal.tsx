import { useState } from 'react';
import GoodsBadge from '../../../components/GoodsBadge';
import type { DeliveryRegistration, Slot } from '../../../lib/types';
import { VEHICLE_LABEL } from '../constants';
import { getTicketCode, getUnitMeta } from '../utils';

interface CallModalProps {
  delivery: DeliveryRegistration;
  slots: Slot[];
  preselectedSlotId?: string;
  onClose: () => void;
  onCall: (slotId: string) => void;
  loading: boolean;
}

export default function CallModal({ delivery, slots, preselectedSlotId, onClose, onCall, loading }: CallModalProps) {
  const [selectedSlot, setSelectedSlot] = useState(preselectedSlotId ?? '');
  const meta = getUnitMeta(delivery.receivingUnit);
  const ticket = getTicketCode(delivery);
  const available = slots.filter((slot) => slot.status === 'AVAILABLE');
  const tier1 = available.filter((slot) => slot.assignedUnit === delivery.receivingUnit && slot.vehicleType === delivery.vehicleType);
  const tier2 = available.filter((slot) => slot.assignedUnit !== delivery.receivingUnit && slot.vehicleType === delivery.vehicleType);
  const tier3 = available.filter((slot) => slot.vehicleType !== delivery.vehicleType);
  const selectedObject = slots.find((slot) => slot.id === selectedSlot);

  function SlotButton({ slot, tier }: { slot: Slot; tier: 1 | 2 | 3 }) {
    const active = selectedSlot === slot.id;
    const styles: Record<1 | 2 | 3, string> = {
      1: active ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-200' : 'border-thiso-200 hover:border-sky-300',
      2: active ? 'border-emart-500 bg-emart-50 text-emart-700' : 'border-thiso-200 hover:border-emart-300',
      3: active ? 'border-red-500 bg-red-50 text-red-700' : 'border-thiso-200 hover:border-red-300',
    };

    return (
      <button
        type="button"
        onClick={() => setSelectedSlot(slot.id)}
        className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left ${styles[tier]}`}
      >
        <div className="font-black text-base">{slot.code}</div>
        {slot.zone && <div className="text-xs font-bold opacity-70 mt-0.5">{slot.zone.code}</div>}
        <div className="text-xs opacity-50 truncate leading-tight">{slot.name}</div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className={`bg-gradient-to-r ${meta.headerBg} p-5 rounded-t-2xl`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white/70 text-sm">{meta.icon} {meta.label}</div>
              {ticket && (
                <div className="text-white/60 text-xs font-mono font-black tracking-widest mt-0.5">🎫 {ticket}</div>
              )}
              <div className="text-white font-black text-2xl tracking-widest mt-1">{delivery.vehiclePlate}</div>
              <div className="text-white/80 text-sm mt-1">{delivery.vendorName} · {VEHICLE_LABEL[delivery.vehicleType]}</div>
              <div className="text-white/60 text-xs mt-0.5 font-mono">{delivery.registrationCode}</div>
            </div>
            <GoodsBadge type={delivery.goodsType} />
          </div>
          {delivery.callCount && delivery.callCount > 0 && (
            <div className="mt-3 bg-white/20 rounded-lg px-3 py-1.5 text-white text-xs">
              ⚠️ Đã gọi <strong>{delivery.callCount}</strong> lần trước
            </div>
          )}
        </div>

        <div className="p-5">
          {preselectedSlotId && (
            <div className="mb-4 px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700">
              💡 AI đề xuất: <strong>{slots.find((slot) => slot.id === preselectedSlotId)?.code}</strong>
            </div>
          )}
          {tier1.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-green-700 uppercase mb-2">✓ Vị trí phù hợp — {meta.label}</p>
              <div className="grid grid-cols-3 gap-2">{tier1.map((slot) => <SlotButton key={slot.id} slot={slot} tier={1} />)}</div>
            </div>
          )}
          {tier2.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-orange-600 uppercase mb-2">Cùng loại xe — đơn vị khác</p>
              <div className="grid grid-cols-3 gap-2">{tier2.map((slot) => <SlotButton key={slot.id} slot={slot} tier={2} />)}</div>
            </div>
          )}
          {tier3.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-red-500 uppercase mb-2">⚠ Vị trí khác loại xe</p>
              <div className="grid grid-cols-3 gap-2">{tier3.map((slot) => <SlotButton key={slot.id} slot={slot} tier={3} />)}</div>
            </div>
          )}
          {tier1.length === 0 && tier2.length === 0 && tier3.length === 0 && (
            <div className="py-6 text-center text-gray-400">Không còn vị trí trống</div>
          )}
          <div className="flex gap-3 mt-4">
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={loading}>Hủy</button>
            <button
              type="button"
              className={`flex-1 font-bold py-2.5 rounded-xl text-white transition-colors disabled:opacity-50
                ${selectedObject?.vehicleType !== delivery.vehicleType ? 'bg-red-500 hover:bg-red-600'
                  : selectedObject?.assignedUnit !== delivery.receivingUnit ? 'bg-emart-500 hover:bg-emart-600'
                    : 'bg-sky-600 hover:bg-sky-700'}`}
              disabled={!selectedSlot || loading}
              onClick={() => onCall(selectedSlot)}
            >
              {loading ? 'Đang gọi...' : `Gọi → ${selectedObject?.code ?? '...'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
