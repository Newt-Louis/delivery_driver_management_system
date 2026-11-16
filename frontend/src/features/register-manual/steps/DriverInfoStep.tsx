import { InfoCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Card, Form, Input, Space, Switch, Typography } from 'antd';
import type { FormState } from '../types';
import { normalizeVehiclePlateInput, vehiclePlateError, VEHICLE_PLATE_EXAMPLE } from '../../../lib/vehiclePlate';
import { DRIVER_PHONE_HINT, driverPhoneError, normalizeDriverPhoneInput } from '../../../lib/driverPhone';

type DriverInfoStepProps = {
  form: FormState;
  rememberInfo: boolean;
  setRememberInfo: (updater: (value: boolean) => boolean) => void;
};


export default function DriverInfoStep({ form, rememberInfo, setRememberInfo }: DriverInfoStepProps) {
  const vehicleType = form.vehicleType;
  return (
    <div className="space-y-5">
      {(form.driverName || form.vehiclePlate) && <Alert type="info" showIcon icon={<InfoCircleOutlined />} title="Đã điền sẵn thông tin từ lần trước. Hãy kiểm tra lại trước khi tiếp tục." />}
      <Card size="small" title="Thông tin tài xế">
        <Form.Item<FormState>
          label="Biển số xe"
          name="vehiclePlate"
          normalize={normalizeVehiclePlateInput}
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập biển số xe' },
            {
              validator: async (_, value: string = '') => {
                const message = value.trim() ? vehiclePlateError(value, vehicleType) : '';
                if (message) throw new Error(message);
              },
            },
          ]}
        >
          <Input size="large" placeholder={vehicleType ? VEHICLE_PLATE_EXAMPLE[vehicleType] : VEHICLE_PLATE_EXAMPLE.TRUCK} autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} className="font-mono tracking-widest" />
        </Form.Item>
        <Form.Item<FormState> label="Tên tài xế" name="driverName">
          <Input size="large" placeholder="Nguyễn Văn A" autoComplete="name" />
        </Form.Item>
        <Form.Item<FormState>
          label="Số điện thoại"
          name="driverPhone"
          normalize={normalizeDriverPhoneInput}
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại' },
            {
              validator: async (_, value: string = '') => {
                const message = value.trim() ? driverPhoneError(value) : '';
                if (message) throw new Error(message);
              },
            },
          ]}
          extra={`${DRIVER_PHONE_HINT} Số này dùng để liên lạc khi cần.`}
          className="!mb-0"
        >
          <Input size="large" type="tel" inputMode="tel" placeholder="0857382937" autoComplete="tel" />
        </Form.Item>
      </Card>

      <Card size="small">
        <Space align="start">
          <Switch checked={rememberInfo} onChange={(checked) => setRememberInfo(() => checked)} aria-label="Ghi nhớ thông tin của tôi" />
          <div><Typography.Text strong><SaveOutlined /> Ghi nhớ thông tin của tôi</Typography.Text><Typography.Text type="secondary" className="block text-xs">Điền sẵn biển số, tên và số điện thoại cho lần sau.</Typography.Text></div>
        </Space>
      </Card>
    </div>
  );
}
