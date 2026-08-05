import { FormEvent, useState } from 'react';
import type { GoodsType, ReceivingTimeConfig, UnitConfig, VehicleType } from '../../../lib/types';
import { unitPresentation } from '../../../lib/unitPresentation';
import { superadminApi } from '../api';
import { EmptyState, TableShell } from './shared';

const VEHICLE_TYPES: VehicleType[] = ['TRUCK', 'MOTORBIKE', 'OTHER'];
const GOODS_TYPES: GoodsType[] = ['FRESH_FOOD', 'GENERAL_GOODS', 'AUTO_WAREHOUSE', 'THI_CONG'];

const VEHICLE_LABELS: Record<VehicleType, string> = {
  TRUCK: 'Xe tải',
  MOTORBIKE: 'Xe máy',
  OTHER: 'Khác',
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
  onDone,
}: {
  units: UnitConfig[];
  editing?: ReceivingTimeConfig | null;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<TimeForm>(() => formFromItem(editing ?? undefined, units));
  const [error, setError] = useState('');
  const isEdit = Boolean(editing);

  function set<K extends keyof TimeForm>(key: K, value: TimeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = payloadFromForm(form);
      if (editing) {
        await superadminApi.updateReceivingTime(editing.id, {
          configuredMinutes: payload.configuredMinutes,
          recommendedMinutes: payload.recommendedMinutes,
        });
      } else {
        await superadminApi.createReceivingTime(payload);
      }
      onDone();
      if (!isEdit) setForm(formFromItem(undefined, units));
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được cấu hình thời gian.');
    }
  }

  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
      <label className="grid gap-1 md:col-span-2">
        <span className="label">Đơn vị</span>
        <select className="input" value={form.unitConfigId} onChange={(e) => set('unitConfigId', e.target.value)} disabled={isEdit} required>
          {units.map((unit) => {
            const unitInfo = unitPresentation(unit.unit, unit);
            return <option key={unit.id} value={unit.id}>{unitInfo.shortName} - {unitInfo.label}</option>;
          })}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Phương tiện</span>
        <select className="input" value={form.vehicleType} onChange={(e) => set('vehicleType', e.target.value as VehicleType)} disabled={isEdit}>
          {VEHICLE_TYPES.map((type) => <option key={type} value={type}>{VEHICLE_LABELS[type]}</option>)}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Loại hàng</span>
        <select className="input" value={form.goodsType} onChange={(e) => set('goodsType', e.target.value as GoodsType)} disabled={isEdit}>
          {GOODS_TYPES.map((type) => <option key={type} value={type}>{GOODS_LABELS[type]}</option>)}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Phút cấu hình</span>
        <input className="input" type="number" min={1} max={1440} value={form.configuredMinutes} onChange={(e) => set('configuredMinutes', e.target.value)} required />
      </label>
      <label className="grid gap-1">
        <span className="label">Phút đề xuất</span>
        <input className="input" type="number" min={1} max={1440} value={form.recommendedMinutes} onChange={(e) => set('recommendedMinutes', e.target.value)} placeholder="-" />
      </label>
      <div className="md:col-span-6 flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={units.length === 0}>{isEdit ? 'Lưu' : 'Tạo cấu hình'}</button>
        {isEdit && <button className="btn btn-secondary" type="button" onClick={onCancel}>Hủy</button>}
      </div>
      {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
    </form>
  );
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export default function ReceivingTimesTab({
  receivingTimes,
  units,
  onRefresh,
}: {
  receivingTimes: ReceivingTimeConfig[];
  units: UnitConfig[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<ReceivingTimeConfig | null>(null);
  const [error, setError] = useState('');

  async function remove(item: ReceivingTimeConfig) {
    if (!window.confirm('Xóa cấu hình thời gian nhận hàng này?')) return;
    setError('');
    try {
      await superadminApi.deleteReceivingTime(item.id);
      if (editing?.id === item.id) setEditing(null);
      onRefresh();
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không xóa được cấu hình thời gian.');
    }
  }

  return (
    <section className="space-y-4">
      <div className="card">
        <h2 className="section-heading mb-4">{editing ? 'Chỉnh cấu hình thời gian' : 'Tạo cấu hình thời gian'}</h2>
        <ReceivingTimeForm
          key={editing?.id ?? 'create'}
          units={units}
          editing={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {receivingTimes.length === 0 ? (
        <EmptyState />
      ) : (
        <TableShell>
          <table className="w-full text-sm">
            <thead className="bg-thiso-50 text-left text-thiso-500">
              <tr>
                <th className="p-3 font-medium">Đơn vị</th>
                <th className="p-3 font-medium">Phương tiện</th>
                <th className="p-3 font-medium">Loại hàng</th>
                <th className="p-3 font-medium">Cấu hình</th>
                <th className="p-3 font-medium">Đề xuất</th>
                <th className="p-3 font-medium">Mẫu</th>
                <th className="p-3 font-medium">Phân tích</th>
                <th className="p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {receivingTimes.map((item) => {
                const unit = item.unitConfig ?? units.find((config) => config.id === item.unitConfigId);
                const unitInfo = unitPresentation(item.unit, unit);
                return (
                  <tr key={item.id} className="border-t border-thiso-100">
                    <td className="p-3">
                      <div className="font-medium text-thiso-800">{unitInfo.shortName}</div>
                      <div className="text-xs text-thiso-400">{unitInfo.label}</div>
                    </td>
                    <td className="p-3">{VEHICLE_LABELS[item.vehicleType] ?? item.vehicleType}</td>
                    <td className="p-3">{GOODS_LABELS[item.goodsType] ?? item.goodsType}</td>
                    <td className="p-3">{item.configuredMinutes} phút</td>
                    <td className="p-3">{item.recommendedMinutes ? `${item.recommendedMinutes} phút` : '-'}</td>
                    <td className="p-3">{item.sampleCount ?? 0}</td>
                    <td className="p-3">{fmtDate(item.lastAnalyzedAt)}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(item)}>Edit</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => remove(item)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </section>
  );
}
