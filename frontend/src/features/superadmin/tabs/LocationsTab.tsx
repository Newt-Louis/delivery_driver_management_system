import { FormEvent, useCallback, useRef, useState } from 'react';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { StatusBadge, TableShell } from './shared';

function LogoUpload({ value, onChange, label, maxSizeKB = 500 }: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  maxSizeKB?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeKB * 1000) { alert(`File quá lớn — tối đa ${maxSizeKB}KB`); return; }
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [onChange, maxSizeKB]);

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-start gap-3">
        <div className="rounded-xl border-2 border-thiso-200 bg-thiso-50 flex items-center justify-center overflow-hidden flex-shrink-0 w-14 h-14">
          {value
            ? <img src={value} alt="preview" className="w-full h-full object-contain p-1" />
            : <span className="text-xl text-thiso-300">🖼</span>}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => inputRef.current?.click()}>
            {value ? 'Thay logo' : 'Tải lên'}
          </button>
          {value && (
            <button type="button" className="text-xs text-red-500 hover:text-red-700 text-left" onClick={() => onChange(null)}>Xóa</button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        <p className="text-[11px] text-thiso-400 pt-1 leading-relaxed">PNG / SVG — tối đa {maxSizeKB}KB</p>
      </div>
    </div>
  );
}

type LocationFormState = {
  code: string;
  locationName: string;
  address: string;
  tagline: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  isActive: boolean;
};

function emptyForm(): LocationFormState {
  return { code: '', locationName: '', address: '', tagline: '', logoUrl: null, avatarUrl: null, isActive: true };
}

function fromLocation(item: BusinessLocation): LocationFormState {
  return {
    code:         item.code,
    locationName: item.locationName,
    address:      item.address      ?? '',
    tagline:      item.tagline      ?? '',
    logoUrl:      item.logoUrl      ?? null,
    avatarUrl:    item.avatarUrl    ?? null,
    isActive:     item.isActive,
  };
}

function LocationForm({ item, onDone, onCancel }: {
  item?: BusinessLocation;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<LocationFormState>(item ? fromLocation(item) : emptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field: keyof LocationFormState, value: string | boolean | null) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        tagline:  form.tagline  || null,
        address:  form.address  || undefined,
        logoUrl:  form.logoUrl  ?? null,
        avatarUrl: form.avatarUrl ?? null,
      };
      if (item) await superadminApi.updateLocation(item.id, payload);
      else      await superadminApi.createLocation(payload);
      onDone();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được location.');
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!item;

  return (
    <form onSubmit={submit} className="border border-thiso-200 rounded-2xl p-5 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-thiso-800">{isEdit ? `Chỉnh sửa: ${item.locationName}` : 'Tạo location mới'}</h4>
        {onCancel && (
          <button type="button" className="text-sm text-thiso-400 hover:text-thiso-700" onClick={onCancel}>Huỷ</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Code *</label>
          <input className="input" placeholder="VD: EMART_Q7" value={form.code}
                 onChange={(e) => set('code', e.target.value)} required disabled={isEdit} />
          {isEdit && <p className="text-[11px] text-thiso-400 mt-1">Code không thể thay đổi sau khi tạo.</p>}
        </div>
        <div>
          <label className="label">Tên location *</label>
          <input className="input" placeholder="Emart Quận 7" value={form.locationName}
                 onChange={(e) => set('locationName', e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label className="label">Địa chỉ</label>
          <input className="input" placeholder="Số 10 Nguyễn Văn Linh, Q.7" value={form.address}
                 onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Tagline</label>
          <input className="input" placeholder="Hệ thống điều phối giao-nhận hàng thông minh" value={form.tagline}
                 onChange={(e) => set('tagline', e.target.value)} />
          <p className="text-[11px] text-thiso-400 mt-1">Hiển thị dưới tên trên màn hình chờ và đăng ký.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <LogoUpload label="Logo chính (navbar, màn hình chờ)" value={form.logoUrl} onChange={(v) => set('logoUrl', v)} />
        <LogoUpload label="Avatar (trang đăng ký, phiếu in)" value={form.avatarUrl} onChange={(v) => set('avatarUrl', v)} />
      </div>

      <div className="flex items-center gap-5 pt-1">
        <label className="flex items-center gap-2 text-sm text-thiso-600 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.currentTarget.checked)} />
          Active
        </label>
        {error && <span className="text-sm text-red-600 flex-1">{error}</span>}
        <div className="ml-auto flex items-center gap-3">
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Huỷ</button>
          )}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo location'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function LocationsTab({ locations, onRefresh }: { locations: BusinessLocation[]; onRefresh: () => void }) {
  const [creating, setCreating]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  async function removeLocation(id: string) {
    if (!confirm('Deactivate hoặc xóa location này?')) return;
    await superadminApi.deleteLocation(id);
    onRefresh();
  }

  function doneCreate() { setCreating(false); onRefresh(); }
  function doneEdit()   { setEditingId(null); onRefresh(); }

  return (
    <section className="space-y-4">
      {creating ? (
        <LocationForm onDone={doneCreate} onCancel={() => setCreating(false)} />
      ) : (
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Tạo location mới</button>
      )}

      <TableShell>
        <table className="w-full text-sm">
          <thead className="bg-thiso-50 text-thiso-500">
            <tr>
              <th className="text-left p-3">Logo</th>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Tên / Tagline</th>
              <th className="text-left p-3">Liên kết</th>
              <th className="text-left p-3">Trạng thái</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <>
                <tr key={location.id} className="border-t border-thiso-100">
                  <td className="p-3">
                    {location.logoUrl
                      ? <img src={location.logoUrl} alt="" className="h-8 w-8 object-contain rounded" />
                      : <div className="h-8 w-8 rounded-lg bg-thiso-100 flex items-center justify-center text-thiso-400 text-xs font-black">{location.code.charAt(0)}</div>}
                  </td>
                  <td className="p-3 font-mono text-xs">{location.code}</td>
                  <td className="p-3">
                    <div className="font-semibold text-thiso-800">{location.locationName}</div>
                    {location.tagline && <div className="text-xs text-thiso-400 mt-0.5">{location.tagline}</div>}
                  </td>
                  <td className="p-3 text-thiso-500">{location._count?.unitConfigs ?? 0} units · {location._count?.users ?? 0} users</td>
                  <td className="p-3"><StatusBadge active={location.isActive} /></td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="btn btn-secondary text-xs" onClick={() => setEditingId(editingId === location.id ? null : location.id)}>
                        {editingId === location.id ? 'Đóng' : 'Sửa'}
                      </button>
                      <button className="btn btn-danger text-xs" onClick={() => removeLocation(location.id)}>Deactivate</button>
                    </div>
                  </td>
                </tr>
                {editingId === location.id && (
                  <tr key={`${location.id}-edit`} className="border-t border-thiso-100 bg-thiso-50/40">
                    <td colSpan={6} className="p-3">
                      <LocationForm item={location} onDone={doneEdit} onCancel={() => setEditingId(null)} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}
