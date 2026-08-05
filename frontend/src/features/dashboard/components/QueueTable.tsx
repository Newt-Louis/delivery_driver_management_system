import { useMemo, useState } from 'react';
import GoodsBadge from '../../../components/GoodsBadge';
import StatusBadge from '../../../components/StatusBadge';
import type { DeliveryRegistration } from '../../../lib/types';
import { downloadCsv } from '../../../lib/export';
import { formatWait } from '../../../lib/utils';
import { DISPATCH_CSV_HEADERS, VEHICLE_LABEL } from '../constants';
import type { DeliveryLifecycleAction, StatusFilter, UnitKey, VehicleTypeFilter } from '../types';
import {
  buildDispatchCsvRows,
  filterDispatchDeliveries,
  getDeliveryWaitState,
  getTicketCode,
  getUnitMeta,
} from '../utils';
import FilterBar from './FilterBar';

interface QueueTableProps {
  deliveries: DeliveryRegistration[];
  unit?: UnitKey;
  onCall: (delivery: DeliveryRegistration, slotId?: string) => void;
  onAction: (id: string, action: DeliveryLifecycleAction) => void;
  onView: (id: string) => void;
  actionLoading: string | null;
}

export default function QueueTable({ deliveries, unit, onCall, onAction, onView, actionLoading }: QueueTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<VehicleTypeFilter>('ALL');

  const filtered = useMemo(
    () => filterDispatchDeliveries(deliveries, search, statusFilter, vehicleFilter),
    [deliveries, search, statusFilter, vehicleFilter],
  );

  function handleExport() {
    downloadCsv('dieu-phoi-hang-cho', DISPATCH_CSV_HEADERS, buildDispatchCsvRows(filtered));
  }

  return (
    <div>
      <FilterBar
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatus={setStatusFilter}
        vehicleFilter={vehicleFilter}
        onVehicle={setVehicleFilter}
        total={filtered.length}
        onExport={handleExport}
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
                {filtered.map((delivery) => {
                  const meta = getUnitMeta(delivery.receivingUnit);
                  const ticket = getTicketCode(delivery);
                  const { calledMin, isCritical, isWarning } = getDeliveryWaitState(delivery);

                  return (
                    <tr
                      key={delivery.id}
                      className={`border-b border-thiso-50 last:border-0 transition-colors border-l-4
                        ${isCritical ? 'bg-red-50 border-l-red-500'
                        : isWarning ? 'bg-amber-50 border-l-amber-400'
                          : `hover:bg-thiso-50/60 ${meta.rowBorder}`}`}
                    >
                      <td className="px-3 py-3">
                        {ticket ? (
                          <div
                            className="inline-flex items-center px-2.5 py-1 rounded-lg font-mono font-black text-xs tracking-widest text-white whitespace-nowrap shadow-sm"
                            style={{ background: meta.color }}
                          >
                            🎫 {ticket}
                          </div>
                        ) : (
                          <span className="text-thiso-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-mono font-black text-thiso-900 text-base leading-none">{delivery.vehiclePlate}</div>
                        <div className="text-xs text-thiso-500 mt-1 leading-none">{delivery.driverName}</div>
                        <div className="text-xs text-thiso-400 mt-0.5 font-mono">{delivery.driverPhone}</div>
                        {delivery.callCount && delivery.callCount > 0 && (
                          <span className="text-[10px] text-emart-600 font-bold mt-0.5 block">📞 Gọi {delivery.callCount}x</span>
                        )}
                      </td>

                      {!unit && (
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${meta.badge}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                      )}

                      <td className="px-3 py-3">
                        <div className="text-sm text-thiso-800 font-medium truncate max-w-[150px]" title={delivery.vendorName}>{delivery.vendorName}</div>
                        {delivery.poNumber && (
                          <div className="text-[10px] text-thiso-400 font-mono mt-0.5">PO: {delivery.poNumber}</div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-sky-700 font-bold bg-sky-50 px-2 py-1 rounded-lg whitespace-nowrap select-all">
                          {delivery.registrationCode}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <GoodsBadge type={delivery.goodsType} />
                        <div className="text-xs text-thiso-500 mt-1">{VEHICLE_LABEL[delivery.vehicleType]}</div>
                      </td>

                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {delivery.status === 'WAITING' && delivery.checkinTime && (
                          <div>
                            <span className={`font-black text-sm ${isCritical ? 'text-red-600' : isWarning ? 'text-orange-500' : 'text-thiso-600'}`}>
                              {formatWait(delivery.checkinTime)}
                            </span>
                            <div className="text-thiso-400 text-[10px] mt-0.5">từ check-in</div>
                          </div>
                        )}
                        {delivery.status === 'CALLED' && (
                          <div>
                            <span className={`font-black text-sm ${calledMin >= 15 ? 'text-red-600' : 'text-sky-600'}`}>
                              {formatWait(delivery.calledTime)}
                            </span>
                            {calledMin >= 15 && (
                              <div className="text-red-500 font-black text-[10px] mt-0.5 animate-pulse">NO-SHOW</div>
                            )}
                          </div>
                        )}
                        {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status) && (
                          <div>
                            <span className="font-black text-sm text-green-600">{formatWait(delivery.receivingStartTime)}</span>
                            <div className="text-thiso-400 text-[10px] mt-0.5">đang nhận</div>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {delivery.assignedSlot ? (
                          <div>
                            <span className="font-black text-base" style={{ color: meta.color }}>{delivery.assignedSlot.code}</span>
                            {delivery.assignedSlot.zone && <div className="text-[10px] text-thiso-400 font-mono">{delivery.assignedSlot.zone.code}</div>}
                          </div>
                        ) : '—'}
                      </td>

                      <td className="px-3 py-3"><StatusBadge status={delivery.status} /></td>

                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-thiso-200 text-thiso-500 hover:bg-thiso-50 hover:text-thiso-700 transition-colors font-medium"
                            onClick={() => onView(delivery.id)}
                          >
                            🔍 Xem
                          </button>
                          {delivery.status === 'WAITING' && (
                            <button type="button" className="btn-primary text-xs px-3 py-1.5" onClick={() => onCall(delivery)}>
                              📣 Gọi vào vị trí
                            </button>
                          )}
                          {delivery.status === 'CALLED' && (
                            <>
                              <button
                                type="button"
                                className="btn-warning text-xs px-3 py-1.5"
                                disabled={!!actionLoading}
                                onClick={() => onAction(delivery.id, 'start-receiving')}
                              >
                                📦 Bắt đầu nhận
                              </button>
                              <button
                                type="button"
                                className="btn-secondary text-xs px-2 py-1.5"
                                disabled={!!actionLoading}
                                onClick={() => onCall(delivery)}
                              >
                                🔁 Gọi lại
                              </button>
                            </>
                          )}
                          {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status) && (
                            <button
                              type="button"
                              className="btn-success text-xs px-3 py-1.5"
                              disabled={!!actionLoading}
                              onClick={() => onAction(delivery.id, 'complete')}
                            >
                              ✓ Hoàn tất
                            </button>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(delivery.status) && (
                            <button
                              type="button"
                              className="btn-danger text-xs px-2 py-1.5"
                              disabled={!!actionLoading}
                              onClick={() => onAction(delivery.id, 'cancel')}
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
