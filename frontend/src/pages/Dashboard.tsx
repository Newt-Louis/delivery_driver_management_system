import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { downloadCsv } from '../lib/export';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/StatusBadge';
import GoodsBadge from '../components/GoodsBadge';
import type { DeliveryRegistration, Slot, DashboardSummary, DispatchData, UnitDispatch, CallLog } from '../lib/types';
import { minutesSince, formatWait } from '../lib/utils';

// ─── Ticket code helper ────────────────────────────────────────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = { EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL' };
const VT_TICKET_PREFIX: Record<string, string> = { TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X' };
function formatTicketCode(unit: string, vt: string, n: number): string {
  return `${UNIT_TICKET_PREFIX[unit] ?? unit}-${VT_TICKET_PREFIX[vt] ?? 'X'}${String(n).padStart(3, '0')}`;
}
function getTicketCode(d: DeliveryRegistration): string | null {
  return d.ticketNumber ? formatTicketCode(d.receivingUnit, d.vehicleType, d.ticketNumber) : null;
}

// ─── Unit identity ─────────────────────────────────────────────────────────────
type UnitKey = 'EMART' | 'THISKYHALL' | 'TENANT';
type TabKey  = 'ALL' | UnitKey;

interface UnitMeta {
  label: string; icon: string; prefix: string;
  color: string; lightBg: string; border: string;
  headerBg: string; badge: string; tabActive: string; rowBorder: string;
}
const UNIT_META: Record<UnitKey, UnitMeta> = {
  EMART: {
    label: 'Emart', icon: '🏬', prefix: 'E',
    color: '#FF9500', lightBg: 'bg-emart-50', border: 'border-emart-300',
    headerBg: 'from-emart-600 to-emart-400',
    badge: 'bg-emart-100 text-emart-700',
    tabActive: 'border-emart-400 text-emart-700 bg-emart-50',
    rowBorder: 'border-l-emart-500',
  },
  THISKYHALL: {
    label: 'Thiskyhall', icon: '🏢', prefix: 'TH',
    color: '#27A55E', lightBg: 'bg-sky-50', border: 'border-sky-300',
    headerBg: 'from-sky-700 to-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    tabActive: 'border-sky-500 text-sky-700 bg-sky-50',
    rowBorder: 'border-l-sky-500',
  },
  TENANT: {
    label: 'Mall (Khách thuê)', icon: '🏪', prefix: 'TE',
    color: '#4F46E5', lightBg: 'bg-thiso-50', border: 'border-thiso-200',
    headerBg: 'from-thiso-700 to-thiso-500',
    badge: 'bg-thiso-100 text-thiso-600',
    tabActive: 'border-thiso-400 text-thiso-700 bg-thiso-50',
    rowBorder: 'border-l-thiso-400',
  },
};
const VEHICLE_LABEL: Record<string, string> = { TRUCK: '🚛 Tải', MOTORBIKE: '🛵 Xe máy', OTHER: '🚗 Khác' };
const STATUS_ORDER: Record<string, number> = { WAITING: 0, CALLED: 1, RECEIVING: 2, AUTO_WAREHOUSE_RECEIVING: 3 };

// ─── Auto-dispatch button ──────────────────────────────────────────────────────
function AutoDispatchBtn({ unit, onDone }: { unit: UnitKey; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<string | null>(null);

  async function dispatch() {
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post(`/api/deliveries/auto-dispatch/${unit}`);
      setResult(data.message);
      onDone();
    } catch {
      setResult('Lỗi khi điều phối');
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 4000);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={dispatch}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm"
      >
        <span className={loading ? 'animate-spin' : ''}>🤖</span>
        {loading ? 'Đang điều phối...' : 'Tự động điều phối'}
      </button>
      {result && (
        <div className={`text-xs px-3 py-1 rounded-full font-semibold ${
          result.includes('Đã') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
}

// ─── Search + filter bar ───────────────────────────────────────────────────────
type StatusFilter = 'ALL' | 'WAITING' | 'CALLED' | 'RECEIVING';
type VtFilter     = 'ALL' | 'TRUCK' | 'MOTORBIKE';

// ─── Expired banner ───────────────────────────────────────────────────────────
function ExpiredBanner({ count, onDone }: { count: number; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');

  async function runExpire() {
    setLoading(true);
    try {
      const r = await api.post('/api/dashboard/expire-stale');
      setMsg(r.data.message);
      onDone();
    } catch {
      setMsg('Lỗi khi xử lý');
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 5000);
    }
  }

  return (
    <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-xl flex flex-wrap items-center gap-3">
      <span className="text-xl shrink-0">🕓</span>
      <span className="font-semibold text-sm flex-1">
        <strong>{count}</strong> đăng ký quá ngày đã tự động lưu vào lịch sử (không check-in hoặc không nhận hàng).
        Tra cứu tại <span className="underline font-bold">Báo cáo → Lịch sử</span>, lọc trạng thái <em>Hết hạn</em>.
      </span>
      {msg ? (
        <span className="text-xs font-semibold text-purple-700">{msg}</span>
      ) : (
        <button
          onClick={runExpire}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? 'Đang xử lý...' : 'Xử lý ngay'}
        </button>
      )}
    </div>
  );
}

function FilterBar({
  search, onSearch,
  statusFilter, onStatus,
  vtFilter, onVt,
  total, onExport,
}: {
  search: string; onSearch: (s: string) => void;
  statusFilter: StatusFilter; onStatus: (f: StatusFilter) => void;
  vtFilter: VtFilter; onVt: (f: VtFilter) => void;
  total: number; onExport: () => void;
}) {
  const statusOpts: { k: StatusFilter; label: string; color: string }[] = [
    { k: 'ALL',       label: 'Tất cả',    color: 'bg-thiso-100 text-thiso-700' },
    { k: 'WAITING',   label: '⏳ Chờ gọi', color: 'bg-amber-100 text-amber-700' },
    { k: 'CALLED',    label: '📣 Đã gọi',  color: 'bg-sky-100 text-sky-700' },
    { k: 'RECEIVING', label: '📦 Nhận hàng', color: 'bg-green-100 text-green-700' },
  ];
  const vtOpts: { k: VtFilter; label: string }[] = [
    { k: 'ALL', label: 'Tất cả xe' },
    { k: 'TRUCK', label: '🚛 Xe Tải' },
    { k: 'MOTORBIKE', label: '🛵 Xe Máy' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 mb-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-thiso-400 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Tìm biển số, số thẻ, nhà CC..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-thiso-200 rounded-xl bg-white focus:outline-none focus:border-sky-400 transition-colors placeholder:text-thiso-300"
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-thiso-300 hover:text-thiso-600 text-base"
          >×</button>
        )}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1 flex-wrap">
        {statusOpts.map((o) => (
          <button
            key={o.k}
            onClick={() => onStatus(o.k)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap
              ${statusFilter === o.k ? o.color + ' ring-2 ring-offset-1 ring-sky-300' : 'bg-thiso-50 text-thiso-500 hover:bg-thiso-100'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Vehicle type pills */}
      <div className="flex items-center gap-1">
        {vtOpts.map((o) => (
          <button
            key={o.k}
            onClick={() => onVt(o.k)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap
              ${vtFilter === o.k ? 'bg-thiso-800 text-white' : 'bg-thiso-50 text-thiso-500 hover:bg-thiso-100'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      {(search || statusFilter !== 'ALL' || vtFilter !== 'ALL') && (
        <span className="text-xs text-thiso-400">{total} kết quả</span>
      )}

      {/* Export */}
      <button
        onClick={onExport}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
      >
        ⬇ Xuất Excel
      </button>
    </div>
  );
}

// ─── Call Modal ────────────────────────────────────────────────────────────────
interface CallModalProps {
  delivery: DeliveryRegistration; slots: Slot[];
  preselectedSlotId?: string; onClose: () => void;
  onCall: (slotId: string) => void; loading: boolean;
}
function CallModal({ delivery, slots, preselectedSlotId, onClose, onCall, loading }: CallModalProps) {
  const [selectedSlot, setSelectedSlot] = useState(preselectedSlotId ?? '');
  const unit = delivery.receivingUnit as UnitKey;
  const meta = UNIT_META[unit];
  const ticket = getTicketCode(delivery);

  const available = slots.filter((s) => s.status === 'AVAILABLE');
  const tier1 = available.filter((s) => s.assignedUnit === delivery.receivingUnit && s.vehicleType === delivery.vehicleType);
  const tier2 = available.filter((s) => s.assignedUnit !== delivery.receivingUnit && s.vehicleType === delivery.vehicleType);
  const tier3 = available.filter((s) => s.vehicleType !== delivery.vehicleType);
  const selectedObj = slots.find((s) => s.id === selectedSlot);

  function SlotBtn({ d, tier }: { d: Slot; tier: 1 | 2 | 3 }) {
    const active = selectedSlot === d.id;
    const styles: Record<1|2|3, string> = {
      1: active ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-200' : 'border-thiso-200 hover:border-sky-300',
      2: active ? 'border-emart-500 bg-emart-50 text-emart-700' : 'border-thiso-200 hover:border-emart-300',
      3: active ? 'border-red-500 bg-red-50 text-red-700' : 'border-thiso-200 hover:border-red-300',
    };
    return (
      <button onClick={() => setSelectedSlot(d.id)}
        className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left ${styles[tier]}`}>
        <div className="font-black text-base">{d.code}</div>
        {d.zone && <div className="text-xs font-bold opacity-70 mt-0.5">{d.zone.code}</div>}
        <div className="text-xs opacity-50 truncate leading-tight">{d.name}</div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className={`bg-gradient-to-r ${meta.headerBg} p-5 rounded-t-2xl`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-white/70 text-sm">{meta.icon} {meta.label}</div>
              {ticket && (
                <div className="text-white/60 text-xs font-mono font-black tracking-widest mt-0.5">🎫 {ticket}</div>
              )}
              <div className="text-white font-black text-2xl tracking-widest mt-1">{delivery.vehiclePlate}</div>
              <div className="text-white/80 text-sm mt-1">{delivery.vendorName} · {VEHICLE_LABEL[delivery.vehicleType]}</div>
              <div className="text-white/60 text-xs mt-0.5 font-mono">{delivery.registrationCode}</div>
            </div>
            <GoodsBadge type={delivery.goodsType} />
          </div>
          {delivery._count && delivery._count.callLogs > 0 && (
            <div className="mt-3 bg-white/20 rounded-lg px-3 py-1.5 text-white text-xs">
              ⚠️ Đã gọi <strong>{delivery._count.callLogs}</strong> lần trước
            </div>
          )}
        </div>
        <div className="p-5">
          {preselectedSlotId && (
            <div className="mb-4 px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700">
              💡 AI đề xuất: <strong>{slots.find((s) => s.id === preselectedSlotId)?.code}</strong>
            </div>
          )}
          {tier1.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-green-700 uppercase mb-2">✓ Vị trí phù hợp — {meta.label}</p>
              <div className="grid grid-cols-3 gap-2">{tier1.map((d) => <SlotBtn key={d.id} d={d} tier={1} />)}</div>
            </div>
          )}
          {tier2.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-orange-600 uppercase mb-2">Cùng loại xe — đơn vị khác</p>
              <div className="grid grid-cols-3 gap-2">{tier2.map((d) => <SlotBtn key={d.id} d={d} tier={2} />)}</div>
            </div>
          )}
          {tier3.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-red-500 uppercase mb-2">⚠ Vị trí khác loại xe</p>
              <div className="grid grid-cols-3 gap-2">{tier3.map((d) => <SlotBtn key={d.id} d={d} tier={3} />)}</div>
            </div>
          )}
          {tier1.length === 0 && tier2.length === 0 && tier3.length === 0 && (
            <div className="py-6 text-center text-gray-400">Không còn vị trí trống</div>
          )}
          <div className="flex gap-3 mt-4">
            <button className="btn-secondary flex-1" onClick={onClose} disabled={loading}>Hủy</button>
            <button
              className={`flex-1 font-bold py-2.5 rounded-xl text-white transition-colors disabled:opacity-50
                ${selectedObj?.vehicleType !== delivery.vehicleType ? 'bg-red-500 hover:bg-red-600'
                  : selectedObj?.assignedUnit !== delivery.receivingUnit ? 'bg-emart-500 hover:bg-emart-600'
                  : 'bg-sky-600 hover:bg-sky-700'}`}
              disabled={!selectedSlot || loading}
              onClick={() => onCall(selectedSlot)}
            >
              {loading ? 'Đang gọi...' : `Gọi → ${selectedObj?.code ?? '...'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Unit Header ───────────────────────────────────────────────────────────────
function UnitHeader({ unit, ud, onDispatch }: { unit: UnitKey; ud: UnitDispatch; onDispatch: () => void }) {
  const meta = UNIT_META[unit];
  const s = ud.insights.stats;
  return (
    <div className={`bg-gradient-to-r ${meta.headerBg} rounded-2xl p-5 mb-4 text-white shadow-lg`}>
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <div className="font-black text-2xl tracking-wide">{meta.label.toUpperCase()}</div>
            {s.avgWaitMinutes !== null && (
              <div className="text-white/70 text-sm">Chờ TB: {s.avgWaitMinutes} phút</div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {ud.insights.nextHour.count > 0 && (
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <div className="text-2xl font-black">{ud.insights.nextHour.count}</div>
              <div className="text-xs text-white/70">xe đến 1h tới</div>
            </div>
          )}
          <AutoDispatchBtn unit={unit} onDone={onDispatch} />
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { v: s.registered,           l: 'Đã đặt',    dim: true },
          { v: s.waiting,              l: 'Chờ gọi',   dim: false },
          { v: s.called,               l: 'Đã gọi',    dim: false },
          { v: s.receiving,            l: 'Nhận hàng', dim: false },
          { v: s.truckSlotsAvailable ?? s.truckDocksAvailable, l: '🚛 Slot', dim: false },
          { v: s.mbSlotsAvailable    ?? s.mbDocksAvailable,   l: '🛵 Slot', dim: false },
        ].map((c) => (
          <div key={c.l} className={`bg-white/10 rounded-xl p-2.5 text-center ${c.dim ? 'opacity-70' : ''}`}>
            <div className="text-2xl font-black leading-none">{c.v}</div>
            <div className="text-xs text-white/70 mt-1 leading-tight">{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Insight Card ───────────────────────────────────────────────────────────
function AICard({ ud, onAction }: { ud: UnitDispatch; onAction: (id: string, slotId?: string) => void }) {
  const { alerts, recommendations } = ud.insights;
  if (alerts.length === 0 && recommendations.length === 0) return null;
  const criticals = alerts.filter((a) => a.level === 'critical');
  const warnings  = alerts.filter((a) => a.level === 'warning');
  return (
    <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center gap-2">
        <span>🤖</span>
        <span className="text-white font-bold text-sm">AI Điều phối</span>
        {criticals.length > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs px-2.5 py-0.5 rounded-full animate-pulse font-bold">
            {criticals.length} KHẨN CẤP
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {criticals.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 bg-red-50">
            <div className="flex-1 text-sm text-red-800 font-medium">{a.message}</div>
            {a.deliveryId && (
              <button className="shrink-0 bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-red-700" onClick={() => onAction(a.deliveryId!)}>Xử lý ngay</button>
            )}
          </div>
        ))}
        {warnings.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 bg-yellow-50">
            <div className="flex-1 text-sm text-yellow-800">{a.message}</div>
            {a.deliveryId && (
              <button className="shrink-0 bg-yellow-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-yellow-600" onClick={() => onAction(a.deliveryId!)}>Xử lý</button>
            )}
          </div>
        ))}
        {recommendations.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 text-sm text-slate-700">{r.message}</div>
            {r.deliveryId && (
              <button className="shrink-0 bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-700" onClick={() => onAction(r.deliveryId!, r.slotId)}>Gọi ngay</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Delivery Detail Modal ────────────────────────────────────────────────────
const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: '🥦 Hàng tươi sống', AUTO_WAREHOUSE: '🤖 Kho tự động', GENERAL_GOODS: '📦 Hàng thông thường', THI_CONG: '🔨 Thi công',
};
const STATUS_LABEL: Record<string, string> = {
  REGISTERED: 'Đã đặt', WAITING: 'Đang chờ', CALLED: 'Đã được gọi', RECEIVING: 'Đang nhận hàng',
  AUTO_WAREHOUSE_RECEIVING: 'Nhận kho tự động', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
};
const VEHICLE_FULL: Record<string, string> = { TRUCK: '🚛 Xe Tải', MOTORBIKE: '🛵 Xe Máy', OTHER: '🚗 Khác' };

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-thiso-400 mb-0.5">{label}</div>
      <div className="text-sm text-thiso-800 font-medium break-words">{value ?? <span className="text-thiso-300">—</span>}</div>
    </div>
  );
}

function DeliveryDetailModal({ id, onClose, onCall, onAction, slots }: {
  id: string;
  onClose: () => void;
  onCall: (d: DeliveryRegistration) => void;
  onAction: (id: string, action: string) => void;
  slots: Slot[];
}) {
  const { data: d, isLoading } = useQuery<DeliveryRegistration & { callLogs: CallLog[] }>({
    queryKey: ['delivery', id],
    queryFn: async () => (await api.get(`/api/deliveries/${id}`)).data,
    staleTime: 5_000,
  });

  const unit  = d ? (d.receivingUnit as UnitKey) : null;
  const meta  = unit ? UNIT_META[unit] : null;
  const ticket = d ? getTicketCode(d) : null;

  // Timeline events
  const timeline: { time: string; label: string; icon: string; accent?: string }[] = [];
  if (d) {
    timeline.push({ time: d.createdAt, label: 'Đăng ký giao hàng', icon: '📝' });
    if (d.checkinTime)        timeline.push({ time: d.checkinTime,        label: 'Check-in tại cổng',       icon: '🔐' });
    (d.callLogs ?? []).slice().reverse().forEach((cl, i) =>
      timeline.push({
        time: cl.calledAt,
        label: `Gọi vào vị trí${cl.slot ? ` → ${cl.slot.code}` : ''}${cl.calledByUser ? ` (bởi ${cl.calledByUser.name})` : ''}`,
        icon: i === 0 && (d.callLogs!.length > 1) ? '🔁' : '📣',
        accent: 'text-sky-700',
      })
    );
    if (d.receivingStartTime) timeline.push({ time: d.receivingStartTime, label: 'Bắt đầu nhận hàng',       icon: '📦', accent: 'text-green-700' });
    if (d.completedTime)      timeline.push({ time: d.completedTime,      label: 'Hoàn tất nhận hàng',      icon: '✅', accent: 'text-green-700' });
    if (d.status === 'CANCELLED') timeline.push({ time: d.updatedAt, label: 'Đã hủy', icon: '❌', accent: 'text-red-600' });
    timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`bg-gradient-to-r ${meta?.headerBg ?? 'from-thiso-700 to-thiso-500'} p-5 rounded-t-2xl shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {ticket && (
                <div className="text-white/70 text-xs font-mono font-black tracking-widest mb-1">🎫 {ticket}</div>
              )}
              <div className="text-white font-black text-2xl tracking-wider truncate">{isLoading ? '…' : d?.vehiclePlate}</div>
              <div className="text-white/80 text-sm mt-1 truncate">{d?.vendorName}</div>
              <div className="text-white/60 text-xs font-mono mt-0.5">{d?.registrationCode}</div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {d && <StatusBadge status={d.status} />}
              <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-thiso-400 py-16">Đang tải...</div>
        ) : d ? (
          <div className="flex-1 overflow-y-auto">
            {/* Registration info grid */}
            <div className="p-5 grid grid-cols-2 gap-4 border-b border-thiso-100">
              <DetailRow label="Nhà cung cấp" value={d.vendorName} />
              <DetailRow label="Mã đăng ký" value={<span className="font-mono text-sky-700 font-black text-sm">{d.registrationCode}</span>} />
              <DetailRow label="Tài xế" value={d.driverName} />
              <DetailRow label="Điện thoại" value={<a href={`tel:${d.driverPhone}`} className="text-sky-600 underline">{d.driverPhone}</a>} />
              <DetailRow label="Biển số xe" value={<span className="font-mono font-black text-thiso-900">{d.vehiclePlate}</span>} />
              <DetailRow label="Loại xe" value={VEHICLE_FULL[d.vehicleType]} />
              <DetailRow label="Đơn vị nhận" value={
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${meta?.badge}`}>{meta?.icon} {meta?.label}</span>
              } />
              <DetailRow label="Loại hàng" value={GOODS_LABEL[d.goodsType]} />
              {d.poNumber && <DetailRow label="Số PO" value={<span className="font-mono">{d.poNumber}</span>} />}
              {d.note      && <DetailRow label="Ghi chú" value={d.note} />}
            </div>

            {/* Timestamps */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-thiso-100 bg-thiso-50/50">
              <DetailRow label="Giờ đặt lịch" value={fmtDt(d.requestedTime)} />
              <DetailRow label="Giờ đăng ký" value={fmtDt(d.createdAt)} />
              <DetailRow label="Check-in" value={fmtDt(d.checkinTime)} />
              <DetailRow label="Được gọi" value={fmtDt(d.calledTime)} />
              <DetailRow label="Bắt đầu nhận" value={fmtDt(d.receivingStartTime)} />
              <DetailRow label="Hoàn tất" value={fmtDt(d.completedTime)} />
              {d.assignedSlot && (
                <DetailRow label="Vị trí được phân công" value={
                  <span className="font-black text-base" style={{ color: meta?.color }}>{d.assignedSlot.code}
                    {d.assignedSlot.zone && <span className="text-xs text-thiso-400 font-normal ml-1">({d.assignedSlot.zone.code})</span>}
                  </span>
                } />
              )}
            </div>

            {/* History timeline */}
            <div className="px-5 py-4">
              <div className="text-xs font-black uppercase tracking-wider text-thiso-400 mb-3">Lịch sử hoạt động</div>
              {timeline.length === 0 ? (
                <div className="text-thiso-300 text-sm">Chưa có lịch sử</div>
              ) : (
                <ol className="relative border-l-2 border-thiso-100 space-y-4 ml-3">
                  {timeline.map((ev, i) => (
                    <li key={i} className="relative pl-5">
                      <span className="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-white border-2 border-thiso-200 flex items-center justify-center text-[11px]">{ev.icon}</span>
                      <div className={`text-sm font-medium ${ev.accent ?? 'text-thiso-700'}`}>{ev.label}</div>
                      <div className="text-xs text-thiso-400 mt-0.5">{fmtDt(ev.time)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ) : null}

        {/* Footer actions */}
        {d && !['COMPLETED', 'CANCELLED'].includes(d.status) && (
          <div className="shrink-0 px-5 py-4 border-t border-thiso-100 flex flex-wrap gap-2 bg-thiso-50/50">
            {d.status === 'WAITING' && (
              <button className="btn-primary text-sm px-4 py-2" onClick={() => { onCall(d); onClose(); }}>📣 Gọi vào vị trí</button>
            )}
            {d.status === 'CALLED' && (
              <>
                <button className="btn-warning text-sm px-4 py-2" onClick={() => { onAction(d.id, 'start-receiving'); onClose(); }}>📦 Bắt đầu nhận</button>
                <button className="btn-secondary text-sm px-3 py-2" onClick={() => { onCall(d); onClose(); }}>🔁 Gọi lại</button>
              </>
            )}
            {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status) && (
              <button className="btn-success text-sm px-4 py-2" onClick={() => { onAction(d.id, 'complete'); onClose(); }}>✅ Hoàn tất</button>
            )}
            <button className="btn-danger text-sm px-3 py-2 ml-auto" onClick={() => { onAction(d.id, 'cancel'); onClose(); }}>Hủy đơn</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Queue Table ───────────────────────────────────────────────────────────────
function QueueTable({
  deliveries, unit, onCall, onAction, onView, actionLoading,
}: {
  deliveries: DeliveryRegistration[];
  unit?: UnitKey;
  onCall: (d: DeliveryRegistration) => void;
  onAction: (id: string, action: string) => void;
  onView: (id: string) => void;
  actionLoading: string | null;
}) {
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [vtFilter, setVtFilter]         = useState<VtFilter>('ALL');
  const unitCounters: Record<string, number> = {};

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliveries
      .filter((d) => {
        if (statusFilter === 'RECEIVING') {
          if (!['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)) return false;
        } else if (statusFilter !== 'ALL') {
          if (d.status !== statusFilter) return false;
        }
        if (vtFilter !== 'ALL' && d.vehicleType !== vtFilter) return false;
        if (!q) return true;
        const ticket = getTicketCode(d) ?? '';
        return (
          d.vehiclePlate.toLowerCase().includes(q) ||
          d.vendorName.toLowerCase().includes(q) ||
          d.driverName?.toLowerCase().includes(q) ||
          d.registrationCode.toLowerCase().includes(q) ||
          ticket.toLowerCase().includes(q) ||
          (d.poNumber?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const sa = STATUS_ORDER[a.status] ?? 9;
        const sb = STATUS_ORDER[b.status] ?? 9;
        if (sa !== sb) return sa - sb;
        return new Date(a.checkinTime ?? a.createdAt).getTime() -
               new Date(b.checkinTime ?? b.createdAt).getTime();
      });
  }, [deliveries, search, statusFilter, vtFilter]);

  const GOODS_L: Record<string, string> = { FRESH_FOOD: 'Tươi sống', AUTO_WAREHOUSE: 'Kho tự động', GENERAL_GOODS: 'Hàng thường', THI_CONG: 'Thi công' };
  const STATUS_L: Record<string, string> = { WAITING: 'Đang chờ', CALLED: 'Đã gọi', RECEIVING: 'Đang nhận', AUTO_WAREHOUSE_RECEIVING: 'Kho tự động', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' };
  const UNIT_L: Record<string, string> = { EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall' };

  function handleExport() {
    downloadCsv('dieu-phoi-hang-cho',
      ['Số thẻ', 'Mã ĐK', 'Biển số', 'Tài xế', 'Nhà CC', 'Đơn vị', 'Loại hàng', 'Loại xe', 'Slot', 'Trạng thái', 'Check-in', 'Chờ (phút)'],
      filtered.map((d) => [
        getTicketCode(d) ?? '', d.registrationCode, d.vehiclePlate, d.driverName, d.vendorName,
        UNIT_L[d.receivingUnit] ?? d.receivingUnit, GOODS_L[d.goodsType] ?? d.goodsType,
        VEHICLE_LABEL[d.vehicleType] ?? d.vehicleType,
        (d as unknown as { assignedSlot?: { code: string } }).assignedSlot?.code ?? '',
        STATUS_L[d.status] ?? d.status,
        d.checkinTime ? new Date(d.checkinTime).toLocaleString('vi-VN') : '',
        d.checkinTime ? Math.round((Date.now() - new Date(d.checkinTime).getTime()) / 60000) : '',
      ]),
    );
  }

  return (
    <div>
      <FilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatusFilter}
        vtFilter={vtFilter} onVt={setVtFilter}
        total={filtered.length} onExport={handleExport}
      />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-thiso-100 py-12 text-center shadow-sm">
          <div className="text-3xl mb-2">{deliveries.length === 0 ? '🎉' : '🔍'}</div>
          <div className="text-thiso-400 text-sm">
            {deliveries.length === 0 ? 'Không có xe nào đang điều phối' : 'Không tìm thấy kết quả phù hợp'}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-thiso-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase text-left border-b border-thiso-100">
                  <th className="px-3 py-3 w-[120px]">Số thẻ</th>
                  <th className="px-3 py-3">Biển số · Tài xế</th>
                  {!unit && <th className="px-3 py-3">Đơn vị</th>}
                  <th className="px-3 py-3">Nhà cung cấp</th>
                  <th className="px-3 py-3 w-[130px]">Mã ĐK</th>
                  <th className="px-3 py-3">Hàng · Xe</th>
                  <th className="px-3 py-3 w-20">Chờ</th>
                  <th className="px-3 py-3 w-16">Vị trí</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3 min-w-[220px]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const dUnit  = d.receivingUnit as UnitKey;
                  const dMeta  = UNIT_META[dUnit];
                  const prefix = dMeta?.prefix ?? '?';
                  unitCounters[prefix] = (unitCounters[prefix] ?? 0) + 1;
                  const ticket  = getTicketCode(d);
                  const waitMin = minutesSince(d.checkinTime);
                  const calledMin = minutesSince(d.calledTime);
                  const isCritical = d.goodsType === 'FRESH_FOOD' && d.status === 'WAITING' && waitMin >= 30;
                  const isWarning  = (d.goodsType === 'FRESH_FOOD' && d.status === 'WAITING' && waitMin >= 20)
                    || (d.status === 'CALLED' && calledMin >= 15);

                  return (
                    <tr
                      key={d.id}
                      className={`border-b border-thiso-50 last:border-0 transition-colors border-l-4
                        ${isCritical  ? 'bg-red-50 border-l-red-500'
                        : isWarning   ? 'bg-amber-50 border-l-amber-400'
                        : `hover:bg-thiso-50/60 ${dMeta?.rowBorder ?? 'border-l-transparent'}`}`}
                    >
                      {/* Số thẻ */}
                      <td className="px-3 py-3">
                        {ticket ? (
                          <div
                            className="inline-flex items-center px-2.5 py-1 rounded-lg font-mono font-black text-xs tracking-widest text-white whitespace-nowrap shadow-sm"
                            style={{ background: dMeta?.color ?? '#555' }}
                          >
                            🎫 {ticket}
                          </div>
                        ) : (
                          <span className="text-thiso-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Biển số + tài xế */}
                      <td className="px-3 py-3">
                        <div className="font-mono font-black text-thiso-900 text-base leading-none">{d.vehiclePlate}</div>
                        <div className="text-xs text-thiso-500 mt-1 leading-none">{d.driverName}</div>
                        <div className="text-xs text-thiso-400 mt-0.5 font-mono">{d.driverPhone}</div>
                        {d._count && d._count.callLogs > 0 && (
                          <span className="text-[10px] text-emart-600 font-bold mt-0.5 block">📞 Gọi {d._count.callLogs}x</span>
                        )}
                      </td>

                      {/* Đơn vị */}
                      {!unit && (
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${dMeta?.badge}`}>
                            {dMeta?.icon} {dMeta?.label}
                          </span>
                        </td>
                      )}

                      {/* Nhà cung cấp */}
                      <td className="px-3 py-3">
                        <div className="text-sm text-thiso-800 font-medium truncate max-w-[150px]" title={d.vendorName}>{d.vendorName}</div>
                        {d.poNumber && (
                          <div className="text-[10px] text-thiso-400 font-mono mt-0.5">PO: {d.poNumber}</div>
                        )}
                      </td>

                      {/* Mã ĐK */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-sky-700 font-bold bg-sky-50 px-2 py-1 rounded-lg whitespace-nowrap select-all">
                          {d.registrationCode}
                        </span>
                      </td>

                      {/* Hàng + xe */}
                      <td className="px-3 py-3">
                        <GoodsBadge type={d.goodsType} />
                        <div className="text-xs text-thiso-500 mt-1">{VEHICLE_LABEL[d.vehicleType]}</div>
                      </td>

                      {/* Thời gian chờ */}
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {d.status === 'WAITING' && d.checkinTime && (
                          <div>
                            <span className={`font-black text-sm ${isCritical ? 'text-red-600' : isWarning ? 'text-orange-500' : 'text-thiso-600'}`}>
                              {formatWait(d.checkinTime)}
                            </span>
                            <div className="text-thiso-400 text-[10px] mt-0.5">từ check-in</div>
                          </div>
                        )}
                        {d.status === 'CALLED' && (
                          <div>
                            <span className={`font-black text-sm ${calledMin >= 15 ? 'text-red-600' : 'text-sky-600'}`}>
                              {formatWait(d.calledTime)}
                            </span>
                            {calledMin >= 15 && (
                              <div className="text-red-500 font-black text-[10px] mt-0.5 animate-pulse">NO-SHOW</div>
                            )}
                          </div>
                        )}
                        {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status) && (
                          <div>
                            <span className="font-black text-sm text-green-600">{formatWait(d.receivingStartTime)}</span>
                            <div className="text-thiso-400 text-[10px] mt-0.5">đang nhận</div>
                          </div>
                        )}
                      </td>

                      {/* Vị trí */}
                      <td className="px-3 py-3">
                        {d.assignedSlot ? (
                          <div>
                            <span className="font-black text-base" style={{ color: dMeta?.color }}>{d.assignedSlot.code}</span>
                            {d.assignedSlot.zone && <div className="text-[10px] text-thiso-400 font-mono">{d.assignedSlot.zone.code}</div>}
                          </div>
                        ) : '—'}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-3 py-3"><StatusBadge status={d.status} /></td>

                      {/* Thao tác */}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-thiso-200 text-thiso-500 hover:bg-thiso-50 hover:text-thiso-700 transition-colors font-medium"
                            onClick={() => onView(d.id)}
                          >
                            🔍 Xem
                          </button>
                          {d.status === 'WAITING' && (
                            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => onCall(d)}>
                              📣 Gọi vào vị trí
                            </button>
                          )}
                          {d.status === 'CALLED' && (
                            <>
                              <button
                                className="btn-warning text-xs px-3 py-1.5"
                                disabled={!!actionLoading}
                                onClick={() => onAction(d.id, 'start-receiving')}
                              >
                                📦 Bắt đầu nhận
                              </button>
                              <button
                                className="btn-secondary text-xs px-2 py-1.5"
                                disabled={!!actionLoading}
                                onClick={() => onCall(d)}
                              >
                                🔁 Gọi lại
                              </button>
                            </>
                          )}
                          {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status) && (
                            <button
                              className="btn-success text-xs px-3 py-1.5"
                              disabled={!!actionLoading}
                              onClick={() => onAction(d.id, 'complete')}
                            >
                              ✓ Hoàn tất
                            </button>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(d.status) && (
                            <button
                              className="btn-danger text-xs px-2 py-1.5"
                              disabled={!!actionLoading}
                              onClick={() => onAction(d.id, 'cancel')}
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upcoming Section ──────────────────────────────────────────────────────────
function UpcomingSection({ deliveries, unit }: { deliveries: DeliveryRegistration[]; unit?: UnitKey }) {
  const [open, setOpen] = useState(true);
  if (deliveries.length === 0) return null;
  const meta = unit ? UNIT_META[unit] : null;

  return (
    <div className="mt-5">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-thiso-500 mb-2 hover:text-thiso-700"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>📋 Đã đặt — chưa check-in</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${meta ? meta.badge : 'bg-gray-200 text-gray-600'}`}>
          {deliveries.length}
        </span>
      </button>
      {open && (
        <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                <th className="px-4 py-2">Giờ đặt</th>
                <th className="px-4 py-2">Biển số</th>
                {!unit && <th className="px-4 py-2">Đơn vị</th>}
                <th className="px-4 py-2">Nhà cung cấp</th>
                <th className="px-4 py-2">Loại xe</th>
                <th className="px-4 py-2">Hàng</th>
                <th className="px-4 py-2">Mã ĐK</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => {
                const dUnit = d.receivingUnit as UnitKey;
                const dMeta = UNIT_META[dUnit];
                const slot = d.requestedTime
                  ? new Date(d.requestedTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const isPast = d.requestedTime ? new Date(d.requestedTime) < new Date() : false;
                return (
                  <tr key={d.id} className={`border-b border-thiso-50 last:border-0 ${isPast ? 'bg-amber-50' : 'hover:bg-thiso-50'}`}>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono font-bold ${isPast ? 'text-emart-600' : 'text-thiso-700'}`}>{slot}</span>
                      {isPast && <div className="text-xs text-emart-400">Trễ slot</div>}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-black text-thiso-800">{d.vehiclePlate}</td>
                    {!unit && (
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${dMeta?.badge}`}>
                          {dMeta?.icon} {dMeta?.label}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-thiso-600 truncate max-w-[140px]">{d.vendorName}</td>
                    <td className="px-4 py-2.5 text-xs text-thiso-400">{VEHICLE_LABEL[d.vehicleType]}</td>
                    <td className="px-4 py-2.5"><GoodsBadge type={d.goodsType} /></td>
                    <td className="px-4 py-2.5 text-xs font-mono text-thiso-400">{d.registrationCode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── All-units overview cards ──────────────────────────────────────────────────
function AllTabView({
  dispatch, onCall, onAction, onView, actionLoading, onDispatch,
}: {
  dispatch: DispatchData;
  onCall: (d: DeliveryRegistration, slotId?: string) => void;
  onAction: (id: string, action: string) => void;
  onView: (id: string) => void;
  actionLoading: string | null;
  onDispatch: () => void;
}) {
  const UNITS: UnitKey[] = ['EMART', 'THISKYHALL', 'TENANT'];
  const allActive = UNITS.flatMap((u) => (dispatch[u] as UnitDispatch | undefined)?.active ?? [])
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      || new Date(a.checkinTime ?? a.createdAt).getTime() - new Date(b.checkinTime ?? b.createdAt).getTime());
  const allUpcoming = UNITS.flatMap((u) => (dispatch[u] as UnitDispatch | undefined)?.upcoming ?? [])
    .sort((a, b) => new Date(a.requestedTime ?? a.createdAt).getTime() - new Date(b.requestedTime ?? b.createdAt).getTime());

  return (
    <>
      {/* Unit overview strip */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {UNITS.map((u) => {
          const ud = dispatch[u] as UnitDispatch | undefined;
          const meta = UNIT_META[u];
          const s = ud?.insights.stats;
          return (
            <div key={u} className={`bg-gradient-to-br ${meta.headerBg} rounded-2xl p-4 text-white shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="font-black text-sm tracking-wide">{meta.label.toUpperCase()}</span>
                </div>
                <AutoDispatchBtn unit={u} onDone={onDispatch} />
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  { l: 'Chờ gọi',  v: s?.waiting   ?? 0 },
                  { l: 'Đã gọi',   v: s?.called     ?? 0 },
                  { l: 'Nhận hàng',v: s?.receiving  ?? 0 },
                ].map((c) => (
                  <div key={c.l} className="bg-white/15 rounded-lg p-2 text-center">
                    <div className="text-xl font-black leading-none">{c.v}</div>
                    <div className="text-xs text-white/70 mt-0.5 leading-tight">{c.l}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-white/60">
                <span>🚛 {s?.truckSlotsAvailable ?? s?.truckDocksAvailable ?? 0} slot tải</span>
                <span>🛵 {s?.mbSlotsAvailable ?? s?.mbDocksAvailable ?? 0} slot máy</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-black text-thiso-500 uppercase tracking-wider flex items-center gap-2">
          Tất cả xe đang điều phối
          {allActive.length > 0 && (
            <span className="bg-thiso-100 text-thiso-600 text-xs px-2 py-0.5 rounded-full font-bold">{allActive.length}</span>
          )}
        </h3>
      </div>
      <QueueTable deliveries={allActive} onCall={onCall} onAction={onAction} onView={onView} actionLoading={actionLoading} />
      <UpcomingSection deliveries={allUpcoming} />
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [activeTab, setActiveTab]       = useState<TabKey>('ALL');
  const [callTarget, setCallTarget]     = useState<DeliveryRegistration | null>(null);
  const [callPreDock, setCallPreDock]   = useState<string | undefined>(undefined);
  const [callLoading, setCallLoading]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewId, setViewId]             = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['slots'] });
  }, [queryClient]);

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await api.get('/api/dashboard/summary')).data,
    refetchInterval: 30_000,
  });

  const { data: dispatch, isLoading } = useQuery<DispatchData>({
    queryKey: ['dashboard', 'dispatch'],
    queryFn: async () => (await api.get('/api/dashboard/dispatch')).data,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    socket.on('queue_updated',      invalidateAll);
    socket.on('slot_updated',       invalidateAll);
    socket.on('delivery_completed', invalidateAll);
    socket.on('delivery_called',    invalidateAll);
    return () => {
      socket.off('queue_updated',      invalidateAll);
      socket.off('slot_updated',       invalidateAll);
      socket.off('delivery_completed', invalidateAll);
      socket.off('delivery_called',    invalidateAll);
    };
  }, [socket, invalidateAll]);

  async function doCall(slotId: string) {
    if (!callTarget) return;
    setCallLoading(true);
    try {
      await api.patch(`/api/deliveries/${callTarget.id}/call`, { slotId });
      invalidateAll();
    } finally {
      setCallLoading(false);
      setCallTarget(null);
      setCallPreDock(undefined);
    }
  }

  async function doAction(id: string, action: string) {
    setActionLoading(id + action);
    try {
      await api.patch(`/api/deliveries/${id}/${action}`);
      invalidateAll();
    } finally {
      setActionLoading(null);
    }
  }

  function openCallModal(d: DeliveryRegistration, preSlotId?: string) {
    setCallTarget(d);
    setCallPreDock(preSlotId);
  }

  function openCallBySuggestion(deliveryId: string, slotId?: string) {
    if (!dispatch) return;
    for (const ud of Object.values(dispatch) as UnitDispatch[]) {
      const d = ud.active.find((a) => a.id === deliveryId);
      if (d) { openCallModal(d, slotId); return; }
    }
  }

  const allSlots = dispatch
    ? (Object.values(dispatch) as UnitDispatch[]).flatMap((ud) => ud.slots ?? [])
    : [];

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'ALL',        label: 'Tất cả',          icon: '📊' },
    { key: 'EMART',      label: 'Emart',            icon: '🏬' },
    { key: 'THISKYHALL', label: 'Thiskyhall',       icon: '🏢' },
    { key: 'TENANT',     label: 'Mall (Khách thuê)',icon: '🏪' },
  ];

  const totalWaiting = dispatch
    ? (['EMART', 'THISKYHALL', 'TENANT'] as UnitKey[]).reduce(
        (s, u) => s + ((dispatch[u] as UnitDispatch | undefined)?.insights.stats.waiting ?? 0), 0,
      )
    : 0;

  return (
    <div className="max-w-screen-xl mx-auto py-5 px-4">
      {callTarget && (
        <CallModal
          delivery={callTarget}
          slots={allSlots}
          preselectedSlotId={callPreDock}
          onClose={() => { setCallTarget(null); setCallPreDock(undefined); }}
          onCall={doCall}
          loading={callLoading}
        />
      )}
      {viewId && (
        <DeliveryDetailModal
          id={viewId}
          onClose={() => setViewId(null)}
          onCall={(d) => { setViewId(null); openCallModal(d); }}
          onAction={(id, action) => { setViewId(null); doAction(id, action); }}
          slots={allSlots}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="page-title">📦 Điều phối Nhận hàng</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-thiso-400">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse inline-block" />
            Realtime · cập nhật 15s
          </div>
        </div>
      </div>

      {/* Urgent alerts */}
      <div className="space-y-2 mb-4">
        {(summary?.urgentFreshFood ?? 0) > 0 && (
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse">
            <span className="text-xl shrink-0">🚨</span>
            <span className="font-bold">{summary!.urgentFreshFood} xe hàng TƯƠI SỐNG chờ hơn 25 phút – gọi ngay!</span>
          </div>
        )}
        {(summary?.noShowRisk ?? 0) > 0 && (
          <div className="bg-orange-500 text-white px-4 py-3 rounded-xl flex items-center gap-3">
            <span className="text-xl shrink-0">⚠️</span>
            <span className="font-bold">{summary!.noShowRisk} xe gọi hơn 15 phút chưa vào vị trí – gọi lại hoặc hủy.</span>
          </div>
        )}
        {(summary?.expiredToday ?? 0) > 0 && (
          <ExpiredBanner count={summary!.expiredToday} onDone={invalidateAll} />
        )}
      </div>

      {/* KPI summary bar */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-5">
        {[
          { l: 'Đã đặt',      v: summary?.registeredToday,                                              dim: true  },
          { l: 'Chờ gọi',     v: summary?.waiting,                                                      dim: false },
          { l: 'FF chờ',      v: summary?.freshFoodWaiting,                                             dim: false },
          { l: 'Đang nhận',   v: summary?.receiving,                                                    dim: false },
          { l: 'Slot trống',  v: summary?.slotsAvailable  ?? summary?.docksAvailable,                  dim: false },
          { l: 'Slot dùng',   v: summary?.slotsOccupied   ?? summary?.docksOccupied,                   dim: false },
          { l: 'Tổng hôm nay',v: summary?.totalToday,                                                  dim: true  },
          { l: 'Hoàn tất',    v: summary?.completedToday,                                               dim: true  },
          { l: 'Đã hủy',      v: summary?.cancelledToday,                                               dim: true  },
          { l: '🕓 Hết hạn',  v: summary?.expiredToday,                                                 expired: true },
        ].map((c) => (
          <div
            key={c.l}
            className={`rounded-xl border p-2 text-center
              ${'alert' in c && c.alert && (c.v ?? 0) > 0
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'expired' in c && c.expired && (c.v ?? 0) > 0
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'dim' in c && c.dim
                    ? 'bg-thiso-50 border-thiso-100 text-thiso-400'
                    : 'bg-white border-thiso-100 text-thiso-700 shadow-sm'}`}
          >
            <div className="text-xl font-black leading-none">{c.v ?? '–'}</div>
            <div className="text-xs mt-1 font-medium leading-tight">{c.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-thiso-200 overflow-x-auto">
        {TABS.map((tab) => {
          const waiting = tab.key === 'ALL'
            ? totalWaiting
            : (dispatch?.[tab.key] as UnitDispatch | undefined)?.insights.stats.waiting ?? 0;
          const meta = tab.key !== 'ALL' ? UNIT_META[tab.key as UnitKey] : null;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all -mb-px border border-b-0 whitespace-nowrap
                ${isActive
                  ? (meta ? `${meta.tabActive} border-gray-200` : 'border-gray-200 bg-white text-gray-700')
                  : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {tab.icon} {tab.label}
              {waiting > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${meta ? meta.badge : 'bg-gray-200 text-gray-700'}`}>
                  {waiting}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="py-20 text-center text-thiso-400">
          <div className="text-4xl mb-3">⏳</div>
          Đang tải dữ liệu điều phối...
        </div>
      )}

      {!isLoading && activeTab === 'ALL' && dispatch && (
        <AllTabView
          dispatch={dispatch}
          onCall={openCallModal}
          onAction={doAction}
          onView={setViewId}
          actionLoading={actionLoading}
          onDispatch={invalidateAll}
        />
      )}

      {!isLoading && activeTab !== 'ALL' && dispatch && (() => {
        const unit = activeTab as UnitKey;
        const ud = dispatch[unit] as UnitDispatch | undefined;
        if (!ud) return <div className="py-8 text-center text-gray-400">Không có dữ liệu</div>;
        return (
          <div>
            <UnitHeader unit={unit} ud={ud} onDispatch={invalidateAll} />
            <AICard ud={ud} onAction={openCallBySuggestion} />
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-black text-thiso-500 uppercase tracking-wider flex items-center gap-2">
                Đang điều phối
                {ud.active.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${UNIT_META[unit].badge}`}>
                    {ud.active.length}
                  </span>
                )}
              </h3>
            </div>
            <QueueTable
              deliveries={ud.active}
              unit={unit}
              onCall={openCallModal}
              onAction={doAction}
              onView={setViewId}
              actionLoading={actionLoading}
            />
            <UpcomingSection deliveries={ud.upcoming} unit={unit} />
          </div>
        );
      })()}

      <div className="mt-6 pt-4 border-t border-thiso-100 flex flex-wrap gap-4 text-xs text-thiso-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded bg-red-500 inline-block" /> FF &gt;30 phút (khẩn)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded bg-yellow-400 inline-block" /> FF &gt;20 phút / No-show &gt;15 phút</span>
        <span>🎫 Số thẻ: EMART=🏬 · THISKY=🏢 · MALL=🏪 &nbsp;|&nbsp; T=Xe Tải · M=Xe Máy</span>
      </div>
    </div>
  );
}
