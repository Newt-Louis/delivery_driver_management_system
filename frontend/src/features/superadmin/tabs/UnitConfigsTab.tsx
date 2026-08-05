import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { UnitConfig } from '../../../lib/types';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { EmptyState, StatusBadge, TableShell } from './shared';

type UnitFormState = {
  businessLocationId: string;
  unit: string;
  displayName: string;
  shortName: string;
  description: string;
  icon: string;
  logoUrl: string;
  primaryColor: string;
  isActive: boolean;
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
};

function formFromUnit(unit: UnitConfig | null, businessLocationId: string): UnitFormState {
  return {
    businessLocationId: unit?.businessLocationId || businessLocationId,
    unit: unit?.unit || '',
    displayName: unit?.displayName || '',
    shortName: unit?.shortName || '',
    description: unit?.description || '',
    icon: unit?.icon || '',
    logoUrl: unit?.logoUrl || '',
    primaryColor: unit?.primaryColor || '#1C1C1C',
    isActive: unit?.isActive ?? true,
    freshFoodEnabled: unit?.freshFoodEnabled ?? true,
    generalGoodsEnabled: unit?.generalGoodsEnabled ?? true,
    thiCongEnabled: unit?.thiCongEnabled ?? true,
    sundayFreshFoodOnly: unit?.sundayFreshFoodOnly ?? false,
    truckSlotMinutes: unit?.truckSlotMinutes ?? 30,
    motorbikeSlotMinutes: unit?.motorbikeSlotMinutes ?? 15,
    truckMaxPerSlot: unit?.truckMaxPerSlot ?? 1,
    motorbikeMaxPerSlot: unit?.motorbikeMaxPerSlot ?? 3,
    vendorApiUrl: unit?.vendorApiUrl || '',
    vendorApiKey: '',
    poApiUrl: unit?.poApiUrl || '',
    poApiKey: '',
  };
}

function unitPayload(form: UnitFormState) {
  return {
    ...form,
    unit: form.unit.toUpperCase().trim(),
    icon: form.icon || null,
    logoUrl: form.logoUrl || null,
    vendorApiUrl: form.vendorApiUrl || null,
    vendorApiKey: form.vendorApiKey || null,
    poApiUrl: form.poApiUrl || null,
    poApiKey: form.poApiKey || null,
    truckSlotMinutes: Number(form.truckSlotMinutes),
    motorbikeSlotMinutes: Number(form.motorbikeSlotMinutes),
    truckMaxPerSlot: Number(form.truckMaxPerSlot),
    motorbikeMaxPerSlot: Number(form.motorbikeMaxPerSlot),
  };
}

function UnitForm({
  locations,
  businessLocationId,
  onBusinessLocationChange,
  onDone,
}: {
  locations: BusinessLocation[];
  businessLocationId: string;
  onBusinessLocationChange: (id: string) => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<UnitFormState>(() => formFromUnit(null, businessLocationId || locations[0]?.id || ''));
  const [error, setError] = useState('');

  useEffect(() => {
    const nextId = businessLocationId || locations[0]?.id || '';
    if (nextId && form.businessLocationId !== nextId) {
      setForm((current) => ({ ...current, businessLocationId: nextId }));
    }
    if (nextId && businessLocationId !== nextId) {
      onBusinessLocationChange(nextId);
    }
  }, [businessLocationId, form.businessLocationId, locations, onBusinessLocationChange]);

  function setBusinessLocation(id: string) {
    setForm((current) => ({ ...current, businessLocationId: id }));
    onBusinessLocationChange(id);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await superadminApi.createUnit(unitPayload(form));
      onDone();
      setForm({ ...form, unit: '', displayName: '', shortName: '', description: '', icon: '', logoUrl: '', vendorApiKey: '', poApiKey: '' });
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không tạo được unit.');
    }
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-8 gap-3 items-end">
      <select className="input md:col-span-2" value={form.businessLocationId} onChange={(e) => setBusinessLocation(e.target.value)} required>
        {locations.map((location) => <option key={location.id} value={location.id}>{location.code} - {location.locationName}</option>)}
      </select>
      <input className="input" placeholder="UNIT_CODE" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
      <input className="input md:col-span-2" placeholder="Tên hiển thị" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
      <input className="input" placeholder="Tên ngắn" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
      <input className="input" placeholder="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
      <button className="btn btn-primary" type="submit">Tạo unit</button>
      {error && <div className="md:col-span-8 text-sm text-red-600">{error}</div>}
    </form>
  );
}

function UnitEditModal({
  unit,
  locations,
  onClose,
  onDone,
}: {
  unit: UnitConfig;
  locations: BusinessLocation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<UnitFormState>(() => formFromUnit(unit, unit.businessLocationId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof UnitFormState>(key: K, value: UnitFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { businessLocationId: _businessLocationId, ...payload } = unitPayload(form);
      void _businessLocationId;
      await superadminApi.updateUnit(unit.id, payload);
      onDone();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được unit.');
    } finally {
      setSaving(false);
    }
  }

  const boolFields: Array<[keyof UnitFormState, string]> = [
    ['isActive', 'Đang hoạt động'],
    ['freshFoodEnabled', 'Nhận hàng tươi sống'],
    ['generalGoodsEnabled', 'Nhận hàng thường'],
    ['thiCongEnabled', 'Nhận hàng thi công'],
    ['sundayFreshFoodOnly', 'Chủ nhật chỉ nhận hàng tươi sống'],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="font-bold text-thiso-800">Chỉnh sửa unit</h3>
            <p className="text-xs text-thiso-400 font-mono">{unit.id}</p>
          </div>
          <button className="text-thiso-400 hover:text-thiso-700 text-xl" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="label">Location</label>
              <select className="input" value={form.businessLocationId} disabled>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.code} - {location.locationName}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit code</label>
              <input className="input font-mono" value={form.unit} onChange={(e) => set('unit', e.target.value.toUpperCase())} required />
            </div>
            <div>
              <label className="label">Tên hiển thị</label>
              <input className="input" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} required />
            </div>
            <div>
              <label className="label">Tên ngắn</label>
              <input className="input" value={form.shortName} onChange={(e) => set('shortName', e.target.value)} />
            </div>
            <div>
              <label className="label">Icon</label>
              <input className="input" value={form.icon} onChange={(e) => set('icon', e.target.value)} />
            </div>
            <div>
              <label className="label">Màu chính</label>
              <input className="input font-mono" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Logo URL</label>
              <input className="input" value={form.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} />
            </div>
            <div className="md:col-span-4">
              <label className="label">Mô tả</label>
              <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-5 gap-2">
            {boolFields.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-xl border border-thiso-100 bg-thiso-50 px-3 py-2 text-sm text-thiso-700">
                <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked as UnitFormState[typeof key])} />
                {label}
              </label>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="label">Xe tải phút/slot</label>
              <input type="number" className="input" value={form.truckSlotMinutes} onChange={(e) => set('truckSlotMinutes', Number(e.target.value))} min={1} max={1440} />
            </div>
            <div>
              <label className="label">Xe tải tối đa/slot</label>
              <input type="number" className="input" value={form.truckMaxPerSlot} onChange={(e) => set('truckMaxPerSlot', Number(e.target.value))} min={1} max={100} />
            </div>
            <div>
              <label className="label">Xe máy phút/slot</label>
              <input type="number" className="input" value={form.motorbikeSlotMinutes} onChange={(e) => set('motorbikeSlotMinutes', Number(e.target.value))} min={1} max={1440} />
            </div>
            <div>
              <label className="label">Xe máy tối đa/slot</label>
              <input type="number" className="input" value={form.motorbikeMaxPerSlot} onChange={(e) => set('motorbikeMaxPerSlot', Number(e.target.value))} min={1} max={100} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Vendor API URL</label>
              <input className="input" value={form.vendorApiUrl} onChange={(e) => set('vendorApiUrl', e.target.value)} />
            </div>
            <div>
              <label className="label">Vendor API key</label>
              <input className="input" type="password" value={form.vendorApiKey} onChange={(e) => set('vendorApiKey', e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>
            <div>
              <label className="label">PO API URL</label>
              <input className="input" value={form.poApiUrl} onChange={(e) => set('poApiUrl', e.target.value)} />
            </div>
            <div>
              <label className="label">PO API key</label>
              <input className="input" type="password" value={form.poApiKey} onChange={(e) => set('poApiKey', e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UnitConfigsTab({
  locations,
  units,
  businessLocationId,
  onBusinessLocationChange,
  onRefresh,
}: {
  locations: BusinessLocation[];
  units: UnitConfig[];
  businessLocationId: string;
  onBusinessLocationChange: (id: string) => void;
  onRefresh: () => void;
}) {
  const [editUnit, setEditUnit] = useState<UnitConfig | null>(null);
  const visibleUnits = useMemo(
    () => units.filter((unit) => !businessLocationId || unit.businessLocationId === businessLocationId),
    [businessLocationId, units],
  );

  async function removeUnit(id: string) {
    if (!confirm('Deactivate hoặc xóa unit này?')) return;
    await superadminApi.deleteUnit(id);
    onRefresh();
  }

  return (
    <section className="space-y-4">
      <UnitForm
        locations={locations}
        businessLocationId={businessLocationId}
        onBusinessLocationChange={onBusinessLocationChange}
        onDone={onRefresh}
      />

      {editUnit && (
        <UnitEditModal
          unit={editUnit}
          locations={locations}
          onClose={() => setEditUnit(null)}
          onDone={() => { setEditUnit(null); onRefresh(); }}
        />
      )}

      {visibleUnits.length === 0 ? (
        <EmptyState text="Khu vực kinh doanh đang chưa có đơn vị nào" />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-thiso-50 text-thiso-500">
              <tr><th className="text-left p-3">Unit</th><th className="text-left p-3">Tên</th><th className="text-left p-3">Location</th><th className="text-left p-3">Slot policy</th><th className="text-left p-3">Trạng thái</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {visibleUnits.map((unit) => (
                <tr key={unit.id} className="border-t border-thiso-100">
                  <td className="p-3 font-mono">{unit.unit}</td>
                  <td className="p-3">{unit.icon} {unit.displayName}</td>
                  <td className="p-3 font-mono text-xs">{unit.businessLocationId}</td>
                  <td className="p-3 text-thiso-500">Tải {unit.truckSlotMinutes}p/{unit.truckMaxPerSlot} · Máy {unit.motorbikeSlotMinutes}p/{unit.motorbikeMaxPerSlot}</td>
                  <td className="p-3"><StatusBadge active={unit.isActive ?? true} /></td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => setEditUnit(unit)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => removeUnit(unit.id)}>Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </section>
  );
}
