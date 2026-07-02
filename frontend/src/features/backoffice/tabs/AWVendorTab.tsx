import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import type { AutoWarehouseVendor } from '../../../lib/types';

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

export default function AWVendorTab() {
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

