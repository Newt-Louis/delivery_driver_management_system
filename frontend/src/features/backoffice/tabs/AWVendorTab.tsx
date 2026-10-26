import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
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
import api from '../../../lib/api';
import type { AutoWarehouseVendor, UnitConfig } from '../../../lib/types';
import ResponsiveDataToolbar, { SearchButton } from '../components/ResponsiveDataToolbar';

type VendorForm = {
  unitConfigId: string;
  vendorCode: string;
  vendorName: string;
  active: boolean;
  note: string;
};

function unitLabel(unit?: Pick<UnitConfig, 'unit' | 'displayName' | 'shortName' | 'icon'> | null) {
  if (!unit) return 'Không rõ đơn vị';
  const label = unit.displayName || unit.shortName || unit.unit;
  return `${unit.icon ? `${unit.icon} ` : ''}${label}`;
}

function errorMessage(error: unknown, fallback = 'Có lỗi xảy ra.') {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.error ?? response.response?.data?.message ?? fallback;
}

function AWVendorModal({
  vendor,
  defaultUnitConfigId,
  units,
  onClose,
  onSaved,
}: {
  vendor: AutoWarehouseVendor | null;
  defaultUnitConfigId: string;
  units: UnitConfig[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState<VendorForm>({
    unitConfigId: vendor?.unitConfigId ?? defaultUnitConfigId,
    vendorCode: vendor?.vendorCode ?? '',
    vendorName: vendor?.vendorName ?? '',
    active: vendor?.active ?? true,
    note: vendor?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function submit() {
    if (!form.unitConfigId || !form.vendorCode.trim() || !form.vendorName.trim()) {
      setError('Vui lòng nhập đầy đủ đơn vị, mã NCC và tên nhà cung cấp.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.patch(`/api/aw-vendors/${vendor!.id}`, {
          vendorName: form.vendorName.trim(),
          active: form.active,
          note: form.note.trim() || null,
        });
      } else {
        await api.post('/api/aw-vendors', {
          unitConfigId: form.unitConfigId,
          vendorCode: form.vendorCode.trim().toUpperCase(),
          vendorName: form.vendorName.trim(),
          active: form.active,
          note: form.note.trim() || undefined,
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
      title={isEdit ? 'Sửa nhà cung cấp' : 'Thêm NCC kho tự động'}
      width="min(640px, calc(100vw - 32px))"
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' } }}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="submit" type="primary" loading={saving} onClick={submit}>{isEdit ? 'Lưu thay đổi' : 'Thêm NCC'}</Button>,
      ]}
    >
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item label="Đơn vị" required>
          <Select
            value={form.unitConfigId || undefined}
            disabled={isEdit}
            placeholder="Chọn đơn vị"
            options={units.map((unit) => ({ value: unit.id, label: `${unit.unit} - ${unitLabel(unit)}` }))}
            onChange={(value) => setField('unitConfigId', value)}
          />
        </Form.Item>
        <Form.Item label="Mã NCC" required>
          <Input
            value={form.vendorCode}
            disabled={isEdit}
            placeholder="Ví dụ: SUP001, NCCABC"
            onChange={(event) => setField('vendorCode', event.target.value.toUpperCase())}
          />
          {!isEdit && <Typography.Text type="secondary" className="text-xs">Tài xế nhập mã này trong form đăng ký để xác nhận vào kho tự động.</Typography.Text>}
        </Form.Item>
        <Form.Item label="Tên nhà cung cấp" required>
          <Input value={form.vendorName} placeholder="Công ty TNHH ABC" onChange={(event) => setField('vendorName', event.target.value)} />
        </Form.Item>
        <Form.Item label="Ghi chú">
          <Input value={form.note} placeholder="Ghi chú thêm nếu có..." onChange={(event) => setField('note', event.target.value)} />
        </Form.Item>
        <Form.Item label="Trạng thái">
          <Switch checked={form.active} checkedChildren="Hoạt động" unCheckedChildren="Vô hiệu" onChange={(checked) => setField('active', checked)} />
        </Form.Item>
        {error && <Alert type="error" showIcon message={error} />}
      </Form>
    </Modal>
  );
}

export default function AWVendorTab() {
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [unitFilter, setUnitFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AutoWarehouseVendor | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });
  const { data: vendors = [], isLoading, isError, refetch } = useQuery<AutoWarehouseVendor[]>({
    queryKey: ['aw-vendors', unitFilter],
    queryFn: async () => (await api.get('/api/aw-vendors', { params: unitFilter ? { unitConfigId: unitFilter } : undefined })).data,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['aw-vendors'] });
  }

  function closeModal() {
    setModalOpen(false);
    setEditItem(null);
  }

  async function toggleActive(vendor: AutoWarehouseVendor) {
    try {
      await api.patch(`/api/aw-vendors/${vendor.id}`, { active: !vendor.active });
      refresh();
    } catch (toggleError) {
      setNotice({ type: 'error', message: errorMessage(toggleError, 'Không thể cập nhật trạng thái NCC.') });
    }
  }

  async function confirmDelete(vendor: AutoWarehouseVendor) {
    try {
      await api.delete(`/api/aw-vendors/${vendor.id}`);
      setNotice({ type: 'success', message: 'Đã xóa nhà cung cấp.' });
      refresh();
    } catch (deleteError) {
      setNotice({ type: 'error', message: errorMessage(deleteError, 'Không thể xóa nhà cung cấp.') });
    }
  }

  const filteredVendors = vendors.filter((vendor) => !nameSearch || vendor.vendorName.toLocaleLowerCase('vi-VN').includes(nameSearch.toLocaleLowerCase('vi-VN')));
  const nameOptions = [...new Set(vendors.map((vendor) => vendor.vendorName.trim()).filter(Boolean))].map((name) => ({ value: name }));
  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedVendors = filteredVendors.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function submitNameSearch() {
    setNameSearch(searchDraft.trim());
    setPage(1);
  }

  function updatePagination(nextPage: number, nextPageSize = pageSize) {
    setPage(nextPage);
    setPageSize(nextPageSize);
  }

  const columns: TableColumnsType<AutoWarehouseVendor> = [
    {
      title: 'Mã NCC',
      dataIndex: 'vendorCode',
      fixed: 'left',
      width: 150,
      render: (vendorCode: string) => <Typography.Text strong code>{vendorCode}</Typography.Text>,
    },
    {
      title: 'Đơn vị',
      key: 'unit',
      width: 220,
      render: (_, vendor) => {
        const label = unitLabel(vendor.unitConfig ?? unitConfigs.find((unit) => unit.unit === vendor.unit));
        return <Tooltip title={label}><Typography.Text ellipsis className="max-w-48">{label}</Typography.Text></Tooltip>;
      },
    },
    {
      title: 'Tên nhà cung cấp',
      dataIndex: 'vendorName',
      width: 300,
      render: (name: string) => <Tooltip title={name}><Typography.Text ellipsis className="max-w-64">{name}</Typography.Text></Tooltip>,
    },
    {
      title: 'Kích hoạt',
      dataIndex: 'active',
      align: 'center',
      width: 130,
      render: (_: boolean, vendor) => (
        <Switch
          checked={vendor.active}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          aria-label={`${vendor.active ? 'Vô hiệu hóa' : 'Kích hoạt'} ${vendor.vendorCode}`}
          onChange={() => toggleActive(vendor)}
        />
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      width: 280,
      render: (note: string | null) => note ? <Tooltip title={note}><Typography.Text type="secondary" ellipsis className="max-w-64">{note}</Typography.Text></Tooltip> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      align: 'right',
      width: 110,
      render: (_, vendor) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa nhà cung cấp">
            <Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Chỉnh sửa ${vendor.vendorCode}`} onClick={() => { setEditItem(vendor); setModalOpen(true); }} />
          </Tooltip>
          <Popconfirm
            title={`Xóa NCC ${vendor.vendorCode}?`}
            description="Hành động này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ color: 'danger', variant: 'solid' }}
            onConfirm={() => confirmDelete(vendor)}
          >
            <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa ${vendor.vendorCode}`} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  function vendorActions(vendor: AutoWarehouseVendor) {
    return (
      <Space size="small" onClick={(event) => event.stopPropagation()}>
        <Switch
          checked={vendor.active}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          aria-label={`${vendor.active ? 'Vô hiệu hóa' : 'Kích hoạt'} ${vendor.vendorCode}`}
          onChange={() => toggleActive(vendor)}
        />
        <Tooltip title="Chỉnh sửa nhà cung cấp">
          <Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Chỉnh sửa ${vendor.vendorCode}`} onClick={() => { setEditItem(vendor); setModalOpen(true); }} />
        </Tooltip>
        <Popconfirm
          title={`Xóa NCC ${vendor.vendorCode}?`}
          description="Hành động này không thể hoàn tác."
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ color: 'danger', variant: 'solid' }}
          onConfirm={() => confirmDelete(vendor)}
        >
          <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa ${vendor.vendorCode}`} />
        </Popconfirm>
      </Space>
    );
  }

  return (
    <Space orientation="vertical" size="large" className="w-full">
      {modalOpen && (
        <AWVendorModal
          vendor={editItem}
          defaultUnitConfigId={unitFilter || unitConfigs[0]?.id || ''}
          units={unitConfigs}
          onClose={closeModal}
          onSaved={() => { closeModal(); refresh(); setNotice({ type: 'success', message: 'Đã lưu nhà cung cấp.' }); }}
        />
      )}
      {notice && <Alert type={notice.type} message={notice.message} showIcon closable onClose={() => setNotice(null)} />}

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small"><Statistic title="Tổng NCC" value={vendors.length} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small"><Statistic title="Đang hoạt động" value={vendors.filter((vendor) => vendor.active).length} suffix={<Tag color="success">Sẵn sàng</Tag>} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small"><Statistic title="Vô hiệu" value={vendors.filter((vendor) => !vendor.active).length} suffix={<Tag>Không áp dụng</Tag>} /></Card>
        </Col>
      </Row>

      <ResponsiveDataToolbar
        filters={(
          <>
            <Space orientation="vertical" size={4} className="w-full sm:w-auto">
              <Typography.Text type="secondary">Tìm tên NCC</Typography.Text>
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
                <Input.Search allowClear placeholder="Nhập tên NCC" enterButton={<SearchButton />} onSearch={submitNameSearch} />
              </AutoComplete>
            </Space>
            <Space orientation="vertical" size={4}>
              <Typography.Text type="secondary">Đơn vị</Typography.Text>
              <Select
                className="min-w-56"
                allowClear
                placeholder="Tất cả đơn vị"
                value={unitFilter || undefined}
                options={unitConfigs.map((unit) => ({ value: unit.id, label: `${unit.icon?.trim() || '🏬'} ${unitLabel(unit)}` }))}
                onChange={(value) => { setUnitFilter(value ?? ''); setPage(1); }}
              />
            </Space>
          </>
        )}
        createAction={<Button type="primary" icon={<PlusOutlined />} disabled={unitConfigs.length === 0} onClick={() => { setEditItem(null); setModalOpen(true); }}>Thêm NCC</Button>}
      />

      {isError ? (
        <Result status="error" title="Không thể tải danh sách NCC kho tự động" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />
      ) : isLoading ? (
        <Card size="small" loading />
      ) : screens.lg ? (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table<AutoWarehouseVendor>
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={filteredVendors}
            locale={{ emptyText: <Empty description="Chưa có NCC nào cho đơn vị này" /> }}
            scroll={{ x: 1190 }}
            rowClassName={(vendor) => vendor.active ? '' : 'opacity-60'}
            pagination={{
              position: ['bottomCenter'],
              size: 'small',
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} NCC`,
              current: currentPage,
              pageSize,
              onChange: updatePagination,
            }}
          />
        </Card>
      ) : pagedVendors.length === 0 ? (
        <Empty description="Chưa có NCC nào cho đơn vị này" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space orientation="vertical" size="middle" className="w-full">
          <Collapse
            items={pagedVendors.map((vendor) => {
              const unit = vendor.unitConfig ?? unitConfigs.find((unitConfig) => unitConfig.unit === vendor.unit);
              return {
                key: vendor.id,
                label: (
                  <Space orientation="vertical" size={0} className="min-w-0">
                    <Typography.Text strong code>{vendor.vendorCode}</Typography.Text>
                    <Typography.Text type="secondary" ellipsis className="block max-w-44">{unitLabel(unit)}</Typography.Text>
                  </Space>
                ),
                extra: vendorActions(vendor),
                children: (
                  <Descriptions size="small" column={1} items={[
                    { key: 'unit', label: 'Đơn vị', children: unitLabel(unit) },
                    { key: 'name', label: 'Tên nhà cung cấp', children: vendor.vendorName },
                    { key: 'active', label: 'Kích hoạt', children: <Tag color={vendor.active ? 'success' : 'default'}>{vendor.active ? 'Bật' : 'Tắt'}</Tag> },
                    { key: 'note', label: 'Ghi chú', children: vendor.note || '—' },
                  ]} />
                ),
              };
            })}
          />
          <Flex justify="center">
            <Pagination current={currentPage} pageSize={pageSize} total={filteredVendors.length} size="small" showSizeChanger={false} showTotal={(total) => `Tổng ${total} NCC`} onChange={updatePagination} />
          </Flex>
        </Space>
      )}
    </Space>
  );
}
