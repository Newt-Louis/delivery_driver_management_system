import { FormEvent, useMemo, useState } from 'react';
import { Alert, AutoComplete, Avatar, Button, Card, Checkbox, Collapse, Descriptions, Empty, Flex, Grid, Input, Modal, Pagination, Popconfirm, Select, Space, Table, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import ResponsiveDataToolbar, { SearchButton } from '../../backoffice/components/ResponsiveDataToolbar';
import type { UnitConfig } from '../../../lib/types';
import { superadminApi } from '../api';
import type { BusinessLocation } from '../types';
import { StatusBadge } from './shared';
import DatafileImageUpload, { type DatafileImageValue } from '../../../components/DatafileImageUpload';
import { hasPendingUploadFile, uploadDatafileAsset } from '../../../lib/datafileUpload';

type UnitFormState = {
  businessLocationId: string;
  unit: string;
  displayName: string;
  shortName: string;
  description: string;
  icon: string;
  logoUrl: string;
  logoOriginalName?: string;
  logoFile?: File;
  primaryColor: string;
  isActive: boolean;
  freshFoodEnabled: boolean;
  generalGoodsEnabled: boolean;
  thiCongEnabled: boolean;
  sundayFreshFoodOnly: boolean;
  truckSlotMinutes: number;
  motorbikeSlotMinutes: number;
  truckMaxPerSlot: number;
  motorbikeMaxPerSlot: number;
  vendorApiUrl: string;
  vendorApiKey: string;
  poApiUrl: string;
  poApiKey: string;
};

function formFromUnit(unit: UnitConfig | null, businessLocationId: string): UnitFormState {
  return {
    businessLocationId: unit?.businessLocationId || businessLocationId,
    unit: unit?.unit || '',
    displayName: unit?.displayName || '',
    shortName: unit?.shortName || '',
    description: unit?.description || '',
    icon: unit?.icon || '',
    logoUrl: unit?.logoUrl || '',
    logoOriginalName: undefined,
    primaryColor: unit?.primaryColor || '#1C1C1C',
    isActive: unit?.isActive ?? true,
    freshFoodEnabled: unit?.freshFoodEnabled ?? true,
    generalGoodsEnabled: unit?.generalGoodsEnabled ?? true,
    thiCongEnabled: unit?.thiCongEnabled ?? true,
    sundayFreshFoodOnly: unit?.sundayFreshFoodOnly ?? false,
    truckSlotMinutes: unit?.truckSlotMinutes ?? 30,
    motorbikeSlotMinutes: unit?.motorbikeSlotMinutes ?? 15,
    truckMaxPerSlot: unit?.truckMaxPerSlot ?? 1,
    motorbikeMaxPerSlot: unit?.motorbikeMaxPerSlot ?? 3,
    vendorApiUrl: unit?.vendorApiUrl || '',
    vendorApiKey: '',
    poApiUrl: unit?.poApiUrl || '',
    poApiKey: '',
  };
}

function unitPayload(form: UnitFormState) {
  const { logoOriginalName: _logoOriginalName, logoFile: _logoFile, ...rest } = form;
  void _logoOriginalName;
  void _logoFile;
  return {
    ...rest,
    unit: form.unit.toUpperCase().trim(),
    icon: form.icon || null,
    logoUrl: form.logoUrl || null,
    vendorApiUrl: form.vendorApiUrl || null,
    vendorApiKey: form.vendorApiKey || null,
    poApiUrl: form.poApiUrl || null,
    poApiKey: form.poApiKey || null,
    truckSlotMinutes: Number(form.truckSlotMinutes),
    motorbikeSlotMinutes: Number(form.motorbikeSlotMinutes),
    truckMaxPerSlot: Number(form.truckMaxPerSlot),
    motorbikeMaxPerSlot: Number(form.motorbikeMaxPerSlot),
  };
}

function UnitForm({
  locations,
  businessLocationId,
  onDone, onCancel, onSavingChange,
}: {
  locations: BusinessLocation[];
  businessLocationId: string;
  onDone: () => void;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [form, setForm] = useState<UnitFormState>(() => formFromUnit(null, businessLocationId || locations[0]?.id || ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function setBusinessLocation(id: string) {
    setForm((current) => ({ ...current, businessLocationId: id }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    onSavingChange(true);
    try {
      const createPayload = {
        ...unitPayload(form),
        logoUrl: hasPendingUploadFile(form.logoFile) ? null : form.logoUrl || null,
      };
      const created = (await superadminApi.createUnit(createPayload)).data as UnitConfig;
      const logoUrl = await uploadUnitLogoIfNeeded(created.id, form.logoUrl, form.logoOriginalName, form.logoFile);
      if (logoUrl !== createPayload.logoUrl) {
        await superadminApi.updateUnit(created.id, { logoUrl });
      }
      onDone();
      setForm({ ...form, unit: '', displayName: '', shortName: '', description: '', icon: '', logoUrl: '', logoOriginalName: undefined, logoFile: undefined, vendorApiKey: '', poApiKey: '' });
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không tạo được unit.');
    } finally { setSaving(false); onSavingChange(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Location *</label>
          <Select style={{ width: '100%' }} value={form.businessLocationId || undefined} onChange={setBusinessLocation} options={locations.map(location => ({ value: location.id, label: `${location.code} - ${location.locationName}` }))} />
        </div>
        <div>
          <label className="label">UNIT_CODE *</label>
          <Input className="input font-mono" placeholder="UNIT_CODE" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
          <p className="text-[11px] text-thiso-400 leading-relaxed mt-1">
            Hệ thống hiện tại chỉ hỗ trợ các code sau: EMART, E-MART, E MART, THISKY, THISKYHALL, THISOMALL, THISO MALL, MALL. Nếu nhập sai hệ thống sẽ không thể xác thực đơn vị thành công
          </p>
        </div>
        <div>
          <label className="label">Tên hiển thị *</label>
          <Input className="input" placeholder="Tên hiển thị" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
        </div>
        <div>
          <label className="label">Tên ngắn</label>
          <Input className="input" placeholder="Tên ngắn" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
        </div>
        <div>
          <label className="label">Icon</label>
          <Input className="input" placeholder="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        </div>
        <div>
          <label className="label">Màu chính</label>
          <Input className="input font-mono" placeholder="#1C1C1C" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">Mô tả</label>
          <Input className="input" placeholder="Mô tả ngắn về đơn vị nhận hàng" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-span-2">
          <DatafileImageUpload
            label="Logo đơn vị"
            value={{ url: form.logoUrl || null, originalName: form.logoOriginalName }}
            onChange={(v: DatafileImageValue) => setForm({ ...form, logoUrl: v.url || '', logoOriginalName: v.originalName, logoFile: v.file })}
            buttonLabel="Tải lên logo"
          />
        </div>
      </div>

      <div className="flex items-center gap-5 pt-1">
        <label className="flex items-center gap-2 text-sm text-thiso-600 cursor-pointer">
          <Checkbox checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}>Active</Checkbox>
        </label>
        {error && <Alert type="error" message={error} />}
        <Button onClick={onCancel} disabled={saving}>Hủy</Button><Button type="primary" htmlType="submit" disabled={!form.businessLocationId} loading={saving}>Tạo unit</Button>
      </div>
    </form>
  );
}

function UnitEditModal({
  unit,
  locations,
  onClose,
  onDone,
}: {
  unit: UnitConfig;
  locations: BusinessLocation[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<UnitFormState>(() => formFromUnit(unit, unit.businessLocationId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof UnitFormState>(key: K, value: UnitFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const logoUrl = await uploadUnitLogoIfNeeded(unit.id, form.logoUrl, form.logoOriginalName, form.logoFile);
      const { businessLocationId: _businessLocationId, ...payload } = { ...unitPayload(form), logoUrl };
      void _businessLocationId;
      await superadminApi.updateUnit(unit.id, payload);
      onDone();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được unit.');
    } finally {
      setSaving(false);
    }
  }

  const boolFields: Array<[keyof UnitFormState, string]> = [
    ['isActive', 'Đang hoạt động'],
    ['freshFoodEnabled', 'Nhận hàng tươi sống'],
    ['generalGoodsEnabled', 'Nhận hàng thường'],
    ['thiCongEnabled', 'Nhận hàng thi công'],
    ['sundayFreshFoodOnly', 'Chủ nhật chỉ nhận hàng tươi sống'],
  ];

  return (
    <Modal open title="Chỉnh sửa unit" onCancel={onClose} footer={null} width={900} maskClosable={!saving} closable={!saving} keyboard={!saving}>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="label">Location</label>
              <Select style={{ width: '100%' }} value={form.businessLocationId} disabled options={locations.map(location => ({ value: location.id, label: `${location.code} - ${location.locationName}` }))} />
            </div>
            <div>
              <label className="label">Unit code</label>
              <Input className="input font-mono" value={form.unit} onChange={(e) => set('unit', e.target.value.toUpperCase())} required />
            </div>
            <div>
              <label className="label">Tên hiển thị</label>
              <Input className="input" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} required />
            </div>
            <div>
              <label className="label">Tên ngắn</label>
              <Input className="input" value={form.shortName} onChange={(e) => set('shortName', e.target.value)} />
            </div>
            <div>
              <label className="label">Icon</label>
              <Input className="input" value={form.icon} onChange={(e) => set('icon', e.target.value)} />
            </div>
            <div>
              <label className="label">Màu chính</label>
              <Input className="input font-mono" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <DatafileImageUpload
                label="Logo đơn vị"
                value={{ url: form.logoUrl || null, originalName: form.logoOriginalName }}
                onChange={(v: DatafileImageValue) => {
                  set('logoUrl', (v.url || '') as UnitFormState['logoUrl']);
                  set('logoOriginalName', v.originalName as UnitFormState['logoOriginalName']);
                  set('logoFile', v.file as UnitFormState['logoFile']);
                }}
                buttonLabel="Tải lên logo"
              />
            </div>
            <div className="md:col-span-4">
              <label className="label">Mô tả</label>
              <Input className="input" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-5 gap-2">
            {boolFields.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-xl border border-thiso-100 bg-thiso-50 px-3 py-2 text-sm text-thiso-700">
                <Checkbox checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked as UnitFormState[typeof key])}>{label}</Checkbox>
              </label>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="label">Xe tải phút/slot</label>
              <Input type="number" className="input" value={form.truckSlotMinutes} onChange={(e) => set('truckSlotMinutes', Number(e.target.value))} min={1} max={1440} />
            </div>
            <div>
              <label className="label">Xe tải tối đa/slot</label>
              <Input type="number" className="input" value={form.truckMaxPerSlot} onChange={(e) => set('truckMaxPerSlot', Number(e.target.value))} min={1} max={100} />
            </div>
            <div>
              <label className="label">Xe máy phút/slot</label>
              <Input type="number" className="input" value={form.motorbikeSlotMinutes} onChange={(e) => set('motorbikeSlotMinutes', Number(e.target.value))} min={1} max={1440} />
            </div>
            <div>
              <label className="label">Xe máy tối đa/slot</label>
              <Input type="number" className="input" value={form.motorbikeMaxPerSlot} onChange={(e) => set('motorbikeMaxPerSlot', Number(e.target.value))} min={1} max={100} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label">Vendor API URL</label>
              <Input className="input" value={form.vendorApiUrl} onChange={(e) => set('vendorApiUrl', e.target.value)} />
            </div>
            <div>
              <label className="label">Vendor API key</label>
              <Input className="input" type="password" value={form.vendorApiKey} onChange={(e) => set('vendorApiKey', e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>
            <div>
              <label className="label">PO API URL</label>
              <Input className="input" value={form.poApiUrl} onChange={(e) => set('poApiUrl', e.target.value)} />
            </div>
            <div>
              <label className="label">PO API key</label>
              <Input className="input" type="password" value={form.poApiKey} onChange={(e) => set('poApiKey', e.target.value)} placeholder="Để trống nếu không đổi" />
            </div>
          </div>

          {error && <Alert type="error" message={error} />}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} disabled={saving}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Lưu</Button>
          </div>
        </form>
    </Modal>
  );
}

async function uploadUnitLogoIfNeeded(unitConfigId: string, value: string | null | undefined, originalName: string | undefined, file?: File) {
  if (!hasPendingUploadFile(file)) return value || null;
  const uploaded = await uploadDatafileAsset({
    scope: 'UNIT_CONFIG',
    category: 'LOGO',
    unitConfigId,
    originalName: originalName ?? 'unit-logo.png',
    file,
  });
  return uploaded.publicUrl;
}

export default function UnitConfigsTab({
  locations,
  units,
  businessLocationId,
  onBusinessLocationChange,
  onRefresh,
}: {
  locations: BusinessLocation[];
  units: UnitConfig[];
  businessLocationId: string;
  onBusinessLocationChange: (id: string) => void;
  onRefresh: () => void;
}) {
  const [editUnit, setEditUnit] = useState<UnitConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [status, setStatus] = useState('');
  const screens = Grid.useBreakpoint();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const visibleUnits = useMemo(
    () => units.filter((unit) => (!businessLocationId || unit.businessLocationId === businessLocationId) && (!search || (unit.displayName || unit.unit).toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))) && (!status || (status === 'active') === (unit.isActive ?? true))),
    [businessLocationId, units, search, status],
  );

  async function removeUnit(id: string) {
    try { await superadminApi.deleteUnit(id); onRefresh(); } catch { message.error('Không thể vô hiệu hóa unit.'); }
  }

  const names = [...new Set(units.map(unit => unit.displayName || unit.unit))].map(value => ({ value }));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleUnits.length / pageSize)));
  const paged = visibleUnits.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function updatePagination(nextPage: number, nextSize = pageSize) { setPage(nextPage); setPageSize(nextSize); }
  function locationName(unit: UnitConfig) { return locations.find(location => location.id === unit.businessLocationId)?.locationName ?? unit.businessLocationId; }
  function actions(unit: UnitConfig) {
    return <Space size="small" onClick={event => event.stopPropagation()}>
      <Tooltip title="Chỉnh sửa unit"><Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Sửa unit ${unit.unit}`} onClick={() => setEditUnit(unit)} /></Tooltip>
      <Popconfirm title="Deactivate hoặc xóa unit này?" onConfirm={() => removeUnit(unit.id)}><Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Vô hiệu hóa unit ${unit.unit}`} /></Popconfirm>
    </Space>;
  }
  const columns: import('antd').TableColumnsType<UnitConfig> = [
    { title: 'Unit', dataIndex: 'unit', width: 160, render: (code: string) => <Typography.Text strong code>{code}</Typography.Text> },
    { title: 'Tên unit', key: 'name', width: 240, render: (_, unit) => <Space><Avatar src={unit.logoUrl || undefined}>{(unit.displayName || unit.unit).charAt(0)}</Avatar><Typography.Text>{unit.displayName || unit.unit}</Typography.Text></Space> },
    { title: 'Location', key: 'location', render: (_, unit) => locationName(unit) },
    { title: 'Xe tải', key: 'truck', render: (_, unit) => `${unit.truckSlotMinutes} phút / ${unit.truckMaxPerSlot} xe` },
    { title: 'Xe máy', key: 'motorbike', render: (_, unit) => `${unit.motorbikeSlotMinutes} phút / ${unit.motorbikeMaxPerSlot} xe` },
    { title: 'Trạng thái', key: 'status', render: (_, unit) => <StatusBadge active={unit.isActive ?? true} /> },
    { title: 'Thao tác', key: 'actions', fixed: 'right', width: 120, render: (_, unit) => actions(unit) },
  ];
  return <Space orientation="vertical" size="large" className="w-full">
    <ResponsiveDataToolbar filters={<><Space orientation="vertical" size={4} className="w-full sm:w-auto"><Typography.Text type="secondary">Tìm tên unit</Typography.Text><AutoComplete className="w-full sm:w-64" value={searchDraft} options={names} open={searchOpen && Boolean(searchDraft.trim())} onFocus={() => setSearchOpen(Boolean(searchDraft.trim()))} onBlur={() => setSearchOpen(false)} onChange={value => { setSearchDraft(value); setSearchOpen(Boolean(value.trim())); }} onSelect={value => { setSearchDraft(value); setSearchOpen(false); }} filterOption={(input, option) => String(option?.value ?? '').toLocaleLowerCase('vi-VN').includes(input.toLocaleLowerCase('vi-VN'))}><Input.Search aria-label="Tìm tên unit" allowClear placeholder="Nhập tên unit" enterButton={<SearchButton />} onSearch={value => { setSearch(value.trim()); setSearchOpen(false); setPage(1); }} /></AutoComplete></Space><Space orientation="vertical" size={4}><Typography.Text type="secondary">Location</Typography.Text><Select aria-label="Location" className="min-w-52" allowClear placeholder="Tất cả locations" value={businessLocationId || undefined} onChange={value => { onBusinessLocationChange(value ?? ''); setPage(1); }} options={locations.map(location => ({ value: location.id, label: `${location.code} - ${location.locationName}` }))} /></Space><Space orientation="vertical" size={4}><Typography.Text type="secondary">Trạng thái</Typography.Text><Select aria-label="Trạng thái unit" className="min-w-44" allowClear placeholder="Tất cả trạng thái" value={status || undefined} onChange={value => { setStatus(value ?? ''); setPage(1); }} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Space></>} createAction={<Button type="primary" icon={<PlusOutlined />} disabled={!locations.length} onClick={() => setCreating(true)}>Thêm unit</Button>} />
    {screens.lg ? <Card size="small" styles={{ body: { padding: 0 } }}><Table<UnitConfig> rowKey="id" columns={columns} dataSource={visibleUnits} scroll={{ x: 1100 }} locale={{ emptyText: <Empty description="Không có unit phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} pagination={{ position: ['bottomCenter'], size: 'small', current: currentPage, pageSize, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: total => `${total} unit`, onChange: updatePagination }} /></Card> : paged.length === 0 ? <Empty description="Không có unit phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <Space orientation="vertical" size="middle" className="w-full"><Collapse items={paged.map(unit => ({ key: unit.id, label: <Space orientation="vertical" size={0} className="min-w-0"><Typography.Text strong code>{unit.unit}</Typography.Text><Typography.Text style={{ overflowWrap: 'anywhere' }}>{unit.displayName || unit.unit}</Typography.Text></Space>, extra: actions(unit), children: <Descriptions size="small" column={1} items={[{ key: 'logo', label: 'Logo', children: <Avatar src={unit.logoUrl || undefined}>{(unit.displayName || unit.unit).charAt(0)}</Avatar> }, { key: 'location', label: 'Location', children: locationName(unit) }, { key: 'truck', label: 'Xe tải', children: `${unit.truckSlotMinutes} phút / ${unit.truckMaxPerSlot} xe` }, { key: 'motorbike', label: 'Xe máy', children: `${unit.motorbikeSlotMinutes} phút / ${unit.motorbikeMaxPerSlot} xe` }, { key: 'status', label: 'Trạng thái', children: <StatusBadge active={unit.isActive ?? true} /> }]} /> }))} /><Flex justify="center"><Pagination current={currentPage} pageSize={pageSize} total={visibleUnits.length} size="small" showSizeChanger={false} showTotal={total => `${total} unit`} onChange={updatePagination} /></Flex></Space>}
    {creating && <Modal open title="Tạo unit mới" footer={null} width={800} closable={!createSaving} maskClosable={!createSaving} keyboard={!createSaving} onCancel={() => setCreating(false)} destroyOnHidden><UnitForm locations={locations} businessLocationId={businessLocationId} onSavingChange={setCreateSaving} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); onRefresh(); }} /></Modal>}
    {editUnit && <UnitEditModal unit={editUnit} locations={locations} onClose={() => setEditUnit(null)} onDone={() => { setEditUnit(null); onRefresh(); }} />}
  </Space>;
}
