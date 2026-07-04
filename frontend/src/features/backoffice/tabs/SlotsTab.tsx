import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import type { GoodsType, Slot, Zone } from '../../../lib/types';
import { GOODS_LABELS, STATUS_COLOR, STATUS_LABEL, UNIT_LABELS, VEHICLE_LABEL } from '../constants';
import SlotModal from '../components/SlotModal';

export default function SlotsTab() {
  const queryClient = useQueryClient();
  const [editSlot, setEditSlot] = useState<Slot | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<Slot | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: slots = [], isLoading } = useQuery<Slot[]>({
    queryKey: ['slots', 'all'],
    queryFn: async () => (await api.get('/api/slots/all')).data,
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/api/zones')).data,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['slots'] });
    queryClient.invalidateQueries({ queryKey: ['slots', 'all'] });
  }

  async function toggleActive(slot: Slot) {
    await api.patch(`/api/slots/${slot.id}`, { isActive: !slot.isActive });
    refresh();
  }

  async function confirmDelete(slot: Slot) {
    try {
      const res = await api.delete(`/api/slots/${slot.id}`);
      setDeleteMsg(res.data.message ?? (res.data.deleted ? 'Đã xóa slot.' : 'Đã vô hiệu hóa slot.'));
      setDeleteConfirm(null);
      refresh();
    } catch {
      setDeleteMsg('Lỗi xóa slot.');
    }
  }

  const filtered = slots.filter((s) => {
    if (!showInactive && !s.isActive) return false;
    if (unitFilter && s.assignedUnit !== unitFilter) return false;
    if (typeFilter && s.vehicleType !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: slots.length,
    active: slots.filter((s) => s.isActive).length,
    trucks: slots.filter((s) => s.vehicleType === 'TRUCK' && s.isActive).length,
    motorbikes: slots.filter((s) => s.vehicleType === 'MOTORBIKE' && s.isActive).length,
    available: slots.filter((s) => s.isActive && s.status === 'AVAILABLE').length,
    occupied: slots.filter((s) => s.isActive && s.status === 'OCCUPIED').length,
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button className="btn-primary px-4 py-2" onClick={() => setEditSlot(null)}>+ Thêm Slot mới</button>
      </div>

      {editSlot !== undefined && (
        <SlotModal slot={editSlot} zones={zones} onClose={() => setEditSlot(undefined)} onSaved={() => { setEditSlot(undefined); refresh(); }} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Xóa Slot {deleteConfirm.code}?</h3>
            <p className="text-sm text-gray-600 mb-5">Nếu slot đã có lịch sử sử dụng, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleteConfirm(null)}>Hủy</button>
              <button className="btn-danger flex-1" onClick={() => confirmDelete(deleteConfirm)}>Xóa / Vô hiệu</button>
            </div>
          </div>
        </div>
      )}

      {deleteMsg && (
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-700 flex items-center justify-between">
          {deleteMsg}
          <button onClick={() => setDeleteMsg('')} className="text-sky-400 hover:text-sky-600">✕</button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Tổng slot', value: stats.total, color: 'bg-thiso-50 border-thiso-100 text-thiso-600' },
          { label: 'Đang hoạt động', value: stats.active, color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { label: '🚛 Xe Tải', value: stats.trucks, color: 'bg-emart-50 border-emart-200 text-emart-700' },
          { label: '🛵 Xe Máy', value: stats.motorbikes, color: 'bg-sky-50 border-sky-100 text-sky-600' },
          { label: 'Trống', value: stats.available, color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Đang dùng', value: stats.occupied, color: 'bg-red-50 border-red-200 text-red-700' },
        ].map((s) => (
          <div key={s.label} className={`border rounded-xl p-3 text-center ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <label>Đơn vị:</label>
        <select className="input w-auto text-sm" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
          <option value="">Tất cả đơn vị</option>
          <option value="EMART">Emart</option>
          <option value="THISKYHALL">Thiskyhall</option>
          <option value="TENANT">Tenant</option>
        </select>
        <label>Loại xe:</label>
        <select className="input w-auto text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tất cả loại xe</option>
          <option value="TRUCK">🚛 Xe Tải</option>
          <option value="MOTORBIKE">🛵 Xe Máy</option>
          <option value="OTHER">🚗 Khác</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" />
          Hiện slot vô hiệu hóa
        </label>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} slot</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-thiso-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-thiso-100 bg-thiso-50 text-left text-thiso-400 text-xs uppercase">
              <th className="px-4 py-3">Mã Slot</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Khu</th>
              <th className="px-4 py-3">Đơn vị</th>
              <th className="px-4 py-3">Loại xe</th>
              <th className="px-4 py-3">Hàng nhận</th>
              <th className="px-4 py-3">Sức chứa</th>
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Kích hoạt</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={11} className="py-12 text-center text-thiso-400">Không có slot nào</td></tr>}
            {filtered.map((slot) => (
              <tr key={slot.id} className={`border-b border-thiso-50 last:border-0 hover:bg-thiso-50 ${!slot.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3"><span className="font-bold font-mono text-thiso-800">{slot.code}</span></td>
                <td className="px-4 py-3 text-thiso-700">{slot.name}</td>
                <td className="px-4 py-3">
                  {slot.zone
                    ? <span className="text-xs font-bold text-thiso-600 bg-thiso-100 px-2 py-0.5 rounded font-mono">{slot.zone.code}</span>
                    : <span className="text-xs text-thiso-300 italic">—</span>}
                </td>
                <td className="px-4 py-3 text-thiso-500 text-xs">{UNIT_LABELS[slot.assignedUnit]}</td>
                <td className="px-4 py-3"><span className="text-sm text-thiso-600">{VEHICLE_LABEL[slot.vehicleType] ?? slot.vehicleType}</span></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {slot.autoWarehouseOnly && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">🏭 AW Only</span>
                    )}
                    {!slot.autoWarehouseOnly && slot.acceptedGoods.length === 0
                      ? <span className="text-xs text-thiso-300 italic">Tất cả</span>
                      : !slot.autoWarehouseOnly && slot.acceptedGoods.map((g) => (
                        <span key={g} className="text-xs px-1.5 py-0.5 rounded bg-thiso-100 text-thiso-600 font-medium">{GOODS_LABELS[g as GoodsType]}</span>
                      ))
                    }
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-semibold text-gray-700">{slot.maxCapacity ?? 1}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${slot.autoAssign ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                    {slot.autoAssign ? 'Bật' : 'Tắt'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[slot.status]}`}>
                    {STATUS_LABEL[slot.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(slot)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${slot.isActive ? 'bg-sky-600' : 'bg-thiso-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${slot.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500" onClick={() => setEditSlot(slot)}>Sửa</button>
                    <button className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-red-400 hover:text-red-600 transition-colors text-thiso-400" onClick={() => { setDeleteConfirm(slot); setDeleteMsg(''); }}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-thiso-400">* Slot có lịch sử giao hàng sẽ bị vô hiệu hóa thay vì xóa hoàn toàn để giữ dữ liệu lịch sử.</p>
    </>
  );
}
