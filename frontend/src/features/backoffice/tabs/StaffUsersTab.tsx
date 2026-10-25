import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  Grid,
  Modal,
  Pagination,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd';
import type { UnitConfig } from '../../../lib/types';
import api from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import {
  createLocationStaffUser,
  deleteLocationStaffUser,
  fetchLocationStaffUsers,
  resetLocationStaffPassword,
  updateLocationStaffUser,
} from '../api';
import { STAFF_ROLE_META } from '../constants';
import type { StaffUser } from '../types';
import ResponsiveDataToolbar, { SearchButton } from '../components/ResponsiveDataToolbar';

type StaffRoleValue = 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
type StaffForm = {
  name: string;
  email: string;
  password: string;
  role: StaffRoleValue;
  primaryUnitConfigId: string;
  unitConfigIds: string[];
  department: string;
  isActive: boolean;
};

const STAFF_ROLES: StaffRoleValue[] = ['ADMIN_OPE', 'RECEIVING', 'CHECKIN'];
const LIFECYCLE_STAFF_ROLES: StaffRoleValue[] = ['RECEIVING', 'CHECKIN'];

function initials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2);
}

function unitLabel(unit: Pick<UnitConfig, 'unit' | 'displayName' | 'shortName'>) {
  return unit.displayName || unit.shortName || unit.unit;
}

function staffPermissionUnitLabel(unit: NonNullable<StaffUser['unitPermissions']>[number]) {
  return unit.displayName || unit.unit;
}

function errorMessage(error: unknown, fallback = 'Có lỗi xảy ra.') {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.error ?? response.response?.data?.message ?? fallback;
}

function StaffUserModal({
  user,
  unitConfigs,
  canManageAdminOpe,
  onClose,
  onSaved,
}: {
  user?: StaffUser | null;
  unitConfigs: UnitConfig[];
  canManageAdminOpe: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(user);
  const isScopeOnlyEdit = user?.role === 'ADMIN_OPE' && !canManageAdminOpe;
  const manageableRoles = canManageAdminOpe ? STAFF_ROLES : LIFECYCLE_STAFF_ROLES;
  const initialUnitConfigIds = user?.unitPermissions?.map((unit) => unit.id)
    ?? (user?.unit ? unitConfigs.filter((unit) => unit.unit === user.unit).map((unit) => unit.id) : []);
  const [form, setForm] = useState<StaffForm>({
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

  function setField<K extends keyof StaffForm>(key: K, value: StaffForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function selectRole(role: StaffRoleValue) {
    setForm((current) => {
      const primaryUnitConfigId = current.primaryUnitConfigId || unitConfigs[0]?.id || '';
      const unitConfigIds = isEdit
        ? (current.unitConfigIds.length > 0 ? current.unitConfigIds : (primaryUnitConfigId ? [primaryUnitConfigId] : []))
        : (primaryUnitConfigId ? [primaryUnitConfigId] : []);
      return { ...current, role, primaryUnitConfigId, unitConfigIds };
    });
    setError('');
  }

  function selectedUnitConfigs(ids = form.unitConfigIds) {
    return unitConfigs.filter((unit) => ids.includes(unit.id));
  }

  async function submit() {
    if (!isScopeOnlyEdit && !form.name.trim()) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!isEdit && form.password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    if (form.unitConfigIds.length === 0) {
      setError('Vai trò vận hành bắt buộc phải chọn ít nhất một đơn vị.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const selectedUnits = selectedUnitConfigs();
      if (isScopeOnlyEdit) {
        await updateLocationStaffUser(user!.id, {
          unit: selectedUnits[0]?.unit ?? null,
          unitConfigIds: form.unitConfigIds,
        });
      } else if (isEdit) {
        await updateLocationStaffUser(user!.id, {
          name: form.name.trim(),
          email: form.email.trim() || null,
          role: form.role,
          unit: selectedUnits[0]?.unit ?? null,
          unitConfigIds: form.unitConfigIds,
          department: form.department.trim() || null,
          isActive: form.isActive,
        });
      } else {
        await createLocationStaffUser({
          name: form.name.trim(),
          email: form.email.trim() || null,
          password: form.password,
          role: form.role,
          unit: selectedUnits[0]?.unit ?? null,
          unitConfigIds: form.unitConfigIds,
          department: form.department.trim() || null,
          isActive: form.isActive,
        });
      }
      onSaved();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      centered
      destroyOnHidden
      title={isScopeOnlyEdit ? 'Chỉnh phạm vi ADMIN_OPE' : isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'}
      width="min(720px, calc(100vw - 32px))"
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' } }}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="submit" type="primary" loading={saving} onClick={submit}>
          {isEdit ? 'Lưu thay đổi' : 'Tạo nhân viên'}
        </Button>,
      ]}
    >
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        {isScopeOnlyEdit ? (
          <Alert
            className="mb-4"
            type="info"
            showIcon
            message={user?.name}
            description="ADMIN_LOC chỉ được chỉnh phạm vi đơn vị thao tác của ADMIN_OPE."
          />
        ) : (
          <>
            <Form.Item label="Họ và tên" required>
              <Input value={form.name} placeholder="Nguyễn Văn A" onChange={(event) => setField('name', event.target.value)} />
            </Form.Item>
            <Form.Item label="Email">
              <Input type="email" value={form.email} placeholder="co-the-bo-trong@thaco.vn" onChange={(event) => setField('email', event.target.value)} />
              <Typography.Text type="secondary" className="text-xs">Để trống thì hệ thống sinh email nội bộ để giữ tính unique.</Typography.Text>
            </Form.Item>
            {!isEdit && (
              <Form.Item label="Mật khẩu" required>
                <Input.Password value={form.password} placeholder="Tối thiểu 6 ký tự" onChange={(event) => setField('password', event.target.value)} />
              </Form.Item>
            )}
            <Form.Item label="Vai trò" required>
              <Select
                value={form.role}
                options={manageableRoles.map((role) => ({ value: role, label: `${STAFF_ROLE_META[role].icon} ${STAFF_ROLE_META[role].label}` }))}
                onChange={selectRole}
              />
            </Form.Item>
          </>
        )}

        <Form.Item label="Đơn vị được phép" required>
          {unitConfigs.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn vị trong location hiện tại." />
          ) : (
            <Checkbox.Group value={form.unitConfigIds} onChange={(ids) => setField('unitConfigIds', ids.map(String))} className="w-full">
              <Space direction="vertical" size="small" className="w-full">
                {unitConfigs.map((unit) => (
                  <Checkbox key={unit.id} value={unit.id} className="w-full">
                    {unit.icon?.trim() || '🏬'} {unitLabel(unit)}
                    <Typography.Text type="secondary" className="ml-2 text-xs">{unit.shortName || unit.unit}</Typography.Text>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          )}
          <Typography.Text type="secondary" className="text-xs">Có thể chọn một hoặc nhiều đơn vị trong BusinessLocation hiện tại.</Typography.Text>
        </Form.Item>

        {!isScopeOnlyEdit && (
          <Form.Item label="Bộ phận / Ca làm việc">
            <Input value={form.department} maxLength={100} placeholder="Ví dụ: Ca sáng, cổng B, kho tươi..." onChange={(event) => setField('department', event.target.value)} />
          </Form.Item>
        )}
        {isEdit && !isScopeOnlyEdit && (
          <Form.Item label="Trạng thái tài khoản">
            <Switch checked={form.isActive} checkedChildren="Hoạt động" unCheckedChildren="Vô hiệu" onChange={(checked) => setField('isActive', checked)} />
          </Form.Item>
        )}
        {error && <Alert type="error" showIcon message={error} />}
      </Form>
    </Modal>
  );
}

function ResetStaffPasswordModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await resetLocationStaffPassword(user.id, password);
      setDone(true);
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      centered
      destroyOnHidden
      title="Đặt lại mật khẩu"
      width="min(480px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={done ? <Button type="primary" onClick={onClose}>Đóng</Button> : [
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="reset" type="primary" loading={saving} onClick={submit}>Đặt lại</Button>,
      ]}
    >
      {done ? (
        <Result status="success" title="Mật khẩu đã được đặt lại" />
      ) : (
        <Form layout="vertical" requiredMark={false} onFinish={submit}>
          <Typography.Paragraph>Đặt mật khẩu mới cho <Typography.Text strong>{user.name}</Typography.Text>.</Typography.Paragraph>
          <Form.Item label="Mật khẩu mới" required>
            <Input.Password value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} />
          </Form.Item>
          <Form.Item label="Xác nhận mật khẩu" required>
            <Input.Password value={confirm} onChange={(event) => { setConfirm(event.target.value); setError(''); }} />
          </Form.Item>
          {error && <Alert type="error" showIcon message={error} />}
        </Form>
      )}
    </Modal>
  );
}

export default function StaffUsersTab() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const canManageAdminOpe = currentUser?.role === 'SUPERADMIN';
  const [modal, setModal] = useState<'create' | 'edit' | 'reset' | null>(null);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: staffUsers = [], isLoading, isError, refetch } = useQuery<StaffUser[]>({
    queryKey: ['location-staff-users'],
    queryFn: fetchLocationStaffUsers,
  });
  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  function closeModal() {
    setModal(null);
    setSelected(null);
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['location-staff-users'] });
  }

  async function confirmDelete(user: StaffUser) {
    try {
      const result = await deleteLocationStaffUser(user.id);
      setNotice({ type: 'success', message: result.deleted ? 'Đã xóa tài khoản.' : 'Đã vô hiệu hóa tài khoản vì đã có lịch sử.' });
      refresh();
    } catch (deleteError) {
      setNotice({ type: 'error', message: errorMessage(deleteError, 'Không thể xóa tài khoản.') });
    }
  }

  const filtered = staffUsers.filter((user) => {
    if (!showInactive && !user.isActive) return false;
    if (filterRole && user.role !== filterRole) return false;
    if (filterUnit && !((user.unitPermissions ?? []).some((unit) => unit.unit === filterUnit) || user.unit === filterUnit)) return false;
    const query = search.trim().toLowerCase();
    return !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || (user.department ?? '').toLowerCase().includes(query);
  });
  const nameOptions = [...new Set(staffUsers.map((user) => user.name.trim()).filter(Boolean))].map((name) => ({ value: name }));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedStaffUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function submitNameSearch() {
    setSearch(searchDraft.trim());
    setPage(1);
  }

  function updatePagination(nextPage: number, nextPageSize = pageSize) {
    setPage(nextPage);
    setPageSize(nextPageSize);
  }

  const columns: TableColumnsType<StaffUser> = [
    {
      title: 'Nhân viên',
      key: 'staff',
      fixed: 'left',
      width: 230,
      render: (_, user) => (
        <Space size="small">
          <Avatar>{initials(user.name)}</Avatar>
          <Space direction="vertical" size={0} className="min-w-0">
            <Typography.Text strong ellipsis className="max-w-32">{user.name}</Typography.Text>
            <Typography.Text type="secondary" className="text-xs">Tạo {new Date(user.createdAt).toLocaleDateString('vi-VN')}</Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Email đăng nhập',
      dataIndex: 'email',
      width: 230,
      render: (email: string) => <Typography.Text code ellipsis className="max-w-48">{email}</Typography.Text>,
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      width: 200,
      render: (role: StaffRoleValue) => <Tag>{STAFF_ROLE_META[role].icon} {STAFF_ROLE_META[role].label}</Tag>,
    },
    {
      title: 'Đơn vị',
      key: 'units',
      width: 260,
      render: (_, user) => user.unitPermissions?.length ? (
        <Space size={[4, 4]} wrap>
          {user.unitPermissions.map((unit) => <Tag key={unit.id}>{unit.icon?.trim() || '🏬'} {staffPermissionUnitLabel(unit)}</Tag>)}
        </Space>
      ) : <Typography.Text type="secondary">{user.unit ?? '—'}</Typography.Text>,
    },
    {
      title: 'Bộ phận',
      dataIndex: 'department',
      width: 180,
      render: (department: string | null) => department ? <Typography.Text ellipsis className="max-w-36">{department}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      align: 'center',
      width: 125,
      render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? 'Hoạt động' : 'Vô hiệu'}</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      align: 'right',
      width: 150,
      render: (_, user) => staffActions(user),
    },
  ];

  function staffActions(user: StaffUser) {
    const canManageLifecycle = user.role === 'RECEIVING' || user.role === 'CHECKIN' || (canManageAdminOpe && user.role === 'ADMIN_OPE');
    const isScopeOnly = user.role === 'ADMIN_OPE' && !canManageAdminOpe;
    return (
      <Space size="small" onClick={(event) => event.stopPropagation()}>
        {(canManageLifecycle || isScopeOnly) && (
          <Tooltip title={isScopeOnly ? 'Chỉnh phạm vi đơn vị' : 'Chỉnh sửa nhân viên'}>
            <Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Chỉnh sửa ${user.name}`} onClick={() => { setSelected(user); setModal('edit'); }} />
          </Tooltip>
        )}
        {canManageLifecycle && (
          <Tooltip title="Đặt lại mật khẩu">
            <Button type="primary" size="small" icon={<KeyOutlined />} aria-label={`Đặt lại mật khẩu ${user.name}`} onClick={() => { setSelected(user); setModal('reset'); }} />
          </Tooltip>
        )}
        {canManageLifecycle && (
          <Popconfirm
            title={`${user.isActive ? 'Vô hiệu hóa / xóa' : 'Xóa'} ${user.name}?`}
            description="Nếu tài khoản đã có lịch sử, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn."
            okText="Xác nhận"
            cancelText="Hủy"
            okButtonProps={{ color: 'danger', variant: 'solid' }}
            onConfirm={() => confirmDelete(user)}
          >
            <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa ${user.name}`} />
          </Popconfirm>
        )}
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      {modal === 'create' && <StaffUserModal unitConfigs={unitConfigs} canManageAdminOpe={canManageAdminOpe} onClose={closeModal} onSaved={() => { closeModal(); refresh(); }} />}
      {modal === 'edit' && selected && <StaffUserModal user={selected} unitConfigs={unitConfigs} canManageAdminOpe={canManageAdminOpe} onClose={closeModal} onSaved={() => { closeModal(); refresh(); }} />}
      {modal === 'reset' && selected && <ResetStaffPasswordModal user={selected} onClose={closeModal} />}

      {notice && <Alert type={notice.type} message={notice.message} showIcon closable onClose={() => setNotice(null)} />}

      <Row gutter={[12, 12]}>
        {STAFF_ROLES.map((role) => {
          const activeCount = staffUsers.filter((user) => user.role === role && user.isActive).length;
          return (
            <Col key={role} xs={24} sm={8}>
              <Card size="small" className="h-full">
                <Statistic title={STAFF_ROLE_META[role].label} value={activeCount} suffix={<Tag color="success">Hoạt động</Tag>} />
              </Card>
            </Col>
          );
        })}
      </Row>

      <ResponsiveDataToolbar
        filters={(
          <>
            <Space direction="vertical" size={4} className="w-full sm:w-auto">
              <Typography.Text type="secondary">Tìm kiếm</Typography.Text>
              <AutoComplete
                className="w-full sm:w-64"
                value={searchDraft}
                options={nameOptions}
                open={searchOpen && Boolean(searchDraft.trim())}
                notFoundContent="Không có dữ liệu"
                onFocus={() => setSearchOpen(Boolean(searchDraft.trim()))}
                onBlur={() => setSearchOpen(false)}
                onChange={(value) => { setSearchDraft(value); setSearchOpen(Boolean(value.trim())); }}
                onSelect={(value) => { setSearchDraft(value); setSearchOpen(false); }}
                filterOption={(inputValue, option) => String(option?.value ?? '').toLocaleLowerCase('vi-VN').includes(inputValue.toLocaleLowerCase('vi-VN'))}
              >
                <Input.Search allowClear placeholder="Tên, email, bộ phận..." enterButton={<SearchButton />} onSearch={submitNameSearch} />
              </AutoComplete>
            </Space>
            <Space direction="vertical" size={4}>
              <Typography.Text type="secondary">Vai trò</Typography.Text>
              <Select className="min-w-48" allowClear placeholder="Tất cả vai trò" value={filterRole || undefined} onChange={(value) => { setFilterRole(value ?? ''); setPage(1); }} options={STAFF_ROLES.map((role) => ({ value: role, label: `${STAFF_ROLE_META[role].icon} ${STAFF_ROLE_META[role].label}` }))} />
            </Space>
            <Space direction="vertical" size={4}>
              <Typography.Text type="secondary">Đơn vị</Typography.Text>
              <Select className="min-w-48" allowClear placeholder="Tất cả đơn vị" value={filterUnit || undefined} onChange={(value) => { setFilterUnit(value ?? ''); setPage(1); }} options={unitConfigs.map((unit) => ({ value: unit.unit, label: `${unit.icon?.trim() || '🏬'} ${unitLabel(unit)}` }))} />
            </Space>
            <Space align="center">
              <Switch checked={showInactive} onChange={(checked) => { setShowInactive(checked); setPage(1); }} />
              <Typography.Text>Hiện tài khoản vô hiệu</Typography.Text>
            </Space>
          </>
        )}
        createAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModal('create')}>Thêm nhân viên</Button>}
      />

      {isError ? (
        <Result status="error" title="Không thể tải danh sách nhân viên" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />
      ) : isLoading ? (
        <Card size="small" loading />
      ) : screens.lg ? (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table<StaffUser>
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={filtered}
            locale={{ emptyText: <Empty description="Không có nhân viên phù hợp" /> }}
            scroll={{ x: 1400 }}
            rowClassName={(user) => user.isActive ? '' : 'opacity-60'}
            pagination={{
              position: ['bottomCenter'],
              size: 'small',
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} nhân viên`,
              current: currentPage,
              pageSize,
              onChange: updatePagination,
            }}
          />
        </Card>
      ) : pagedStaffUsers.length === 0 ? (
        <Empty description="Không có nhân viên phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" size="middle" className="w-full">
          <Collapse
            items={pagedStaffUsers.map((user) => ({
              key: user.id,
              label: (
                <Space size="small" className="min-w-0" align="start">
                  <Avatar>{initials(user.name)}</Avatar>
                  <Space direction="vertical" size={0} className="min-w-0">
                    <Typography.Text strong ellipsis className="block max-w-40">{user.name}</Typography.Text>
                    <Typography.Text type="secondary" ellipsis className="block max-w-40">{user.email}</Typography.Text>
                  </Space>
                </Space>
              ),
              extra: staffActions(user),
              children: (
                <Descriptions size="small" column={1} items={[
                  { key: 'email', label: 'Email đăng nhập', children: <Typography.Text code>{user.email}</Typography.Text> },
                  { key: 'role', label: 'Vai trò', children: <Tag>{STAFF_ROLE_META[user.role].icon} {STAFF_ROLE_META[user.role].label}</Tag> },
                  { key: 'units', label: 'Đơn vị', children: user.unitPermissions?.length ? <Space size={[4, 4]} wrap>{user.unitPermissions.map((unit) => <Tag key={unit.id}>{unit.icon?.trim() || '🏬'} {staffPermissionUnitLabel(unit)}</Tag>)}</Space> : user.unit || '—' },
                  { key: 'department', label: 'Bộ phận', children: user.department || '—' },
                  { key: 'status', label: 'Trạng thái', children: <Tag color={user.isActive ? 'success' : 'default'}>{user.isActive ? 'Hoạt động' : 'Vô hiệu'}</Tag> },
                  { key: 'created', label: 'Tạo lúc', children: new Date(user.createdAt).toLocaleDateString('vi-VN') },
                ]} />
              ),
            }))}
          />
          <Flex justify="center">
            <Pagination current={currentPage} pageSize={pageSize} total={filtered.length} size="small" showSizeChanger={false} showTotal={(total) => `Tổng ${total} nhân viên`} onChange={updatePagination} />
          </Flex>
        </Space>
      )}
    </Space>
  );
}
