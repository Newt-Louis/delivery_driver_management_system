import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import type { Zone, UnitConfig } from '../../../lib/types';

export default function ZonesTab() {
  const queryClient = useQueryClient();
  const { data: zones = [], isLoading } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/api/zones')).data,
  });
  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  const [addMode, setAddMode] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [form, setForm] = useState({ code: '', name: '', unitConfigId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function refreshZones() {
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    queryClient.invalidateQueries({ queryKey: ['slots', 'all'] });
  }

  async function saveZone() {
    if (!form.code.trim() || !form.name.trim() || !form.unitConfigId) { setError('Bắt buộc nhập mã, tên khu và đơn vị.'); return; }
    setSaving(true); setError('');
    try {
      if (editZone) {
        await api.patch(`/api/zones/${editZone.id}`, form);
      } else {
        await api.post('/api/zones', form);
      }
      setAddMode(false); setEditZone(null); setForm({ code: '', name: '', unitConfigId: '' });
      refreshZones();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Lỗi lưu khu.');
    } finally { setSaving(false); }
  }

  async function deleteZone(z: Zone) {
    if (!confirm(`Xóa khu ${z.code}?`)) return;
    try {
      await api.delete(`/api/zones/${z.id}`);
      refreshZones();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Lỗi xóa khu.');
    }
  }

  const UNIT_BADGE: Record<string, string> = {
    EMART: 'bg-emart-100 text-emart-700',
    THISKYHALL: 'bg-sky-100 text-sky-700',
    TENANT: 'bg-thiso-100 text-thiso-600',
  };
  const UNIT_LABEL: Record<string, string> = { EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)' };
  const ZONE_COLORS = ['from-sky-700 to-sky-500', 'from-emart-600 to-emart-400', 'from-thiso-700 to-thiso-500', 'from-sky-500 to-sky-400', 'from-thiso-500 to-thiso-400'];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-thiso-400">Quản lý các khu nhận hàng vật lý. Mỗi khu có thể chứa nhiều slot và phục vụ nhiều đơn vị.</p>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => { setAddMode(true); setEditZone(null); setForm({ code: '', name: '', unitConfigId: unitConfigs[0]?.id ?? '' }); }}>
          + Thêm Khu
        </button>
      </div>

      {(addMode || editZone) && (
        <div className="mb-5 bg-white border border-thiso-100 rounded-2xl p-5">
          <h3 className="font-bold text-thiso-800 mb-4">{editZone ? `Sửa Khu ${editZone.code}` : 'Thêm Khu mới'}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Mã Khu *</label>
              <input className="input uppercase" placeholder="K6" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} disabled={!!editZone} />
            </div>
            <div>
              <label className="label">Tên Khu *</label>
              <input className="input" placeholder="Khu 6 – Khu vực mới" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Đơn vị *</label>
              <select className="input" value={form.unitConfigId} onChange={(e) => setForm((f) => ({ ...f, unitConfigId: e.target.value }))}>
                <option value="">— Chọn đơn vị —</option>
                {unitConfigs.map((cfg) => (
                  <option key={cfg.id} value={cfg.id}>{UNIT_LABEL[cfg.unit] ?? cfg.unit}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => { setAddMode(false); setEditZone(null); setError(''); }}>Hủy</button>
            <button className="btn-primary" onClick={saveZone} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </div>
      )}

      {isLoading && <div className="py-8 text-center text-thiso-400">Đang tải...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((z, idx) => {
          const slotList = z.slots ?? [];
          const trucks = slotList.filter((s) => s.vehicleType === 'TRUCK');
          const motorbikes = slotList.filter((s) => s.vehicleType === 'MOTORBIKE');
          const unitSet = z.unitConfig?.unit ? [z.unitConfig.unit] : [...new Set(slotList.map((s) => s.assignedUnit))];
          const gradient = ZONE_COLORS[idx % ZONE_COLORS.length];

          return (
            <div key={z.id} className="bg-white border border-thiso-100 rounded-2xl overflow-hidden shadow-card">
              <div className={`bg-gradient-to-r ${gradient} px-4 py-3 text-white flex items-center justify-between`}>
                <div>
                  <div className="font-black text-xl tracking-widest">{z.code}</div>
                  <div className="text-white/80 text-sm">{z.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black">{slotList.length}</div>
                  <div className="text-white/70 text-xs">slot</div>
                </div>
              </div>

              <div className="p-4">
                {/* Unit badges */}
                {unitSet.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {unitSet.map((u) => (
                      <span key={u} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${UNIT_BADGE[u] ?? 'bg-gray-100 text-gray-600'}`}>
                        {UNIT_LABEL[u] ?? u}
                      </span>
                    ))}
                    {unitSet.length === 0 && <span className="text-xs text-gray-400 italic">Chưa có slot</span>}
                  </div>
                )}

                {/* Slot summary */}
                <div className="flex gap-4 text-sm text-thiso-600 mb-3">
                  {trucks.length > 0 && <span>🚛 {trucks.length} tải</span>}
                  {motorbikes.length > 0 && <span>🛵 {motorbikes.length} xe máy</span>}
                  {slotList.length === 0 && <span className="text-gray-400 italic text-xs">Chưa có slot nào</span>}
                </div>

                {/* Slot chips */}
                {slotList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {slotList.map((s) => (
                      <span key={s.id} className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${s.status === 'AVAILABLE' ? 'border-green-300 bg-green-50 text-green-700' : s.status === 'OCCUPIED' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                        {s.code}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-thiso-100">
                  <button
                    className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-sky-400 hover:text-sky-600 transition-colors text-thiso-500"
                    onClick={() => { setEditZone(z); setAddMode(false); setForm({ code: z.code, name: z.name, unitConfigId: z.unitConfigId }); setError(''); }}
                  >
                    Sửa
                  </button>
                  <button
                    className="text-xs px-3 py-1 rounded-lg border border-thiso-200 hover:border-red-400 hover:text-red-600 transition-colors text-thiso-400"
                    onClick={() => deleteZone(z)}
                    disabled={(z._count?.slots ?? slotList.length) > 0}
                    title={(z._count?.slots ?? slotList.length) > 0 ? 'Chuyển hết slot ra trước khi xóa' : ''}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

