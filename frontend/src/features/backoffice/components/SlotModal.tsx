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
  assignedUnit: z.enum(['EMART', 'THISKYHALL', 'TENANT']),
  vehicleType: z.enum(['TRUCK', 'MOTORBIKE', 'OTHER']).default('TRUCK'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).default('AVAILABLE'),
  zoneId: z.string().min(1, 'Bắt buộc chọn khu'),
  autoAssign: z.boolean().default(true),
  maxCapacity: z.number().int().min(1).max(10).default(1),
  acceptedGoods: z.array(z.enum(['FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG'])).default([]),
  autoWarehouseOnly: z.boolean().default(false),
});
type SlotForm = z.infer<typeof slotSchema>;

export default function SlotModal({ slot, zones, onClose, onSaved }: { slot?: Slot | null; zones: Zone[]; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState('');
  const isEdit = !!slot;

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: slot
      ? { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit, vehicleType: slot.vehicleType, status: slot.status, zoneId: slot.zoneId ?? '', autoAssign: slot.autoAssign, autoWarehouseOnly: slot.autoWarehouseOnly ?? false, maxCapacity: slot.maxCapacity ?? 1, acceptedGoods: slot.acceptedGoods as GoodsType[] }
      : { vehicleType: 'TRUCK', assignedUnit: 'EMART', status: 'AVAILABLE', zoneId: '', autoAssign: true, autoWarehouseOnly: false, maxCapacity: 1, acceptedGoods: [] },
  });

  const acceptedGoods = watch('acceptedGoods') ?? [];
  const assignedUnit = watch('assignedUnit');
  const matchingZones = zones.filter((z) => z.unitConfig?.unit === assignedUnit);

  function toggleGoods(g: GoodsType) {
    if (acceptedGoods.includes(g)) {
      setValue('acceptedGoods', acceptedGoods.filter((x) => x !== g));
    } else {
      setValue('acceptedGoods', [...acceptedGoods, g]);
    }
  }

  async function onSubmit(data: SlotForm) {
    setServerError('');
    try {
      const payload = { ...data, zoneId: data.zoneId };
      if (isEdit) {
        await api.patch(`/api/slots/${slot!.id}`, { name: payload.name, assignedUnit: payload.assignedUnit, vehicleType: payload.vehicleType, status: payload.status, zoneId: payload.zoneId, autoAssign: payload.autoAssign, autoWarehouseOnly: payload.autoWarehouseOnly, maxCapacity: payload.maxCapacity, acceptedGoods: payload.acceptedGoods });
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
                <option value="EMART">Emart</option>
                <option value="THISKYHALL">Thiskyhall</option>
                <option value="TENANT">Mall (Khách thuê)</option>
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
            <label className="label mb-2">Loại hàng nhận (trống = nhận tất cả)</label>
            <div className="flex flex-wrap gap-2">
              {(['FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG'] as GoodsType[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGoods(g)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${acceptedGoods.includes(g) ? 'bg-thiso-800 text-white border-thiso-800' : 'bg-white text-thiso-500 border-thiso-200 hover:border-thiso-400'}`}
                >
                  {GOODS_LABELS[g]}
                </button>
              ))}
            </div>
            {acceptedGoods.length === 0 && <p className="text-xs text-thiso-400 mt-1">Slot nhận tất cả loại hàng</p>}
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

