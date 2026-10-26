import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Col, Collapse, Empty, Flex, Form, Input, InputNumber, Popconfirm, Result, Row, Skeleton, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import api from '../../../lib/api';
import type { DeliveryTimeWindow, GoodsType, UnitConfig } from '../../../lib/types';
import AdaptiveGrid from '../../../components/AdaptiveGrid';

type UnitConfigFormData = {
  freshFoodEnabled: boolean;
  generalGoodsEnabled: boolean;
  thiCongEnabled: boolean;
  sundayFreshFoodOnly: boolean;
  truckSlotMinutes: number;
  motorbikeSlotMinutes: number;
  truckMaxPerSlot: number;
  motorbikeMaxPerSlot: number;
  autoCancelCalledEnabled: boolean;
  autoCancelCalledAfterMinutes: number;
  vendorApiUrl: string;
  vendorApiKey: string;
  poApiUrl: string;
  poApiKey: string;
};

type GoodsConfig = {
  type: GoodsType;
  label: string;
  icon: string;
  field: 'freshFoodEnabled' | 'generalGoodsEnabled' | 'thiCongEnabled';
  tagColor?: 'success' | 'gold';
};

const GOODS_CONFIGS: GoodsConfig[] = [
  { type: 'FRESH_FOOD', label: 'Hàng tươi sống', icon: '🥬', field: 'freshFoodEnabled' },
  { type: 'GENERAL_GOODS', label: 'Hàng thường', icon: '📦', field: 'generalGoodsEnabled' },
  { type: 'THI_CONG', label: 'Thi công', icon: '🔨', field: 'thiCongEnabled' },
];

function errorMessage(error: unknown, fallback = 'Lỗi lưu cấu hình.') {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.error ?? response.response?.data?.message ?? fallback;
}

function TimeWindowEditor({ unit, goodsType, editing }: { unit: string; goodsType: GoodsType; editing: boolean }) {
  const queryClient = useQueryClient();
  const [addMode, setAddMode] = useState(false);
  const [newWindow, setNewWindow] = useState({ label: '', startTime: '08:00', endTime: '17:00' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editWindow, setEditWindow] = useState<{ label: string; startTime: string; endTime: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const queryKey = ['time-windows', unit, goodsType, ''];
  const { data: windows = [], isLoading, isError, refetch } = useQuery<DeliveryTimeWindow[]>({
    queryKey,
    queryFn: async () => (await api.get(`/api/units/${unit}/time-windows`, { params: { goodsType } })).data,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  async function addWindow() {
    if (!newWindow.startTime || !newWindow.endTime) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.post(`/api/units/${unit}/time-windows`, { goodsType, label: newWindow.label || null, startTime: newWindow.startTime, endTime: newWindow.endTime });
      invalidate();
      setAddMode(false);
      setNewWindow({ label: '', startTime: '08:00', endTime: '17:00' });
    } catch (error) {
      setNotice(errorMessage(error, 'Không thể thêm khung giờ.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editWindow) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.patch(`/api/units/time-windows/${id}`, editWindow);
      invalidate();
      setEditId(null);
      setEditWindow(null);
    } catch (error) {
      setNotice(errorMessage(error, 'Không thể cập nhật khung giờ.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteWindow(id: string) {
    setNotice(null);
    try {
      await api.delete(`/api/units/time-windows/${id}`);
      invalidate();
    } catch (error) {
      setNotice(errorMessage(error, 'Không thể xóa khung giờ.'));
    }
  }

  async function toggleWindow(window: DeliveryTimeWindow) {
    setNotice(null);
    try {
      await api.patch(`/api/units/time-windows/${window.id}`, { enabled: !window.enabled });
      invalidate();
    } catch (error) {
      setNotice(errorMessage(error, 'Không thể đổi trạng thái khung giờ.'));
    }
  }

  if (isLoading) return <Skeleton active title={false} paragraph={{ rows: 1 }} />;
  if (isError) return <Result status="warning" title="Không thể tải khung giờ" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />;

  return (
    <Space orientation="vertical" size="small" className="w-full">
      {windows.length === 0 && !addMode && <Typography.Text type="secondary" italic>{editing ? 'Chưa có khung giờ. Nhấn Thêm để cấu hình.' : 'Chưa cấu hình.'}</Typography.Text>}
      {windows.map((window) => (
        <Card key={window.id} size="small" className={!window.enabled ? 'opacity-60' : undefined}>
          {editId === window.id && editWindow ? (
            <Flex gap="small" align="end" wrap="wrap">
              <Form.Item label="Nhãn" className="mb-0"><Input className="w-28" value={editWindow.label} onChange={(event) => setEditWindow((current) => ({ ...current!, label: event.target.value }))} /></Form.Item>
              <Form.Item label="Bắt đầu" className="mb-0"><Input type="time" value={editWindow.startTime} onChange={(event) => setEditWindow((current) => ({ ...current!, startTime: event.target.value }))} /></Form.Item>
              <Form.Item label="Kết thúc" className="mb-0"><Input type="time" value={editWindow.endTime} onChange={(event) => setEditWindow((current) => ({ ...current!, endTime: event.target.value }))} /></Form.Item>
              <Button type="primary" loading={saving} onClick={() => saveEdit(window.id)}>Lưu</Button>
              <Button onClick={() => { setEditId(null); setEditWindow(null); }}>Hủy</Button>
            </Flex>
          ) : (
            <Flex justify="space-between" align="center" gap="small" wrap="wrap">
              <Space orientation="vertical" size={0} className="min-w-0">
                <Typography.Text strong>{window.label || 'Khung giờ nhận hàng'}</Typography.Text>
                <Typography.Text code>{window.startTime} → {window.endTime}</Typography.Text>
              </Space>
              {editing && (
                <Space size="small">
                  <Switch checked={window.enabled} checkedChildren="Bật" unCheckedChildren="Tắt" aria-label={`Đổi trạng thái ${window.label || 'khung giờ'}`} onChange={() => toggleWindow(window)} />
                  <Tooltip title="Sửa khung giờ"><Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Sửa ${window.label || 'khung giờ'}`} onClick={() => { setEditId(window.id); setEditWindow({ label: window.label ?? '', startTime: window.startTime, endTime: window.endTime }); }} /></Tooltip>
                  <Popconfirm title="Xóa khung giờ này?" okText="Xóa" cancelText="Hủy" okButtonProps={{ color: 'danger', variant: 'solid' }} onConfirm={() => deleteWindow(window.id)}>
                    <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa ${window.label || 'khung giờ'}`} />
                  </Popconfirm>
                </Space>
              )}
            </Flex>
          )}
        </Card>
      ))}
      {editing && (addMode ? (
        <Card size="small" title="Thêm khung giờ">
          <Flex gap="small" align="end" wrap="wrap">
            <Form.Item label="Nhãn" className="mb-0"><Input className="w-28" value={newWindow.label} placeholder="Ca sáng" onChange={(event) => setNewWindow((current) => ({ ...current, label: event.target.value }))} /></Form.Item>
            <Form.Item label="Bắt đầu" className="mb-0"><Input type="time" value={newWindow.startTime} onChange={(event) => setNewWindow((current) => ({ ...current, startTime: event.target.value }))} /></Form.Item>
            <Form.Item label="Kết thúc" className="mb-0"><Input type="time" value={newWindow.endTime} onChange={(event) => setNewWindow((current) => ({ ...current, endTime: event.target.value }))} /></Form.Item>
            <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={addWindow}>Thêm</Button>
            <Button onClick={() => setAddMode(false)}>Hủy</Button>
          </Flex>
        </Card>
      ) : <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddMode(true)} size="small">Thêm khung giờ</Button>)}
      {notice && <Alert type="error" showIcon message={notice} closable onClose={() => setNotice(null)} />}
    </Space>
  );
}

function UnitConfigCard({ config, onSaved }: { config: UnitConfig; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<UnitConfigFormData>({
    freshFoodEnabled: config.freshFoodEnabled ?? true,
    generalGoodsEnabled: config.generalGoodsEnabled ?? true,
    thiCongEnabled: config.thiCongEnabled ?? true,
    sundayFreshFoodOnly: config.sundayFreshFoodOnly ?? false,
    truckSlotMinutes: config.truckSlotMinutes ?? 30,
    motorbikeSlotMinutes: config.motorbikeSlotMinutes ?? 15,
    truckMaxPerSlot: config.truckMaxPerSlot ?? 1,
    motorbikeMaxPerSlot: config.motorbikeMaxPerSlot ?? 3,
    autoCancelCalledEnabled: config.autoCancelCalledEnabled ?? false,
    autoCancelCalledAfterMinutes: config.autoCancelCalledAfterMinutes ?? 15,
    vendorApiUrl: config.vendorApiUrl ?? '', vendorApiKey: '', poApiUrl: config.poApiUrl ?? '', poApiKey: '',
  });

  function setField<Key extends keyof UnitConfigFormData>(field: Key, value: UnitConfigFormData[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(`/api/units/${config.unit}/config`, {
        freshFoodEnabled: form.freshFoodEnabled, generalGoodsEnabled: form.generalGoodsEnabled, thiCongEnabled: form.thiCongEnabled,
        sundayFreshFoodOnly: form.sundayFreshFoodOnly, truckSlotMinutes: Number(form.truckSlotMinutes), motorbikeSlotMinutes: Number(form.motorbikeSlotMinutes),
        truckMaxPerSlot: Number(form.truckMaxPerSlot), motorbikeMaxPerSlot: Number(form.motorbikeMaxPerSlot),
        autoCancelCalledEnabled: form.autoCancelCalledEnabled, autoCancelCalledAfterMinutes: Number(form.autoCancelCalledAfterMinutes),
        vendorApiUrl: form.vendorApiUrl || null, vendorApiKey: form.vendorApiKey || null, poApiUrl: form.poApiUrl || null, poApiKey: form.poApiKey || null,
      });
      setEditing(false);
      onSaved();
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const numberField = (label: string, field: 'truckSlotMinutes' | 'motorbikeSlotMinutes' | 'truckMaxPerSlot' | 'motorbikeMaxPerSlot', min: number, max: number) => (
    <Form.Item label={label} className="mb-0"><InputNumber className="w-full" min={min} max={max} value={form[field]} disabled={!editing} onChange={(value) => setField(field, Number(value ?? min))} /></Form.Item>
  );

  const goodsSections = GOODS_CONFIGS.map((goods) => ({
    key: goods.type,
    label: <Space size="small"><span>{goods.icon}</span><Typography.Text strong>{goods.label}</Typography.Text></Space>,
    children: (
      <Space orientation="vertical" size="middle" className="w-full">
        <Flex justify="space-between" align="center" gap="small" wrap="wrap">
          <Typography.Text type="secondary">Cho phép nhận loại hàng này</Typography.Text>
          <Switch checked={form[goods.field]} disabled={!editing} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={(checked) => setField(goods.field, checked)} />
        </Flex>
        {form[goods.field] && <><Typography.Text type="secondary">Khung giờ nhận hàng</Typography.Text><TimeWindowEditor unit={config.unit} goodsType={goods.type} editing={editing} /></>}
        {goods.type === 'FRESH_FOOD' && <Flex justify="space-between" align="center" gap="small" wrap="wrap"><Typography.Text type="secondary">Chủ nhật chỉ nhận hàng tươi sống</Typography.Text><Switch checked={form.sundayFreshFoodOnly} disabled={!editing} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={(checked) => setField('sundayFreshFoodOnly', checked)} /></Flex>}
      </Space>
    ),
  }));

  return (
    <Card
      size="small"
      className="h-full"
      cover={<div aria-hidden className="h-6 lg:h-8" style={{ backgroundColor: config.primaryColor }} />}
    >
      <Flex justify="space-between" align="center" gap="small" wrap="wrap" className="mb-4 w-full">
        <Space size="small" className="min-w-0">
          <Avatar shape="square" src={config.logoUrl || undefined} style={{ backgroundColor: 'transparent' }}>{config.icon?.trim() || '🏬'}</Avatar>
          <Space orientation="vertical" size={0} className="min-w-0">
            <Tooltip title={config.displayName || config.unit}><Typography.Text strong ellipsis className="block max-w-36 sm:max-w-48">{config.displayName || config.unit}</Typography.Text></Tooltip>
            <Typography.Text code type="secondary">{config.unit}</Typography.Text>
          </Space>
        </Space>
        {editing ? (
          <Space>
            <Button onClick={() => { setEditing(false); setSaveError(''); }} size="small">Hủy</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} size="small">Lưu</Button>
          </Space>
        ) : <Button color="gold" variant="solid" icon={<EditOutlined />} onClick={() => setEditing(true)} size="small">Sửa</Button>}
      </Flex>
      <Form layout="vertical" requiredMark={false}>
        <Collapse defaultActiveKey={GOODS_CONFIGS.map((goods) => goods.type)} items={goodsSections} />
        <Card size="small" className="mt-4" title={<Space><SettingOutlined /><span>Cấu hình slot</span></Space>}>
          <Row gutter={[12, 16]}>
            <Col xs={24} sm={12}>{numberField('Xe tải: phút / slot', 'truckSlotMinutes', 15, 120)}</Col>
            <Col xs={24} sm={12}>{numberField('Xe tải: tối đa xe / slot', 'truckMaxPerSlot', 1, 20)}</Col>
            <Col xs={24} sm={12}>{numberField('Xe máy: phút / slot', 'motorbikeSlotMinutes', 5, 60)}</Col>
            <Col xs={24} sm={12}>{numberField('Xe máy: tối đa xe / slot', 'motorbikeMaxPerSlot', 1, 20)}</Col>
          </Row>
        </Card>
        <Card size="small" className="mt-4" title={<Space><Tag color="gold">Cảnh báo</Tag><span>Tự động hủy xe đã gọi không vào</span></Space>}>
          <Space orientation="vertical" size="middle" className="w-full">
            <Flex justify="space-between" align="center" gap="small" wrap="wrap"><Typography.Text>Bật tự động hủy</Typography.Text><Switch checked={form.autoCancelCalledEnabled} disabled={!editing} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={(checked) => setField('autoCancelCalledEnabled', checked)} /></Flex>
            <Form.Item label="Từ lần cuối gọi vào slot sau (phút)" className="mb-0"><InputNumber className="w-full" min={5} max={999} value={form.autoCancelCalledAfterMinutes} disabled={!editing || !form.autoCancelCalledEnabled} onChange={(value) => setField('autoCancelCalledAfterMinutes', Number(value ?? 5))} /></Form.Item>
          </Space>
        </Card>
        {saveError && <Alert className="mt-4" type="error" showIcon message={saveError} />}
      </Form>
    </Card>
  );
}

export default function UnitsTab() {
  const queryClient = useQueryClient();
  const { data: unitConfigs = [], isLoading, isError, refetch } = useQuery<UnitConfig[]>({ queryKey: ['unit-configs'], queryFn: async () => (await api.get('/api/units/configs')).data });
  if (isError) return <Result status="error" title="Không thể tải cấu hình đơn vị" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />;
  if (isLoading) return <Card size="small" loading />;
  if (unitConfigs.length === 0) return <Empty description="Khu vực hiện tại chưa có đơn vị nào." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  return <AdaptiveGrid minColumnWidth={320} maxColumnWidth={520}>{unitConfigs.map((config) => <UnitConfigCard key={config.id} config={config} onSaved={() => queryClient.invalidateQueries({ queryKey: ['unit-configs'] })} />)}</AdaptiveGrid>;
}
