import { useQuery } from '@tanstack/react-query';
import GoodsBadge from '../../../components/GoodsBadge';
import StatusBadge from '../../../components/StatusBadge';
import type { DeliveryRegistration } from '../../../lib/types';
import { fetchDeliveryDetail } from '../api';
import { GOODS_LABEL, VEHICLE_FULL } from '../constants';
import type { DeliveryLifecycleAction } from '../types';
import { formatDateOnly, formatDateTime, getDeliveryTimeline, getTicketCode, getUnitMeta } from '../utils';
import DetailRow from './DetailRow';

interface DeliveryDetailModalProps {
  id: string;
  onClose: () => void;
  onCall: (delivery: DeliveryRegistration) => void;
  onAction: (id: string, action: DeliveryLifecycleAction) => void;
}

export default function DeliveryDetailModal({ id, onClose, onCall, onAction }: DeliveryDetailModalProps) {
  const { data: delivery, isLoading } = useQuery<DeliveryRegistration>({
    queryKey: ['delivery', id],
    queryFn: () => fetchDeliveryDetail(id),
    staleTime: 5_000,
  });

  const meta = delivery ? getUnitMeta(delivery.receivingUnit) : null;
  const ticket = delivery ? getTicketCode(delivery) : null;
  const timeline = delivery ? getDeliveryTimeline(delivery) : [];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className={`bg-gradient-to-r ${meta?.headerBg ?? 'from-thiso-700 to-thiso-500'} p-5 rounded-t-2xl shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {ticket && (
                <div className="text-white/70 text-xs font-mono font-black tracking-widest mb-1">🎫 {ticket}</div>
              )}
              <div className="text-white font-black text-2xl tracking-wider truncate">{isLoading ? '…' : delivery?.vehiclePlate}</div>
              <div className="text-white/80 text-sm mt-1 truncate">{delivery?.vendorName}</div>
              <div className="text-white/60 text-xs font-mono mt-0.5">{delivery?.registrationCode}</div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {delivery && <StatusBadge status={delivery.status} />}
              <button type="button" onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-thiso-400 py-16">Đang tải...</div>
        ) : delivery ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 grid grid-cols-2 gap-4 border-b border-thiso-100">
              <DetailRow label="Nhà cung cấp" value={delivery.vendorName} />
              <DetailRow label="Mã đăng ký" value={<span className="font-mono text-sky-700 font-black text-sm">{delivery.registrationCode}</span>} />
              <DetailRow label="Tài xế" value={delivery.driverName} />
              <DetailRow label="Điện thoại" value={<a href={`tel:${delivery.driverPhone}`} className="text-sky-600 underline">{delivery.driverPhone}</a>} />
              <DetailRow label="Biển số xe" value={<span className="font-mono font-black text-thiso-900">{delivery.vehiclePlate}</span>} />
              <DetailRow label="Loại xe" value={VEHICLE_FULL[delivery.vehicleType]} />
              <DetailRow label="Đơn vị nhận" value={
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${meta?.badge}`}>{meta?.icon} {meta?.label}</span>
              } />
              <DetailRow label="Loại hàng" value={GOODS_LABEL[delivery.goodsType]} />
              {delivery.poNumber && <DetailRow label="Số PO" value={<span className="font-mono">{delivery.poNumber}</span>} />}
              {delivery.note && <DetailRow label="Ghi chú" value={delivery.note} />}
              {delivery.cancelReason && <DetailRow label="Lý do hủy" value={delivery.cancelReason} />}
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-thiso-100 bg-thiso-50/50">
              <DetailRow label="Ngày giao" value={formatDateOnly(delivery.requestedTime)} />
              <DetailRow label="Giờ đăng ký" value={formatDateTime(delivery.createdAt)} />
              <DetailRow label="Check-in" value={formatDateTime(delivery.checkinTime)} />
              <DetailRow label="Được gọi" value={formatDateTime(delivery.calledTime)} />
              <DetailRow label="Bắt đầu nhận" value={formatDateTime(delivery.receivingStartTime)} />
              <DetailRow label="Hoàn tất" value={formatDateTime(delivery.completedTime)} />
              {delivery.assignedSlot && (
                <DetailRow label="Vị trí được phân công" value={
                  <span className="font-black text-base" style={{ color: meta?.color }}>
                    {delivery.assignedSlot.code}
                    {delivery.assignedSlot.zone && <span className="text-xs text-thiso-400 font-normal ml-1">({delivery.assignedSlot.zone.code})</span>}
                  </span>
                } />
              )}
            </div>

            <div className="px-5 py-4">
              <div className="text-xs font-black uppercase tracking-wider text-thiso-400 mb-3">Lịch sử hoạt động</div>
              {timeline.length === 0 ? (
                <div className="text-thiso-300 text-sm">Chưa có lịch sử</div>
              ) : (
                <ol className="relative border-l-2 border-thiso-100 space-y-4 ml-3">
                  {timeline.map((event, index) => (
                    <li key={index} className="relative pl-5">
                      <span className="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-white border-2 border-thiso-200 flex items-center justify-center text-[11px]">{event.icon}</span>
                      <div className={`text-sm font-medium ${event.accent ?? 'text-thiso-700'}`}>{event.label}</div>
                      <div className="text-xs text-thiso-400 mt-0.5">{formatDateTime(event.time)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ) : null}

        {delivery && !['COMPLETED', 'CANCELLED'].includes(delivery.status) && (
          <div className="shrink-0 px-5 py-4 border-t border-thiso-100 flex flex-wrap gap-2 bg-thiso-50/50">
            {delivery.status === 'WAITING' && (
              <button type="button" className="btn-primary text-sm px-4 py-2" onClick={() => { onCall(delivery); onClose(); }}>📣 Gọi vào vị trí</button>
            )}
            {delivery.status === 'CALLED' && (
              <>
                <button type="button" className="btn-warning text-sm px-4 py-2" onClick={() => { onAction(delivery.id, 'start-receiving'); onClose(); }}>📦 Bắt đầu nhận</button>
                <button type="button" className="btn-secondary text-sm px-3 py-2" onClick={() => { onCall(delivery); onClose(); }}>🔁 Gọi lại</button>
              </>
            )}
            {['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status) && (
              <button type="button" className="btn-success text-sm px-4 py-2" onClick={() => { onAction(delivery.id, 'complete'); onClose(); }}>✅ Hoàn tất</button>
            )}
            <button type="button" className="btn-danger text-sm px-3 py-2 ml-auto" onClick={() => { onAction(delivery.id, 'cancel'); onClose(); }}>Hủy đơn</button>
          </div>
        )}
      </div>
    </div>
  );
}
