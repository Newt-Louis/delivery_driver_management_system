import { FormEvent, useState } from 'react';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { StatusBadge, TableShell } from './shared';

function LocationForm({ item, onDone }: { item?: BusinessLocation; onDone: () => void }) {
  const [form, setForm] = useState({
    code: item?.code ?? '',
    locationName: item?.locationName ?? '',
    address: item?.address ?? '',
    tagline: item?.tagline ?? '',
    logoUrl: item?.logoUrl ?? '',
    avatarUrl: item?.avatarUrl ?? '',
    isActive: item?.isActive ?? true,
  });
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (item) await superadminApi.updateLocation(item.id, form);
      else await superadminApi.createLocation(form);
      onDone();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được location.');
    }
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
      <input className="input" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      <input className="input md:col-span-2" placeholder="Tên location" value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} required />
      <input className="input md:col-span-2" placeholder="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <label className="flex items-center gap-2 text-sm text-thiso-600">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })} />
        Active
      </label>
      {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
      <button className="btn btn-primary md:col-span-2" type="submit">{item ? 'Lưu location' : 'Tạo location'}</button>
    </form>
  );
}

export default function LocationsTab({ locations, onRefresh }: { locations: BusinessLocation[]; onRefresh: () => void }) {
  async function removeLocation(id: string) {
    if (!confirm('Deactivate hoặc xóa location này?')) return;
    await superadminApi.deleteLocation(id);
    onRefresh();
  }

  return (
    <section className="space-y-4">
      <LocationForm onDone={onRefresh} />
      <TableShell>
        <table className="w-full text-sm">
          <thead className="bg-thiso-50 text-thiso-500">
            <tr><th className="text-left p-3">Code</th><th className="text-left p-3">Tên</th><th className="text-left p-3">Liên kết</th><th className="text-left p-3">Trạng thái</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id} className="border-t border-thiso-100">
                <td className="p-3 font-mono">{location.code}</td>
                <td className="p-3">{location.locationName}</td>
                <td className="p-3 text-thiso-500">{location._count?.unitConfigs ?? 0} units · {location._count?.users ?? 0} users</td>
                <td className="p-3"><StatusBadge active={location.isActive} /></td>
                <td className="p-3 text-right"><button className="btn btn-danger" onClick={() => removeLocation(location.id)}>Deactivate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}
