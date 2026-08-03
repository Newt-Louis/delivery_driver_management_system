import { FormEvent, useMemo, useState } from 'react';
import type { Role, UnitConfig, User } from '../../../lib/types';
import { canManageUserRole } from '../../../lib/permissions';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { TableShell } from './shared';

type UserRow = User & {
  isActive?: boolean;
  deletedAt?: string | null;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN_LOC' | 'ADMIN_OPE';
  businessLocationId: string;
  department: string;
  unitConfigIds: string[];
};

type UserModalState =
  | { mode: 'create'; user?: undefined }
  | { mode: 'edit'; user: UserRow };

const ROLE_OPTIONS: Array<'ADMIN_LOC' | 'ADMIN_OPE'> = ['ADMIN_LOC', 'ADMIN_OPE'];

function userFormInitialState(locations: BusinessLocation[], user?: UserRow): UserFormState {
  const editableRole = user?.role && ROLE_OPTIONS.includes(user.role as 'ADMIN_LOC' | 'ADMIN_OPE')
    ? user.role as 'ADMIN_LOC' | 'ADMIN_OPE'
    : 'ADMIN_LOC';

  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: editableRole,
    businessLocationId: user?.businessLocationId ?? locations[0]?.id ?? '',
    department: user?.department ?? '',
    unitConfigIds: user?.unitPermissions?.map((unit) => unit.id) ?? [],
  };
}

function UserStatusBadge({ user }: { user: UserRow }) {
  if (user.deletedAt) {
    return (
      <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
        Deleted
      </span>
    );
  }
  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-thiso-100 text-thiso-500'}`}>
      {user.isActive ? 'Active' : 'Disabled'}
    </span>
  );
}

function UserFormModal({
  mode,
  user,
  locations,
  units,
  onClose,
  onDone,
}: {
  mode: 'create' | 'edit';
  user?: UserRow;
  locations: BusinessLocation[];
  units: UnitConfig[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState(() => userFormInitialState(locations, user));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locationUnits = units.filter((unit) => unit.businessLocationId === form.businessLocationId && (unit.isActive ?? true));

  function toggleUnit(id: string) {
    setForm((current) => ({
      ...current,
      unitConfigIds: current.unitConfigIds.includes(id)
        ? current.unitConfigIds.filter((unitId) => unitId !== id)
        : [...current.unitConfigIds, id],
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.businessLocationId) {
      setError('Chọn BusinessLocation trước khi lưu tài khoản.');
      return;
    }
    if (form.unitConfigIds.length === 0) {
      setError('Tài khoản vận hành phải được gán ít nhất một unit operation scope.');
      return;
    }

    const firstUnit = locationUnits.find((unitConfig) => unitConfig.id === form.unitConfigIds[0]);
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      businessLocationId: form.businessLocationId,
      department: form.department || null,
      unit: firstUnit?.unit ?? null,
      unitConfigIds: form.unitConfigIds,
    };
    if (mode === 'create') payload.password = form.password;

    try {
      setSaving(true);
      if (mode === 'edit' && user) {
        await superadminApi.updateUser(user.id, payload);
      } else {
        await superadminApi.createUser(payload);
      }
      onDone();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được tài khoản.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-thiso-900/40 px-4">
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-thiso-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-thiso-800">
            {mode === 'edit' ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản'}
          </h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Đóng</button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid md:grid-cols-6 gap-3">
            <input className="input md:col-span-2" placeholder="Họ tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input md:col-span-2" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            {mode === 'create' && (
              <input className="input" type="password" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            )}
            <select className={`input ${mode === 'edit' ? 'md:col-span-2' : ''}`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN_LOC' | 'ADMIN_OPE' })}>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select
              className="input md:col-span-3"
              value={form.businessLocationId}
              onChange={(e) => setForm({ ...form, businessLocationId: e.target.value, unitConfigIds: [] })}
              required
            >
              {locations.map((location) => <option key={location.id} value={location.id}>{location.code} - {location.locationName}</option>)}
            </select>
            <input className="input md:col-span-3" placeholder="Bộ phận/ghi chú" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>

          <div className="flex flex-wrap gap-2">
            {locationUnits.map((unit) => (
              <label key={unit.id} className={`px-3 py-2 rounded border text-sm cursor-pointer ${form.unitConfigIds.includes(unit.id) ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-thiso-200 text-thiso-600'}`}>
                <input type="checkbox" className="sr-only" checked={form.unitConfigIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} />
                {unit.unit} - {unit.displayName}
              </label>
            ))}
            {locationUnits.length === 0 && <span className="text-sm text-thiso-400">Location này chưa có unit active.</span>}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-thiso-100 pt-4">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersTab({ users, locations, units, onRefresh }: { users: UserRow[]; locations: BusinessLocation[]; units: UnitConfig[]; onRefresh: () => void }) {
  const [modal, setModal] = useState<UserModalState | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const locationNames = useMemo(() => new Map(locations.map((location) => [location.id, `${location.code} - ${location.locationName}`])), [locations]);

  async function mutateUser(id: string, action: () => Promise<unknown>) {
    try {
      setActionError('');
      setBusyUserId(id);
      await action();
      onRefresh();
    } catch (err) {
      setActionError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thực hiện được thao tác.');
    } finally {
      setBusyUserId(null);
    }
  }

  function closeModalAndRefresh() {
    setModal(null);
    onRefresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button className="btn btn-primary" type="button" onClick={() => setModal({ mode: 'create' })}>
          Tạo tài khoản
        </button>
      </div>
      {actionError && <div className="text-sm text-red-600">{actionError}</div>}

      <TableShell>
        <table className="w-full text-sm">
          <thead className="bg-thiso-50 text-thiso-500">
            <tr>
              <th className="text-left p-3">Tên</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Units</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isDeleted = Boolean(user.deletedAt);
              const isBusy = busyUserId === user.id;
              const isSuperadmin = user.role === 'SUPERADMIN';
              const canManage = canManageUserRole('SUPERADMIN', user.role);
              return (
                <tr key={user.id} className="border-t border-thiso-100">
                  <td className="p-3">{user.name}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">{user.businessLocationId ? locationNames.get(user.businessLocationId) ?? user.businessLocationId : '-'}</td>
                  <td className="p-3">{(user.unitPermissions ?? []).map((unit) => unit.code ?? unit.unit).join(', ') || '-'}</td>
                  <td className="p-3"><UserStatusBadge user={user} /></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-secondary px-3 py-1.5 text-xs" type="button" disabled={!canManage || isDeleted || isSuperadmin || isBusy} onClick={() => setModal({ mode: 'edit', user })}>
                        Edit
                      </button>
                      {!isDeleted && (
                        <button
                          className={`btn px-3 py-1.5 text-xs ${user.isActive ? 'btn-danger' : 'btn-success'}`}
                          type="button"
                          disabled={!canManage || isSuperadmin || isBusy}
                          onClick={() => mutateUser(user.id, () => superadminApi.updateUser(user.id, { isActive: !user.isActive }))}
                        >
                          {user.isActive ? 'Disable' : 'Active'}
                        </button>
                      )}
                      <button
                        className={`btn px-3 py-1.5 text-xs ${isDeleted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'btn-danger'}`}
                        type="button"
                        disabled={!canManage || isSuperadmin || isBusy}
                        onClick={() => {
                          if (isDeleted) {
                            mutateUser(user.id, () => superadminApi.regenerateUser(user.id));
                            return;
                          }
                          if (window.confirm(`Xóa mềm tài khoản ${user.email}?`)) {
                            mutateUser(user.id, () => superadminApi.deleteUser(user.id));
                          }
                        }}
                      >
                        {isDeleted ? 'Regenerate' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>

      {modal && (
        <UserFormModal
          key={modal.mode === 'edit' ? modal.user.id : 'create'}
          mode={modal.mode}
          user={modal.user}
          locations={locations}
          units={units}
          onClose={() => setModal(null)}
          onDone={closeModalAndRefresh}
        />
      )}
    </section>
  );
}
