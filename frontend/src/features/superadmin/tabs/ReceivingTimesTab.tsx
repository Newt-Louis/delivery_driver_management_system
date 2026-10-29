import { useState } from 'react';
import { Alert, Button, Form, InputNumber, Modal, Popconfirm, Select, Space, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import ReadOnlyMasterList, { type ReadOnlyScope } from '../components/ReadOnlyMasterList';
import type { GoodsType, ReceivingTimeConfig, UnitConfig, VehicleType } from '../../../lib/types';
import { unitPresentation } from '../../../lib/unitPresentation';
import { superadminApi } from '../api';

const VEHICLE_TYPES: VehicleType[] = ['TRUCK', 'MOTORBIKE'];
const GOODS_TYPES: GoodsType[] = ['FRESH_FOOD', 'GENERAL_GOODS', 'AUTO_WAREHOUSE', 'THI_CONG'];

const VEHICLE_LABELS: Record<VehicleType, string> = {
  TRUCK: 'Xe tải',
  MOTORBIKE: 'Xe máy',
};

const GOODS_LABELS: Record<GoodsType, string> = {
  FRESH_FOOD: 'Hàng tươi sống',
  GENERAL_GOODS: 'Hàng tổng hợp',
  AUTO_WAREHOUSE: 'Kho tự động',
  THI_CONG: 'Thi công',
};

interface TimeForm {
  unitConfigId: string;
  vehicleType: VehicleType;
  goodsType: GoodsType;
  configuredMinutes: string;
  recommendedMinutes: string;
}

function formFromItem(item?: ReceivingTimeConfig, units: UnitConfig[] = []): TimeForm {
  return {
    unitConfigId: item?.unitConfigId ?? units[0]?.id ?? '',
    vehicleType: item?.vehicleType ?? 'TRUCK',
    goodsType: item?.goodsType ?? 'GENERAL_GOODS',
    configuredMinutes: String(item?.configuredMinutes ?? 30),
    recommendedMinutes: item?.recommendedMinutes ? String(item.recommendedMinutes) : '',
  };
}

function payloadFromForm(form: TimeForm) {
  return {
    unitConfigId: form.unitConfigId,
    vehicleType: form.vehicleType,
    goodsType: form.goodsType,
    configuredMinutes: Number(form.configuredMinutes),
    recommendedMinutes: form.recommendedMinutes ? Number(form.recommendedMinutes) : null,
  };
}

function ReceivingTimeForm({
  units,
  editing,
  onCancel,
  onDone, onSavingChange,
}: {
  units: UnitConfig[];
  editing?: ReceivingTimeConfig | null;
  onCancel?: () => void;
  onDone: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [form, setForm] = useState<TimeForm>(() => formFromItem(editing ?? undefined, units));
  const [error, setError] = useState('');
  const isEdit = Boolean(editing);

  function set<K extends keyof TimeForm>(key: K, value: TimeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const [saving, setSaving] = useState(false);
  async function submit() {
    setError(''); setSaving(true); onSavingChange(true);
    try { const payload = payloadFromForm(form); if (editing) await superadminApi.updateReceivingTime(editing.id, { configuredMinutes: payload.configuredMinutes, recommendedMinutes: payload.recommendedMinutes }); else await superadminApi.createReceivingTime(payload); onDone(); if (!isEdit) setForm(formFromItem(undefined, units)); }
    catch (err) { setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được cấu hình thời gian.'); } finally { setSaving(false); onSavingChange(false); }
  }
  return <Form layout="vertical" onFinish={submit}><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4"><Form.Item label="Đơn vị" required><Select value={form.unitConfigId || undefined} onChange={v => set('unitConfigId', v)} disabled={isEdit} options={units.map(u => { const meta = unitPresentation(u.unit, u); return { value: u.id, label: `${meta.shortName} - ${meta.label}` }; })} /></Form.Item><Form.Item label="Phương tiện"><Select value={form.vehicleType} disabled={isEdit} onChange={v => set('vehicleType', v)} options={VEHICLE_TYPES.map(v => ({ value: v, label: VEHICLE_LABELS[v] }))} /></Form.Item><Form.Item label="Loại hàng"><Select value={form.goodsType} disabled={isEdit} onChange={v => set('goodsType', v)} options={GOODS_TYPES.map(v => ({ value: v, label: GOODS_LABELS[v] }))} /></Form.Item><Form.Item label="Phút cấu hình" required><InputNumber min={1} max={1440} value={Number(form.configuredMinutes) || null} onChange={v => set('configuredMinutes', v === null ? '' : String(v))} /></Form.Item><Form.Item label="Phút đề xuất"><InputNumber min={1} max={1440} value={form.recommendedMinutes ? Number(form.recommendedMinutes) : null} onChange={v => set('recommendedMinutes', v === null ? '' : String(v))} /></Form.Item></div>{error && <Alert type="error" message={error} />}<Space><Button type="primary" htmlType="submit" loading={saving} disabled={!units.length || !form.unitConfigId || !form.configuredMinutes}>{isEdit ? 'Lưu' : 'Tạo cấu hình'}</Button><Button onClick={onCancel} disabled={saving}>Hủy</Button></Space></Form>;

}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

const getReceivingTimeName = (item: ReceivingTimeConfig) => unitPresentation(item.unit, item.unitConfig).label;

export default function ReceivingTimesTab({
  receivingTimes,
  units,
  onRefresh, scope,
}: {
  receivingTimes: ReceivingTimeConfig[];
  units: UnitConfig[];
  onRefresh: () => void;
  scope: ReadOnlyScope;
}) {
  const [editing, setEditing] = useState<ReceivingTimeConfig | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(item: ReceivingTimeConfig) {
    setError(''); setDeleting(item.id);
    try {
      await superadminApi.deleteReceivingTime(item.id);
      if (editing?.id === item.id) setEditing(null);
      onRefresh();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không xóa được cấu hình thời gian.');
    } finally { setDeleting(null); }
  }

  const fields = [
    { key: 'unit', title: 'Đơn vị', value: (item: ReceivingTimeConfig) => { const u = unitPresentation(item.unit, item.unitConfig ?? units.find(c => c.id === item.unitConfigId)); return `${u.shortName} - ${u.label}`; } },
    { key: 'vehicle', title: 'Phương tiện', value: (item: ReceivingTimeConfig) => VEHICLE_LABELS[item.vehicleType] ?? item.vehicleType },
    { key: 'goods', title: 'Loại hàng', value: (item: ReceivingTimeConfig) => GOODS_LABELS[item.goodsType] ?? item.goodsType },
    { key: 'configured', title: 'Cấu hình', value: (item: ReceivingTimeConfig) => `${item.configuredMinutes} phút` },
    { key: 'recommended', title: 'Đề xuất', value: (item: ReceivingTimeConfig) => item.recommendedMinutes ? `${item.recommendedMinutes} phút` : '—' },
    { key: 'sample', title: 'Mẫu', value: (item: ReceivingTimeConfig) => item.sampleCount ?? 0 },
    { key: 'analyzed', title: 'Phân tích', value: (item: ReceivingTimeConfig) => fmtDate(item.lastAnalyzedAt) },
  ];
  function actions(item: ReceivingTimeConfig) { return <Space size="small"><Tooltip title="Chỉnh cấu hình"><Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Sửa cấu hình ${item.unit} ${item.vehicleType} ${item.goodsType}`} onClick={() => setEditing(item)} /></Tooltip><Popconfirm title="Xóa cấu hình thời gian nhận hàng này?" onConfirm={() => remove(item)}><Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa cấu hình ${item.unit} ${item.vehicleType} ${item.goodsType}`} loading={deleting === item.id} /></Popconfirm></Space>; }
  return <Space orientation="vertical" size="large" className="w-full">{error && <Alert type="error" message={error} showIcon />}<ReadOnlyMasterList items={receivingTimes} scope={scope} fields={fields} getName={getReceivingTimeName} searchLabel="Tìm tên đơn vị" emptyLabel="Không có cấu hình phù hợp" createAction={<Button type="primary" icon={<PlusOutlined />} disabled={!units.length} onClick={() => setCreating(true)}>Thêm cấu hình</Button>} actions={actions} />{(creating || editing) && <Modal open title={editing ? 'Chỉnh cấu hình thời gian' : 'Tạo cấu hình thời gian'} footer={null} onCancel={() => { setCreating(false); setEditing(null); }} closable={!saving} maskClosable={!saving} keyboard={!saving} destroyOnHidden><ReceivingTimeForm key={editing?.id ?? 'create'} units={units} editing={editing} onSavingChange={setSaving} onCancel={() => { setCreating(false); setEditing(null); }} onDone={() => { setCreating(false); setEditing(null); onRefresh(); }} /></Modal>}</Space>;
}
