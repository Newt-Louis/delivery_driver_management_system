import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
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
  const [unitFilter, setUnitFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AutoWarehouseVendor | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Flex justify="end">
        <Button type="primary" icon={<PlusOutlined />} disabled={unitConfigs.length === 0} onClick={() => { setEditItem(null); setModalOpen(true); }}>Thêm NCC</Button>
      </Flex>

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

      <Card size="small">
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">Đơn vị</Typography.Text>
          <Select
            className="min-w-56"
            allowClear
            placeholder="Tất cả đơn vị"
            value={unitFilter || undefined}
            options={unitConfigs.map((unit) => ({ value: unit.id, label: `${unit.icon?.trim() || '🏬'} ${unitLabel(unit)}` }))}
            onChange={(value) => setUnitFilter(value ?? '')}
          />
        </Space>
      </Card>

      {isError ? (
        <Result status="error" title="Không thể tải danh sách NCC kho tự động" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table<AutoWarehouseVendor>
            rowKey="id"
            loading={isLoading}
            columns={columns}
            dataSource={vendors}
            locale={{ emptyText: <Empty description="Chưa có NCC nào cho đơn vị này" /> }}
            scroll={{ x: 1190 }}
            rowClassName={(vendor) => vendor.active ? '' : 'opacity-60'}
            pagination={{
              position: ['bottomCenter'],
              size: 'small',
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} NCC`,
            }}
          />
        </Card>
      )}
    </Space>
  );
}
