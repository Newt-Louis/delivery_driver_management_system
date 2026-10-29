import { FormEvent, useMemo, useState } from 'react';
import { Alert, AutoComplete, Avatar, Button, Card, Checkbox, Collapse, Descriptions, Empty, Flex, Grid, Input, Modal, Pagination, Popconfirm, Select, Space, Table, Tooltip, Typography, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import ResponsiveDataToolbar, { SearchButton } from '../../backoffice/components/ResponsiveDataToolbar';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { StatusBadge } from './shared';
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

function LocationForm({ item, onDone, onCancel, onSavingChange }: {
  item?: BusinessLocation;
  onDone: () => void;
  onCancel?: () => void;
  onSavingChange: (saving: boolean) => void;
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
    onSavingChange(true);
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
      onSavingChange(false);
    }
  }

  const isEdit = !!item;

  return <form onSubmit={submit}><div className="grid sm:grid-cols-2 gap-4"><label>Code *<Input placeholder="VD: THT or PVT or SALA" value={form.code} onChange={e => set('code', e.target.value)} required disabled={isEdit} />{isEdit && <Typography.Text type="secondary">Code không thể thay đổi sau khi tạo.</Typography.Text>}</label><label>Tên location *<Input placeholder="Tên khu vực" value={form.locationName} onChange={e => set('locationName', e.target.value)} required /></label><label>Địa chỉ<Input value={form.address} onChange={e => set('address', e.target.value)} /></label><label>Tagline<Input value={form.tagline} onChange={e => set('tagline', e.target.value)} /><Typography.Text type="secondary">Hiển thị dưới tên trên màn hình chờ và đăng ký.</Typography.Text></label><DatafileImageUpload label="Logo chính (navbar, màn hình chờ)" value={{ url: form.logoUrl, originalName: form.logoOriginalName }} onChange={(v: DatafileImageValue) => setForm(current => ({ ...current, logoUrl: v.url, logoOriginalName: v.originalName, logoFile: v.file }))} buttonLabel="Tải lên logo" /><DatafileImageUpload label="Avatar (trang đăng ký, phiếu in)" value={{ url: form.avatarUrl, originalName: form.avatarOriginalName }} onChange={(v: DatafileImageValue) => setForm(current => ({ ...current, avatarUrl: v.url, avatarOriginalName: v.originalName, avatarFile: v.file }))} buttonLabel="Tải lên avatar" /></div><Space wrap className="mt-4"><Checkbox checked={form.isActive} onChange={e => set('isActive', e.target.checked)}>Active</Checkbox>{onCancel && <Button onClick={onCancel} disabled={saving}>Huỷ</Button>}<Button type="primary" htmlType="submit" loading={saving}>{isEdit ? 'Lưu thay đổi' : 'Tạo location'}</Button></Space>{error && <Alert type="error" message={error} className="mt-3" />}</form>;

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
  const [modalSaving, setModalSaving] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  async function removeLocation(id: string) {
    try { await superadminApi.deleteLocation(id); onRefresh(); } catch { message.error('Không thể vô hiệu hóa location.'); }
  }

  function doneCreate() { setCreating(false); onRefresh(); }
  function doneEdit()   { setEditingId(null); onRefresh(); }

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState<string>('');
  const screens = Grid.useBreakpoint();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const selected = locations.find(location => location.id === editingId);
  const visible = useMemo(() => locations.filter(location => (!search || location.locationName.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))) && (!status || (status === 'active') === location.isActive)), [locations, search, status]);
  const names = [...new Set(locations.map(location => location.locationName))].map(value => ({ value }));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / pageSize)));
  const paged = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function updatePagination(nextPage: number, nextSize = pageSize) { setPage(nextPage); setPageSize(nextSize); }
  function actions(location: BusinessLocation) {
    return <Space size="small" onClick={event => event.stopPropagation()}>
      <Tooltip title="Chỉnh sửa location"><Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Sửa location ${location.code}`} onClick={() => setEditingId(location.id)} /></Tooltip>
      <Popconfirm title="Deactivate hoặc xóa location này?" onConfirm={() => removeLocation(location.id)}><Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Vô hiệu hóa location ${location.code}`} /></Popconfirm>
    </Space>;
  }
  const columns: import('antd').TableColumnsType<BusinessLocation> = [
    { title: 'Code', dataIndex: 'code', width: 150, render: (code: string) => <Typography.Text strong code>{code}</Typography.Text> },
    { title: 'Tên location', key: 'name', width: 240, render: (_, location) => <Space><Avatar src={location.logoUrl || undefined}>{location.code.charAt(0)}</Avatar><Typography.Text>{location.locationName}</Typography.Text></Space> },
    { title: 'Tagline', key: 'tagline', render: (_, location) => location.tagline || '—' },
    { title: 'Địa chỉ', key: 'address', render: (_, location) => location.address || '—' },
    { title: 'Liên kết', key: 'linked', render: (_, location) => `${location._count?.unitConfigs ?? 0} units · ${location._count?.users ?? 0} users` },
    { title: 'Trạng thái', key: 'status', render: (_, location) => <StatusBadge active={location.isActive} /> },
    { title: 'Thao tác', key: 'actions', fixed: 'right', width: 120, render: (_, location) => actions(location) },
  ];

  return <Space orientation="vertical" size="large" className="w-full">
    <ResponsiveDataToolbar filters={<><Space orientation="vertical" size={4} className="w-full sm:w-auto"><Typography.Text type="secondary">Tìm tên location</Typography.Text><AutoComplete className="w-full sm:w-64" value={searchDraft} options={names} open={searchOpen && Boolean(searchDraft.trim())} onFocus={() => setSearchOpen(Boolean(searchDraft.trim()))} onBlur={() => setSearchOpen(false)} onChange={value => { setSearchDraft(value); setSearchOpen(Boolean(value.trim())); }} onSelect={value => { setSearchDraft(value); setSearchOpen(false); }} filterOption={(input, option) => String(option?.value ?? '').toLocaleLowerCase('vi-VN').includes(input.toLocaleLowerCase('vi-VN'))}><Input.Search aria-label="Tìm tên location" allowClear placeholder="Nhập tên location" enterButton={<SearchButton />} onSearch={value => { setSearch(value.trim()); setSearchOpen(false); setPage(1); }} /></AutoComplete></Space><Space orientation="vertical" size={4}><Typography.Text type="secondary">Trạng thái</Typography.Text><Select aria-label="Trạng thái location" className="min-w-44" allowClear placeholder="Tất cả trạng thái" value={status || undefined} onChange={value => { setStatus(value ?? ''); setPage(1); }} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Space></>} createAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Thêm location</Button>} />
    {screens.lg ? <Card size="small" styles={{ body: { padding: 0 } }}><Table<BusinessLocation> rowKey="id" columns={columns} dataSource={visible} scroll={{ x: 1150 }} locale={{ emptyText: <Empty description="Không có location phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} pagination={{ position: ['bottomCenter'], size: 'small', current: currentPage, pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `${total} location`, onChange: updatePagination }} /></Card> : paged.length === 0 ? <Empty description="Không có location phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <Space orientation="vertical" size="middle" className="w-full"><Collapse items={paged.map(location => ({ key: location.id, label: <Space orientation="vertical" size={0} className="min-w-0"><Typography.Text strong code>{location.code}</Typography.Text><Typography.Text style={{ overflowWrap: 'anywhere' }}>{location.locationName}</Typography.Text></Space>, extra: actions(location), children: <Descriptions size="small" column={1} items={[{ key: 'logo', label: 'Logo', children: <Avatar src={location.logoUrl || undefined}>{location.code.charAt(0)}</Avatar> }, { key: 'tagline', label: 'Tagline', children: location.tagline || '—' }, { key: 'address', label: 'Địa chỉ', children: location.address || '—' }, { key: 'linked', label: 'Liên kết', children: `${location._count?.unitConfigs ?? 0} units · ${location._count?.users ?? 0} users` }, { key: 'status', label: 'Trạng thái', children: <StatusBadge active={location.isActive} /> }]} /> }))} /><Flex justify="center"><Pagination current={currentPage} pageSize={pageSize} total={visible.length} size="small" showSizeChanger={false} showTotal={total => `${total} location`} onChange={updatePagination} /></Flex></Space>}
    {(creating || selected) && <Modal open title={selected ? `Chỉnh sửa: ${selected.locationName}` : 'Tạo location mới'} footer={null} width={800} closable={!modalSaving} maskClosable={!modalSaving} keyboard={!modalSaving} onCancel={() => { setCreating(false); setEditingId(null); }} destroyOnHidden><LocationForm onSavingChange={setModalSaving} key={selected?.id ?? 'create'} item={selected} onDone={selected ? doneEdit : doneCreate} onCancel={() => { setCreating(false); setEditingId(null); }} /></Modal>}
  </Space>;
}
