import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import type { DeliveryTimeWindow, UnitGoodsType, UnitConfig, GoodsType } from '../../../lib/types';
import { GOODS_LABELS, UNIT_ICONS, UNIT_LABELS } from '../constants';
import type { UnitKey } from '../types';

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
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-semibold text-thiso-500">
                  {win.label || 'Khung giờ'}
                </span>
                <span className="shrink-0 whitespace-nowrap rounded-md bg-thiso-50 px-2 py-0.5 font-mono text-xs font-semibold text-thiso-800">
                  {win.startTime} → {win.endTime}
                </span>
              </div>
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


export default function UnitsTab() {
  const queryClient = useQueryClient();
  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });
  const configMap = Object.fromEntries(unitConfigs.map((c) => [c.unit, c])) as Record<UnitKey, UnitConfig>;

  return (
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
  );
}
