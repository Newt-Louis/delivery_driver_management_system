import { FormEvent, useState } from 'react';
import { superadminApi } from '../api';
import type { BusinessLocation, DeviceItem } from '../types';
import { EmptyState, StatusBadge, TableShell } from './shared';

const DEVICE_TYPES = ['FIXED_DEVICE', 'PDA', 'TABLET', 'TV'];

function DeviceForm({
  locations,
  editing,
  onCancel,
  onDone,
}: {
  locations: BusinessLocation[];
  editing?: DeviceItem | null;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    code: editing?.code ?? '',
    name: editing?.name ?? '',
    businessLocationId: editing?.businessLocationId ?? locations[0]?.id ?? '',
    deviceType: editing?.deviceType ?? 'FIXED_DEVICE',
    deviceSecret: '',
    isActive: editing?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!editing;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await superadminApi.updateDevice(editing.id, {
          name: form.name,
          deviceType: form.deviceType,
          isActive: form.isActive,
          ...(form.deviceSecret ? { deviceSecret: form.deviceSecret } : {}),
        });
      } else {
        await superadminApi.createDevice(form);
      }
      onDone();
      if (!isEdit) setForm({ ...form, code: '', name: '', deviceSecret: '' });
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được thiết bị.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-7 gap-3 items-end">
      <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DEVICE_CODE" disabled={isEdit} required />
      <input className="input md:col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tên thiết bị" required />
      <select className="input" value={form.businessLocationId} onChange={(e) => setForm({ ...form, businessLocationId: e.target.value })} disabled={isEdit} required>
        {locations.map((location) => <option key={location.id} value={location.id}>{location.code} - {location.locationName}</option>)}
      </select>
      <select className="input" value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })}>
        {DEVICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <input className="input" type="password" value={form.deviceSecret} onChange={(e) => setForm({ ...form, deviceSecret: e.target.value })} placeholder={isEdit ? 'Secret mới nếu đổi' : 'Device secret'} required={!isEdit} minLength={isEdit ? undefined : 8} />
      <div className="flex gap-2">
        {isEdit && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
        )}
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : isEdit ? 'Lưu' : 'Tạo'}</button>
      </div>
      {isEdit && (
        <label className="md:col-span-7 flex items-center gap-2 text-sm text-thiso-600">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Thiết bị đang hoạt động
        </label>
      )}
      {error && <div className="md:col-span-7 text-sm text-red-600">{error}</div>}
    </form>
  );
}

export default function DevicesTab({
  devices,
  locations,
  onRefresh,
}: {
  devices: DeviceItem[];
  locations: BusinessLocation[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<DeviceItem | null>(null);

  async function remove(device: DeviceItem) {
    if (!confirm(`Xóa/vô hiệu hóa thiết bị ${device.code}?`)) return;
    await superadminApi.deleteDevice(device.id);
    onRefresh();
  }

  return (
    <section className="space-y-4">
      <DeviceForm locations={locations} editing={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); onRefresh(); }} />
      {devices.length === 0 ? <EmptyState /> : (
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-thiso-50 text-thiso-500">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Tên</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Loại</th>
                <th className="text-left p-3">Last seen</th>
                <th className="text-left p-3">Trạng thái</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="border-t border-thiso-100">
                  <td className="p-3 font-mono">{device.code}</td>
                  <td className="p-3">{device.name}</td>
                  <td className="p-3 font-mono text-xs">{device.businessLocationId}</td>
                  <td className="p-3">{device.deviceType}</td>
                  <td className="p-3 text-thiso-500">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('vi-VN') : '-'}</td>
                  <td className="p-3"><StatusBadge active={device.isActive} /></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => setEditing(device)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => remove(device)}>Delete</button>
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
