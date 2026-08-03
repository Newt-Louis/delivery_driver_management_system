import { FormEvent, useState } from 'react';
import type { UnitConfig } from '../../../lib/types';
import { superadminApi } from '../api';
import { EmptyState, StatusBadge, TableShell } from './shared';

function VendorForm({ units, onDone }: { units: UnitConfig[]; onDone: () => void }) {
  const [form, setForm] = useState({ unitConfigId: units[0]?.id ?? '', vendorCode: '', vendorName: '', active: true, note: '' });
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await superadminApi.createVendor(form);
      onDone();
      setForm({ ...form, vendorCode: '', vendorName: '', note: '' });
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không tạo được vendor.');
    }
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
      <select className="input md:col-span-2" value={form.unitConfigId} onChange={(e) => setForm({ ...form, unitConfigId: e.target.value })} required>
        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit} - {unit.displayName}</option>)}
      </select>
      <input className="input" placeholder="Vendor code" value={form.vendorCode} onChange={(e) => setForm({ ...form, vendorCode: e.target.value })} required />
      <input className="input md:col-span-2" placeholder="Vendor name" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} required />
      <button className="btn btn-primary" type="submit">Tạo vendor</button>
      {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
    </form>
  );
}

export default function AwVendorsTab({ vendors, units, onRefresh }: { vendors: any[]; units: UnitConfig[]; onRefresh: () => void }) {
  return (
    <section className="space-y-4">
      <VendorForm units={units} onDone={onRefresh} />
      {vendors.length === 0 ? (
        <EmptyState />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <tbody>
              {vendors.map((item) => (
                <tr key={item.id} className="border-t border-thiso-100">
                  <td className="p-3">{item.unit}</td><td className="p-3 font-mono">{item.vendorCode}</td><td className="p-3">{item.vendorName}</td><td className="p-3"><StatusBadge active={item.active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </section>
  );
}
