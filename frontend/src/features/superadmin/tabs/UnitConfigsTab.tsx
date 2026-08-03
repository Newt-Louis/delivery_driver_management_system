import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { UnitConfig } from '../../../lib/types';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { EmptyState, StatusBadge, TableShell } from './shared';

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
  const [form, setForm] = useState({
    businessLocationId: businessLocationId || locations[0]?.id || '',
    unit: '',
    displayName: '',
    shortName: '',
    icon: '',
    primaryColor: '#1C1C1C',
    isActive: true,
    freshFoodEnabled: true,
    generalGoodsEnabled: true,
    thiCongEnabled: true,
    sundayFreshFoodOnly: false,
    truckSlotMinutes: 30,
    motorbikeSlotMinutes: 15,
    truckMaxPerSlot: 1,
    motorbikeMaxPerSlot: 3,
  });
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
      await superadminApi.createUnit(form);
      onDone();
      setForm({ ...form, unit: '', displayName: '', shortName: '' });
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
                  <td className="p-3 text-right"><button className="btn btn-danger" onClick={() => removeUnit(unit.id)}>Deactivate</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </section>
  );
}
