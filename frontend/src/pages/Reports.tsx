import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { downloadCsv } from '../lib/export';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'history' | 'breakdown' | 'slots' | 'ai';

interface Overview {
  total: number; completed: number; cancelled: number;
  completionRate: number; cancellationRate: number;
  avgWaitMinutes: number; avgReceivingMinutes: number;
  byStatus: Record<string, number>; checkinOnTime: number;
}
interface BreakdownItem { key: string; count: number }
interface Breakdown { byGoods: BreakdownItem[]; byVehicle: BreakdownItem[]; byUnit: BreakdownItem[] }
interface DayTrend { day: string; total: number; completed: number }
interface HeatCell { hour: number; dow: number; count: number }
interface DeliveryItem {
  id: string; registrationCode: string; vendorName: string; driverName: string;
  vehiclePlate: string; receivingUnit: string; goodsType: string; vehicleType: string;
  status: string; checkinTime: string | null; calledTime: string | null;
  receivingStartTime: string | null; completedTime: string | null;
  createdAt: string; ticketNumber: number | null; closeReason: string | null;
  callCount: number; archivedAt: string;
  assignedSlot: { code: string; name: string } | null;
}
interface HistoryPage { items: DeliveryItem[]; total: number; pages: number; page: number; limit: number }
interface DeliveryHistoryEvent {
  id: string; eventType: string; occurredAt: string;
  actorLabel: string | null; slotCode: string | null; slotName: string | null;
  message: string | null; reason: string | null;
}
interface SlotPerf {
  slotId: string; slotCode: string; slotName: string;
  vehicleType: string; assignedUnit: string;
  totalDeliveries: number; completedDeliveries: number; completionRate: number;
  avgReceivingMinutes: number | null; maxReceivingMinutes: number | null;
  minReceivingMinutes: number | null; totalOccupiedMinutes: number;
  utilizationPct: number;
}
interface AiRec {
  unit: string; vehicleType: string; currentSlots: number; avgUtilization: number;
  suggestion: 'ADD_SLOT' | 'REDUCE_SLOT' | 'CONVERT_TO_MOTORBIKE' | 'CONVERT_TO_TRUCK' | 'OPTIMAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string; action: string; backlogNow: number; peakHour: number | null;
}
interface AiReport { recommendations: AiRec[]; healthScore: number; avgUtilization: number; periodDays: number; analyzedAt: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Hàng tươi sống', AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng thông thường', THI_CONG: 'Thi công',
};
const VEHICLE_LABEL: Record<string, string> = { TRUCK: '🚛 Xe tải', MOTORBIKE: '🛵 Xe máy', OTHER: '🚗 Khác' };
const UNIT_LABEL: Record<string, string> = { EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)' };
const STATUS_LABEL: Record<string, string> = {
  REGISTERED: 'Đã đăng ký', WAITING: 'Đang chờ', CALLED: 'Đã gọi',
  RECEIVING: 'Đang nhận', AUTO_WAREHOUSE_RECEIVING: 'Kho tự động',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', INCOMPLETED: 'Chưa hoàn tất',
};
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600',
  WAITING: 'bg-amber-100 text-amber-700', CALLED: 'bg-sky-100 text-sky-700',
  RECEIVING: 'bg-indigo-100 text-indigo-700', AUTO_WAREHOUSE_RECEIVING: 'bg-purple-100 text-purple-700',
  REGISTERED: 'bg-thiso-100 text-thiso-600', EXPIRED: 'bg-purple-100 text-purple-600',
  INCOMPLETED: 'bg-orange-100 text-orange-700',
};
const DOW_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const EVENT_LABEL: Record<string, { label: string; icon: string; accent?: string }> = {
  REGISTERED: { label: 'Đăng ký giao hàng', icon: '📝' },
  CHECKED_IN: { label: 'Check-in tại cổng', icon: '🔐' },
  AUTO_ASSIGNED: { label: 'Tự động gọi vào vị trí', icon: '🤖', accent: 'text-sky-700' },
  MANUAL_CALLED: { label: 'Gọi vào vị trí', icon: '📣', accent: 'text-sky-700' },
  RECALLED: { label: 'Gọi lại', icon: '🔁', accent: 'text-sky-700' },
  REASSIGNED_SLOT: { label: 'Đổi vị trí nhận hàng', icon: '🔀', accent: 'text-sky-700' },
  RECEIVING_STARTED: { label: 'Bắt đầu nhận hàng', icon: '📦', accent: 'text-green-700' },
  AUTO_WAREHOUSE_RECEIVING_STARTED: { label: 'Bắt đầu nhận kho tự động', icon: '🏭', accent: 'text-green-700' },
  COMPLETED: { label: 'Hoàn tất nhận hàng', icon: '✅', accent: 'text-green-700' },
  CANCELLED: { label: 'Đã hủy', icon: '❌', accent: 'text-red-600' },
  EXPIRED_NO_SHOW: { label: 'Hết hạn: không tới check-in', icon: '⌛', accent: 'text-red-600' },
  EXPIRED_WAITING: { label: 'Hết hạn: không nhận hàng', icon: '⌛', accent: 'text-red-600' },
  INCOMPLETED: { label: 'Chưa hoàn tất cuối ngày', icon: '⚠️', accent: 'text-orange-600' },
  ARCHIVED: { label: 'Đã lưu lịch sử', icon: '🗄️', accent: 'text-thiso-500' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = '') {
  if (n == null) return '—';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + suffix;
}
function fmtDt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
function defaultFrom() { return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10) }
function defaultTo() { return new Date().toISOString().slice(0, 10) }

// ─── Mini components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'text-thiso-800' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-thiso-100 px-5 py-4 shadow-sm">
      <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-3xl font-black leading-none ${color}`}>{value}</div>
      {sub && <div className="text-xs text-thiso-400 mt-1.5">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color = 'bg-sky-500' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-36 text-sm text-thiso-700 truncate shrink-0">{label}</div>
      <div className="flex-1 bg-thiso-100 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-sm font-bold text-thiso-700 w-10 text-right shrink-0">{value}</div>
    </div>
  );
}

function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'bg-red-500' : pct >= 65 ? 'bg-amber-500' : pct >= 30 ? 'bg-green-500' : 'bg-thiso-300';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-thiso-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${pct >= 85 ? 'text-red-600' : pct >= 65 ? 'text-amber-600' : 'text-thiso-600'}`}>{pct}%</span>
    </div>
  );
}

function DateFilter({ from, to, unit, onFrom, onTo, onUnit }: {
  from: string; to: string; unit: string;
  onFrom: (v: string) => void; onTo: (v: string) => void; onUnit: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
        <span className="text-xs text-thiso-400">Từ</span>
        <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
          className="text-sm text-thiso-700 bg-transparent outline-none" />
      </div>
      <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
        <span className="text-xs text-thiso-400">Đến</span>
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
          className="text-sm text-thiso-700 bg-transparent outline-none" />
      </div>
      <select value={unit} onChange={(e) => onUnit(e.target.value)}
        className="bg-white border border-thiso-200 rounded-xl px-3 py-1.5 text-sm text-thiso-700 outline-none">
        <option value="">Tất cả đơn vị</option>
        <option value="EMART">Emart</option>
        <option value="THISKYHALL">Thiskyhall</option>
        <option value="TENANT">Mall (Khách thuê)</option>
      </select>
      {[7, 30, 90].map((d) => (
        <button key={d} onClick={() => {
          onFrom(new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10));
          onTo(defaultTo());
        }} className="px-3 py-1.5 text-xs bg-white border border-thiso-200 rounded-xl text-thiso-600 hover:bg-thiso-50 transition-colors">
          {d} ngày
        </button>
      ))}
    </div>
  );
}

function ExportBtn({ onClick, label = 'Xuất Excel' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm"
    >
      <span>⬇</span>{label}
    </button>
  );
}

function historyEventText(ev: DeliveryHistoryEvent): string {
  const base = EVENT_LABEL[ev.eventType]?.label ?? ev.eventType;
  const slot = ev.slotCode ? ` → ${ev.slotCode}` : '';
  const actor = ev.actorLabel ? ` (${ev.actorLabel})` : '';
  const reason = ev.reason ? `: ${ev.reason}` : '';
  return `${base}${slot}${actor}${reason}`;
}

function HistoryTimelineModal({ item, onClose }: { item: DeliveryItem; onClose: () => void }) {
  const { data: events = [], isLoading } = useQuery<DeliveryHistoryEvent[]>({
    queryKey: ['reports-history-events', item.id],
    queryFn: async () => (await api.get(`/api/reports/deliveries/${item.id}/events`)).data,
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-thiso-100 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-sky-700 font-black">{item.registrationCode}</div>
            <h3 className="text-xl font-black text-thiso-900">{item.vehiclePlate}</h3>
            <p className="text-sm text-thiso-500">{item.vendorName} · {item.driverName}</p>
          </div>
          <button className="text-2xl text-thiso-300 hover:text-thiso-600 leading-none" onClick={onClose}>×</button>
        </div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div><span className="text-thiso-400">Trạng thái: </span><strong>{STATUS_LABEL[item.status] ?? item.status}</strong></div>
            <div><span className="text-thiso-400">Số lần gọi: </span><strong>{item.callCount}</strong></div>
            <div><span className="text-thiso-400">Slot: </span><strong>{item.assignedSlot?.code ?? '—'}</strong></div>
            <div><span className="text-thiso-400">Lưu lúc: </span><strong>{fmtDt(item.archivedAt)}</strong></div>
            {item.closeReason && <div className="col-span-2"><span className="text-thiso-400">Lý do: </span><strong>{item.closeReason}</strong></div>}
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-thiso-400">Đang tải timeline...</div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-thiso-400">Chưa có timeline</div>
          ) : (
            <ol className="relative border-l-2 border-thiso-100 space-y-4 ml-3">
              {events.map((ev) => {
                const meta = EVENT_LABEL[ev.eventType] ?? { icon: '•' };
                return (
                  <li key={ev.id} className="relative pl-5">
                    <span className="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-white border-2 border-thiso-200 flex items-center justify-center text-[11px]">{meta.icon}</span>
                    <div className={`text-sm font-medium ${meta.accent ?? 'text-thiso-700'}`}>{historyEventText(ev)}</div>
                    {ev.message && <div className="text-xs text-thiso-500 mt-0.5">{ev.message}</div>}
                    <div className="text-xs text-thiso-400 mt-0.5">{fmtDt(ev.occurredAt)}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ from, to, unit }: { from: string; to: string; unit: string }) {
  const { data: ov, isLoading: ovLoading } = useQuery<Overview>({
    queryKey: ['reports-overview', from, to, unit],
    queryFn: async () => (await api.get('/api/reports/overview', { params: { from, to, unit: unit || undefined } })).data,
  });
  const { data: trend = [] } = useQuery<DayTrend[]>({
    queryKey: ['reports-trend', from, to, unit],
    queryFn: async () => (await api.get('/api/reports/daily-trend', { params: { from, to, unit: unit || undefined } })).data,
  });
  const { data: heat = [] } = useQuery<HeatCell[]>({
    queryKey: ['reports-heat', from, to, unit],
    queryFn: async () => (await api.get('/api/reports/hourly-heatmap', { params: { from, to, unit: unit || undefined } })).data,
  });

  const maxTrend = useMemo(() => Math.max(1, ...trend.map((t) => t.total)), [trend]);
  const maxHeat = useMemo(() => Math.max(1, ...heat.map((h) => h.count)), [heat]);

  if (ovLoading) return <div className="py-20 text-center text-thiso-400">Đang tải...</div>;
  if (!ov) return null;

  function exportOverview() {
    if (!ov) return;
    downloadCsv('bao-cao-tong-quan', ['Chỉ số', 'Giá trị'], [
      ['Tổng lượt giao hàng', ov.total],
      ['Hoàn tất', ov.completed],
      ['Đã hủy', ov.cancelled],
      ['Tỷ lệ hoàn tất (%)', ov.completionRate],
      ['Tỷ lệ hủy (%)', ov.cancellationRate],
      ['TB chờ được gọi (phút)', ov.avgWaitMinutes],
      ['TB thời gian nhận (phút)', ov.avgReceivingMinutes],
      ...Object.entries(ov.byStatus).map(([k, v]) => [`Trạng thái: ${k}`, v]),
    ]);
  }
  function exportTrend() {
    downloadCsv('xu-huong-theo-ngay', ['Ngày', 'Tổng', 'Hoàn tất'],
      trend.map((t) => [t.day, t.total, t.completed]));
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="flex justify-end gap-2 mb-1">
        <ExportBtn onClick={exportOverview} label="Xuất KPI" />
        <ExportBtn onClick={exportTrend} label="Xuất xu hướng" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Tổng lượt giao hàng" value={ov.total.toLocaleString()} />
        <KpiCard label="Hoàn tất" value={`${ov.completionRate}%`} sub={`${ov.completed} lượt`} color="text-green-600" />
        <KpiCard label="TB chờ được gọi" value={fmt(ov.avgWaitMinutes, ' phút')} sub="từ check-in → gọi" />
        <KpiCard label="TB thời gian nhận" value={fmt(ov.avgReceivingMinutes, ' phút')} sub="từ bắt đầu → hoàn tất" />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Phân bổ theo trạng thái</h3>
          {Object.entries(ov.byStatus).sort((a, b) => b[1] - a[1]).map(([st, cnt]) => (
            <BarRow key={st} label={STATUS_LABEL[st] ?? st} value={cnt} max={ov.total} color="bg-sky-500" />
          ))}
        </div>

        {/* Daily trend chart */}
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Xu hướng theo ngày</h3>
          {trend.length === 0 && <div className="text-sm text-thiso-400 py-8 text-center">Không có dữ liệu</div>}
          <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
            {trend.map((t) => {
              const totalH = Math.max(1, Math.round((t.total / maxTrend) * 100));
              const compH = Math.round((t.completed / maxTrend) * 100);
              return (
                <div key={t.day} className="flex flex-col items-center gap-0.5 flex-1 min-w-[14px] group relative">
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-thiso-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {t.day}: {t.total} ({t.completed} HT)
                  </div>
                  <div className="w-full flex flex-col-reverse" style={{ height: `${totalH}%` }}>
                    <div className="w-full rounded-t-sm bg-sky-200" style={{ height: '100%' }}>
                      <div className="w-full rounded-t-sm bg-sky-500" style={{ height: `${totalH > 0 ? compH / totalH * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-thiso-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" /> Hoàn tất</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-200 inline-block" /> Tổng</span>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
        <h3 className="font-bold text-thiso-700 mb-1">Bản đồ nhiệt — giờ check-in</h3>
        <p className="text-xs text-thiso-400 mb-4">Màu đậm hơn = đông hơn. Dùng để xác định giờ cao điểm và bố trí nhân lực.</p>
        <div className="overflow-x-auto">
          <table className="text-[11px] border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="text-thiso-400 font-normal w-8 text-right pr-1" />
                {DOW_LABEL.map((d) => <th key={d} className="text-thiso-500 font-bold w-9 text-center">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, i) => i + 4).map((hour) => (
                <tr key={hour}>
                  <td className="text-thiso-400 text-right pr-1">{String(hour).padStart(2, '0')}h</td>
                  {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                    const cell = heat.find((h) => h.hour === hour && h.dow === dow);
                    const intensity = cell ? cell.count / maxHeat : 0;
                    const bg = intensity > 0.7 ? '#1E3A5C' : intensity > 0.4 ? '#2B5F9E' : intensity > 0.1 ? '#93C5FD' : intensity > 0 ? '#DBEAFE' : '#F8FAFC';
                    const fg = intensity > 0.4 ? 'white' : '#64748B';
                    return (
                      <td key={dow} className="rounded w-9 h-7 text-center font-bold" style={{ background: bg, color: fg }}>
                        {cell ? cell.count : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Breakdown Tab ────────────────────────────────────────────────────────────

function BreakdownTab({ from, to, unit }: { from: string; to: string; unit: string }) {
  const { data, isLoading } = useQuery<Breakdown>({
    queryKey: ['reports-breakdown', from, to, unit],
    queryFn: async () => (await api.get('/api/reports/breakdown', { params: { from, to, unit: unit || undefined } })).data,
  });

  if (isLoading) return <div className="py-20 text-center text-thiso-400">Đang tải...</div>;
  if (!data) return null;

  const maxGoods = Math.max(1, ...data.byGoods.map((r) => r.count));
  const maxVeh = Math.max(1, ...data.byVehicle.map((r) => r.count));
  const maxUnit = Math.max(1, ...data.byUnit.map((r) => r.count));
  const colors = ['bg-sky-500', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500', 'bg-emerald-500'];

  function exportBreakdown() {
    downloadCsv('phan-tich-giao-hang', ['Nhóm', 'Loại', 'Số lượt'], [
      ...data!.byGoods.map((r)   => ['Loại hàng',   GOODS_LABEL[r.key]   ?? r.key, r.count]),
      ...data!.byVehicle.map((r) => ['Loại xe',      VEHICLE_LABEL[r.key] ?? r.key, r.count]),
      ...data!.byUnit.map((r)    => ['Đơn vị',       UNIT_LABEL[r.key]    ?? r.key, r.count]),
    ]);
  }

  return (
    <div>
    <div className="flex justify-end mb-3"><ExportBtn onClick={exportBreakdown} /></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
        <h3 className="font-bold text-thiso-700 mb-4">Theo loại hàng hóa</h3>
        {data.byGoods.map((r, i) => (
          <BarRow key={r.key} label={GOODS_LABEL[r.key] ?? r.key} value={r.count} max={maxGoods} color={colors[i % colors.length]} />
        ))}
        {data.byGoods.length === 0 && <p className="text-sm text-thiso-400">Không có dữ liệu</p>}
      </div>
      <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
        <h3 className="font-bold text-thiso-700 mb-4">Theo loại phương tiện</h3>
        {data.byVehicle.map((r, i) => (
          <BarRow key={r.key} label={VEHICLE_LABEL[r.key] ?? r.key} value={r.count} max={maxVeh} color={colors[i % colors.length]} />
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
        <h3 className="font-bold text-thiso-700 mb-4">Theo đơn vị nhận hàng</h3>
        {data.byUnit.map((r, i) => (
          <BarRow key={r.key} label={UNIT_LABEL[r.key] ?? r.key} value={r.count} max={maxUnit} color={colors[i % colors.length]} />
        ))}
      </div>
    </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ from, to, unit }: { from: string; to: string; unit: string }) {
  const [page, setPage] = useState(1);
  const [goodsFilter, setGoodsFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<DeliveryItem | null>(null);

  const commonParams = {
    from, to,
    unit: unit || undefined,
    goodsType: goodsFilter || undefined,
    vehicleType: vehicleFilter || undefined,
    status: statusFilter || undefined,
    search: searchQuery.trim() || undefined,
  };

  const { data, isLoading } = useQuery<HistoryPage>({
    queryKey: ['reports-history', from, to, unit, goodsFilter, vehicleFilter, statusFilter, searchQuery, page],
    queryFn: async () => (await api.get('/api/reports/deliveries', {
      params: { ...commonParams, page, limit: 50 },
    })).data,
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Free-text search */}
        <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5 min-w-[220px]">
          <span className="text-thiso-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Tìm nhà CC, tài xế, biển số, mã ĐK..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="flex-1 text-sm text-thiso-700 bg-transparent outline-none placeholder:text-thiso-300"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setPage(1); }} className="text-thiso-300 hover:text-thiso-500 text-xs">✕</button>
          )}
        </div>
        <select className="input text-sm py-1.5 min-w-[160px]" value={goodsFilter} onChange={(e) => { setGoodsFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả loại hàng</option>
          {Object.entries(GOODS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input text-sm py-1.5 min-w-[140px]" value={vehicleFilter} onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả xe</option>
          {Object.entries(VEHICLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input text-sm py-1.5 min-w-[140px]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{k === 'EXPIRED' ? '🕓 ' : ''}{v}</option>)}
        </select>
        {data && <span className="text-xs text-thiso-400 self-center">Tổng: {data.total.toLocaleString()} lượt</span>}
        <ExportBtn onClick={async () => {
          const all = await api.get('/api/reports/deliveries', {
            params: { ...commonParams, limit: 9999 },
          });
          const rows = all.data.items as DeliveryItem[];
          downloadCsv('lich-su-giao-hang',
            ['Mã ĐK', 'Nhà cung cấp', 'Tài xế', 'Biển số', 'Đơn vị', 'Loại hàng', 'Loại xe', 'Slot', 'Trạng thái', 'Số lần gọi', 'Lý do', 'Check-in', 'Hoàn tất', 'Ngày tạo'],
            rows.map((d) => [d.registrationCode, d.vendorName, d.driverName, d.vehiclePlate,
              UNIT_LABEL[d.receivingUnit] ?? d.receivingUnit, GOODS_LABEL[d.goodsType] ?? d.goodsType,
              VEHICLE_LABEL[d.vehicleType] ?? d.vehicleType, d.assignedSlot?.code ?? '',
              STATUS_LABEL[d.status] ?? d.status, d.callCount, d.closeReason ?? '',
              d.checkinTime ? new Date(d.checkinTime).toLocaleString('vi-VN') : '',
              d.completedTime ? new Date(d.completedTime).toLocaleString('vi-VN') : '',
              new Date(d.createdAt).toLocaleString('vi-VN')]),
          );
        }} label="Xuất tất cả" />
      </div>
      {selectedHistory && <HistoryTimelineModal item={selectedHistory} onClose={() => setSelectedHistory(null)} />}

      <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                <th className="px-4 py-3">Mã ĐK</th>
                <th className="px-4 py-3">Nhà CC · Tài xế</th>
                <th className="px-4 py-3">Biển số</th>
                <th className="px-4 py-3">Đơn vị</th>
                <th className="px-4 py-3">Loại hàng</th>
                <th className="px-4 py-3">Xe</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Gọi</th>
                <th className="px-4 py-3">Hoàn tất</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={11} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>}
              {!isLoading && (!data || data.items.length === 0) && (
                <tr><td colSpan={11} className="py-12 text-center text-thiso-400">Không có dữ liệu trong khoảng thời gian này</td></tr>
              )}
              {data?.items.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-thiso-50 last:border-0 hover:bg-thiso-50/40 transition-colors cursor-pointer"
                  onDoubleClick={() => setSelectedHistory(d)}
                  title="Double-click để xem timeline"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-thiso-600">{d.registrationCode}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-thiso-800 text-xs">{d.vendorName}</div>
                    <div className="text-[11px] text-thiso-400">{d.driverName}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-thiso-700">{d.vehiclePlate}</td>
                  <td className="px-4 py-2.5 text-xs text-thiso-600">{UNIT_LABEL[d.receivingUnit] ?? d.receivingUnit}</td>
                  <td className="px-4 py-2.5 text-xs text-thiso-600">{GOODS_LABEL[d.goodsType] ?? d.goodsType}</td>
                  <td className="px-4 py-2.5 text-xs text-thiso-600">{VEHICLE_LABEL[d.vehicleType] ?? d.vehicleType}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-thiso-500">{d.assignedSlot?.code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-thiso-500">{fmtDt(d.checkinTime)}</td>
                  <td className="px-4 py-2.5 text-xs text-thiso-500">{d.callCount}</td>
                  <td className="px-4 py-2.5 text-xs text-thiso-500">{fmtDt(d.completedTime)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[d.status] ?? 'bg-thiso-100 text-thiso-600'}`}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-thiso-100 bg-thiso-50">
            <span className="text-xs text-thiso-400">Trang {data.page} / {data.pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1 text-xs border border-thiso-200 rounded-lg bg-white hover:bg-thiso-50 disabled:opacity-40">← Trước</button>
              <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}
                className="px-3 py-1 text-xs border border-thiso-200 rounded-lg bg-white hover:bg-thiso-50 disabled:opacity-40">Tiếp →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Slot Performance Tab ─────────────────────────────────────────────────────

function SlotTab({ from, to, unit }: { from: string; to: string; unit: string }) {
  const { data = [], isLoading } = useQuery<SlotPerf[]>({
    queryKey: ['reports-slots', from, to, unit],
    queryFn: async () => (await api.get('/api/reports/slot-performance', { params: { from, to, unit: unit || undefined } })).data,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SlotPerf[]>();
    for (const s of data) {
      const g = map.get(s.assignedUnit) ?? [];
      g.push(s);
      map.set(s.assignedUnit, g);
    }
    return map;
  }, [data]);

  if (isLoading) return <div className="py-20 text-center text-thiso-400">Đang tải...</div>;

  function exportSlots() {
    downloadCsv('hieu-suat-slot',
      ['Slot', 'Tên slot', 'Đơn vị', 'Loại xe', 'Tổng lượt', 'Hoàn tất', 'Tỷ lệ HT (%)', 'TB nhận (phút)', 'Min (phút)', 'Max (phút)', 'Utilization (%)'],
      data.map((s) => [s.slotCode, s.slotName, UNIT_LABEL[s.assignedUnit] ?? s.assignedUnit,
        VEHICLE_LABEL[s.vehicleType] ?? s.vehicleType, s.totalDeliveries, s.completedDeliveries,
        s.completionRate, s.avgReceivingMinutes ?? '', s.minReceivingMinutes ?? '', s.maxReceivingMinutes ?? '',
        s.utilizationPct]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><ExportBtn onClick={exportSlots} /></div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>Hướng dẫn đọc báo cáo:</strong> Utilization = tổng phút thực tế nhận hàng ÷ (số ngày × 15h/ngày).
        Vùng xanh (30–65%): tối ưu. Đỏ (≥85%): cần thêm slot. Xám (&lt;25%): xem xét thu hẹp.
      </div>

      {[...grouped.entries()].map(([unitKey, slots]) => (
        <div key={unitKey}>
          <h3 className="font-bold text-thiso-700 mb-3">{UNIT_LABEL[unitKey] ?? unitKey}</h3>
          <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Loại xe</th>
                    <th className="px-4 py-3 text-right">Tổng lượt</th>
                    <th className="px-4 py-3 text-right">Hoàn tất</th>
                    <th className="px-4 py-3 text-right">TB nhận (phút)</th>
                    <th className="px-4 py-3 text-right">Min / Max</th>
                    <th className="px-4 py-3 min-w-[160px]">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s.slotId} className="border-b border-thiso-50 last:border-0 hover:bg-thiso-50/40">
                      <td className="px-4 py-3">
                        <div className="font-bold font-mono text-thiso-800">{s.slotCode}</div>
                        <div className="text-[11px] text-thiso-400">{s.slotName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-thiso-600">{VEHICLE_LABEL[s.vehicleType] ?? s.vehicleType}</td>
                      <td className="px-4 py-3 text-right font-bold text-thiso-800">{s.totalDeliveries}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-bold text-green-600">{s.completedDeliveries}</span>
                        <span className="text-xs text-thiso-400 ml-1">({s.completionRate}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right text-thiso-700">{fmt(s.avgReceivingMinutes)}</td>
                      <td className="px-4 py-3 text-right text-xs text-thiso-500">{fmt(s.minReceivingMinutes)} / {fmt(s.maxReceivingMinutes)}</td>
                      <td className="px-4 py-3"><UtilBar pct={s.utilizationPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="py-16 text-center text-thiso-400">Chưa có dữ liệu slot</div>}
    </div>
  );
}

// ─── AI Recommendations Tab ───────────────────────────────────────────────────

const SUGGEST_META: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  ADD_SLOT:            { label: 'Thêm slot',      icon: '➕', bg: 'bg-red-50',    text: 'text-red-700' },
  REDUCE_SLOT:         { label: 'Giảm slot',      icon: '➖', bg: 'bg-amber-50',  text: 'text-amber-700' },
  CONVERT_TO_MOTORBIKE:{ label: 'Chuyển xe máy', icon: '🔄', bg: 'bg-purple-50', text: 'text-purple-700' },
  CONVERT_TO_TRUCK:    { label: 'Chuyển xe tải', icon: '🔄', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  OPTIMAL:             { label: 'Tối ưu',          icon: '✅', bg: 'bg-green-50',  text: 'text-green-700' },
};
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  HIGH:   { label: 'Ưu tiên cao', color: 'bg-red-100 text-red-700' },
  MEDIUM: { label: 'Trung bình',  color: 'bg-amber-100 text-amber-700' },
  LOW:    { label: 'Thấp',        color: 'bg-thiso-100 text-thiso-500' },
};

function AiTab({ from, to, unit }: { from: string; to: string; unit: string }) {
  const { data, isLoading } = useQuery<AiReport>({
    queryKey: ['reports-ai', from, to, unit],
    queryFn: async () => (await api.get('/api/reports/ai-slot-recommendations', { params: { from, to, unit: unit || undefined } })).data,
  });

  if (isLoading) return (
    <div className="py-20 text-center">
      <div className="text-3xl mb-3">🤖</div>
      <div className="text-thiso-400">Đang phân tích dữ liệu...</div>
    </div>
  );
  if (!data) return null;

  const scoreColor = data.healthScore >= 75 ? 'text-green-600' : data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const highs = data.recommendations.filter((r) => r.priority === 'HIGH');
  const meds = data.recommendations.filter((r) => r.priority === 'MEDIUM');
  const lows = data.recommendations.filter((r) => r.priority === 'LOW');

  function exportAi() {
    const SUGGEST_LABEL: Record<string, string> = { ADD_SLOT: 'Thêm slot', REDUCE_SLOT: 'Giảm slot', OPTIMAL: 'Tối ưu' };
    const PRIORITY_LABEL: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
    downloadCsv('ai-de-xuat-slot',
      ['Đơn vị', 'Loại xe', 'Số slot', 'Utilization (%)', 'Đề xuất', 'Ưu tiên', 'Tồn đọng', 'Lý do', 'Hành động'],
      data!.recommendations.map((r) => [
        UNIT_LABEL[r.unit] ?? r.unit, VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType,
        r.currentSlots, r.avgUtilization, SUGGEST_LABEL[r.suggestion] ?? r.suggestion,
        PRIORITY_LABEL[r.priority] ?? r.priority, r.backlogNow, r.reason, r.action,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><ExportBtn onClick={exportAi} label="Xuất đề xuất AI" /></div>
      {/* Health summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm text-center">
          <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-2">Điểm sức khỏe vận hành</div>
          <div className={`text-5xl font-black ${scoreColor}`}>{data.healthScore}</div>
          <div className="text-xs text-thiso-400 mt-1">/100</div>
          <div className="mt-3 text-sm text-thiso-600">
            {data.healthScore >= 75 ? '✅ Vận hành hiệu quả' : data.healthScore >= 50 ? '⚠️ Cần cải thiện' : '🚨 Cần hành động ngay'}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm text-center">
          <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-2">TB Utilization toàn hệ thống</div>
          <div className={`text-5xl font-black ${data.avgUtilization >= 85 ? 'text-red-600' : data.avgUtilization >= 30 ? 'text-green-600' : 'text-amber-600'}`}>{data.avgUtilization}%</div>
          <div className="text-xs text-thiso-400 mt-1">mức sử dụng trung bình</div>
          <div className="mt-3 text-sm text-thiso-600">Phân tích {data.periodDays} ngày gần nhất</div>
        </div>
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-3">Tóm tắt đề xuất</div>
          <div className="space-y-2">
            {highs.length > 0 && <div className="flex items-center justify-between text-sm"><span className="text-red-600 font-bold">🚨 Ưu tiên cao</span><span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full text-xs">{highs.length}</span></div>}
            {meds.length > 0 && <div className="flex items-center justify-between text-sm"><span className="text-amber-600 font-bold">⚠️ Trung bình</span><span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full text-xs">{meds.length}</span></div>}
            {lows.length > 0 && <div className="flex items-center justify-between text-sm"><span className="text-thiso-500">✅ Tối ưu</span><span className="bg-thiso-100 text-thiso-600 font-bold px-2 py-0.5 rounded-full text-xs">{lows.length}</span></div>}
          </div>
          <div className="mt-3 text-[11px] text-thiso-400">Cập nhật: {new Date(data.analyzedAt).toLocaleString('vi-VN')}</div>
        </div>
      </div>

      {/* Recommendation cards */}
      {data.recommendations.filter((r) => r.suggestion !== 'OPTIMAL').length > 0 && (
        <div>
          <h3 className="font-bold text-thiso-700 mb-3">🎯 Đề xuất hành động</h3>
          <div className="space-y-3">
            {data.recommendations.filter((r) => r.suggestion !== 'OPTIMAL').map((r, i) => {
              const sm = SUGGEST_META[r.suggestion];
              const pm = PRIORITY_META[r.priority];
              return (
                <div key={i} className={`rounded-2xl border p-5 ${r.priority === 'HIGH' ? 'border-red-200 bg-red-50' : r.priority === 'MEDIUM' ? 'border-amber-200 bg-amber-50' : 'border-thiso-100 bg-white'}`}>
                  <div className="flex flex-wrap items-start gap-3 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sm.bg} ${sm.text}`}>{sm.icon} {sm.label}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pm.color}`}>{pm.label}</span>
                    <span className="text-sm font-bold text-thiso-800">{UNIT_LABEL[r.unit] ?? r.unit} · {VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType}</span>
                    <span className="text-xs text-thiso-400 ml-auto">{r.currentSlots} slot hiện tại · {r.avgUtilization}% utilization</span>
                  </div>
                  <div className="text-sm text-thiso-700 mb-2">
                    <span className="font-semibold">Phân tích:</span> {r.reason}
                  </div>
                  <div className="text-sm text-thiso-800 bg-white/60 rounded-xl px-3 py-2">
                    <span className="font-semibold">💡 Đề xuất:</span> {r.action}
                  </div>
                  {(r.backlogNow > 0 || r.peakHour != null) && (
                    <div className="flex gap-4 mt-2 text-xs text-thiso-500">
                      {r.backlogNow > 0 && <span>⏳ Tồn đọng hiện tại: <strong>{r.backlogNow} xe</strong></span>}
                      {r.peakHour != null && <span>🕐 Giờ cao điểm: <strong>{r.peakHour}:00–{r.peakHour + 1}:00</strong></span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Optimal slots */}
      {data.recommendations.filter((r) => r.suggestion === 'OPTIMAL').length > 0 && (
        <div>
          <h3 className="font-bold text-thiso-700 mb-3">✅ Cấu hình slot đang tối ưu</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.recommendations.filter((r) => r.suggestion === 'OPTIMAL').map((r, i) => (
              <div key={i} className="bg-white border border-thiso-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-thiso-700 text-sm">{UNIT_LABEL[r.unit] ?? r.unit}</span>
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{r.avgUtilization}%</span>
                </div>
                <div className="text-xs text-thiso-500">{VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType} · {r.currentSlots} slot</div>
                <UtilBar pct={r.avgUtilization} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expansion advisory */}
      <div className="bg-gradient-to-br from-thiso-800 to-thiso-700 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🏗️</div>
          <div>
            <h3 className="font-black text-lg mb-2">Đề xuất mở rộng / Trung tâm mới</h3>
            <p className="text-thiso-300 text-sm leading-relaxed mb-3">
              Dựa trên dữ liệu {data.periodDays} ngày qua: utilization trung bình toàn hệ thống đạt{' '}
              <strong className="text-white">{data.avgUtilization}%</strong>.{' '}
              {data.avgUtilization >= 70
                ? 'Hệ thống đang hoạt động gần ngưỡng tối đa. Nếu xu hướng tăng trưởng duy trì, nên lên kế hoạch mở rộng khu vực nhận hàng hoặc nghiên cứu điểm phân phối thứ hai trong 6–12 tháng tới.'
                : data.avgUtilization >= 50
                  ? 'Hệ thống đang vận hành trong vùng ổn định. Có thể hấp thụ thêm 20–30% lưu lượng trước khi cần đầu tư mở rộng.'
                  : 'Công suất hiện tại còn nhiều dư địa. Tập trung tối ưu hóa quy trình vận hành trước khi cân nhắc mở rộng cơ sở hạ tầng.'}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Slots đang dùng', value: data.recommendations.reduce((s, r) => s + r.currentSlots, 0) },
                { label: 'Cần thêm slot', value: data.recommendations.filter((r) => r.suggestion === 'ADD_SLOT').length },
                { label: 'Điểm sức khỏe', value: `${data.healthScore}/100` },
              ].map((c) => (
                <div key={c.label} className="bg-white/10 rounded-xl p-3">
                  <div className="text-xl font-black">{c.value}</div>
                  <div className="text-[11px] text-thiso-300 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

export default function Reports() {
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [unit, setUnit] = useState('');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',   label: '📊 Tổng quan' },
    { id: 'breakdown',  label: '🗂 Phân tích' },
    { id: 'history',    label: '📋 Lịch sử' },
    { id: 'slots',      label: '🚪 Hiệu suất Slot' },
    { id: 'ai',         label: '🤖 AI Đề xuất' },
  ];

  return (
    <div className="min-h-screen bg-thiso-50/50 p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-thiso-800">Báo cáo & Phân tích</h1>
          <p className="text-sm text-thiso-500 mt-0.5">Dữ liệu thực tế · Dành cho ban lãnh đạo</p>
        </div>

        {/* Date / Unit filters — shared across tabs */}
        <DateFilter from={from} to={to} unit={unit} onFrom={setFrom} onTo={setTo} onUnit={setUnit} />

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white border border-thiso-100 rounded-2xl p-1.5 w-fit shadow-sm flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-thiso-800 text-white shadow-sm'
                  : 'text-thiso-500 hover:text-thiso-700 hover:bg-thiso-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview'  && <OverviewTab  from={from} to={to} unit={unit} />}
        {tab === 'breakdown' && <BreakdownTab from={from} to={to} unit={unit} />}
        {tab === 'history'   && <HistoryTab   from={from} to={to} unit={unit} />}
        {tab === 'slots'     && <SlotTab      from={from} to={to} unit={unit} />}
        {tab === 'ai'        && <AiTab        from={from} to={to} unit={unit} />}
      </div>
    </div>
  );
}
