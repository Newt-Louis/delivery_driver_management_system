import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { downloadCsv } from '../lib/export';
import StatusBadge from '../components/StatusBadge';
import GoodsBadge from '../components/GoodsBadge';
import type { DeliveryRegistration } from '../lib/types';

// ─── Ticket code ──────────────────────────────────────────────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = { EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL' };
const VT_TICKET_PREFIX:   Record<string, string> = { TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X' };
function formatTicketCode(unit: string, vt: string, n: number): string {
  return `${UNIT_TICKET_PREFIX[unit] ?? unit}-${VT_TICKET_PREFIX[vt] ?? 'X'}${String(n).padStart(3, '0')}`;
}

const UNIT_COLOR: Record<string, string> = {
  EMART: '#FF9500', THISKYHALL: '#27A55E', TENANT: '#4F46E5',
};

const UNIT_BADGE: Record<string, { label: string; color: string }> = {
  EMART:      { label: 'Emart',      color: 'bg-emart-100 text-emart-700' },
  THISKYHALL: { label: 'Thiskyhall', color: 'bg-sky-100 text-sky-700' },
  TENANT:     { label: 'Mall (Khách thuê)', color: 'bg-thiso-100 text-thiso-600' },
};

const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe Tải', MOTORBIKE: '🛵 Xe Máy', OTHER: '🚗 Khác',
};

export default function CheckIn() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'plate' | 'code'>('plate');
  const [result, setResult] = useState<DeliveryRegistration | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: waitingList, refetch } = useQuery<DeliveryRegistration[]>({
    queryKey: ['deliveries', 'waiting'],
    queryFn: async () => (await api.get('/api/deliveries', { params: { status: 'WAITING' } })).data,
  });

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const body = mode === 'plate' ? { vehiclePlate: input } : { registrationCode: input };
      const res = await api.patch('/api/deliveries/check-in-lookup', body);
      setResult(res.data);
      setInput('');
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không tìm thấy xe hoặc đã check-in rồi';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="section-heading mb-1">Bảo vệ / Security</div>
        <h1 className="page-title">Check-in xe vào cổng</h1>
      </div>

      {/* Check-in card */}
      <div className="card mb-4">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-5 p-1 bg-thiso-50 rounded-xl">
          {(['plate', 'code'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setInput(''); setResult(null); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white shadow-card text-thiso-800'
                  : 'text-thiso-400 hover:text-thiso-600'
              }`}
            >
              {m === 'plate' ? '🚗 Biển số xe' : '🔖 Mã đăng ký'}
            </button>
          ))}
        </div>

        <form onSubmit={handleCheckIn} className="flex gap-3">
          <input
            className="input flex-1 text-lg font-mono font-bold uppercase"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder={mode === 'plate' ? '51C-123.45' : 'REG-20240606-0001'}
            required
            autoFocus
          />
          <button type="submit" className="btn-primary px-6 text-base" disabled={loading}>
            {loading ? '...' : 'Check-in ↵'}
          </button>
        </form>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {result && (
          <div className="mt-4 border-2 border-sky-300 rounded-xl overflow-hidden">
            <div className="bg-sky-600 px-4 py-3 flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span className="font-bold text-white">Check-in thành công!</span>
              <span className="ml-auto font-mono text-sky-100 text-xs">{result.registrationCode}</span>
            </div>

            {/* Ticket code — most prominent, tell this to the driver */}
            {result.ticketNumber != null && (
              <div
                className="px-4 py-5 text-center"
                style={{ background: UNIT_COLOR[result.receivingUnit] ?? '#4F46E5' }}
              >
                <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Số thẻ của tài xế</div>
                <div className="text-white font-black tracking-widest" style={{ fontSize: 'clamp(2rem, 6vw, 3.2rem)', lineHeight: 1.1 }}>
                  {formatTicketCode(result.receivingUnit, result.vehicleType, result.ticketNumber)}
                </div>
                <div className="text-white/70 text-xs mt-2">Thông báo số thẻ này cho tài xế theo dõi màn hình chờ</div>
              </div>
            )}

            <div className="p-4 grid grid-cols-2 gap-3 text-sm bg-sky-50">
              <InfoRow label="Biển số" value={<span className="font-mono font-bold text-thiso-800 text-base">{result.vehiclePlate}</span>} />
              <InfoRow label="Loại xe" value={VEHICLE_LABEL[result.vehicleType]} />
              <InfoRow label="Tài xế" value={result.driverName} />
              <InfoRow label="Điện thoại" value={result.driverPhone} />
              <InfoRow label="Nhà cung cấp" value={result.vendorName} />
              <InfoRow label="Đơn vị nhận" value={
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${UNIT_BADGE[result.receivingUnit]?.color}`}>
                  {UNIT_BADGE[result.receivingUnit]?.label}
                </span>
              } />
              <InfoRow label="Loại hàng" value={<GoodsBadge type={result.goodsType} />} />
              <div className="col-span-2">
                <InfoRow label="Trạng thái" value={<StatusBadge status={result.status} />} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Waiting list */}
      {waitingList && waitingList.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-thiso-700">Xe đang chờ trong sân</h2>
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{waitingList.length} xe</span>
              <button
                onClick={() => downloadCsv('xe-dang-cho',
                  ['Số thẻ', 'Mã ĐK', 'Biển số', 'Tài xế', 'Nhà CC', 'Đơn vị', 'Loại hàng', 'Loại xe', 'Chờ (phút)'],
                  waitingList.map((d) => [
                    d.ticketNumber != null ? formatTicketCode(d.receivingUnit, d.vehicleType, d.ticketNumber) : '',
                    d.registrationCode, d.vehiclePlate, d.driverName, d.vendorName,
                    ({ EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall' } as Record<string,string>)[d.receivingUnit] ?? d.receivingUnit,
                    ({ FRESH_FOOD: 'Tươi sống', GENERAL_GOODS: 'Hàng thường', AUTO_WAREHOUSE: 'Kho tự động', THI_CONG: 'Thi công' } as Record<string,string>)[d.goodsType] ?? d.goodsType,
                    VEHICLE_LABEL[d.vehicleType] ?? d.vehicleType,
                    d.checkinTime ? Math.round((Date.now() - new Date(d.checkinTime).getTime()) / 60000) : '',
                  ])
                )}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
              >
                ⬇ Xuất Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-thiso-100 text-left">
                  <th className="pb-2 pr-3 section-heading">Số thẻ</th>
                  <th className="pb-2 pr-3 section-heading">Biển số · Tài xế</th>
                  <th className="pb-2 pr-3 section-heading">Mã ĐK</th>
                  <th className="pb-2 pr-3 section-heading">Đơn vị</th>
                  <th className="pb-2 pr-3 section-heading">Loại hàng</th>
                  <th className="pb-2 section-heading">Chờ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thiso-50">
                {waitingList.map((d) => (
                  <tr key={d.id} className="hover:bg-thiso-50 transition-colors">
                    <td className="py-2.5 pr-3">
                      {d.ticketNumber != null ? (
                        <span
                          className="font-mono font-black text-white text-xs px-2 py-1 rounded-lg"
                          style={{ background: UNIT_COLOR[d.receivingUnit] ?? '#4F46E5' }}
                        >
                          {formatTicketCode(d.receivingUnit, d.vehicleType, d.ticketNumber)}
                        </span>
                      ) : <span className="text-thiso-300 text-xs">—</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-mono font-bold text-thiso-800 text-sm">{d.vehiclePlate}</div>
                      <div className="text-thiso-400 text-xs">{d.driverName}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-thiso-500">{d.registrationCode}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${UNIT_BADGE[d.receivingUnit]?.color ?? 'bg-thiso-100 text-thiso-600'}`}>
                        {UNIT_BADGE[d.receivingUnit]?.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3"><GoodsBadge type={d.goodsType} /></td>
                    <td className="py-2.5 text-thiso-500 text-xs whitespace-nowrap">{d.checkinTime ? `${Math.round((Date.now() - new Date(d.checkinTime).getTime()) / 60000)} phút` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-thiso-400 font-semibold uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-thiso-800">{value}</div>
    </div>
  );
}
