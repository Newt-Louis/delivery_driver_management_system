import { Fragment, FormEvent, ReactNode, useMemo, useState } from 'react';
import type { Role, UnitConfig, User } from '../../../lib/types';
import { canManageUserRole } from '../../../lib/permissions';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { TableShell } from './shared';

type UserRow = User & {
  isActive?: boolean;
  deletedAt?: string | null;
};

type UserStatus = 'active' | 'disabled' | 'deleted';
type SortKey = 'name' | 'email' | 'role' | 'location' | 'units' | 'status' | 'createdAt' | 'updatedAt' | 'deletedAt';
type SortDirection = 'asc' | 'desc';
type SortRule = { key: SortKey; direction: SortDirection };

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
const PAGE_SIZE_OPTIONS = [20, 50, 100];

function userStatus(user: UserRow): UserStatus {
  if (user.deletedAt) return 'deleted';
  return user.isActive ? 'active' : 'disabled';
}

function userStatusLabel(status: UserStatus) {
  if (status === 'deleted') return 'Deleted';
  if (status === 'active') return 'Active';
  return 'Disabled';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function normalized(value: unknown) {
  return String(value ?? '').toLowerCase();
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerQuery);

  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark key={`${index}-${lowerQuery}`} className="bg-gray-200 text-inherit rounded px-0.5">
        {text.slice(index, index + lowerQuery.length)}
      </mark>,
    );
    cursor = index + lowerQuery.length;
    index = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts.map((part, idx) => <Fragment key={idx}>{part}</Fragment>)}</>;
}

function SortIcon({ direction }: { direction?: SortDirection }) {
  if (direction === 'asc') return <span className="text-[11px] leading-none">↑</span>;
  if (direction === 'desc') return <span className="text-[11px] leading-none">↓</span>;
  return <span className="text-[10px] leading-none">≡</span>;
}

function SortMenu({
  value,
  open,
  onOpenChange,
  onChange,
}: {
  value?: SortDirection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (direction: SortDirection | '') => void;
}) {
  function choose(direction: SortDirection | '') {
    onChange(direction);
    onOpenChange(false);
  }

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded border text-thiso-500 transition-colors ${value ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-thiso-200 bg-white hover:bg-thiso-50'}`}
        onClick={() => onOpenChange(!open)}
        aria-label="Sắp xếp"
      >
        <SortIcon direction={value} />
      </button>
      {open && (
        <div className="absolute left-1 top-6 z-30 min-w-[116px] rounded-md border border-thiso-100 bg-white py-1 shadow-lg">
          <button type="button" className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-thiso-50 ${!value ? 'font-semibold text-thiso-800' : 'text-thiso-500'}`} onClick={() => choose('')}>
            ≡ Bỏ chọn
          </button>
          <button type="button" className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-thiso-50 ${value === 'desc' ? 'font-semibold text-sky-700' : 'text-thiso-500'}`} onClick={() => choose('desc')}>
            ↓ Cao đến thấp
          </button>
          <button type="button" className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-thiso-50 ${value === 'asc' ? 'font-semibold text-sky-700' : 'text-thiso-500'}`} onClick={() => choose('asc')}>
            ↑ Thấp đến cao
          </button>
        </div>
      )}
    </span>
  );
}

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
  const [filters, setFilters] = useState({
    businessLocationId: '',
    unitConfigId: '',
    role: '',
    status: '',
    search: '',
  });
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [openSortKey, setOpenSortKey] = useState<SortKey | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const locationNames = useMemo(() => new Map(locations.map((location) => [location.id, `${location.code} - ${location.locationName}`])), [locations]);
  const roleOptions = useMemo(() => [...new Set(users.map((user) => user.role))].sort(), [users]);
  const statusOptions = useMemo(() => [...new Set(users.map(userStatus))], [users]);
  const filteredUnitOptions = useMemo(
    () => units.filter((unit) => !filters.businessLocationId || unit.businessLocationId === filters.businessLocationId),
    [filters.businessLocationId, units],
  );

  const getSortValue = (user: UserRow, key: SortKey) => {
    if (key === 'name') return user.name;
    if (key === 'email') return user.email;
    if (key === 'role') return user.role;
    if (key === 'location') return user.businessLocationId ? locationNames.get(user.businessLocationId) ?? user.businessLocationId : '';
    if (key === 'units') return (user.unitPermissions ?? []).map((unit) => unit.code ?? unit.unit).join(', ');
    if (key === 'status') return userStatusLabel(userStatus(user));
    if (key === 'createdAt') return user.createdAt ? new Date(user.createdAt).getTime() : 0;
    if (key === 'updatedAt') return user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
    return user.deletedAt ? new Date(user.deletedAt).getTime() : 0;
  };

  const filteredUsers = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const rows = users.filter((user) => {
      if (filters.businessLocationId && user.businessLocationId !== filters.businessLocationId) return false;
      if (filters.role && user.role !== filters.role) return false;
      if (filters.status && userStatus(user) !== filters.status) return false;
      if (filters.unitConfigId && !(user.unitPermissions ?? []).some((unit) => unit.id === filters.unitConfigId)) return false;
      if (query && !normalized(user.name).includes(query) && !normalized(user.email).includes(query)) return false;
      return true;
    });

    if (sortRules.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const rule of sortRules) {
        const aValue = getSortValue(a, rule.key);
        const bValue = getSortValue(b, rule.key);
        const result = typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), 'vi', { sensitivity: 'base', numeric: true });
        if (result !== 0) return rule.direction === 'asc' ? result : -result;
      }
      return 0;
    });
  }, [filters, sortRules, users, locationNames]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'businessLocationId' && value && !units.some((unit) => unit.id === current.unitConfigId && unit.businessLocationId === value)) {
        next.unitConfigId = '';
      }
      return next;
    });
    setPage(1);
  }

  function setSort(key: SortKey, direction: SortDirection | '') {
    setSortRules((current) => {
      const withoutKey = current.filter((rule) => rule.key !== key);
      if (!direction) return withoutKey;
      return [...withoutKey, { key, direction }];
    });
    setPage(1);
  }

  function sortDirectionFor(key: SortKey) {
    return sortRules.find((rule) => rule.key === key)?.direction;
  }

  function header(label: string, key: SortKey) {
    return (
      <th className="text-left p-3 whitespace-nowrap overflow-visible">
        <span>{label}</span>
        <SortMenu
          value={sortDirectionFor(key)}
          open={openSortKey === key}
          onOpenChange={(open) => setOpenSortKey(open ? key : null)}
          onChange={(direction) => setSort(key, direction)}
        />
      </th>
    );
  }

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
      <div className="flex flex-col xl:flex-row gap-3 xl:items-end xl:justify-between">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-1">
          <select className="input" value={filters.businessLocationId} onChange={(e) => updateFilter('businessLocationId', e.target.value)}>
            <option value="">Tất cả locations</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.code} - {location.locationName}</option>)}
          </select>
          <select className="input" value={filters.unitConfigId} onChange={(e) => updateFilter('unitConfigId', e.target.value)}>
            <option value="">Tất cả units</option>
            {filteredUnitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit} - {unit.displayName}</option>)}
          </select>
          <select className="input" value={filters.role} onChange={(e) => updateFilter('role', e.target.value)}>
            <option value="">Tất cả roles</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">Tất cả status</option>
            {statusOptions.map((status) => <option key={status} value={status}>{userStatusLabel(status)}</option>)}
          </select>
          <input
            className="input"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Tìm tên hoặc email"
          />
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setModal({ mode: 'create' })}>
          Tạo tài khoản
        </button>
      </div>
      {actionError && <div className="text-sm text-red-600">{actionError}</div>}

      <TableShell>
        <table className="w-full text-sm">
          <thead className="bg-thiso-50 text-thiso-500">
            <tr>
              {header('Tên', 'name')}
              {header('Email', 'email')}
              {header('Role', 'role')}
              {header('Location', 'location')}
              {header('Units', 'units')}
              {header('Status', 'status')}
              {header('Tạo mới', 'createdAt')}
              {header('Cập nhật', 'updatedAt')}
              {header('Xóa', 'deletedAt')}
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.length === 0 && (
              <tr>
                <td className="p-6 text-center text-thiso-400" colSpan={10}>
                  Không tìm thấy thông tin.
                </td>
              </tr>
            )}
            {pagedUsers.map((user) => {
              const isDeleted = Boolean(user.deletedAt);
              const isBusy = busyUserId === user.id;
              const isSuperadmin = user.role === 'SUPERADMIN';
              const canManage = canManageUserRole('SUPERADMIN', user.role);
              return (
                <tr key={user.id} className="border-t border-thiso-100">
                  <td className="p-3"><Highlight text={user.name} query={filters.search} /></td>
                  <td className="p-3"><Highlight text={user.email} query={filters.search} /></td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">{user.businessLocationId ? locationNames.get(user.businessLocationId) ?? user.businessLocationId : '-'}</td>
                  <td className="p-3">{(user.unitPermissions ?? []).map((unit) => unit.code ?? unit.unit).join(', ') || '-'}</td>
                  <td className="p-3"><UserStatusBadge user={user} /></td>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(user.createdAt)}</td>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(user.updatedAt)}</td>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(user.deletedAt)}</td>
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-thiso-500">
        <div>
          Hiển thị {filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          -{Math.min(currentPage * pageSize, filteredUsers.length)} / {filteredUsers.length} tài khoản
        </div>
        <div className="flex items-center gap-2">
          <span>Số dòng</span>
          <select className="input py-1.5 w-24" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <button className="btn btn-secondary px-3 py-1.5" type="button" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
            Trước
          </button>
          <span>Trang {currentPage}/{totalPages}</span>
          <button className="btn btn-secondary px-3 py-1.5" type="button" disabled={currentPage >= totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>
            Sau
          </button>
        </div>
      </div>

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
