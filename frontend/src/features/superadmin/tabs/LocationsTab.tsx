import { FormEvent, useState } from 'react';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { StatusBadge, TableShell } from './shared';
import DatafileImageUpload, { type DatafileImageValue } from '../../../components/DatafileImageUpload';
import { hasPendingUploadFile, uploadDatafileAsset } from '../../../lib/datafileUpload';

type LocationFormState = {
  code: string;
  locationName: string;
  address: string;
  tagline: string;
  logoUrl: string | null;
  logoOriginalName?: string;
  logoFile?: File;
  avatarUrl: string | null;
  avatarOriginalName?: string;
  avatarFile?: File;
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
      const basePayload = {
        ...form,
        tagline:  form.tagline  || null,
        address:  form.address  || undefined,
        logoOriginalName: undefined,
        logoFile: undefined,
        avatarOriginalName: undefined,
        avatarFile: undefined,
      };
      const payload = {
        ...basePayload,
        logoUrl:  item && hasPendingUploadFile(form.logoFile) ? item.logoUrl ?? null : form.logoUrl ?? null,
        avatarUrl: item && hasPendingUploadFile(form.avatarFile) ? item.avatarUrl ?? null : form.avatarUrl ?? null,
      };

      if (item) {
        const logoUrl = await uploadLocationImageIfNeeded(item.id, form.logoUrl, form.logoOriginalName, 'LOGO', form.logoFile);
        const avatarUrl = await uploadLocationImageIfNeeded(item.id, form.avatarUrl, form.avatarOriginalName, 'AVATAR', form.avatarFile);
        await superadminApi.updateLocation(item.id, { ...payload, logoUrl, avatarUrl });
      } else {
        const createPayload = {
          ...basePayload,
          logoUrl:  hasPendingUploadFile(form.logoFile) ? null : form.logoUrl ?? null,
          avatarUrl: hasPendingUploadFile(form.avatarFile) ? null : form.avatarUrl ?? null,
        };
        const created = (await superadminApi.createLocation(createPayload)).data as BusinessLocation;
        const logoUrl = await uploadLocationImageIfNeeded(created.id, form.logoUrl, form.logoOriginalName, 'LOGO', form.logoFile);
        const avatarUrl = await uploadLocationImageIfNeeded(created.id, form.avatarUrl, form.avatarOriginalName, 'AVATAR', form.avatarFile);
        if (logoUrl !== createPayload.logoUrl || avatarUrl !== createPayload.avatarUrl) {
          await superadminApi.updateLocation(created.id, { logoUrl, avatarUrl });
        }
      }
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
        <DatafileImageUpload
          label="Logo chính (navbar, màn hình chờ)"
          value={{ url: form.logoUrl, originalName: form.logoOriginalName }}
          onChange={(v: DatafileImageValue) => setForm((current) => ({ ...current, logoUrl: v.url, logoOriginalName: v.originalName, logoFile: v.file }))}
          buttonLabel="Tải lên logo"
        />
        <DatafileImageUpload
          label="Avatar (trang đăng ký, phiếu in)"
          value={{ url: form.avatarUrl, originalName: form.avatarOriginalName }}
          onChange={(v: DatafileImageValue) => setForm((current) => ({ ...current, avatarUrl: v.url, avatarOriginalName: v.originalName, avatarFile: v.file }))}
          buttonLabel="Tải lên avatar"
        />
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

async function uploadLocationImageIfNeeded(
  businessLocationId: string,
  value: string | null,
  originalName: string | undefined,
  category: 'LOGO' | 'AVATAR',
  file?: File,
) {
  if (!hasPendingUploadFile(file)) return value ?? null;
  const uploaded = await uploadDatafileAsset({
    scope: 'BUSINESS_LOCATION',
    category,
    businessLocationId,
    originalName: originalName ?? `${category.toLowerCase()}.png`,
    file,
  });
  return uploaded.publicUrl;
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
