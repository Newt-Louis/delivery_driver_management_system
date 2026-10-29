import { Fragment, FormEvent, ReactNode, useMemo, useState } from 'react';
import type { Role, UnitConfig, User } from '../../../lib/types';
import { canManageUserRole } from '../../../lib/permissions';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { Alert, AutoComplete, Avatar, Button, Card, Checkbox, Collapse, Descriptions, Empty, Flex, Grid, Input, Modal, Pagination, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, StopOutlined, CheckOutlined } from '@ant-design/icons';
import ResponsiveDataToolbar, { SearchButton } from '../../backoffice/components/ResponsiveDataToolbar';

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
      <Typography.Text mark key={`${index}-${lowerQuery}`}>
        {text.slice(index, index + lowerQuery.length)}
      </Typography.Text>,
    );
    cursor = index + lowerQuery.length;
    index = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts.map((part, idx) => <Fragment key={idx}>{part}</Fragment>)}</>;
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

function UserStatusBadge({ user }: { user: UserRow }) { return <Tag color={user.deletedAt ? 'default' : user.isActive ? 'success' : 'default'}>{userStatusLabel(userStatus(user))}</Tag>; }

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

  return <Modal open title={mode === 'edit' ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản'} onCancel={onClose} footer={null} width={900} maskClosable={!saving} closable={!saving} keyboard={!saving}><form onSubmit={submit} className="space-y-4"><div className="grid sm:grid-cols-2 gap-3"><Input aria-label="Họ tên" placeholder="Họ tên" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /><Input aria-label="Email" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />{mode === 'create' && <Input.Password aria-label="Mật khẩu" placeholder="Mật khẩu" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />}<Select aria-label="Role" value={form.role} onChange={v => setForm({ ...form, role: v })} options={ROLE_OPTIONS.map(v => ({ value: v, label: v }))} /><Select aria-label="Location" value={form.businessLocationId || undefined} onChange={v => setForm({ ...form, businessLocationId: v, unitConfigIds: [] })} options={locations.map(l => ({ value: l.id, label: `${l.code} - ${l.locationName}` }))} /><Input aria-label="Bộ phận hoặc ghi chú" placeholder="Bộ phận/ghi chú" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div><Space wrap>{locationUnits.map(unit => <Checkbox key={unit.id} checked={form.unitConfigIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)}>{unit.unit} - {unit.displayName}</Checkbox>)}{!locationUnits.length && <Typography.Text type="secondary">Location này chưa có unit active.</Typography.Text>}</Space>{error && <Alert type="error" message={error} />}<div className="flex justify-end gap-2"><Button onClick={onClose} disabled={saving}>Hủy</Button><Button type="primary" htmlType="submit" loading={saving}>Lưu</Button></div></form></Modal>;

}

export default function UsersTab({ users, locations, units, onRefresh }: { users: UserRow[]; locations: BusinessLocation[]; units: UnitConfig[]; onRefresh: () => void }) {
  const [modal, setModal] = useState<UserModalState | null>(null);
  const screens = Grid.useBreakpoint();
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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

  const nameOptions = [...new Set(users.map(user => user.name.trim()).filter(Boolean))].map(value => ({ value }));
  function updatePagination(nextPage: number, nextSize = pageSize) { setPage(nextPage); setPageSize(nextSize); }
  function actions(user: UserRow) {
    const deleted = Boolean(user.deletedAt);
    const busy = busyUserId === user.id;
    const disabled = !canManageUserRole('SUPERADMIN', user.role) || user.role === 'SUPERADMIN' || busy;
    return <Space size="small" onClick={event => event.stopPropagation()}>
      <Tooltip title="Chỉnh sửa"><Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Chỉnh sửa ${user.name}`} disabled={disabled || deleted} onClick={() => setModal({ mode: 'edit', user })} /></Tooltip>
      {!deleted && <Tooltip title={user.isActive ? 'Disable' : 'Active'}><Button color={user.isActive ? 'danger' : 'primary'} variant="solid" size="small" icon={user.isActive ? <StopOutlined /> : <CheckOutlined />} aria-label={`${user.isActive ? 'Disable' : 'Active'} ${user.name}`} disabled={disabled} loading={busy} onClick={() => mutateUser(user.id, () => superadminApi.updateUser(user.id, { isActive: !user.isActive }))} /></Tooltip>}
      {deleted ? <Tooltip title="Regenerate"><Button type="primary" size="small" icon={<ReloadOutlined />} aria-label={`Regenerate ${user.name}`} disabled={disabled} loading={busy} onClick={() => mutateUser(user.id, () => superadminApi.regenerateUser(user.id))} /></Tooltip> : <Popconfirm title={`Xóa mềm tài khoản ${user.email}?`} onConfirm={() => mutateUser(user.id, () => superadminApi.deleteUser(user.id))}><Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Delete ${user.name}`} disabled={disabled} loading={busy} /></Popconfirm>}
    </Space>;
  }
  const columns: TableColumnsType<UserRow> = [
    { title: 'Tên', key: 'name', fixed: 'left', width: 235, render: (_, u) => <Space><Avatar>{u.name.charAt(0)}</Avatar><Typography.Text><Highlight text={u.name} query={filters.search} /></Typography.Text></Space> },
    { title: 'Email', key: 'email', width: 250, render: (_, u) => <Highlight text={u.email} query={filters.search} /> },
    { title: 'Role', dataIndex: 'role', width: 220 },
    { title: 'Location', key: 'location', width: 240, render: (_, u) => u.businessLocationId ? locationNames.get(u.businessLocationId) ?? u.businessLocationId : '—' },
    { title: 'Units', key: 'units', width: 230, render: (_, u) => (u.unitPermissions ?? []).map(x => x.code ?? x.unit).join(', ') || '—' },
    { title: 'Status', key: 'status', width: 220, render: (_, u) => <UserStatusBadge user={u} /> },
    { title: 'Tạo mới', key: 'created', width: 230, render: (_, u) => formatDateTime(u.createdAt) },
    { title: 'Cập nhật', key: 'updated', width: 230, render: (_, u) => formatDateTime(u.updatedAt) },
    { title: 'Xóa', key: 'deleted', width: 230, render: (_, u) => formatDateTime(u.deletedAt) },
    { title: 'Thao tác', key: 'actions', fixed: 'right', align: 'right', width: 140, render: (_, u) => actions(u) },
  ];
  const sortFields: Array<[SortKey, string]> = [['name', 'Tên'], ['email', 'Email'], ['role', 'Role'], ['location', 'Location'], ['units', 'Units'], ['status', 'Status'], ['createdAt', 'Tạo mới'], ['updatedAt', 'Cập nhật'], ['deletedAt', 'Xóa']];
  return <Space orientation="vertical" size="large" className="w-full">
    <ResponsiveDataToolbar filters={<>
      <Space orientation="vertical" size={4} className="w-full sm:w-auto"><Typography.Text type="secondary">Tìm kiếm</Typography.Text><AutoComplete className="w-full sm:w-64" value={searchDraft} options={nameOptions} open={searchOpen && Boolean(searchDraft.trim())} notFoundContent="Không có dữ liệu" onFocus={() => setSearchOpen(Boolean(searchDraft.trim()))} onBlur={() => setSearchOpen(false)} onChange={v => { setSearchDraft(v); setSearchOpen(Boolean(v.trim())); }} onSelect={v => { setSearchDraft(v); setSearchOpen(false); }} filterOption={(input, option) => String(option?.value ?? '').toLocaleLowerCase('vi-VN').includes(input.toLocaleLowerCase('vi-VN'))}><Input.Search aria-label="Tìm tên hoặc email" allowClear placeholder="Tìm tên hoặc email" enterButton={<SearchButton />} onSearch={v => { updateFilter('search', v.trim()); setSearchOpen(false); }} /></AutoComplete></Space>
      <Space orientation="vertical" size={4}><Typography.Text type="secondary">Location</Typography.Text><Select aria-label="Location" className="min-w-44" value={filters.businessLocationId || undefined} allowClear placeholder="Tất cả locations" onChange={v => updateFilter('businessLocationId', v ?? '')} options={locations.map(l => ({ value: l.id, label: `${l.code} - ${l.locationName}` }))} /></Space>
      <Space orientation="vertical" size={4}><Typography.Text type="secondary">Unit</Typography.Text><Select aria-label="Unit" className="min-w-44" value={filters.unitConfigId || undefined} allowClear placeholder="Tất cả units" onChange={v => updateFilter('unitConfigId', v ?? '')} options={filteredUnitOptions.map(u => ({ value: u.id, label: `${u.unit} - ${u.displayName}` }))} /></Space>
      <Space orientation="vertical" size={4}><Typography.Text type="secondary">Role</Typography.Text><Select aria-label="Role" className="min-w-36" value={filters.role || undefined} allowClear placeholder="Tất cả roles" onChange={v => updateFilter('role', v ?? '')} options={roleOptions.map(v => ({ value: v, label: v }))} /></Space>
      <Space orientation="vertical" size={4}><Typography.Text type="secondary">Status</Typography.Text><Select aria-label="Status" className="min-w-36" value={filters.status || undefined} allowClear placeholder="Tất cả status" onChange={v => updateFilter('status', v ?? '')} options={statusOptions.map(v => ({ value: v, label: userStatusLabel(v) }))} /></Space>
    </>} createAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ mode: 'create' })}>Tạo tài khoản</Button>} />
    {!screens.lg && <Collapse items={[{ key: 'sort', label: 'Sắp xếp theo cột', children: <Space wrap>{sortFields.map(([key, label]) => <Space orientation="vertical" size={4} key={key}><Typography.Text type="secondary">{label}</Typography.Text><Select<SortDirection | ''> aria-label={`Sắp xếp ${label}`} value={sortDirectionFor(key) ?? ''} onChange={v => setSort(key, v)} options={[{ value: '', label: 'Không sắp xếp' }, { value: 'desc', label: 'Cao đến thấp' }, { value: 'asc', label: 'Thấp đến cao' }]} style={{ width: 150 }} /></Space>)}</Space> }]} />}
    {actionError && <Alert type="error" message={actionError} showIcon />}
    {screens.lg ? <Card size="small" styles={{ body: { padding: 0 } }}><Table<UserRow> rowKey="id" dataSource={filteredUsers} columns={columns} scroll={{ x: 2100 }} locale={{ emptyText: <Empty description="Không có tài khoản phù hợp" /> }} pagination={{ position: ['bottomCenter'], size: 'small', current: currentPage, pageSize, showSizeChanger: true, pageSizeOptions: PAGE_SIZE_OPTIONS, showTotal: total => `Tổng ${total} tài khoản`, onChange: updatePagination }} /></Card> : pagedUsers.length === 0 ? <Empty description="Không có tài khoản phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <Space orientation="vertical" size="middle" className="w-full"><Collapse items={pagedUsers.map(user => ({ key: user.id, label: <Space size="small" className="min-w-0" align="start"><Avatar>{user.name.charAt(0)}</Avatar><Space orientation="vertical" size={0} className="min-w-0"><Typography.Text strong ellipsis={{ tooltip: user.name }} className="block max-w-32">{user.name}</Typography.Text><Typography.Text type="secondary" ellipsis={{ tooltip: user.email }} className="block max-w-32">{user.email}</Typography.Text></Space></Space>, extra: actions(user), children: <Descriptions size="small" column={1} items={[{ key: 'email', label: 'Email', children: <Typography.Text style={{ overflowWrap: 'anywhere' }}>{user.email}</Typography.Text> }, { key: 'role', label: 'Role', children: user.role }, { key: 'location', label: 'Location', children: user.businessLocationId ? locationNames.get(user.businessLocationId) ?? user.businessLocationId : '—' }, { key: 'units', label: 'Units', children: (user.unitPermissions ?? []).map(x => x.code ?? x.unit).join(', ') || '—' }, { key: 'status', label: 'Status', children: <UserStatusBadge user={user} /> }, { key: 'created', label: 'Tạo mới', children: formatDateTime(user.createdAt) }, { key: 'updated', label: 'Cập nhật', children: formatDateTime(user.updatedAt) }, { key: 'deleted', label: 'Xóa', children: formatDateTime(user.deletedAt) }]} /> }))} /><Flex justify="center"><Pagination current={currentPage} pageSize={pageSize} total={filteredUsers.length} size="small" showSizeChanger={false} showTotal={total => `Tổng ${total} tài khoản`} onChange={updatePagination} /></Flex></Space>}
    {modal && <UserFormModal key={modal.mode === 'edit' ? modal.user.id : 'create'} mode={modal.mode} user={modal.user} locations={locations} units={units} onClose={() => setModal(null)} onDone={closeModalAndRefresh} />}
  </Space>;
}
