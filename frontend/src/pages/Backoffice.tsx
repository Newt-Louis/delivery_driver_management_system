import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { useBranding, UNIT_FALLBACKS } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import type { Slot, Zone, UnitConfig, GoodsType, DeliveryTimeWindow, UnitGoodsType, AutoWarehouseVendor } from '../lib/types';

const UNIT_LABELS: Record<string, string> = { EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)' };
const VEHICLE_LABEL: Record<string, string> = { TRUCK: '🚛 Xe Tải', MOTORBIKE: '🛵 Xe Máy', OTHER: '🚗 Khác' };
const STATUS_LABEL: Record<string, string> = { AVAILABLE: 'Trống', OCCUPIED: 'Đang dùng', RESERVED: 'Đặt trước', MAINTENANCE: 'Bảo trì' };
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  OCCUPIED: 'bg-red-100 text-red-800',
  RESERVED: 'bg-yellow-100 text-yellow-800',
  MAINTENANCE: 'bg-gray-200 text-gray-600',
};
const GOODS_LABELS: Record<GoodsType, string> = {
  FRESH_FOOD:    '🥬 Tươi sống',
  AUTO_WAREHOUSE:'🤖 Auto WH',
  GENERAL_GOODS: '📦 Hàng thường',
  THI_CONG:      '🔨 Thi công',
};

// ─── Slot Modal ───────────────────────────────────────────────────────────────

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

function SlotModal({ slot, zones, onClose, onSaved }: { slot?: Slot | null; zones: Zone[]; onClose: () => void; onSaved: () => void }) {
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

// ─── Unit Config Panel ────────────────────────────────────────────────────────

const UNIT_ICONS: Record<string, string> = { EMART: '🏬', THISKYHALL: '🏢', TENANT: '🏪' };

type UnitKey = 'EMART' | 'THISKYHALL' | 'TENANT';

interface UnitConfigFormData {
  freshFoodEnabled: boolean;
  generalGoodsEnabled: boolean;
  thiCongEnabled: boolean;
  sundayFreshFoodOnly: boolean;
  truckSlotMinutes: number;
  motorbikeSlotMinutes: number;
  truckMaxPerSlot: number;
  motorbikeMaxPerSlot: number;
  vendorApiUrl: string;
  vendorApiKey: string;
  poApiUrl: string;
  poApiKey: string;
}

// ─── Time Window Editor ───────────────────────────────────────────────────────
// Renders the list of time windows for either:
//   - a specific custom goods type  (unitGoodsTypeId set)
//   - the base-type fallback         (unitGoodsTypeId undefined)

function TimeWindowEditor({
  unit, goodsType, unitGoodsTypeId, editing,
}: {
  unit: UnitKey; goodsType: GoodsType; unitGoodsTypeId?: string; editing: boolean;
}) {
  const qc = useQueryClient();
  const [addMode, setAddMode] = useState(false);
  const [newWin, setNewWin]   = useState({ label: '', startTime: '08:00', endTime: '17:00' });
  const [editId, setEditId]   = useState<string | null>(null);
  const [editWin, setEditWin] = useState<{ label: string; startTime: string; endTime: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  const qKey = ['time-windows', unit, goodsType, unitGoodsTypeId ?? ''];
  const { data: windows = [], isLoading } = useQuery<DeliveryTimeWindow[]>({
    queryKey: qKey,
    queryFn: async () => {
      const p = new URLSearchParams({ goodsType });
      if (unitGoodsTypeId) p.set('unitGoodsTypeId', unitGoodsTypeId);
      return (await api.get(`/api/units/${unit}/time-windows?${p}`)).data;
    },
  });

  function invalidate() { qc.invalidateQueries({ queryKey: qKey }); }

  async function addWindow() {
    if (!newWin.startTime || !newWin.endTime) return;
    setSaving(true);
    try {
      await api.post(`/api/units/${unit}/time-windows`, {
        goodsType,
        unitGoodsTypeId: unitGoodsTypeId ?? undefined,
        label: newWin.label || null,
        startTime: newWin.startTime,
        endTime: newWin.endTime,
      });
      invalidate();
      setAddMode(false);
      setNewWin({ label: '', startTime: '08:00', endTime: '17:00' });
    } finally { setSaving(false); }
  }

  async function saveEdit(id: string) {
    if (!editWin) return;
    setSaving(true);
    try {
      await api.patch(`/api/units/time-windows/${id}`, editWin);
      invalidate();
      setEditId(null); setEditWin(null);
    } finally { setSaving(false); }
  }

  async function deleteWin(id: string) {
    await api.delete(`/api/units/time-windows/${id}`);
    invalidate();
  }

  async function toggleWin(win: DeliveryTimeWindow) {
    await api.patch(`/api/units/time-windows/${win.id}`, { enabled: !win.enabled });
    invalidate();
  }

  if (isLoading) return <p className="text-xs text-thiso-400 py-1">Đang tải...</p>;

  return (
    <div className="space-y-1">
      {windows.length === 0 && !addMode && (
        <p className="text-xs text-thiso-400 italic py-0.5">
          {editing ? 'Chưa có khung giờ. Nhấn + để thêm.' : 'Chưa cấu hình.'}
        </p>
      )}
      {windows.map(win => (
        <div key={win.id} className={`flex flex-wrap items-center gap-2 py-1 px-2 rounded-lg border ${win.enabled ? 'bg-white border-thiso-100' : 'bg-thiso-50 border-transparent opacity-60'}`}>
          {editId === win.id && editWin ? (
            <>
              <input type="text" value={editWin.label} onChange={e => setEditWin(v => ({ ...v!, label: e.target.value }))} placeholder="Nhãn" className="input text-xs py-0.5 w-16" />
              <input type="time" value={editWin.startTime} onChange={e => setEditWin(v => ({ ...v!, startTime: e.target.value }))} className="input text-xs py-0.5 w-24" />
              <span className="text-xs text-thiso-400">→</span>
              <input type="time" value={editWin.endTime} onChange={e => setEditWin(v => ({ ...v!, endTime: e.target.value }))} className="input text-xs py-0.5 w-24" />
              <button onClick={() => saveEdit(win.id)} disabled={saving} className="text-xs px-2 py-0.5 bg-sky-600 text-white rounded-lg">Lưu</button>
              <button onClick={() => { setEditId(null); setEditWin(null); }} className="text-xs px-2 py-0.5 border border-thiso-200 rounded-lg text-thiso-500">Hủy</button>
            </>
          ) : (
            <>
              {win.label && <span className="text-xs font-semibold text-thiso-500 w-12 shrink-0">{win.label}</span>}
              <span className="font-mono text-xs text-thiso-800 flex-1">{win.startTime} → {win.endTime}</span>
              {editing && (
                <>
                  <button onClick={() => toggleWin(win)} className={`text-[10px] px-1.5 py-0.5 rounded-full ${win.enabled ? 'bg-green-100 text-green-700' : 'bg-thiso-100 text-thiso-400'}`}>
                    {win.enabled ? 'Bật' : 'Tắt'}
                  </button>
                  <button onClick={() => { setEditId(win.id); setEditWin({ label: win.label ?? '', startTime: win.startTime, endTime: win.endTime }); }} className="text-xs text-thiso-400 hover:text-sky-600 px-1">✏</button>
                  <button onClick={() => deleteWin(win.id)} className="text-xs text-thiso-400 hover:text-red-500 px-1">✕</button>
                </>
              )}
            </>
          )}
        </div>
      ))}
      {editing && (
        addMode ? (
          <div className="flex flex-wrap items-center gap-2 py-1 px-2 bg-sky-50 rounded-lg border border-sky-200">
            <input type="text" value={newWin.label} onChange={e => setNewWin(v => ({ ...v, label: e.target.value }))} placeholder="Nhãn" className="input text-xs py-0.5 w-16" />
            <input type="time" value={newWin.startTime} onChange={e => setNewWin(v => ({ ...v, startTime: e.target.value }))} className="input text-xs py-0.5 w-24" />
            <span className="text-xs text-thiso-400">→</span>
            <input type="time" value={newWin.endTime} onChange={e => setNewWin(v => ({ ...v, endTime: e.target.value }))} className="input text-xs py-0.5 w-24" />
            <button onClick={addWindow} disabled={saving} className="text-xs px-2 py-0.5 bg-sky-600 text-white rounded-lg whitespace-nowrap">+ Thêm</button>
            <button onClick={() => setAddMode(false)} className="text-xs px-2 py-0.5 border border-thiso-200 rounded-lg text-thiso-500">Hủy</button>
          </div>
        ) : (
          <button onClick={() => setAddMode(true)} className="text-xs text-sky-600 hover:text-sky-700 py-0.5">+ Thêm khung giờ</button>
        )
      )}
    </div>
  );
}

// ─── Goods Type Editor ───────────────────────────────────────────────────────
// Each custom goods type row contains its own inline TimeWindowEditor.
// When no custom types are configured, falls back to a single base-type window editor.

function GoodsTypeEditor({ unit, baseType, editing }: { unit: UnitKey; baseType: GoodsType; editing: boolean }) {
  const qc = useQueryClient();
  const [addMode, setAddMode]   = useState(false);
  const [newItem, setNewItem]   = useState({ emoji: '📦', name: '' });
  const [editId, setEditId]     = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{ emoji: string; name: string } | null>(null);
  const [saving, setSaving]     = useState(false);

  const { data: items = [], isLoading } = useQuery<UnitGoodsType[]>({
    queryKey: ['goods-types', unit, baseType],
    queryFn: async () => (await api.get(`/api/units/${unit}/goods-types?all=1&baseType=${baseType}`)).data,
  });

  function invalidate() { qc.invalidateQueries({ queryKey: ['goods-types', unit, baseType] }); }

  async function addItem() {
    if (!newItem.name.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/units/${unit}/goods-types`, { baseType, name: newItem.name.trim(), emoji: newItem.emoji || '📦' });
      invalidate();
      setAddMode(false);
      setNewItem({ emoji: '📦', name: '' });
    } finally { setSaving(false); }
  }

  async function saveEdit(id: string) {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.patch(`/api/units/goods-types/${id}`, editItem);
      invalidate();
      setEditId(null); setEditItem(null);
    } finally { setSaving(false); }
  }

  async function deleteItem(id: string) {
    await api.delete(`/api/units/goods-types/${id}`);
    invalidate();
  }

  async function toggleItem(item: UnitGoodsType) {
    await api.patch(`/api/units/goods-types/${item.id}`, { enabled: !item.enabled });
    invalidate();
  }

  if (isLoading) return <p className="text-xs text-thiso-400 py-1">Đang tải...</p>;

  return (
    <div className="space-y-2 mt-2">
      {/* Per-custom-type rows, each with its own time window sub-editor */}
      {items.map(item => (
        <div key={item.id} className={`rounded-xl border p-2.5 space-y-2 ${item.enabled ? 'bg-white border-thiso-200' : 'bg-thiso-50 border-thiso-100 opacity-70'}`}>
          {/* Item header */}
          {editId === item.id && editItem ? (
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" value={editItem.emoji} onChange={e => setEditItem(v => ({ ...v!, emoji: e.target.value }))} className="input text-xs py-1 w-12 text-center" maxLength={4} />
              <input type="text" value={editItem.name} onChange={e => setEditItem(v => ({ ...v!, name: e.target.value }))} placeholder="Tên loại hàng" className="input text-xs py-1 flex-1 min-w-0" />
              <button onClick={() => saveEdit(item.id)} disabled={saving} className="text-xs px-2 py-1 bg-sky-600 text-white rounded-lg">Lưu</button>
              <button onClick={() => { setEditId(null); setEditItem(null); }} className="text-xs px-2 py-1 border border-thiso-200 rounded-lg text-thiso-500">Hủy</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{item.emoji}</span>
              <span className="text-sm font-medium text-thiso-800 flex-1">{item.name}</span>
              {editing && (
                <>
                  <button onClick={() => toggleItem(item)} className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.enabled ? 'bg-green-100 text-green-700' : 'bg-thiso-100 text-thiso-400'}`}>
                    {item.enabled ? 'Bật' : 'Tắt'}
                  </button>
                  <button onClick={() => { setEditId(item.id); setEditItem({ emoji: item.emoji, name: item.name }); }} className="text-xs text-thiso-400 hover:text-sky-600 px-1">✏</button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-thiso-400 hover:text-red-500 px-1">✕</button>
                </>
              )}
            </div>
          )}
          {/* Time windows scoped to this custom type */}
          <div className="border-t border-thiso-100 pt-2 pl-1">
            <p className="text-[10px] font-semibold text-thiso-400 uppercase tracking-wide mb-1">Khung giờ nhận hàng</p>
            <TimeWindowEditor unit={unit} goodsType={baseType} unitGoodsTypeId={item.id} editing={editing} />
          </div>
        </div>
      ))}

      {/* Add new custom type button / inline form */}
      {editing && (
        addMode ? (
          <div className="flex flex-wrap items-center gap-2 py-1.5 px-2 bg-sky-50 rounded-lg border border-sky-200">
            <input type="text" value={newItem.emoji} onChange={e => setNewItem(v => ({ ...v, emoji: e.target.value }))} className="input text-xs py-1 w-12 text-center" maxLength={4} placeholder="📦" />
            <input type="text" value={newItem.name} onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))} placeholder="Tên loại hàng..." className="input text-xs py-1 flex-1 min-w-0" />
            <button onClick={addItem} disabled={saving || !newItem.name.trim()} className="text-xs px-2 py-1 bg-sky-600 text-white rounded-lg whitespace-nowrap disabled:opacity-50">+ Thêm</button>
            <button onClick={() => setAddMode(false)} className="text-xs px-2 py-1 border border-thiso-200 rounded-lg text-thiso-500">Hủy</button>
          </div>
        ) : (
          <button onClick={() => setAddMode(true)} className="text-xs text-sky-600 hover:text-sky-700 font-semibold py-0.5">+ Thêm danh mục</button>
        )
      )}

      {/* Fallback: base-type windows when no custom types are configured */}
      {items.length === 0 && (
        <div>
          <p className="text-xs font-medium text-thiso-500 mb-1">Khung giờ nhận hàng</p>
          <TimeWindowEditor unit={unit} goodsType={baseType} editing={editing} />
        </div>
      )}
    </div>
  );
}

function UnitConfigCard({ unit, config, onSaved }: { unit: UnitKey; config?: UnitConfig; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<UnitConfigFormData>({
    freshFoodEnabled: config?.freshFoodEnabled ?? true,
    generalGoodsEnabled: config?.generalGoodsEnabled ?? true,
    thiCongEnabled: config?.thiCongEnabled ?? true,
    sundayFreshFoodOnly: config?.sundayFreshFoodOnly ?? false,
    truckSlotMinutes: config?.truckSlotMinutes ?? 30,
    motorbikeSlotMinutes: config?.motorbikeSlotMinutes ?? 15,
    truckMaxPerSlot: config?.truckMaxPerSlot ?? 1,
    motorbikeMaxPerSlot: config?.motorbikeMaxPerSlot ?? 3,
    vendorApiUrl: config?.vendorApiUrl ?? '',
    vendorApiKey: '',
    poApiUrl: config?.poApiUrl ?? '',
    poApiKey: '',
  });

  function setF(key: keyof UnitConfigFormData, val: string | boolean | number) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(`/api/units/${unit}/config`, {
        freshFoodEnabled: form.freshFoodEnabled,
        generalGoodsEnabled: form.generalGoodsEnabled,
        thiCongEnabled: form.thiCongEnabled,
        sundayFreshFoodOnly: form.sundayFreshFoodOnly,
        truckSlotMinutes: Number(form.truckSlotMinutes),
        motorbikeSlotMinutes: Number(form.motorbikeSlotMinutes),
        truckMaxPerSlot: Number(form.truckMaxPerSlot),
        motorbikeMaxPerSlot: Number(form.motorbikeMaxPerSlot),
        vendorApiUrl: form.vendorApiUrl || null,
        vendorApiKey: form.vendorApiKey || null,
        poApiUrl: form.poApiUrl || null,
        poApiKey: form.poApiKey || null,
      });
      setEditing(false);
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(msg ?? 'Lỗi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  }

  const numInput = (label: string, key: keyof UnitConfigFormData, min: number, max: number) => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        className="input text-sm py-1.5"
        value={form[key] as number}
        onChange={(e) => setF(key, Number(e.target.value))}
        disabled={!editing}
      />
    </div>
  );

  const toggle = (label: string, key: keyof UnitConfigFormData) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => editing && setF(key, !form[key])}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form[key] ? 'bg-sky-600' : 'bg-thiso-200'} ${!editing ? 'opacity-60 cursor-default' : ''}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="bg-white border border-thiso-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{UNIT_ICONS[unit]}</span>
          <div>
            <h3 className="font-bold text-thiso-800">{UNIT_LABELS[unit]}</h3>
            {!config && <span className="text-xs text-thiso-400">Chưa cấu hình</span>}
          </div>
        </div>
        {!editing ? (
          <button className="text-xs px-3 py-1.5 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500" onClick={() => setEditing(true)}>
            Chỉnh sửa
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 rounded-lg border border-thiso-200 hover:border-thiso-400 text-thiso-500" onClick={() => { setEditing(false); setSaveError(''); }}>Hủy</button>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-thiso-800 text-white hover:bg-thiso-900" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Fresh Food */}
        <div className="bg-green-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700">🥬 Hàng tươi sống</span>
            {toggle('Kích hoạt', 'freshFoodEnabled')}
          </div>
          {form.freshFoodEnabled && <GoodsTypeEditor unit={unit} baseType="FRESH_FOOD" editing={editing} />}
          {toggle('Chủ nhật: chỉ nhận hàng tươi sống', 'sundayFreshFoodOnly')}
        </div>

        {/* General Goods */}
        <div className="bg-thiso-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-thiso-600">📦 Hàng thường</span>
            {toggle('Kích hoạt', 'generalGoodsEnabled')}
          </div>
          {form.generalGoodsEnabled && <GoodsTypeEditor unit={unit} baseType="GENERAL_GOODS" editing={editing} />}
        </div>

        {/* Thi Công */}
        <div className="bg-amber-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-700">🔨 Thi công</span>
            {toggle('Kích hoạt', 'thiCongEnabled')}
          </div>
          {form.thiCongEnabled && <GoodsTypeEditor unit={unit} baseType="THI_CONG" editing={editing} />}
        </div>

        {/* Slot config */}
        <div className="bg-orange-50 rounded-xl p-3 space-y-2">
          <span className="text-sm font-semibold text-orange-700">⏱ Cấu hình Slot</span>
          <div className="grid grid-cols-2 gap-2">
            {numInput('Xe tải: phút/slot', 'truckSlotMinutes', 15, 120)}
            {numInput('Xe tải: tối đa xe/slot', 'truckMaxPerSlot', 1, 20)}
            {numInput('Xe máy: phút/slot', 'motorbikeSlotMinutes', 5, 60)}
            {numInput('Xe máy: tối đa xe/slot', 'motorbikeMaxPerSlot', 1, 20)}
          </div>
        </div>

        {/* API config */}
        <div className="bg-thiso-50 rounded-xl p-3 space-y-2">
          <span className="text-sm font-semibold text-thiso-600">🔗 API Nhà cung cấp & PO</span>
          <div>
            <label className="text-xs text-gray-500">URL API Nhà cung cấp</label>
            <input type="url" className="input text-sm py-1.5" placeholder="https://api.example.com/vendors" value={form.vendorApiUrl} onChange={(e) => setF('vendorApiUrl', e.target.value)} disabled={!editing} />
          </div>
          {editing && (
            <div>
              <label className="text-xs text-gray-500">API Key Nhà cung cấp (để trống nếu không đổi)</label>
              <input type="password" className="input text-sm py-1.5" placeholder="••••••••" value={form.vendorApiKey} onChange={(e) => setF('vendorApiKey', e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500">URL API PO</label>
            <input type="url" className="input text-sm py-1.5" placeholder="https://api.example.com/po" value={form.poApiUrl} onChange={(e) => setF('poApiUrl', e.target.value)} disabled={!editing} />
          </div>
          {editing && (
            <div>
              <label className="text-xs text-gray-500">API Key PO (để trống nếu không đổi)</label>
              <input type="password" className="input text-sm py-1.5" placeholder="••••••••" value={form.poApiKey} onChange={(e) => setF('poApiKey', e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {saveError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{saveError}</div>}
    </div>
  );
}

// ─── Zone Management ──────────────────────────────────────────────────────────

function ZonePanel() {
  const queryClient = useQueryClient();
  const { data: zones = [], isLoading } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/api/zones')).data,
  });
  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  const [addMode, setAddMode] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [form, setForm] = useState({ code: '', name: '', unitConfigId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function refreshZones() {
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    queryClient.invalidateQueries({ queryKey: ['slots', 'all'] });
  }

  async function saveZone() {
    if (!form.code.trim() || !form.name.trim() || !form.unitConfigId) { setError('Bắt buộc nhập mã, tên khu và đơn vị.'); return; }
    setSaving(true); setError('');
    try {
      if (editZone) {
        await api.patch(`/api/zones/${editZone.id}`, form);
      } else {
        await api.post('/api/zones', form);
      }
      setAddMode(false); setEditZone(null); setForm({ code: '', name: '', unitConfigId: '' });
      refreshZones();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Lỗi lưu khu.');
    } finally { setSaving(false); }
  }

  async function deleteZone(z: Zone) {
    if (!confirm(`Xóa khu ${z.code}?`)) return;
    try {
      await api.delete(`/api/zones/${z.id}`);
      refreshZones();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Lỗi xóa khu.');
    }
  }

  const UNIT_BADGE: Record<string, string> = {
    EMART: 'bg-emart-100 text-emart-700',
    THISKYHALL: 'bg-sky-100 text-sky-700',
    TENANT: 'bg-thiso-100 text-thiso-600',
  };
  const UNIT_LABEL: Record<string, string> = { EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)' };
  const ZONE_COLORS = ['from-sky-700 to-sky-500', 'from-emart-600 to-emart-400', 'from-thiso-700 to-thiso-500', 'from-sky-500 to-sky-400', 'from-thiso-500 to-thiso-400'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-thiso-400">Quản lý các khu nhận hàng vật lý. Mỗi khu có thể chứa nhiều slot và phục vụ nhiều đơn vị.</p>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => { setAddMode(true); setEditZone(null); setForm({ code: '', name: '', unitConfigId: unitConfigs[0]?.id ?? '' }); }}>
          + Thêm Khu
        </button>
      </div>

      {(addMode || editZone) && (
        <div className="mb-5 bg-white border border-thiso-100 rounded-2xl p-5">
          <h3 className="font-bold text-thiso-800 mb-4">{editZone ? `Sửa Khu ${editZone.code}` : 'Thêm Khu mới'}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Mã Khu *</label>
              <input className="input uppercase" placeholder="K6" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} disabled={!!editZone} />
            </div>
            <div>
              <label className="label">Tên Khu *</label>
              <input className="input" placeholder="Khu 6 – Khu vực mới" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Đơn vị *</label>
              <select className="input" value={form.unitConfigId} onChange={(e) => setForm((f) => ({ ...f, unitConfigId: e.target.value }))}>
                <option value="">— Chọn đơn vị —</option>
                {unitConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>{UNIT_LABEL[cfg.unit] ?? cfg.unit}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => { setAddMode(false); setEditZone(null); setError(''); }}>Hủy</button>
            <button className="btn-primary" onClick={saveZone} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </div>
      )}

      {isLoading && <div className="py-8 text-center text-thiso-400">Đang tải...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((z, idx) => {
          const slotList = z.slots ?? [];
          const trucks = slotList.filter((s) => s.vehicleType === 'TRUCK');
          const motorbikes = slotList.filter((s) => s.vehicleType === 'MOTORBIKE');
          const unitSet = z.unitConfig?.unit ? [z.unitConfig.unit] : [...new Set(slotList.map((s) => s.assignedUnit))];
          const gradient = ZONE_COLORS[idx % ZONE_COLORS.length];

          return (
            <div key={z.id} className="bg-white border border-thiso-100 rounded-2xl overflow-hidden shadow-card">
              <div className={`bg-gradient-to-r ${gradient} px-4 py-3 text-white flex items-center justify-between`}>
                <div>
                  <div className="font-black text-xl tracking-widest">{z.code}</div>
                  <div className="text-white/80 text-sm">{z.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black">{slotList.length}</div>
                  <div className="text-white/70 text-xs">slot</div>
                </div>
              </div>

              <div className="p-4">
                {/* Unit badges */}
                {unitSet.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {unitSet.map((u) => (
                      <span key={u} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${UNIT_BADGE[u] ?? 'bg-gray-100 text-gray-600'}`}>
                        {UNIT_LABEL[u] ?? u}
                      </span>
                    ))}
                    {unitSet.length === 0 && <span className="text-xs text-gray-400 italic">Chưa có slot</span>}
                  </div>
                )}

                {/* Slot summary */}
                <div className="flex gap-4 text-sm text-thiso-600 mb-3">
                  {trucks.length > 0 && <span>🚛 {trucks.length} tải</span>}
                  {motorbikes.length > 0 && <span>🛵 {motorbikes.length} xe máy</span>}
                  {slotList.length === 0 && <span className="text-gray-400 italic text-xs">Chưa có slot nào</span>}
                </div>

                {/* Slot chips */}
                {slotList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {slotList.map((s) => (
                      <span key={s.id} className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${s.status === 'AVAILABLE' ? 'border-green-300 bg-green-50 text-green-700' : s.status === 'OCCUPIED' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                        {s.code}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-thiso-100">
                  <button
                    className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500"
                    onClick={() => { setEditZone(z); setAddMode(false); setForm({ code: z.code, name: z.name, unitConfigId: z.unitConfigId }); setError(''); }}
                  >
                    Sửa
                  </button>
                  <button
                    className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-red-400 hover:text-red-600 transition-colors text-thiso-400"
                    onClick={() => deleteZone(z)}
                    disabled={(z._count?.slots ?? slotList.length) > 0}
                    title={(z._count?.slots ?? slotList.length) > 0 ? 'Chuyển hết slot ra trước khi xóa' : ''}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Brand Panel ─────────────────────────────────────────────────────────────

type ReceivingUnitKey = 'EMART' | 'THISKYHALL' | 'TENANT';

function LogoUpload({ value, onChange, label, maxSizeKB = 500, variant = 'logo' }: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  maxSizeKB?: number;
  variant?: 'logo' | 'bg';
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeKB * 1000) { alert(`File quá lớn — tối đa ${maxSizeKB}KB`); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [onChange, maxSizeKB]);

  const isBg = variant === 'bg';

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border-2 border-thiso-200 bg-thiso-50 flex items-center justify-center overflow-hidden flex-shrink-0
          ${isBg ? 'w-40 h-24' : 'w-16 h-16'}`}>
          {value
            ? <img src={value} alt="preview" className={`w-full h-full ${isBg ? 'object-cover' : 'object-contain p-1'}`} />
            : <span className="text-2xl text-thiso-300">🖼</span>}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => inputRef.current?.click()}>
            {value ? (isBg ? 'Thay ảnh' : 'Thay logo') : (isBg ? 'Tải lên ảnh' : 'Tải lên logo')}
          </button>
          {value && (
            <button type="button" className="text-xs text-red-500 hover:text-red-700 text-left" onClick={() => onChange(null)}>
              Xóa
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          {isBg
            ? <p className="text-[11px] text-thiso-400 leading-relaxed">JPG, PNG — tối đa {maxSizeKB}KB<br/>Khuyến nghị 1920×1080, ảnh sẽ phủ toàn màn hình kiosk</p>
            : <p className="text-[11px] text-thiso-400 leading-relaxed">PNG, JPG, SVG — tối đa {maxSizeKB}KB<br/>Nền trong suốt (PNG) hiển thị tốt hơn</p>}
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  const { mall, units, refresh } = useBranding();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<string | null>(null);

  // Mall state
  const [mallName,    setMallName]    = useState(mall.mallName);
  const [mallTagline, setMallTagline] = useState(mall.tagline ?? '');
  const [mallLogo,    setMallLogo]    = useState<string | null>(mall.logoUrl);
  const [kioskBgUrl,  setKioskBgUrl]  = useState<string | null>(mall.kioskBgUrl ?? null);

  // Unit states
  const [unitData, setUnitData] = useState<Record<ReceivingUnitKey, {
    displayName: string; shortName: string; description: string;
    logoUrl: string | null; primaryColor: string;
  }>>({
    EMART:      { displayName: units.EMART?.displayName      ?? '', shortName: units.EMART?.shortName      ?? '', description: units.EMART?.description      ?? '', logoUrl: units.EMART?.logoUrl      ?? null, primaryColor: units.EMART?.primaryColor      ?? '#FF9500' },
    THISKYHALL: { displayName: units.THISKYHALL?.displayName ?? '', shortName: units.THISKYHALL?.shortName ?? '', description: units.THISKYHALL?.description ?? '', logoUrl: units.THISKYHALL?.logoUrl ?? null, primaryColor: units.THISKYHALL?.primaryColor ?? '#27A55E' },
    TENANT:     { displayName: units.TENANT?.displayName     ?? '', shortName: units.TENANT?.shortName     ?? '', description: units.TENANT?.description     ?? '', logoUrl: units.TENANT?.logoUrl     ?? null, primaryColor: units.TENANT?.primaryColor     ?? '#1C1C1C' },
  });

  function setUnit(unit: ReceivingUnitKey, field: string, value: string | null) {
    setUnitData(d => ({ ...d, [unit]: { ...d[unit], [field]: value } }));
  }

  async function saveMall() {
    setSaving('mall');
    try {
      await api.patch('/api/brand/mall', { mallName, tagline: mallTagline || null, logoUrl: mallLogo, kioskBgUrl });
      refresh();
      setSaved('mall'); setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  async function saveUnit(unit: ReceivingUnitKey) {
    setSaving(unit);
    try {
      await api.patch(`/api/units/${unit}/config`, unitData[unit]);
      refresh();
      setSaved(unit); setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  const UNIT_STYLE_BG: Record<ReceivingUnitKey, string> = {
    EMART: 'bg-emart-50 border-emart-200', THISKYHALL: 'bg-sky-50 border-sky-200', TENANT: 'bg-thiso-50 border-thiso-200',
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-thiso-400">Cấu hình logo và tên hiển thị cho công ty và từng đơn vị. Logo sẽ xuất hiện trong trang đăng ký, màn hình chờ và phiếu in.</p>

      {/* ── Mall / Company branding ── */}
      <div className="card space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-thiso-100">
          <div className="w-8 h-8 rounded-lg bg-thiso-800 flex items-center justify-center">
            {mallLogo
              ? <img src={mallLogo} alt="" className="w-full h-full object-contain rounded-lg p-0.5" />
              : <span className="text-white font-black text-sm">{mallName.charAt(0)}</span>}
          </div>
          <div>
            <h3 className="font-bold text-thiso-800">Thương hiệu công ty</h3>
            <p className="text-xs text-thiso-400">Logo chính hiển thị trên navbar và màn hình đăng nhập</p>
          </div>
        </div>

        <LogoUpload label="Logo công ty" value={mallLogo} onChange={setMallLogo} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tên công ty</label>
            <input className="input" value={mallName} onChange={e => setMallName(e.target.value)} placeholder="THISO GROUP" />
          </div>
          <div>
            <label className="label">Tagline / Mô tả ngắn</label>
            <input className="input" value={mallTagline} onChange={e => setMallTagline(e.target.value)} placeholder="Delivery Management System" />
          </div>
        </div>

        <div className="border-t border-thiso-100 pt-5">
          <h4 className="font-semibold text-thiso-700 text-sm mb-1">🖥 Hình nền màn hình Kiosk</h4>
          <p className="text-[11px] text-thiso-400 mb-3">Hiển thị ở chế độ idle khi không có kết quả quét. Để trống = nền tối mặc định.</p>
          <LogoUpload label="" value={kioskBgUrl} onChange={setKioskBgUrl} maxSizeKB={2048} variant="bg" />
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved === 'mall' && <span className="text-xs text-sky-600 font-semibold">✓ Đã lưu</span>}
          <button className="btn-primary px-6" onClick={saveMall} disabled={saving === 'mall'}>
            {saving === 'mall' ? 'Đang lưu...' : 'Lưu thương hiệu công ty'}
          </button>
        </div>
      </div>

      {/* ── Per-unit branding ── */}
      <div className="space-y-5">
        <h3 className="font-bold text-thiso-700">Thương hiệu từng đơn vị</h3>
        {(['EMART', 'THISKYHALL', 'TENANT'] as ReceivingUnitKey[]).map((unit) => {
          const d  = unitData[unit];
          const fb = UNIT_FALLBACKS[unit];
          return (
            <div key={unit} className={`border rounded-2xl p-5 space-y-4 ${UNIT_STYLE_BG[unit]}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-thiso-100 flex items-center justify-center overflow-hidden">
                  {d.logoUrl
                    ? <img src={d.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                    : <span className="text-2xl">{fb.icon}</span>}
                </div>
                <div>
                  <h4 className="font-bold text-thiso-800">{d.displayName || fb.displayName}</h4>
                  <p className="text-xs text-thiso-400 font-mono">{unit}</p>
                </div>
              </div>

              <LogoUpload label="Logo đơn vị" value={d.logoUrl} onChange={v => setUnit(unit, 'logoUrl', v)} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tên hiển thị đầy đủ</label>
                  <input className="input bg-white" value={d.displayName} onChange={e => setUnit(unit, 'displayName', e.target.value)} placeholder={fb.displayName} />
                </div>
                <div>
                  <label className="label">Tên rút gọn</label>
                  <input className="input bg-white" value={d.shortName} onChange={e => setUnit(unit, 'shortName', e.target.value)} placeholder={fb.shortName} />
                  <p className="text-[11px] text-thiso-400 mt-1">Dùng trên màn hình TV hàng chờ</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="label">Mô tả / địa chỉ cổng</label>
                  <input className="input bg-white" value={d.description} onChange={e => setUnit(unit, 'description', e.target.value)} placeholder={fb.description} />
                  <p className="text-[11px] text-thiso-400 mt-1">Ví dụ: Siêu thị — Cửa B3, tầng hầm</p>
                </div>
                <div>
                  <label className="label">Màu thương hiệu</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={d.primaryColor}
                      onChange={e => setUnit(unit, 'primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-thiso-200 cursor-pointer bg-white p-0.5"
                    />
                    <input
                      className="input bg-white font-mono text-sm flex-1"
                      value={d.primaryColor}
                      onChange={e => setUnit(unit, 'primaryColor', e.target.value)}
                      placeholder="#FF9500"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                {saved === unit && <span className="text-xs text-sky-600 font-semibold">✓ Đã lưu</span>}
                <button className="btn-primary text-sm px-5" onClick={() => saveUnit(unit)} disabled={saving === unit}>
                  {saving === unit ? 'Đang lưu...' : `Lưu ${d.displayName || unit}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Staff PIN Panel ──────────────────────────────────────────────────────────

interface StaffPin { id: string; name: string; role: 'SECURITY' | 'RECEIVING'; pin: string; active: boolean }

const ROLE_CONFIG = {
  SECURITY:  { label: 'Bảo vệ / Security',       icon: '🔐', bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200'   },
  RECEIVING: { label: 'Nhân viên nhận hàng',      icon: '📦', bg: 'bg-green-50', text: 'text-green-700',  border: 'border-green-200' },
};

function StaffPinPanel() {
  const queryClient = useQueryClient();
  const { data: pins = [], isLoading } = useQuery<StaffPin[]>({
    queryKey: ['staff-pins'],
    queryFn: () => api.get('/api/staff-pins').then(r => r.data),
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffPin | null>(null);
  const [form, setForm] = useState({ name: '', role: 'SECURITY' as 'SECURITY' | 'RECEIVING', pin: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  function openAdd() { setEditing(null); setForm({ name: '', role: 'SECURITY', pin: '' }); setErr(''); setShowForm(true); }
  function openEdit(p: StaffPin) { setEditing(p); setForm({ name: p.name, role: p.role, pin: '' }); setErr(''); setShowForm(true); }

  async function save() {
    if (!form.name.trim()) { setErr('Vui lòng nhập tên nhân viên'); return; }
    if (!editing && !form.pin.match(/^\d{4}$/)) { setErr('PIN phải là 4 chữ số'); return; }
    if (form.pin && !form.pin.match(/^\d{4}$/)) { setErr('PIN phải là 4 chữ số'); return; }
    setSaving(true); setErr('');
    try {
      const payload: Record<string, unknown> = { name: form.name, role: form.role };
      if (form.pin) payload.pin = form.pin;
      if (editing) { await api.patch(`/api/staff-pins/${editing.id}`, payload); }
      else         { await api.post('/api/staff-pins', payload); }
      queryClient.invalidateQueries({ queryKey: ['staff-pins'] });
      setShowForm(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Lỗi lưu dữ liệu');
    } finally { setSaving(false); }
  }

  async function toggleActive(p: StaffPin) {
    await api.patch(`/api/staff-pins/${p.id}`, { active: !p.active });
    queryClient.invalidateQueries({ queryKey: ['staff-pins'] });
  }

  async function remove(p: StaffPin) {
    if (!confirm(`Xóa nhân viên "${p.name}"?`)) return;
    await api.delete(`/api/staff-pins/${p.id}`);
    queryClient.invalidateQueries({ queryKey: ['staff-pins'] });
  }

  const byRole = (role: 'SECURITY' | 'RECEIVING') => pins.filter(p => p.role === role);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-thiso-800">Quản lý nhân viên & mã PIN</h2>
          <p className="text-xs text-thiso-400 mt-0.5">
            Nhân viên dùng PIN 4 số để xác nhận hành động khi scan QR — không cần đăng nhập hệ thống
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700 transition-colors">
          + Thêm
        </button>
      </div>

      {/* Explanation card */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-800 space-y-1.5">
        <p className="font-semibold">Cách hoạt động</p>
        <p>🔐 <strong>Bảo vệ</strong> scan QR tài xế → nhập mã PIN → xác nhận check-in</p>
        <p>📦 <strong>Nhân viên nhận hàng</strong> scan QR → nhập mã PIN → xác nhận bắt đầu / hoàn thành nhận hàng</p>
        <p className="text-sky-600 text-xs">Mỗi nhân viên có PIN riêng — hệ thống ghi nhận ai thực hiện hành động</p>
      </div>

      {isLoading && <p className="text-thiso-400 text-sm">Đang tải...</p>}

      {/* Lists by role */}
      {(['SECURITY', 'RECEIVING'] as const).map(role => {
        const cfg = ROLE_CONFIG[role];
        const list = byRole(role);
        return (
          <div key={role} className={`rounded-2xl border ${cfg.border} overflow-hidden`}>
            <div className={`px-4 py-3 ${cfg.bg} flex items-center gap-2`}>
              <span className="text-lg">{cfg.icon}</span>
              <span className={`font-bold text-sm ${cfg.text}`}>{cfg.label}</span>
              <span className={`ml-auto text-xs font-semibold ${cfg.text} opacity-60`}>{list.length} nhân viên</span>
            </div>
            {list.length === 0 ? (
              <div className="px-4 py-6 text-center text-thiso-300 text-sm">Chưa có nhân viên</div>
            ) : (
              <div className="divide-y divide-thiso-50 bg-white">
                {list.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${!p.active ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-thiso-800 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-thiso-400">
                          {showPins[p.id] ? p.pin : '••••'}
                        </span>
                        <button
                          onClick={() => setShowPins(v => ({ ...v, [p.id]: !v[p.id] }))}
                          className="text-[10px] text-thiso-300 hover:text-thiso-500"
                        >
                          {showPins[p.id] ? 'ẩn' : 'xem'}
                        </button>
                        {!p.active && <span className="text-[10px] bg-red-100 text-red-500 px-1.5 rounded-full">Vô hiệu</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => openEdit(p)} className="text-xs px-2.5 py-1 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500">
                        Sửa
                      </button>
                      <button onClick={() => toggleActive(p)} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${p.active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {p.active ? 'Khóa' : 'Mở'}
                      </button>
                      <button onClick={() => remove(p)} className="text-xs px-2 py-1 rounded-lg text-red-400 hover:bg-red-50 transition-colors">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
            <h3 className="font-bold text-thiso-800">{editing ? 'Sửa nhân viên' : 'Thêm nhân viên'}</h3>
            <div>
              <label className="text-xs text-thiso-500">Họ tên</label>
              <input className="input py-2.5 mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nguyễn Văn A" style={{ fontSize: '16px' }} />
            </div>
            <div>
              <label className="text-xs text-thiso-500">Vai trò</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(['SECURITY', 'RECEIVING'] as const).map(r => {
                  const c = ROLE_CONFIG[r];
                  return (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                      className={`p-3 rounded-xl border-2 text-center transition-colors ${form.role === r ? `${c.bg} ${c.border} ${c.text}` : 'border-thiso-200 text-thiso-500'}`}>
                      <div className="text-xl mb-1">{c.icon}</div>
                      <div className="text-xs font-semibold leading-tight">{c.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-thiso-500">
                PIN 4 chữ số {editing && <span className="text-thiso-300">(để trống = giữ nguyên)</span>}
              </label>
              <input
                className="input py-2.5 mt-1 font-mono tracking-[0.4em] text-center text-lg"
                type="tel" inputMode="numeric" maxLength={4}
                value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                placeholder="••••" style={{ fontSize: '22px' }}
              />
            </div>
            {err && <p className="text-sm text-red-500 font-medium">⚠ {err}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-thiso-200 rounded-xl text-sm text-thiso-500">Hủy</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── User Management Panel ───────────────────────────────────────────────────

interface SystemUser {
  id: string; name: string; email: string;
  role: string; unit: string | null; department: string | null;
  isActive: boolean; createdAt: string;
}

const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  ADMIN:     { label: 'Quản trị viên', color: 'bg-red-100 text-red-700',    icon: '👑' },
  RECEIVING: { label: 'Nhận hàng',     color: 'bg-sky-100 text-sky-700',    icon: '📦' },
  SECURITY:  { label: 'Bảo vệ',        color: 'bg-amber-100 text-amber-700',icon: '🔐' },
  VENDOR:    { label: 'Nhà CC',        color: 'bg-thiso-100 text-thiso-600',  icon: '🏭' },
};
const UNIT_META_U: Record<string, string> = {
  EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function UserModal({
  user, onClose, onSaved, currentUserId,
}: {
  user?: SystemUser | null;
  onClose: () => void;
  onSaved: () => void;
  currentUserId: string;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name:       user?.name       ?? '',
    email:      user?.email      ?? '',
    password:   '',
    role:       user?.role       ?? 'RECEIVING',
    unit:       user?.unit       ?? '',
    department: user?.department ?? '',
    isActive:   user?.isActive   ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        name:       form.name,
        role:       form.role,
        unit:       form.unit  || null,
        department: form.department || null,
        isActive:   form.isActive,
        ...(isEdit ? {} : { email: form.email, password: form.password }),
      };
      if (isEdit) {
        await api.patch(`/api/users/${user!.id}`, payload);
      } else {
        await api.post('/api/users', payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  const isSelf = user?.id === currentUserId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between">
          <h3 className="font-bold text-thiso-800">{isEdit ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}</h3>
          <button onClick={onClose} className="text-thiso-400 hover:text-thiso-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Họ tên *</label>
            <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nguyễn Văn A" />
          </div>

          {/* Email — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Email *</label>
              <input className="input w-full" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="user@mall.com" />
            </div>
          )}

          {/* Password — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Mật khẩu * (tối thiểu 6 ký tự)</label>
              <input className="input w-full font-mono" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} placeholder="••••••" />
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Vai trò *</label>
            <select
              className="input w-full"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              disabled={isSelf}
            >
              {Object.entries(ROLE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            {isSelf && <p className="text-[11px] text-thiso-400 mt-1">Không thể thay đổi vai trò của tài khoản đang đăng nhập</p>}
          </div>

          {/* Unit */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Đơn vị</label>
            <select className="input w-full" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
              <option value="">— Tất cả đơn vị —</option>
              <option value="EMART">🏬 Emart</option>
              <option value="THISKYHALL">🏢 Thiskyhall</option>
              <option value="TENANT">🏪 Mall (Khách thuê)</option>
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Bộ phận / Ca làm việc</label>
            <input className="input w-full" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="vd: Nhận hàng ca sáng, Bảo vệ cổng B..." maxLength={100} />
          </div>

          {/* isActive — only on edit, not self */}
          {isEdit && !isSelf && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => set('isActive', !form.isActive)}
                className={`relative w-10 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-thiso-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-thiso-700">
                {form.isActive ? 'Tài khoản đang hoạt động' : 'Tài khoản bị vô hiệu'}
              </span>
            </label>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-sm text-red-700">⚠ {error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  function genRandom() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setPassword(pw); setConfirm(pw); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(`/api/users/${user.id}/reset-password`, { password });
      setDone(true);
    } catch {
      setError('Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between">
          <h3 className="font-bold text-thiso-800">Đặt lại mật khẩu</h3>
          <button onClick={onClose} className="text-thiso-400 hover:text-thiso-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-green-700">Mật khẩu đã được đặt lại</p>
              <p className="text-sm text-thiso-500 mt-1">Thông báo mật khẩu mới cho người dùng: <strong className="font-mono">{password}</strong></p>
              <button className="mt-5 btn-primary w-full" onClick={onClose}>Đóng</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-thiso-600">Đặt mật khẩu mới cho <strong>{user.name}</strong></p>
              <div>
                <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Mật khẩu mới</label>
                <div className="flex gap-2">
                  <input className="input flex-1 font-mono" type="text" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} required minLength={6} placeholder="Nhập hoặc tạo ngẫu nhiên" />
                  <button type="button" onClick={genRandom} className="btn-secondary text-xs px-3 whitespace-nowrap">🎲 Ngẫu nhiên</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Xác nhận mật khẩu</label>
                <input className="input w-full font-mono" type="text" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} required />
              </div>
              {error && <p className="text-sm text-red-600">⚠ {error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? '...' : 'Đặt lại'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function UserPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [modal, setModal]         = useState<'create' | 'edit' | 'reset' | null>(null);
  const [selected, setSelected]   = useState<SystemUser | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [search, setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const { data: users = [], isLoading } = useQuery<SystemUser[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/api/users')).data,
  });

  function refresh() { qc.invalidateQueries({ queryKey: ['users'] }); setModal(null); setSelected(null); }

  async function handleDelete(id: string) {
    try {
      const r = await api.delete(`/api/users/${id}`);
      setDeleteMsg(r.data.deleted ? 'Đã xóa tài khoản' : 'Đã vô hiệu hóa tài khoản (có lịch sử)');
      refresh();
    } catch (err: unknown) {
      setDeleteMsg((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi');
    } finally {
      setDeleteId(null);
      setTimeout(() => setDeleteMsg(''), 4000);
    }
  }

  const filtered = users.filter((u) => {
    if (!showInactive && !u.isActive) return false;
    if (filterRole && u.role !== filterRole) return false;
    if (filterUnit && u.unit !== filterUnit) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {modal === 'create' && (
        <UserModal onClose={() => setModal(null)} onSaved={refresh} currentUserId={currentUserId} />
      )}
      {modal === 'edit' && selected && (
        <UserModal user={selected} onClose={() => { setModal(null); setSelected(null); }} onSaved={refresh} currentUserId={currentUserId} />
      )}
      {modal === 'reset' && selected && (
        <ResetPasswordModal user={selected} onClose={() => { setModal(null); setSelected(null); }} />
      )}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-thiso-800 mb-2">Xóa tài khoản?</h3>
            <p className="text-sm text-thiso-500 mb-5">Nếu tài khoản đã có lịch sử, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn-danger flex-1" onClick={() => handleDelete(deleteId)}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-thiso-400 text-sm pointer-events-none">🔍</span>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-thiso-200 rounded-xl bg-white focus:outline-none focus:border-sky-400"
            placeholder="Tìm tên, email, bộ phận..."
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm py-2 min-w-[140px]" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className="input text-sm py-2 min-w-[140px]" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
          <option value="">Tất cả đơn vị</option>
          <option value="EMART">🏬 Emart</option>
          <option value="THISKYHALL">🏢 Thiskyhall</option>
          <option value="TENANT">🏪 Mall</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-thiso-500 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Hiện TK vô hiệu
        </label>
        <button className="btn-primary ml-auto" onClick={() => setModal('create')}>+ Tạo tài khoản</button>
      </div>

      {deleteMsg && (
        <div className="mb-3 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700">{deleteMsg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Object.entries(ROLE_META).map(([role, meta]) => {
          const cnt = users.filter((u) => u.role === role && u.isActive).length;
          return (
            <div key={role} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cnt > 0 ? 'bg-white border-thiso-100' : 'bg-thiso-50 border-thiso-100 opacity-60'}`}>
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <div className="text-xl font-black text-thiso-800 leading-none">{cnt}</div>
                <div className="text-xs text-thiso-500 mt-0.5">{meta.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                <th className="px-4 py-3">Người dùng</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Đơn vị</th>
                <th className="px-4 py-3">Bộ phận</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-thiso-400">Không có người dùng nào</td></tr>
              )}
              {filtered.map((u) => {
                const rm = ROLE_META[u.role] ?? ROLE_META.VENDOR;
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={`border-b border-thiso-50 last:border-0 transition-colors ${!u.isActive ? 'opacity-50 bg-thiso-50/50' : 'hover:bg-thiso-50/60'}`}>
                    {/* Avatar + name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: u.isActive ? '#1C3A5C' : '#9CA3AF' }}
                        >
                          {initials(u.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-thiso-800 leading-none">
                            {u.name}
                            {isSelf && <span className="ml-1.5 text-[10px] text-sky-500 font-bold">(bạn)</span>}
                          </div>
                          <div className="text-[10px] text-thiso-400 mt-0.5">
                            Tạo {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-thiso-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${rm.color}`}>
                        {rm.icon} {rm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-thiso-600">
                      {u.unit ? UNIT_META_U[u.unit] : <span className="text-thiso-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-thiso-600">
                      {u.department ?? <span className="text-thiso-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.isActive ? '✓ Hoạt động' : '✗ Vô hiệu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        <button
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-thiso-200 text-thiso-600 hover:bg-thiso-50 transition-colors"
                          onClick={() => { setSelected(u); setModal('edit'); }}
                        >✏ Sửa</button>
                        <button
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors"
                          onClick={() => { setSelected(u); setModal('reset'); }}
                        >🔑 Mật khẩu</button>
                        {!isSelf && (
                          <button
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => setDeleteId(u.id)}
                          >{u.isActive ? 'Vô hiệu' : 'Xóa'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-thiso-400">* Tài khoản có lịch sử sử dụng sẽ bị vô hiệu hóa thay vì xóa hoàn toàn.</p>
    </div>
  );
}

// ─── AW Vendor Panel ──────────────────────────────────────────────────────────

function AWVendorModal({
  vendor, defaultUnit, onClose, onSaved,
}: {
  vendor: AutoWarehouseVendor | null;
  defaultUnit: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!vendor;
  const [form, setFormState] = useState({
    unit: vendor?.unit ?? (defaultUnit as AutoWarehouseVendor['unit']),
    vendorCode: vendor?.vendorCode ?? '',
    vendorName: vendor?.vendorName ?? '',
    active: vendor?.active ?? true,
    note: vendor?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(key: string, val: string | boolean) {
    setFormState(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await api.patch(`/api/aw-vendors/${vendor!.id}`, {
          vendorName: form.vendorName, active: form.active, note: form.note || null,
        });
      } else {
        await api.post('/api/aw-vendors', {
          unit: form.unit, vendorCode: form.vendorCode,
          vendorName: form.vendorName, active: form.active, note: form.note || undefined,
        });
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-thiso-800 mb-5">
          {isEdit ? 'Sửa nhà cung cấp' : 'Thêm NCC kho tự động'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Đơn vị *</label>
            <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)} disabled={isEdit}>
              <option value="EMART">Emart</option>
              <option value="THISKYHALL">Thiskyhall</option>
              <option value="TENANT">Mall (Khách thuê)</option>
            </select>
          </div>
          <div>
            <label className="label">Mã NCC *</label>
            <input
              className="input font-mono"
              value={form.vendorCode}
              onChange={e => set('vendorCode', e.target.value.toUpperCase())}
              placeholder="VD: SUP001, NCCABC"
              disabled={isEdit}
              required
            />
            {!isEdit && <p className="text-[11px] text-thiso-400 mt-1">Tài xế nhập mã này trong form đăng ký để xác nhận vào kho tự động</p>}
          </div>
          <div>
            <label className="label">Tên nhà cung cấp *</label>
            <input className="input" value={form.vendorName} onChange={e => set('vendorName', e.target.value)} placeholder="Công ty TNHH ABC" required />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="Ghi chú thêm nếu có..." />
          </div>
          <label className="flex items-center gap-3 p-3 bg-thiso-50 rounded-xl cursor-pointer">
            <div
              onClick={() => set('active', !form.active)}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${form.active ? 'bg-sky-500' : 'bg-thiso-300'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-medium text-thiso-700">{form.active ? 'Đang hoạt động' : 'Vô hiệu hóa'}</span>
          </label>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm NCC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AWVendorPanel() {
  const qc = useQueryClient();
  const [unitFilter, setUnitFilter] = useState('EMART');
  const [modal, setModal]           = useState(false);
  const [editItem, setEditItem]     = useState<AutoWarehouseVendor | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [msg, setMsg]               = useState('');

  const { data: vendors = [], isLoading } = useQuery<AutoWarehouseVendor[]>({
    queryKey: ['aw-vendors', unitFilter],
    queryFn: async () => (await api.get('/api/aw-vendors', { params: { unit: unitFilter } })).data,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['aw-vendors'] });
  }

  function showMsg(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  }

  async function toggleActive(v: AutoWarehouseVendor) {
    await api.patch(`/api/aw-vendors/${v.id}`, { active: !v.active });
    refresh();
  }

  async function doDelete(id: string) {
    try {
      await api.delete(`/api/aw-vendors/${id}`);
      setDeleteId(null);
      refresh();
      showMsg('Đã xóa nhà cung cấp.');
    } catch {
      showMsg('Lỗi khi xóa.');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-thiso-500">
          Danh sách NCC được phép vào khu kho tự động. Tài xế nhập mã NCC khi đăng ký để được xếp vào slot kho tự động.
        </p>
        <div className="flex items-center gap-3">
          <select className="input w-auto text-sm" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
            <option value="EMART">Emart</option>
            <option value="THISKYHALL">Thiskyhall</option>
            <option value="TENANT">Mall (Khách thuê)</option>
          </select>
          <button className="btn-primary px-4 py-2" onClick={() => { setEditItem(null); setModal(true); }}>+ Thêm NCC</button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-700 flex items-center justify-between">
          {msg}
          <button onClick={() => setMsg('')} className="text-sky-400 hover:text-sky-600">✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-thiso-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-thiso-100 bg-thiso-50 text-left text-thiso-400 text-xs uppercase">
              <th className="px-4 py-3">Mã NCC</th>
              <th className="px-4 py-3">Tên nhà cung cấp</th>
              <th className="px-4 py-3">Kích hoạt</th>
              <th className="px-4 py-3">Ghi chú</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>}
            {!isLoading && vendors.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-thiso-400">Chưa có NCC nào cho đơn vị này</td></tr>
            )}
            {vendors.map(v => (
              <tr key={v.id} className={`border-b border-thiso-50 last:border-0 hover:bg-thiso-50 ${!v.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono font-bold text-thiso-800">{v.vendorCode}</td>
                <td className="px-4 py-3 text-thiso-700">{v.vendorName}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${v.active ? 'bg-sky-600' : 'bg-thiso-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${v.active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-thiso-400 italic">{v.note || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500"
                      onClick={() => { setEditItem(v); setModal(true); }}
                    >Sửa</button>
                    <button
                      className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-red-400 hover:text-red-600 transition-colors text-thiso-400"
                      onClick={() => setDeleteId(v.id)}
                    >Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <AWVendorModal
          vendor={editItem}
          defaultUnit={unitFilter}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); refresh(); showMsg('Đã lưu thành công.'); }}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-thiso-800 mb-2">Xóa nhà cung cấp?</h3>
            <p className="text-sm text-thiso-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn-danger flex-1" onClick={() => doDelete(deleteId)}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Backoffice ──────────────────────────────────────────────────────────

export default function Backoffice() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'slots' | 'zones' | 'units' | 'brand' | 'staff' | 'users' | 'awvendors'>('slots');
  const [editSlot, setEditSlot] = useState<Slot | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<Slot | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: slots = [], isLoading } = useQuery<Slot[]>({
    queryKey: ['slots', 'all'],
    queryFn: async () => (await api.get('/api/slots/all')).data,
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/api/zones')).data,
  });

  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
    enabled: activeTab === 'units',
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['slots'] });
    queryClient.invalidateQueries({ queryKey: ['slots', 'all'] });
  }

  async function toggleActive(slot: Slot) {
    await api.patch(`/api/slots/${slot.id}`, { isActive: !slot.isActive });
    refresh();
  }

  async function confirmDelete(slot: Slot) {
    try {
      const res = await api.delete(`/api/slots/${slot.id}`);
      setDeleteMsg(res.data.message ?? (res.data.deleted ? 'Đã xóa slot.' : 'Đã vô hiệu hóa slot.'));
      setDeleteConfirm(null);
      refresh();
    } catch {
      setDeleteMsg('Lỗi xóa slot.');
    }
  }

  const filtered = slots.filter((s) => {
    if (!showInactive && !s.isActive) return false;
    if (unitFilter && s.assignedUnit !== unitFilter) return false;
    if (typeFilter && s.vehicleType !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: slots.length,
    active: slots.filter((s) => s.isActive).length,
    trucks: slots.filter((s) => s.vehicleType === 'TRUCK' && s.isActive).length,
    motorbikes: slots.filter((s) => s.vehicleType === 'MOTORBIKE' && s.isActive).length,
    available: slots.filter((s) => s.isActive && s.status === 'AVAILABLE').length,
    occupied: slots.filter((s) => s.isActive && s.status === 'OCCUPIED').length,
  };

  const configMap = Object.fromEntries(unitConfigs.map((c) => [c.unit, c])) as Record<UnitKey, UnitConfig>;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Backoffice — Cấu hình Hệ thống</h1>
          <p className="text-sm text-thiso-400 mt-1">Quản lý slot và cấu hình đơn vị nhận hàng (chỉ Admin)</p>
        </div>
        {activeTab === 'slots' && (
          <button className="btn-primary px-4 py-2" onClick={() => setEditSlot(null)}>+ Thêm Slot mới</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-thiso-200">
        {([['slots', '🚪 Quản lý Slot'], ['zones', '🗺 Quản lý Khu'], ['units', '⚙ Cấu hình Đơn vị'], ['brand', '🎨 Thương hiệu'], ['staff', '👷 Nhân viên'], ['users', '👤 Người dùng'], ['awvendors', '🏭 Kho tự động']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab ? 'bg-white border border-b-white border-thiso-200 text-thiso-800 font-semibold -mb-px' : 'text-thiso-400 hover:text-thiso-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Slot Tab ── */}
      {activeTab === 'slots' && (
        <>
          {editSlot !== undefined && (
            <SlotModal slot={editSlot} zones={zones} onClose={() => setEditSlot(undefined)} onSaved={() => { setEditSlot(undefined); refresh(); }} />
          )}

          {deleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Xóa Slot {deleteConfirm.code}?</h3>
                <p className="text-sm text-gray-600 mb-5">Nếu slot đã có lịch sử sử dụng, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn.</p>
                <div className="flex gap-3">
                  <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Hủy</button>
                  <button className="btn-danger flex-1" onClick={() => confirmDelete(deleteConfirm)}>Xóa / Vô hiệu</button>
                </div>
              </div>
            </div>
          )}

          {deleteMsg && (
            <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-700 flex items-center justify-between">
              {deleteMsg}
              <button onClick={() => setDeleteMsg('')} className="text-sky-400 hover:text-sky-600">✕</button>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Tổng slot', value: stats.total, color: 'bg-thiso-50 border-thiso-100 text-thiso-600' },
              { label: 'Đang hoạt động', value: stats.active, color: 'bg-sky-50 border-sky-200 text-sky-700' },
              { label: '🚛 Xe Tải', value: stats.trucks, color: 'bg-emart-50 border-emart-200 text-emart-700' },
              { label: '🛵 Xe Máy', value: stats.motorbikes, color: 'bg-sky-50 border-sky-100 text-sky-600' },
              { label: 'Trống', value: stats.available, color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Đang dùng', value: stats.occupied, color: 'bg-red-50 border-red-200 text-red-700' },
            ].map((s) => (
              <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs mt-0.5 font-medium">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <select className="input w-auto text-sm" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">Tất cả đơn vị</option>
              <option value="EMART">Emart</option>
              <option value="THISKYHALL">Thiskyhall</option>
              <option value="TENANT">Tenant</option>
            </select>
            <select className="input w-auto text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tất cả loại xe</option>
              <option value="TRUCK">🚛 Xe Tải</option>
              <option value="MOTORBIKE">🛵 Xe Máy</option>
              <option value="OTHER">🚗 Khác</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" />
              Hiện slot vô hiệu hóa
            </label>
            <span className="text-sm text-gray-400 ml-auto">{filtered.length} slot</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-thiso-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-thiso-100 bg-thiso-50 text-left text-thiso-400 text-xs uppercase">
                  <th className="px-4 py-3">Mã Slot</th>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Khu</th>
                  <th className="px-4 py-3">Đơn vị</th>
                  <th className="px-4 py-3">Loại xe</th>
                  <th className="px-4 py-3">Hàng nhận</th>
                  <th className="px-4 py-3">Sức chứa</th>
                  <th className="px-4 py-3">Auto</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Kích hoạt</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={11} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>}
                {!isLoading && filtered.length === 0 && <tr><td colSpan={11} className="py-12 text-center text-thiso-400">Không có slot nào</td></tr>}
                {filtered.map((slot) => (
                  <tr key={slot.id} className={`border-b border-thiso-50 last:border-0 hover:bg-thiso-50 ${!slot.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3"><span className="font-bold font-mono text-thiso-800">{slot.code}</span></td>
                    <td className="px-4 py-3 text-thiso-700">{slot.name}</td>
                    <td className="px-4 py-3">
                      {slot.zone
                        ? <span className="text-xs font-bold text-thiso-600 bg-thiso-100 px-2 py-0.5 rounded font-mono">{slot.zone.code}</span>
                        : <span className="text-xs text-thiso-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-thiso-500 text-xs">{UNIT_LABELS[slot.assignedUnit]}</td>
                    <td className="px-4 py-3"><span className="text-sm text-thiso-600">{VEHICLE_LABEL[slot.vehicleType] ?? slot.vehicleType}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {slot.autoWarehouseOnly && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">🏭 AW Only</span>
                        )}
                        {!slot.autoWarehouseOnly && slot.acceptedGoods.length === 0
                          ? <span className="text-xs text-thiso-300 italic">Tất cả</span>
                          : !slot.autoWarehouseOnly && slot.acceptedGoods.map((g) => (
                              <span key={g} className="text-xs px-1.5 py-0.5 rounded bg-thiso-100 text-thiso-600 font-medium">{GOODS_LABELS[g as GoodsType]}</span>
                            ))
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-gray-700">{slot.maxCapacity ?? 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${slot.autoAssign ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                        {slot.autoAssign ? 'Bật' : 'Tắt'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[slot.status]}`}>
                        {STATUS_LABEL[slot.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(slot)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${slot.isActive ? 'bg-sky-600' : 'bg-thiso-200'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${slot.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500" onClick={() => setEditSlot(slot)}>Sửa</button>
                        <button className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-red-400 hover:text-red-600 transition-colors text-thiso-400" onClick={() => { setDeleteConfirm(slot); setDeleteMsg(''); }}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-thiso-400">* Slot có lịch sử giao hàng sẽ bị vô hiệu hóa thay vì xóa hoàn toàn để giữ dữ liệu lịch sử.</p>
        </>
      )}

      {/* ── Zone Tab ── */}
      {activeTab === 'zones' && <ZonePanel />}

      {/* ── Unit Config Tab ── */}
      {activeTab === 'units' && (
        <div className="space-y-5">
          <p className="text-sm text-thiso-400">
            Cấu hình khung giờ nhận hàng, slot booking và API tích hợp cho từng đơn vị.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {(['EMART', 'THISKYHALL', 'TENANT'] as UnitKey[]).map((unit) => (
              <UnitConfigCard
                key={unit}
                unit={unit}
                config={configMap[unit]}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ['unit-configs'] })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Brand Tab ── */}
      {activeTab === 'brand' && <BrandPanel />}

      {/* ── Staff PIN Tab ── */}
      {activeTab === 'staff' && <StaffPinPanel />}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && <UserPanel currentUserId={currentUser?.id ?? ''} />}

      {/* ── AW Vendor Tab ── */}
      {activeTab === 'awvendors' && <AWVendorPanel />}
    </div>
  );
}
