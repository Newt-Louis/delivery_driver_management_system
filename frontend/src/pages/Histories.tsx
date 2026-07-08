import { useState, useEffect } from 'react';
import { useDeliveryHistory } from '../features/histories/hooks/useDeliveryHistory';
import { useAuditLogs } from '../features/histories/hooks/useAuditLogs';
import { DELIVERY_COLUMNS, AUDIT_COLUMNS, DELIVERY_STORAGE_KEY, AUDIT_STORAGE_KEY, GOODS_LABEL, VEHICLE_LABEL, UNIT_LABEL } from '../features/histories/constants';
import type { DeliveryHistoryItem, AuditLogItem, HistoryTab } from '../features/histories/types';
import ColumnToggle from '../features/histories/components/ColumnToggle';
import DeliveryTable from '../features/histories/components/DeliveryTable';
import AuditTable from '../features/histories/components/AuditTable';
import TimelineModal from '../features/histories/components/TimelineModal';
import AuditDetailModal from '../features/histories/components/AuditDetailModal';
import PlaceholderTab from '../features/histories/components/PlaceholderTab';

function defaultFrom() {
  return new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function loadColumns(key: string, defaults: string[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return defaults;
}

export default function Histories() {
  const [tab, setTab] = useState<HistoryTab>('delivery');

  // ─── Delivery tab ─────────────────────────────────────────────────────────
  const delivery = useDeliveryHistory();
  const [deliveryVisible, setDeliveryVisible] = useState(() =>
    loadColumns(DELIVERY_STORAGE_KEY, DELIVERY_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  );
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryHistoryItem | null>(null);

  useEffect(() => {
    try { localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(deliveryVisible)); } catch { /* ignore */ }
  }, [deliveryVisible]);

  // ─── Audit tab ────────────────────────────────────────────────────────────
  const audit = useAuditLogs();
  const [auditVisible, setAuditVisible] = useState(() =>
    loadColumns(AUDIT_STORAGE_KEY, AUDIT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  );
  const [selectedAudit, setSelectedAudit] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    try { localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditVisible)); } catch { /* ignore */ }
  }, [auditVisible]);

  const tabs: { id: HistoryTab; label: string }[] = [
    { id: 'access', label: '🔍 Truy cập' },
    { id: 'delivery', label: '📦 Giao/Nhận' },
    { id: 'audit', label: '📋 Audit' },
  ];

  return (
    <div className="min-h-screen bg-thiso-50/50 p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-thiso-800">Lịch sử</h1>
          <p className="text-sm text-thiso-500 mt-0.5">Truy cập, giao/nhận hàng và nhật ký thao tác</p>
        </div>

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

        {/* ─── Access Tab ──────────────────────────────────────────────── */}
        {tab === 'access' && <PlaceholderTab />}

        {/* ─── Delivery Tab ────────────────────────────────────────────── */}
        {tab === 'delivery' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5 min-w-[220px]">
                <span className="text-thiso-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Tìm mã chuyến, nhà CC, tài xế, biển số..."
                  value={delivery.search}
                  onChange={(e) => delivery.setSearch(e.target.value)}
                  className="flex-1 text-sm text-thiso-700 bg-transparent outline-none placeholder:text-thiso-300"
                />
                {delivery.search && (
                  <button onClick={() => delivery.setSearch('')} className="text-thiso-300 hover:text-thiso-500 text-xs">✕</button>
                )}
              </div>
              <select className="input text-sm py-1.5 min-w-[160px]" value={delivery.filters.finalStatus} onChange={(e) => delivery.setFilter('finalStatus', e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries({ COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', INCOMPLETED: 'Chưa hoàn tất' }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input text-sm py-1.5 min-w-[140px]" value={delivery.filters.receivingUnit} onChange={(e) => delivery.setFilter('receivingUnit', e.target.value)}>
                <option value="">Tất cả đơn vị</option>
                {Object.entries(UNIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input text-sm py-1.5 min-w-[140px]" value={delivery.filters.goodsType} onChange={(e) => delivery.setFilter('goodsType', e.target.value)}>
                <option value="">Tất cả loại hàng</option>
                {Object.entries(GOODS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="input text-sm py-1.5 min-w-[120px]" value={delivery.filters.vehicleType} onChange={(e) => delivery.setFilter('vehicleType', e.target.value)}>
                <option value="">Tất cả xe</option>
                {Object.entries(VEHICLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-thiso-400">Từ</span>
                <input type="date" value={delivery.filters.from} onChange={(e) => delivery.setFilter('from', e.target.value)}
                  className="text-sm text-thiso-700 bg-transparent outline-none" />
              </div>
              <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-thiso-400">Đến</span>
                <input type="date" value={delivery.filters.to} onChange={(e) => delivery.setFilter('to', e.target.value)}
                  className="text-sm text-thiso-700 bg-transparent outline-none" />
              </div>
              <ColumnToggle columns={DELIVERY_COLUMNS} visibleKeys={deliveryVisible} onChange={setDeliveryVisible} />
              {delivery.data && <span className="text-xs text-thiso-400 self-center">Tổng: {delivery.data.total.toLocaleString()}</span>}
            </div>

            <DeliveryTable
              items={delivery.data?.items ?? []}
              isLoading={delivery.isLoading}
              page={delivery.page}
              pages={delivery.data?.pages ?? 0}
              total={delivery.data?.total ?? 0}
              onPageChange={delivery.setPage}
              sortField={delivery.sortField}
              sortDir={delivery.sortDir}
              onSort={delivery.handleSort}
              onRowDoubleClick={setSelectedDelivery}
              visibleColumns={deliveryVisible}
            />

            {selectedDelivery && <TimelineModal item={selectedDelivery} onClose={() => setSelectedDelivery(null)} />}
          </div>
        )}

        {/* ─── Audit Tab ──────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5 min-w-[220px]">
                <span className="text-thiso-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Tìm actor, hành động, đối tượng..."
                  value={audit.search}
                  onChange={(e) => audit.setSearch(e.target.value)}
                  className="flex-1 text-sm text-thiso-700 bg-transparent outline-none placeholder:text-thiso-300"
                />
                {audit.search && (
                  <button onClick={() => audit.setSearch('')} className="text-thiso-300 hover:text-thiso-500 text-xs">✕</button>
                )}
              </div>
              <select className="input text-sm py-1.5 min-w-[140px]" value={audit.filters.actorType} onChange={(e) => audit.setFilter('actorType', e.target.value)}>
                <option value="">Tất cả actor</option>
                <option value="USER">Người dùng</option>
                <option value="STAFF">Nhân viên</option>
                <option value="DEVICE">Thiết bị</option>
                <option value="SYSTEM">Hệ thống</option>
              </select>
              <input
                type="text"
                placeholder="Hành động..."
                value={audit.filters.action}
                onChange={(e) => audit.setFilter('action', e.target.value)}
                className="input text-sm py-1.5 min-w-[160px]"
              />
              <input
                type="text"
                placeholder="Đối tượng..."
                value={audit.filters.targetType}
                onChange={(e) => audit.setFilter('targetType', e.target.value)}
                className="input text-sm py-1.5 min-w-[160px]"
              />
              <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-thiso-400">Từ</span>
                <input type="date" value={audit.filters.from} onChange={(e) => audit.setFilter('from', e.target.value)}
                  className="text-sm text-thiso-700 bg-transparent outline-none" />
              </div>
              <div className="flex items-center gap-2 bg-white border border-thiso-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-thiso-400">Đến</span>
                <input type="date" value={audit.filters.to} onChange={(e) => audit.setFilter('to', e.target.value)}
                  className="text-sm text-thiso-700 bg-transparent outline-none" />
              </div>
              <ColumnToggle columns={AUDIT_COLUMNS} visibleKeys={auditVisible} onChange={setAuditVisible} />
              {audit.data && <span className="text-xs text-thiso-400 self-center">Tổng: {audit.data.total.toLocaleString()}</span>}
            </div>

            <AuditTable
              items={audit.data?.items ?? []}
              isLoading={audit.isLoading}
              page={audit.page}
              pages={audit.data?.pages ?? 0}
              total={audit.data?.total ?? 0}
              onPageChange={audit.setPage}
              sortField={audit.sortField}
              sortDir={audit.sortDir}
              onSort={audit.handleSort}
              onRowDoubleClick={setSelectedAudit}
              visibleColumns={auditVisible}
            />

            {selectedAudit && <AuditDetailModal item={selectedAudit} onClose={() => setSelectedAudit(null)} />}
          </div>
        )}
      </div>
    </div>
  );
}
