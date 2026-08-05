import { FormEvent, useState } from 'react';
import type { AutoWarehouseVendor, UnitConfig } from '../../../lib/types';
import { unitPresentation } from '../../../lib/unitPresentation';
import { superadminApi } from '../api';
import { EmptyState, StatusBadge, TableShell } from './shared';

interface VendorFormState {
  unitConfigId: string;
  vendorCode: string;
  vendorName: string;
  active: boolean;
  note: string;
}

function formFromVendor(vendor?: AutoWarehouseVendor | null, units: UnitConfig[] = []): VendorFormState {
  return {
    unitConfigId: vendor?.unitConfigId ?? units[0]?.id ?? '',
    vendorCode: vendor?.vendorCode ?? '',
    vendorName: vendor?.vendorName ?? '',
    active: vendor?.active ?? true,
    note: vendor?.note ?? '',
  };
}

function VendorForm({
  units,
  editing,
  onDone,
  onCancel,
}: {
  units: UnitConfig[];
  editing?: AutoWarehouseVendor | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<VendorFormState>(() => formFromVendor(editing, units));
  const [error, setError] = useState('');
  const isEdit = Boolean(editing);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await superadminApi.updateVendor(editing.id, {
          vendorCode: form.vendorCode,
          vendorName: form.vendorName,
          active: form.active,
          note: form.note || null,
        });
      } else {
        await superadminApi.createVendor({
          unitConfigId: form.unitConfigId,
          vendorCode: form.vendorCode,
          vendorName: form.vendorName,
          active: form.active,
          note: form.note || null,
        });
      }
      onDone();
      if (!isEdit) setForm(formFromVendor(undefined, units));
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được vendor.');
    }
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
      <label className="grid gap-1 md:col-span-2">
        <span className="label">Đơn vị</span>
        <select className="input" value={form.unitConfigId} onChange={(e) => setForm({ ...form, unitConfigId: e.target.value })} disabled={isEdit} required>
          {units.map((unit) => {
            const unitInfo = unitPresentation(unit.unit, unit);
            return <option key={unit.id} value={unit.id}>{unitInfo.shortName} - {unitInfo.label}</option>;
          })}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Vendor code</span>
        <input className="input" value={form.vendorCode} onChange={(e) => setForm({ ...form, vendorCode: e.target.value })} required />
      </label>
      <label className="grid gap-1 md:col-span-2">
        <span className="label">Vendor name</span>
        <input className="input" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} required />
      </label>
      <label className="flex items-center gap-2 text-sm text-thiso-700">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Active
      </label>
      <label className="grid gap-1 md:col-span-5">
        <span className="label">Ghi chú</span>
        <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Tùy chọn" />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={units.length === 0}>{isEdit ? 'Lưu' : 'Tạo vendor'}</button>
        {isEdit && <button className="btn btn-secondary" type="button" onClick={onCancel}>Hủy</button>}
      </div>
      {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
    </form>
  );
}

export default function AwVendorsTab({
  vendors,
  units,
  onRefresh,
}: {
  vendors: AutoWarehouseVendor[];
  units: UnitConfig[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<AutoWarehouseVendor | null>(null);
  const [error, setError] = useState('');

  async function remove(vendor: AutoWarehouseVendor) {
    if (!window.confirm('Xóa vendor kho tự động này?')) return;
    setError('');
    try {
      await superadminApi.deleteVendor(vendor.id);
      if (editing?.id === vendor.id) setEditing(null);
      onRefresh();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không xóa được vendor.');
    }
  }

  return (
    <section className="space-y-4">
      <div className="card">
        <h2 className="section-heading mb-4">{editing ? 'Chỉnh vendor kho tự động' : 'Tạo vendor kho tự động'}</h2>
        <VendorForm
          key={editing?.id ?? 'create'}
          units={units}
          editing={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {vendors.length === 0 ? (
        <EmptyState />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-thiso-50 text-left text-thiso-500">
              <tr>
                <th className="p-3 font-medium">Đơn vị</th>
                <th className="p-3 font-medium">Vendor code</th>
                <th className="p-3 font-medium">Vendor name</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Ghi chú</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((item) => {
                const unit = item.unitConfig ?? units.find((config) => config.id === item.unitConfigId);
                const unitInfo = unitPresentation(item.unit, unit);
                return (
                  <tr key={item.id} className="border-t border-thiso-100">
                    <td className="p-3">
                      <div className="font-medium text-thiso-800">{unitInfo.shortName}</div>
                      <div className="text-xs text-thiso-400">{unitInfo.label}</div>
                    </td>
                    <td className="p-3 font-mono">{item.vendorCode}</td>
                    <td className="p-3">{item.vendorName}</td>
                    <td className="p-3"><StatusBadge active={item.active} /></td>
                    <td className="p-3">{item.note || '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(item)}>Edit</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => remove(item)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </section>
  );
}
