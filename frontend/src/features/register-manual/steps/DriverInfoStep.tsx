import { InfoCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Card, Form, Input, Space, Switch, Typography } from 'antd';
import type { FormState } from '../types';

type DriverInfoStepProps = {
  form: FormState;
  rememberInfo: boolean;
  setRememberInfo: (updater: (value: boolean) => boolean) => void;
};

const normalizePlate = (value: string = '') => value.toUpperCase().replace(/[^A-Z0-9\-.]/g, '');
const normalizePhone = (value: string = '') => value.replace(/[^\d+\-\s]/g, '');

export default function DriverInfoStep({ form, rememberInfo, setRememberInfo }: DriverInfoStepProps) {
  return (
    <div className="space-y-5">
      {(form.driverName || form.vehiclePlate) && <Alert type="info" showIcon icon={<InfoCircleOutlined />} title="Đã điền sẵn thông tin từ lần trước. Hãy kiểm tra lại trước khi tiếp tục." />}
      <Card size="small" title="Thông tin tài xế">
        <Form.Item<FormState>
          label="Biển số xe"
          name="vehiclePlate"
          normalize={normalizePlate}
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập biển số xe' }]}
          extra="Ví dụ: 51C-123.45 — nhập chữ in hoa, không cần dấu cách."
        >
          <Input size="large" placeholder="51C-123.45" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} className="font-mono tracking-widest" />
        </Form.Item>
        <Form.Item<FormState> label="Tên tài xế" name="driverName">
          <Input size="large" placeholder="Nguyễn Văn A" autoComplete="name" />
        </Form.Item>
        <Form.Item<FormState>
          label="Số điện thoại"
          name="driverPhone"
          normalize={normalizePhone}
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập số điện thoại' },
            {
              validator: async (_, value: string = '') => {
                if (value.trim() && value.replace(/\D/g, '').length < 9) throw new Error('Số điện thoại không hợp lệ (cần ít nhất 9 số)');
              },
            },
          ]}
          extra="Số này dùng để liên lạc khi cần."
          className="!mb-0"
        >
          <Input size="large" type="tel" inputMode="numeric" placeholder="0901 234 567" autoComplete="tel" />
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
