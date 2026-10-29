import { Alert, Descriptions, Typography } from 'antd';
import type { DeliveryRegistration } from '../../../lib/types';
import { VEHICLE_LABEL, GOODS_LABEL } from '../constants';
import { getTicketCode, getUnitMeta } from '../utils';
export default function CheckInResultCard({ delivery }: { delivery: DeliveryRegistration }) {
  return <div className="mt-4">
    <Alert type="success" showIcon title="Check-in thành công!" description={delivery.ticketNumber != null ? <span>Số thẻ: <Typography.Text strong>{getTicketCode(delivery)}</Typography.Text> — thông báo số thẻ cho tài xế theo dõi màn hình chờ.</span> : undefined} />
    <Descriptions className="mt-4" column={{ xs: 1, sm: 2 }} size="small" items={[
      { key: 'code', label: 'Mã đăng ký', children: delivery.registrationCode }, { key: 'plate', label: 'Biển số', children: delivery.vehiclePlate },
      { key: 'vehicle', label: 'Loại xe', children: VEHICLE_LABEL[delivery.vehicleType] }, { key: 'driver', label: 'Tài xế', children: delivery.driverName },
      { key: 'phone', label: 'Điện thoại', children: delivery.driverPhone }, { key: 'vendor', label: 'Nhà cung cấp', children: delivery.vendorName },
      { key: 'unit', label: 'Đơn vị nhận', children: getUnitMeta(delivery).label }, { key: 'goods', label: 'Loại hàng', children: GOODS_LABEL[delivery.goodsType] },
      { key: 'status', label: 'Trạng thái', children: delivery.status },
    ]} />
  </div>;
}
