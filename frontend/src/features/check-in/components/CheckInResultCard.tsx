import GoodsBadge from '../../../components/GoodsBadge';
import StatusBadge from '../../../components/StatusBadge';
import type { DeliveryRegistration } from '../../../lib/types';
import { VEHICLE_LABEL } from '../constants';
import { getTicketCode, getUnitMeta } from '../utils';
import InfoRow from './InfoRow';
import UnitBadge from './UnitBadge';

export default function CheckInResultCard({ delivery }: { delivery: DeliveryRegistration }) {
  return (
    <div className="mt-4 border-2 border-sky-300 rounded-xl overflow-hidden">
      <div className="bg-sky-600 px-4 py-3 flex items-center gap-2">
        <span className="text-xl">✅</span>
        <span className="font-bold text-white">Check-in thành công!</span>
        <span className="ml-auto font-mono text-sky-100 text-xs">{delivery.registrationCode}</span>
      </div>

      {delivery.ticketNumber != null && (
        <div
          className="px-4 py-5 text-center"
          style={{ background: getUnitMeta(delivery).color }}
        >
          <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Số thẻ của tài xế</div>
          <div className="text-white font-black tracking-widest" style={{ fontSize: 'clamp(2rem, 6vw, 3.2rem)', lineHeight: 1.1 }}>
            {getTicketCode(delivery)}
          </div>
          <div className="text-white/70 text-xs mt-2">Thông báo số thẻ này cho tài xế theo dõi màn hình chờ</div>
        </div>
      )}

      <div className="p-4 grid grid-cols-2 gap-3 text-sm bg-sky-50">
        <InfoRow label="Biển số" value={<span className="font-mono font-bold text-thiso-800 text-base">{delivery.vehiclePlate}</span>} />
        <InfoRow label="Loại xe" value={VEHICLE_LABEL[delivery.vehicleType]} />
        <InfoRow label="Tài xế" value={delivery.driverName} />
        <InfoRow label="Điện thoại" value={delivery.driverPhone} />
        <InfoRow label="Nhà cung cấp" value={delivery.vendorName} />
        <InfoRow label="Đơn vị nhận" value={<UnitBadge delivery={delivery} strong />} />
        <InfoRow label="Loại hàng" value={<GoodsBadge type={delivery.goodsType} />} />
        <div className="col-span-2">
          <InfoRow label="Trạng thái" value={<StatusBadge status={delivery.status} />} />
        </div>
      </div>
    </div>
  );
}
