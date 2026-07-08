import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UnitConfig } from '../../../lib/types';
import api from '../../../lib/api';
import {
  createLocationStaffUser,
  deleteLocationStaffUser,
  fetchLocationStaffUsers,
  resetLocationStaffPassword,
  updateLocationStaffUser,
} from '../api';
import { STAFF_ROLE_META } from '../constants';
import type { StaffUser } from '../types';

type StaffRoleValue = 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';

const STAFF_ROLES: StaffRoleValue[] = ['ADMIN_OPE', 'RECEIVING', 'CHECKIN'];
const UNIT_REQUIRED_ROLES: StaffRoleValue[] = ['RECEIVING', 'CHECKIN'];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function unitLabel(unit: Pick<UnitConfig, 'unit' | 'displayName' | 'shortName' | 'icon'>) {
  return unit.displayName || unit.shortName || unit.unit;
}

function unitIcon(unit: Pick<UnitConfig, 'icon'>) {
  return unit.icon?.trim() || '🏬';
}

function staffPermissionUnitLabel(unit: NonNullable<StaffUser['unitPermissions']>[number]) {
  return unit.displayName || unit.unit;
}

function staffPermissionUnitIcon(unit: NonNullable<StaffUser['unitPermissions']>[number]) {
  return unit.icon?.trim() || '🏬';
}

function StaffUserModal({
  user,
  unitConfigs,
  onClose,
  onSaved,
}: {
  user?: StaffUser | null;
  unitConfigs: UnitConfig[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const initialUnitConfigIds = user?.unitPermissions?.map((unit) => unit.id)
    ?? (user?.unit ? unitConfigs.filter((cfg) => cfg.unit === user.unit).map((cfg) => cfg.id) : []);
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email?.endsWith('@internal.local') ? '' : user?.email ?? '',
    password: '',
    role: (user?.role ?? 'CHECKIN') as StaffRoleValue,
    primaryUnitConfigId: initialUnitConfigIds[0] ?? unitConfigs[0]?.id ?? '',
    unitConfigIds: initialUnitConfigIds,
    department: user?.department ?? '',
    isActive: user?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const unitRequired = UNIT_REQUIRED_ROLES.includes(form.role);
  const canEditMultiUnit = isEdit && unitRequired;

  function selectedUnitConfigs(ids = form.unitConfigIds) {
    return unitConfigs.filter((cfg) => ids.includes(cfg.id));
  }

  function set(key: string, value: string | boolean | string[]) {
    setForm((current) => {
      if (key === 'role' && UNIT_REQUIRED_ROLES.includes(value as StaffRoleValue)) {
        const primaryUnitConfigId = current.primaryUnitConfigId || unitConfigs[0]?.id || '';
        const unitConfigIds = isEdit
          ? (current.unitConfigIds.length > 0 ? current.unitConfigIds : (primaryUnitConfigId ? [primaryUnitConfigId] : []))
          : (primaryUnitConfigId ? [primaryUnitConfigId] : []);
        return { ...current, role: value as StaffRoleValue, primaryUnitConfigId, unitConfigIds };
      }
      return { ...current, [key]: value };
    });
    setError('');
  }

  function toggleUnit(unitConfigId: string) {
    if (!canEditMultiUnit) return;
    setForm((current) => {
      const exists = current.unitConfigIds.includes(unitConfigId);
      const unitConfigIds = exists
        ? current.unitConfigIds.filter((id) => id !== unitConfigId)
        : [...current.unitConfigIds, unitConfigId];
      return { ...current, unitConfigIds };
    });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Vui lòng nhập họ tên.'); return; }
    if (!isEdit && form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự.'); return; }
    if (unitRequired && !isEdit && !form.primaryUnitConfigId) { setError('Vai trò Nhận hàng và Check-in bắt buộc phải chọn một đơn vị.'); return; }
    if (unitRequired && isEdit && form.unitConfigIds.length === 0) { setError('Vai trò Nhận hàng và Check-in bắt buộc phải chọn ít nhất một đơn vị.'); return; }

    setSaving(true);
    setError('');
    try {
      const selectedIds = unitRequired
        ? (isEdit ? form.unitConfigIds : [form.primaryUnitConfigId])
        : [];
      const selectedUnits = selectedUnitConfigs(selectedIds);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        role: form.role,
        unit: selectedUnits[0]?.unit ?? null,
        unitConfigIds: selectedIds,
        department: form.department.trim() || null,
        isActive: form.isActive,
      };
      if (isEdit) {
        await updateLocationStaffUser(user!.id, payload);
      } else {
        await createLocationStaffUser({ ...payload, password: form.password });
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Có lỗi xảy ra.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between">
          <h3 className="font-bold text-thiso-800">{isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}</h3>
          <button onClick={onClose} className="text-thiso-400 hover:text-thiso-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Họ và tên *</label>
            <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nguyễn Văn A" />
          </div>

          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Email</label>
            <input className="input w-full" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="co-the-bo-trong@thaco.vn" />
            <p className="text-[11px] text-thiso-400 mt-1">Để trống thì hệ thống sinh email nội bộ để giữ tính unique.</p>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Mật khẩu * (tối thiểu 6 ký tự)</label>
              <input className="input w-full font-mono" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} placeholder="••••••" />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-2">Vai trò *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STAFF_ROLES.map((role) => {
                const meta = STAFF_ROLE_META[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => set('role', role)}
                    className={`p-3 rounded-xl border-2 text-center transition-colors ${form.role === role ? `${meta.color} border-current` : 'border-thiso-200 text-thiso-500'}`}
                  >
                    <div className="text-xl mb-1">{meta.icon}</div>
                    <div className="text-xs font-semibold leading-tight">{meta.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-2">
              {canEditMultiUnit ? 'Đơn vị được phép' : 'Đơn vị chính'}{unitRequired ? ' *' : ''}
            </label>
            {!unitRequired ? (
              <div className="rounded-xl border border-thiso-100 bg-thiso-50 px-3 py-2 text-sm text-thiso-500">
                Role này thao tác theo khu vực nên không cần chỉ định unit.
              </div>
            ) : !isEdit ? (
              <select
                className="input w-full"
                value={form.primaryUnitConfigId}
                onChange={(e) => setForm((current) => ({
                  ...current,
                  primaryUnitConfigId: e.target.value,
                  unitConfigIds: e.target.value ? [e.target.value] : [],
                }))}
              >
                {unitConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>{unitIcon(cfg)} {unitLabel(cfg)}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unitConfigs.map((cfg) => {
                  const checked = form.unitConfigIds.includes(cfg.id);
                  return (
                    <button
                      key={cfg.id}
                      type="button"
                      onClick={() => toggleUnit(cfg.id)}
                      className={`text-left px-3 py-2 rounded-xl border transition-colors ${checked ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-thiso-200 text-thiso-500'} hover:border-sky-300`}
                    >
                      <div className="text-sm font-bold">{unitIcon(cfg)} {unitLabel(cfg)}</div>
                      <div className="text-[11px] text-thiso-400">{cfg.shortName || cfg.unit}</div>
                    </button>
                  );
                })}
              </div>
            )}
            {canEditMultiUnit
              ? <p className="text-[11px] text-thiso-400 mt-1">Có thể chọn thêm nhiều đơn vị cho tài khoản hiện trường.</p>
              : unitRequired
                ? <p className="text-[11px] text-thiso-400 mt-1">Tài khoản mới chỉ chọn một đơn vị chính; có thể mở rộng thêm khi chỉnh sửa.</p>
                : <p className="text-[11px] text-thiso-400 mt-1">ADMIN_OPE thao tác theo khu vực nên không cần chọn đơn vị.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Bộ phận / Ca làm việc</label>
            <input className="input w-full" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="vd: Ca sáng, cổng B, kho tươi..." maxLength={100} />
          </div>

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => set('isActive', !form.isActive)}
                className={`relative w-10 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-thiso-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-thiso-700">
                {form.isActive ? 'Tài khoản đang hoạt động' : 'Tài khoản bị vô hiệu'}
              </span>
            </label>
          )}

          {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-sm text-red-700">⚠ {error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo nhân viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetStaffPasswordModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
    if (password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return; }
    setSaving(true);
    setError('');
    try {
      await resetLocationStaffPassword(user.id, password);
      setDone(true);
    } catch {
      setError('Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between">
          <h3 className="font-bold text-thiso-800">Đặt lại mật khẩu</h3>
          <button onClick={onClose} className="text-thiso-400 hover:text-thiso-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-green-700">Mật khẩu đã được đặt lại</p>
              <button className="mt-5 btn-primary w-full" onClick={onClose}>Đóng</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-thiso-600">Đặt mật khẩu mới cho <strong>{user.name}</strong></p>
              <input className="input w-full font-mono" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} required minLength={6} placeholder="Mật khẩu mới" />
              <input className="input w-full font-mono" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} required placeholder="Xác nhận mật khẩu" />
              {error && <p className="text-sm text-red-600">⚠ {error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? '...' : 'Đặt lại'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StaffUsersTab() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | 'reset' | null>(null);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const { data: staffUsers = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ['location-staff-users'],
    queryFn: fetchLocationStaffUsers,
  });

  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['location-staff-users'] });
    setModal(null);
    setSelected(null);
  }

  async function handleDelete(id: string) {
    try {
      const res = await deleteLocationStaffUser(id);
      setDeleteMsg(res.deleted ? 'Đã xóa tài khoản' : 'Đã vô hiệu hóa tài khoản (có lịch sử)');
      refresh();
    } catch (err: unknown) {
      setDeleteMsg((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi');
    } finally {
      setDeleteId(null);
      setTimeout(() => setDeleteMsg(''), 4000);
    }
  }

  const filtered = staffUsers.filter((user) => {
    if (!showInactive && !user.isActive) return false;
    if (filterRole && user.role !== filterRole) return false;
    if (filterUnit && !((user.unitPermissions ?? []).some((unit) => unit.unit === filterUnit) || user.unit === filterUnit)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!user.name.toLowerCase().includes(q) && !user.email.toLowerCase().includes(q) && !(user.department ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {modal === 'create' && (
        <StaffUserModal unitConfigs={unitConfigs} onClose={() => setModal(null)} onSaved={refresh} />
      )}
      {modal === 'edit' && selected && (
        <StaffUserModal user={selected} unitConfigs={unitConfigs} onClose={() => { setModal(null); setSelected(null); }} onSaved={refresh} />
      )}
      {modal === 'reset' && selected && (
        <ResetStaffPasswordModal user={selected} onClose={() => { setModal(null); setSelected(null); }} />
      )}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-thiso-800 mb-2">Xóa nhân viên?</h3>
            <p className="text-sm text-thiso-500 mb-5">Nếu tài khoản đã có lịch sử, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn-danger flex-1" onClick={() => handleDelete(deleteId)}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-thiso-400 text-sm pointer-events-none">🔍</span>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-thiso-200 rounded-xl bg-white focus:outline-none focus:border-sky-400"
            placeholder="Tìm tên, email, bộ phận..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm py-2 min-w-[170px]" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {STAFF_ROLES.map((role) => <option key={role} value={role}>{STAFF_ROLE_META[role].icon} {STAFF_ROLE_META[role].label}</option>)}
        </select>
        <select className="input text-sm py-2 min-w-[140px]" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
          <option value="">Tất cả đơn vị</option>
          {unitConfigs.map((cfg) => <option key={cfg.id} value={cfg.unit}>{unitIcon(cfg)} {unitLabel(cfg)}</option>)}
        </select>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setModal('create')}>+ Thêm nhân viên</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-thiso-500 cursor-pointer select-none mb-4 ml-4">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
        Hiện TK vô hiệu
      </label>

      {deleteMsg && (
        <div className="mb-3 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700">{deleteMsg}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {STAFF_ROLES.map((role) => {
          const meta = STAFF_ROLE_META[role];
          const count = staffUsers.filter((user) => user.role === role && user.isActive).length;
          return (
            <div key={role} className="rounded-xl border px-4 py-3 flex items-center gap-3 bg-white border-thiso-100">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <div className="text-xl font-black text-thiso-800 leading-none">{count}</div>
                <div className="text-xs text-thiso-500 mt-0.5">{meta.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Email đăng nhập</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Đơn vị</th>
                <th className="px-4 py-3">Bộ phận</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-thiso-400">Không có nhân viên nào</td></tr>}
              {filtered.map((user) => {
                const meta = STAFF_ROLE_META[user.role];
                return (
                  <tr key={user.id} className={`border-b border-thiso-50 last:border-0 transition-colors ${!user.isActive ? 'opacity-50 bg-thiso-50/50' : 'hover:bg-thiso-50/60'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ background: user.isActive ? '#1C3A5C' : '#9CA3AF' }}>
                          {initials(user.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-thiso-800 leading-none">{user.name}</div>
                          <div className="text-[10px] text-thiso-400 mt-0.5">Tạo {new Date(user.createdAt).toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-thiso-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.color}`}>{meta.icon} {meta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-thiso-600">
                      {user.unitPermissions?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {user.unitPermissions.map((unit) => (
                            <span key={unit.id} className="text-[11px] px-2 py-1 rounded-full bg-thiso-50 text-thiso-600 font-semibold">
                              {staffPermissionUnitIcon(unit)} {staffPermissionUnitLabel(unit)}
                            </span>
                          ))}
                        </div>
                      ) : user.unit ? user.unit : <span className="text-thiso-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-thiso-600">{user.department ?? <span className="text-thiso-300 text-xs">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {user.isActive ? '✓ Hoạt động' : '✗ Vô hiệu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        <button className="text-xs px-2.5 py-1.5 rounded-lg border border-thiso-200 text-thiso-600 hover:bg-thiso-50 transition-colors" onClick={() => { setSelected(user); setModal('edit'); }}>✏ Sửa</button>
                        <button className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors" onClick={() => { setSelected(user); setModal('reset'); }}>🔑 Mật khẩu</button>
                        <button className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors" onClick={() => setDeleteId(user.id)}>{user.isActive ? 'Vô hiệu' : 'Xóa'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
