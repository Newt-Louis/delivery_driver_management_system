import { Alert, Button, DatePicker, Input, Select, Space, Tabs, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useDeliveryHistory } from '../features/histories/hooks/useDeliveryHistory';
import { useAuditLogs } from '../features/histories/hooks/useAuditLogs';
import { DELIVERY_COLUMNS, AUDIT_COLUMNS, DELIVERY_STORAGE_KEY, AUDIT_STORAGE_KEY, GOODS_LABEL, VEHICLE_LABEL } from '../features/histories/constants';
import type { DeliveryHistoryItem, AuditLogItem, HistoryTab } from '../features/histories/types';
import type { UnitConfig } from '../lib/types';
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
  const { data: units = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });
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
    { id: 'access', label: 'Truy cập' },
    { id: 'delivery', label: 'Giao/Nhận' },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Typography.Title level={2}>Lịch sử</Typography.Title>
          <p className="text-sm text-thiso-500 mt-0.5">Truy cập, giao/nhận hàng và nhật ký thao tác</p>
        </div>

        {/* Tab bar */}
        <Tabs activeKey={tab} onChange={(key) => setTab(key as HistoryTab)} items={tabs.map(t => ({ key: t.id, label: t.label }))} />

        {/* ─── Access Tab ──────────────────────────────────────────────── */}
        {tab === 'access' && <PlaceholderTab />}

        {/* ─── Delivery Tab ────────────────────────────────────────────── */}
        {tab === 'delivery' && (
          <div className="space-y-4">
            {/* Filters */}
            <Space wrap>
              <Input allowClear aria-label="Tìm lịch sử giao hàng" placeholder="Tìm mã chuyến, nhà CC, tài xế, biển số..." value={delivery.search} onChange={e => delivery.setSearch(e.target.value)} style={{ width: 260 }} />
              <Select aria-label="Trạng thái" value={delivery.filters.finalStatus} onChange={v => delivery.setFilter('finalStatus', v)} style={{ minWidth: 160 }} options={[{value:'',label:'Tất cả trạng thái'}, ...Object.entries({ COMPLETED:'Hoàn tất', CANCELLED:'Đã hủy', EXPIRED:'Hết hạn', INCOMPLETED:'Chưa hoàn tất' }).map(([value,label]) => ({value,label}))]} />
              <Select aria-label="Đơn vị" value={delivery.filters.receivingUnit} onChange={v => delivery.setFilter('receivingUnit', v)} style={{ minWidth: 160 }} options={[{value:'',label:'Tất cả đơn vị'}, ...units.map(u => ({value:u.unit,label:u.shortName || u.displayName || u.unit}))]} />
              <Select aria-label="Loại hàng" value={delivery.filters.goodsType} onChange={v => delivery.setFilter('goodsType', v)} style={{ minWidth: 160 }} options={[{value:'',label:'Tất cả loại hàng'}, ...Object.entries(GOODS_LABEL).map(([value,label]) => ({value,label}))]} />
              <Select aria-label="Loại xe" value={delivery.filters.vehicleType} onChange={v => delivery.setFilter('vehicleType', v)} style={{ minWidth: 140 }} options={[{value:'',label:'Tất cả xe'}, ...Object.entries(VEHICLE_LABEL).map(([value,label]) => ({value,label}))]} />
              <DatePicker aria-label="Từ ngày" value={delivery.filters.from ? dayjs(delivery.filters.from) : null} onChange={d => delivery.setFilter('from', d ? d.format('YYYY-MM-DD') : '')} />
              <DatePicker aria-label="Đến ngày" value={delivery.filters.to ? dayjs(delivery.filters.to) : null} onChange={d => delivery.setFilter('to', d ? d.format('YYYY-MM-DD') : '')} />
              <ColumnToggle columns={DELIVERY_COLUMNS} visibleKeys={deliveryVisible} onChange={setDeliveryVisible} />{delivery.data && <Typography.Text type="secondary">Tổng: {delivery.data.total.toLocaleString()}</Typography.Text>}
            </Space>

            {delivery.isError && <Alert type="error" showIcon message="Không thể tải lịch sử giao hàng" action={<Button onClick={() => delivery.refetch()}>Thử lại</Button>} />}
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
            <Space wrap>
              <Input allowClear aria-label="Tìm audit" placeholder="Tìm actor, hành động, đối tượng..." value={audit.search} onChange={e => audit.setSearch(e.target.value)} style={{ width: 250 }} />
              <Select aria-label="Loại actor" value={audit.filters.actorType} onChange={v => audit.setFilter('actorType', v)} style={{ minWidth: 150 }} options={[{value:'',label:'Tất cả actor'}, {value:'USER',label:'Người dùng'}, {value:'STAFF',label:'Nhân viên'}, {value:'DEVICE',label:'Thiết bị'}, {value:'SYSTEM',label:'Hệ thống'}]} />
              <Input aria-label="Hành động" placeholder="Hành động..." value={audit.filters.action} onChange={e => audit.setFilter('action', e.target.value)} style={{ width: 160 }} />
              <Input aria-label="Đối tượng" placeholder="Đối tượng..." value={audit.filters.targetType} onChange={e => audit.setFilter('targetType', e.target.value)} style={{ width: 160 }} />
              <DatePicker aria-label="Từ ngày" value={audit.filters.from ? dayjs(audit.filters.from) : null} onChange={d => audit.setFilter('from', d ? d.format('YYYY-MM-DD') : '')} />
              <DatePicker aria-label="Đến ngày" value={audit.filters.to ? dayjs(audit.filters.to) : null} onChange={d => audit.setFilter('to', d ? d.format('YYYY-MM-DD') : '')} />
              <ColumnToggle columns={AUDIT_COLUMNS} visibleKeys={auditVisible} onChange={setAuditVisible} />{audit.data && <Typography.Text type="secondary">Tổng: {audit.data.total.toLocaleString()}</Typography.Text>}
            </Space>

            {audit.isError && <Alert type="error" showIcon message="Không thể tải nhật ký" action={<Button onClick={() => audit.refetch()}>Thử lại</Button>} />}
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
