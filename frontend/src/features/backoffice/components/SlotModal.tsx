import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../../../lib/api';
import type { Slot, Zone, GoodsType } from '../../../lib/types';
import { GOODS_LABELS } from '../constants';

const slotSchema = z.object({
  code: z.string().min(1, 'Bắt buộc').max(20),
  name: z.string().min(1, 'Bắt buộc').max(50),
  assignedUnit: z.string().trim().min(1, 'Bắt buộc chọn đơn vị').transform((value) => value.toUpperCase()),
  vehicleType: z.enum(['TRUCK', 'MOTORBIKE', 'OTHER']).default('TRUCK'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).default('AVAILABLE'),
  zoneId: z.string().min(1, 'Bắt buộc chọn khu'),
  autoAssign: z.boolean().default(true),
  maxCapacity: z.number().int().min(1).max(10).default(1),
  acceptedGoods: z.array(z.enum(['FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG'])).default([]),
  goodsPriority: z.array(z.enum(['FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG'])).default([]),
  autoWarehouseOnly: z.boolean().default(false),
});
type SlotForm = z.infer<typeof slotSchema>;

const NORMAL_GOODS: GoodsType[] = ['FRESH_FOOD', 'GENERAL_GOODS', 'THI_CONG'];

function defaultGoodsPriority(slot?: Slot | null): GoodsType[] {
  const acceptedGoods = (slot?.acceptedGoods ?? []).filter((goodsType) => NORMAL_GOODS.includes(goodsType));
  const priority = (slot?.goodsPriority ?? []).filter((goodsType) => NORMAL_GOODS.includes(goodsType));
  if (priority.length > 0) {
    return [
      ...priority,
      ...acceptedGoods.filter((goodsType) => !priority.includes(goodsType)),
    ];
  }
  return acceptedGoods.length > 0 ? acceptedGoods : NORMAL_GOODS;
}

export default function SlotModal({ slot, zones, onClose, onSaved }: { slot?: Slot | null; zones: Zone[]; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const isEdit = !!slot;
  const unitOptions = Array.from(new Map(
    zones
      .filter((zone) => zone.unitConfig?.unit)
      .map((zone) => [zone.unitConfig!.unit, zone.unitConfig!]),
  ).values());
  const defaultUnit = slot?.assignedUnit ?? unitOptions[0]?.unit ?? '';

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: slot
      ? { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit, vehicleType: slot.vehicleType, status: slot.status, zoneId: slot.zoneId ?? '', autoAssign: slot.autoAssign, autoWarehouseOnly: slot.autoWarehouseOnly ?? false, maxCapacity: slot.maxCapacity ?? 1, acceptedGoods: slot.acceptedGoods as GoodsType[], goodsPriority: defaultGoodsPriority(slot) }
      : { vehicleType: 'TRUCK', assignedUnit: defaultUnit, status: 'AVAILABLE', zoneId: '', autoAssign: true, autoWarehouseOnly: false, maxCapacity: 1, acceptedGoods: [], goodsPriority: NORMAL_GOODS },
  });

  const goodsPriority = watch('goodsPriority') ?? [];
  const autoWarehouseOnly = watch('autoWarehouseOnly');
  const assignedUnit = watch('assignedUnit');
  const matchingZones = zones.filter((z) => z.unitConfig?.unit === assignedUnit);

  function setPriority(next: GoodsType[]) {
    setValue('goodsPriority', next, { shouldDirty: true, shouldValidate: true });
  }

  function addGoods(goodsType: GoodsType) {
    if (goodsPriority.includes(goodsType)) return;
    setPriority([...goodsPriority, goodsType]);
  }

  function removeGoods(goodsType: GoodsType) {
    setPriority(goodsPriority.filter((item) => item !== goodsType));
  }

  function moveGoods(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...goodsPriority];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPriority(next);
  }

  async function onSubmit(data: SlotForm) {
    setServerError('');
    try {
      const orderedGoods = data.autoWarehouseOnly
        ? []
        : data.goodsPriority.filter((goodsType) => NORMAL_GOODS.includes(goodsType));
      if (!data.autoWarehouseOnly && orderedGoods.length === 0) {
        setServerError('Vui lòng giữ ít nhất một loại hàng nhận cho slot.');
        return;
      }
      const acceptedGoods = orderedGoods.length === NORMAL_GOODS.length ? [] : orderedGoods;
      const payload = { ...data, zoneId: data.zoneId, acceptedGoods, goodsPriority: orderedGoods };
      if (isEdit) {
        await api.patch(`/api/slots/${slot!.id}`, { name: payload.name, assignedUnit: payload.assignedUnit, vehicleType: payload.vehicleType, status: payload.status, zoneId: payload.zoneId, autoAssign: payload.autoAssign, autoWarehouseOnly: payload.autoWarehouseOnly, maxCapacity: payload.maxCapacity, acceptedGoods: payload.acceptedGoods, goodsPriority: payload.goodsPriority });
      } else {
        await api.post('/api/slots', payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg ?? 'Lỗi lưu slot.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-thiso-800 mb-5">{isEdit ? `Chỉnh sửa Slot — ${slot!.code}` : 'Thêm Slot mới'}</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mã Slot *</label>
              <input {...register('code')} className="input" placeholder="T10, M16..." disabled={isEdit} />
              {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="label">Tên hiển thị *</label>
              <input {...register('name')} className="input" placeholder="Slot Tải 10" />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Đơn vị *</label>
              <select {...register('assignedUnit')} className="input">
                {unitOptions.map((unit) => (
                  <option key={unit.id} value={unit.unit}>{unit.displayName || unit.unit}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Loại phương tiện *</label>
              <select {...register('vehicleType')} className="input">
                <option value="TRUCK">🚛 Xe Tải</option>
                <option value="MOTORBIKE">🛵 Xe Máy</option>
                <option value="OTHER">🚗 Khác</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Khu (Zone) *</label>
              <select {...register('zoneId')} className="input">
                <option value="">— Chọn khu —</option>
                {matchingZones.map((z) => (
                  <option key={z.id} value={z.id}>{z.code} – {z.name}</option>
                ))}
              </select>
              {errors.zoneId && <p className="text-xs text-red-600 mt-1">{errors.zoneId.message}</p>}
            </div>
            <div>
              <label className="label">Trạng thái ban đầu</label>
              <select {...register('status')} className="input">
                <option value="AVAILABLE">Trống</option>
                <option value="RESERVED">Đặt trước</option>
                <option value="MAINTENANCE">Bảo trì</option>
              </select>
            </div>
          </div>

          {/* Auto-assign toggle */}
          <div className="flex items-center justify-between p-3 bg-sky-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-sky-800">Tự động điều xe</p>
              <p className="text-xs text-sky-600">Hệ thống tự gọi xe vào slot khi có chỗ trống</p>
            </div>
            <button
              type="button"
              onClick={() => setValue('autoAssign', !watch('autoAssign'))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${watch('autoAssign') ? 'bg-sky-600' : 'bg-thiso-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${watch('autoAssign') ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Auto-warehouse only toggle */}
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-purple-800">🏭 Chỉ dành cho Kho tự động</p>
              <p className="text-xs text-purple-600">Slot này chỉ nhận xe được xác nhận là NCC kho tự động</p>
            </div>
            <button
              type="button"
              onClick={() => setValue('autoWarehouseOnly', !watch('autoWarehouseOnly'))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${watch('autoWarehouseOnly') ? 'bg-purple-600' : 'bg-thiso-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${watch('autoWarehouseOnly') ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="label">Sức chứa tối đa (xe/slot)</label>
            <input
              type="number"
              min={1}
              max={10}
              {...register('maxCapacity', { valueAsNumber: true })}
              className="input w-24"
            />
            <p className="text-xs text-gray-400 mt-1">Xe tải: 1 — Xe máy: thường là 3</p>
          </div>

          {/* Accepted goods */}
          <div>
            <label className="label mb-2">LOẠI HÀNG NHẬN</label>
            <div className={`space-y-2 rounded-xl border border-thiso-100 bg-thiso-50 p-2.5 ${autoWarehouseOnly ? 'opacity-50' : ''}`}>
              {goodsPriority.map((goodsType, index) => (
                <div
                  key={goodsType}
                  draggable={!autoWarehouseOnly}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) moveGoods(dragIndex, index);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className="flex items-center gap-2 rounded-lg border border-thiso-100 bg-white px-2.5 py-2 text-sm shadow-sm"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-thiso-100 text-[11px] font-black text-thiso-600">
                    {index + 1}
                  </span>
                  <span className="cursor-grab text-thiso-300">↕</span>
                  <span className="min-w-0 flex-1 font-semibold text-thiso-700">{GOODS_LABELS[goodsType]}</span>
                  <button
                    type="button"
                    disabled={autoWarehouseOnly}
                    onClick={() => removeGoods(goodsType)}
                    className="rounded-md px-2 py-1 text-xs font-bold text-thiso-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-default"
                  >
                    Bỏ
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {NORMAL_GOODS.filter((goodsType) => !goodsPriority.includes(goodsType)).map((goodsType) => (
                  <button
                    key={goodsType}
                    type="button"
                    disabled={autoWarehouseOnly}
                    onClick={() => addGoods(goodsType)}
                    className="rounded-full border border-thiso-200 bg-white px-3 py-1.5 text-xs font-semibold text-thiso-500 hover:border-thiso-400 disabled:cursor-default"
                  >
                    + {GOODS_LABELS[goodsType]}
                  </button>
                ))}
              </div>
              {autoWarehouseOnly && (
                <p className="text-xs text-thiso-400">Slot kho tự động chỉ nhận xe AUTO_WAREHOUSE.</p>
              )}
              {!autoWarehouseOnly && goodsPriority.length === NORMAL_GOODS.length && (
                <p className="text-xs text-thiso-400">Slot nhận tất cả loại hàng thường theo thứ tự ưu tiên ở trên.</p>
              )}
              {!autoWarehouseOnly && goodsPriority.length < NORMAL_GOODS.length && (
                <p className="text-xs text-thiso-400">Slot chỉ nhận các loại hàng đang nằm trong danh sách ưu tiên.</p>
              )}
            </div>
          </div>

          {serverError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo Slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
