import { CarOutlined, EditOutlined, EnvironmentOutlined, InboxOutlined, PhoneOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Form, Input, Space, Tag, Typography } from 'antd';
import { UNIT_FALLBACKS, type UnitBranding } from '../../../context/BrandingContext';
import type { UnitConfig } from '../../../lib/types';
import { GOODS_LABEL, VEHICLE_INFO } from '../constants';
import type { FormState, SetFormField, Unit, VehicleType } from '../types';

type ReviewSubmitStepProps = {
  form: FormState;
  unitConfig: UnitConfig | null;
  brandUnits: Record<Unit, UnitBranding>;
  locationName: string;
  awStatus: 'idle' | 'loading' | 'match' | 'nomatch';
  awVendorName: string;
  submitError: string;
  set: SetFormField;
  onEditStep: (step: 1 | 2 | 3) => void;
};

export default function ReviewSubmitStep({ form, unitConfig, brandUnits, locationName, awStatus, awVendorName, submitError, set, onEditStep }: ReviewSubmitStepProps) {
  const receivingUnit = form.receivingUnit as Unit;
  const unitBrand = brandUnits[receivingUnit] ?? UNIT_FALLBACKS[receivingUnit];
  const unitDisplayName = unitConfig?.displayName || unitBrand?.displayName || form.receivingUnit;
  const vehicle = VEHICLE_INFO[form.vehicleType as VehicleType];

  return (
    <div className="space-y-5">
      <Card size="small" title="Xác nhận thông tin đăng ký">
        <Descriptions column={1} size="small" bordered items={[
          ...(locationName ? [{ key: 'location', label: <Space><EnvironmentOutlined />Khu vực</Space>, children: locationName }] : []),
          { key: 'unit', label: <Space><ShopOutlined />Đơn vị giao</Space>, children: unitDisplayName },
          { key: 'goods', label: <Space><InboxOutlined />Loại hàng</Space>, children: GOODS_LABEL[form.goodsType] ?? form.goodsType },
          { key: 'vehicle', label: <Space><CarOutlined />Phương tiện</Space>, children: vehicle?.label ?? form.vehicleType },
          { key: 'plate', label: <Space><CarOutlined />Biển số xe</Space>, children: <Typography.Text code>{form.vehiclePlate}</Typography.Text> },
          { key: 'driver', label: <Space><UserOutlined />Tài xế</Space>, children: form.driverName || '—' },
          { key: 'phone', label: <Space><PhoneOutlined />Điện thoại</Space>, children: <Typography.Text code>{form.driverPhone}</Typography.Text> },
          { key: 'vendor', label: <Space><ShopOutlined />Nhà cung cấp</Space>, children: form.vendorName },
          ...(form.vendorCode ? [{ key: 'vendor-code', label: 'Mã NCC', children: <Typography.Text code>{form.vendorCode}</Typography.Text> }] : []),
          { key: 'reference', label: 'Mã đối chiếu', children: <Typography.Text code>{form.poNumber}</Typography.Text> },
          { key: 'date', label: 'Ngày giao', children: form.deliveryDate.split('-').reverse().join('/') },
        ]} />
        {awStatus === 'match' && <Tag color="success" className="mt-4">Kho tự động{awVendorName ? ` · ${awVendorName}` : ''}</Tag>}
      </Card>

      <Space wrap>
        <Button icon={<EditOutlined />} onClick={() => onEditStep(1)}>Sửa điểm giao</Button>
        <Button icon={<EditOutlined />} onClick={() => onEditStep(2)}>Sửa ngày và đơn hàng</Button>
        <Button icon={<EditOutlined />} onClick={() => onEditStep(3)}>Sửa thông tin xe</Button>
      </Space>

      <Card size="small" title="Ghi chú">
        <Form layout="vertical"><Form.Item className="!mb-0"><Input.TextArea rows={3} value={form.note} onChange={(event) => set('note', event.target.value)} placeholder="Yêu cầu đặc biệt, hàng dễ vỡ, cần xe nâng..." /></Form.Item></Form>
      </Card>
      {submitError && <Alert type="error" showIcon message={submitError} />}
      <Typography.Paragraph type="secondary" className="!mb-0 text-center text-xs">Thông tin đăng ký chỉ dùng cho mục đích quản lý giao hàng. Khi hoàn tất, bạn đồng ý để hệ thống sử dụng thông tin này cho chuyến giao.</Typography.Paragraph>
    </div>
  );
}
