import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Empty, Form, Input, Modal, Popconfirm, Result, Select, Space, Tooltip, message } from 'antd';
import { useAuth } from '../../../context/AuthContext';
import { useBranding } from '../../../context/BrandingContext';
import ReadOnlyMasterList from '../../superadmin/components/ReadOnlyMasterList';
import { StatusBadge } from '../../superadmin/tabs/shared';
import { createDevice, deactivateDevice, fetchDevices, updateDevice } from '../api';
import type { DeviceItem, DeviceType } from '../types';

const DEVICE_TYPES: DeviceType[] = ['FIXED_DEVICE', 'PDA', 'TABLET', 'TV'];

type DeviceFormValues = {
  code: string;
  name: string;
  deviceType: DeviceType;
  deviceSecret?: string;
  isActive: boolean;
};

function errorMessage(error: unknown, fallback: string) {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.message ?? response.response?.data?.error ?? fallback;
}

function locationLabel(location?: { code?: string; locationName?: string } | null) {
  if (!location) return '';
  return [location.code, location.locationName].filter(Boolean).join(' - ');
}

function DeviceForm({
  businessLocationId,
  currentLocationLabel,
  editing,
  onCancel,
  onDone,
  onSavingChange,
}: {
  businessLocationId: string;
  currentLocationLabel: string;
  editing: DeviceItem | null;
  onCancel: () => void;
  onDone: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(values: DeviceFormValues) {
    setSaving(true);
    onSavingChange(true);
    setError('');
    try {
      if (editing) {
        await updateDevice(editing.id, {
          name: values.name,
          deviceType: values.deviceType,
          isActive: values.isActive,
          ...(values.deviceSecret ? { deviceSecret: values.deviceSecret } : {}),
        });
      } else {
        // Location is never chosen in Backoffice: devices always belong to the
        // operational BusinessLocation of the signed-in account.
        await createDevice({
          code: values.code,
          name: values.name,
          businessLocationId,
          deviceType: values.deviceType,
          deviceSecret: values.deviceSecret ?? '',
        });
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Không lưu được thiết bị.'));
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <Form<DeviceFormValues>
      layout="vertical"
      initialValues={{
        code: editing?.code ?? '',
        name: editing?.name ?? '',
        deviceType: editing?.deviceType ?? 'FIXED_DEVICE',
        deviceSecret: '',
        isActive: editing?.isActive ?? true,
      }}
      onFinish={submit}
    >
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Form.Item name="code" label="Mã thiết bị" normalize={(v: string) => v.toUpperCase()} rules={[{ required: true, min: 2, max: 40 }]}>
          <Input disabled={!!editing} />
        </Form.Item>
        <Form.Item name="name" label="Tên thiết bị" rules={[{ required: true, max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Khu vực kinh doanh">
          <Input value={locationLabel(editing?.businessLocation) || currentLocationLabel} disabled />
        </Form.Item>
        <Form.Item name="deviceType" label="Loại thiết bị">
          <Select options={DEVICE_TYPES.map(t => ({ value: t, label: t }))} />
        </Form.Item>
        <Form.Item name="deviceSecret" label={editing ? 'Secret mới nếu đổi' : 'Device secret'} rules={editing ? [{ min: 8 }] : [{ required: true, min: 8 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        {editing && (
          <Form.Item name="isActive" valuePropName="checked">
            <Checkbox>Thiết bị đang hoạt động</Checkbox>
          </Form.Item>
        )}
      </div>
      {error && <Alert type="error" message={error} showIcon className="mb-3" />}
      <Space>
        <Button onClick={onCancel} disabled={saving}>Hủy</Button>
        <Button type="primary" htmlType="submit" loading={saving}>{editing ? 'Lưu' : 'Tạo'}</Button>
      </Space>
    </Form>
  );
}

const getName = (device: DeviceItem) => device.name;

export default function DevicesTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { mall } = useBranding();
  const businessLocationId = user?.businessLocationId ?? '';
  const [editing, setEditing] = useState<DeviceItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setEditing(null);
    setCreating(false);
  }, [businessLocationId]);

  const { data: devices = [], isLoading, isError, refetch } = useQuery<DeviceItem[]>({
    queryKey: ['devices', user?.id, businessLocationId],
    queryFn: fetchDevices,
    enabled: Boolean(businessLocationId),
  });

  const currentLocationLabel = locationLabel(devices[0]?.businessLocation) || locationLabel(mall) || mall.mallName;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['devices'] });
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
  }

  async function remove(device: DeviceItem) {
    setDeleting(device.id);
    try {
      await deactivateDevice(device.id);
      refresh();
    } catch (err) {
      message.error(errorMessage(err, 'Không vô hiệu hóa được thiết bị'));
    } finally {
      setDeleting(null);
    }
  }

  function actions(d: DeviceItem) {
    return (
      <Space size="small">
        <Tooltip title="Chỉnh sửa thiết bị">
          <Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Sửa thiết bị ${d.code}`} onClick={() => setEditing(d)} />
        </Tooltip>
        <Popconfirm title={`Vô hiệu hóa thiết bị ${d.code}?`} disabled={!d.isActive} onConfirm={() => remove(d)}>
          <Tooltip title={d.isActive ? 'Vô hiệu hóa thiết bị' : 'Thiết bị đã bị vô hiệu hóa'}>
            <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Vô hiệu hóa thiết bị ${d.code}`} disabled={!d.isActive} loading={deleting === d.id} />
          </Tooltip>
        </Popconfirm>
      </Space>
    );
  }

  const fields = [
    { key: 'code', title: 'Code', value: (d: DeviceItem) => d.code },
    { key: 'name', title: 'Tên', value: (d: DeviceItem) => d.name },
    { key: 'location', title: 'Khu vực', value: (d: DeviceItem) => locationLabel(d.businessLocation) || d.businessLocationId },
    { key: 'type', title: 'Loại', value: (d: DeviceItem) => d.deviceType },
    { key: 'last', title: 'Last seen', value: (d: DeviceItem) => d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('vi-VN') : '—' },
    { key: 'status', title: 'Trạng thái', value: (d: DeviceItem) => <StatusBadge active={d.isActive} /> },
  ];

  if (!businessLocationId) {
    return <Empty description="Tài khoản chưa có khu vực vận hành hiện tại. Hãy chọn khu vực trước khi quản lý thiết bị." />;
  }

  if (isError) {
    return <Result status="error" title="Không thể tải danh sách thiết bị" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />;
  }

  if (isLoading) return <Card size="small" loading />;

  return (
    <Space orientation="vertical" size="large" className="w-full">
      <ReadOnlyMasterList
        items={devices}
        fields={fields}
        getName={getName}
        searchLabel="Tìm tên thiết bị"
        emptyLabel="Chưa có thiết bị nào trong khu vực này"
        createAction={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Thêm thiết bị</Button>}
        actions={actions}
      />
      {(creating || editing) && (
        <Modal
          open
          title={editing ? 'Chỉnh thiết bị' : 'Tạo thiết bị'}
          footer={null}
          onCancel={closeModal}
          closable={!saving}
          maskClosable={!saving}
          keyboard={!saving}
          destroyOnHidden
        >
          <DeviceForm
            key={editing?.id ?? 'create'}
            businessLocationId={businessLocationId}
            currentLocationLabel={currentLocationLabel}
            editing={editing}
            onSavingChange={setSaving}
            onCancel={closeModal}
            onDone={() => { closeModal(); refresh(); }}
          />
        </Modal>
      )}
    </Space>
  );
}
