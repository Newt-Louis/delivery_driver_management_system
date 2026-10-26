import { InfoCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Card, Form, Input, Space, Switch, Typography } from 'antd';
import FieldFrame from '../components/FieldFrame';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import type { FormState, RegisterFieldErrors, SetFormField } from '../types';

type DriverInfoStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  highlightedField: keyof FormState | null;
  rememberInfo: boolean;
  setRememberInfo: (updater: (value: boolean) => boolean) => void;
  set: SetFormField;
};

export default function DriverInfoStep({ form, fieldErrors, highlightedField, rememberInfo, setRememberInfo, set }: DriverInfoStepProps) {
  return (
    <div className="space-y-5">
      {(form.driverName || form.vehiclePlate) && <Alert type="info" showIcon icon={<InfoCircleOutlined />} message="Đã điền sẵn thông tin từ lần trước. Hãy kiểm tra lại trước khi tiếp tục." />}
      <Card size="small" title="Thông tin tài xế">
        <Form layout="vertical" requiredMark={false}>
          <FieldFrame field="vehiclePlate" highlightedField={highlightedField}>
            <Form.Item label="Biển số xe" required className="!mb-4">
              <Input size="large" value={form.vehiclePlate} onChange={(event) => set('vehiclePlate', event.target.value.toUpperCase().replace(/[^A-Z0-9\-\.]/g, ''))} placeholder="51C-123.45" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} status={fieldErrors.vehiclePlate ? 'error' : undefined} className="font-mono tracking-widest" />
              <FieldHint text="Ví dụ: 51C-123.45 — nhập chữ in hoa, không cần dấu cách." />
              {fieldErrors.vehiclePlate && <FieldError text={fieldErrors.vehiclePlate} />}
            </Form.Item>
          </FieldFrame>
          <FieldFrame field="driverName" highlightedField={highlightedField}>
            <Form.Item label="Tên tài xế" className="!mb-4">
              <Input size="large" value={form.driverName} onChange={(event) => set('driverName', event.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" />
            </Form.Item>
          </FieldFrame>
          <FieldFrame field="driverPhone" highlightedField={highlightedField}>
            <Form.Item label="Số điện thoại" required className="!mb-4">
              <Input size="large" type="tel" inputMode="numeric" value={form.driverPhone} onChange={(event) => set('driverPhone', event.target.value.replace(/[^\d+\-\s]/g, ''))} placeholder="0901 234 567" autoComplete="tel" status={fieldErrors.driverPhone ? 'error' : undefined} />
              <FieldHint text="Số này dùng để liên lạc khi cần." />
              {fieldErrors.driverPhone && <FieldError text={fieldErrors.driverPhone} />}
            </Form.Item>
          </FieldFrame>
        </Form>
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
