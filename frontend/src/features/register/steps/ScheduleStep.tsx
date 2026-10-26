import { CalendarOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import type { DailyRegistrationStat } from '../api';
import DeliveryDateCalendar from '../components/DeliveryDateCalendar';
import FieldFrame from '../components/FieldFrame';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import { isSundayDate } from '../utils/date';
import type { FormState, RegisterFieldErrors, SetFormField } from '../types';

type ScheduleStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  highlightedField: keyof FormState | null;
  dailyStats: DailyRegistrationStat[];
  dailyStatsMsg: string;
  dailyStatsLoading: boolean;
  manualReferenceLoading: boolean;
  manualReferenceError: string;
  sundayFreshFoodBlocked: boolean;
  sundayFreshFoodOnly: boolean;
  set: SetFormField;
  onRetryManualReferenceCode: () => void;
};

export default function ScheduleStep({ form, fieldErrors, highlightedField, dailyStats, dailyStatsMsg, dailyStatsLoading, manualReferenceLoading, manualReferenceError, sundayFreshFoodBlocked, sundayFreshFoodOnly, set, onRetryManualReferenceCode }: ScheduleStepProps) {
  return (
    <div className="space-y-5">
      <FieldFrame field="deliveryDate" highlightedField={highlightedField} variant="choice">
        <Card size="small" title={<><CalendarOutlined /> Ngày giao hàng</>}>
          {dailyStatsMsg && <Alert className="mb-4" type="warning" showIcon message={dailyStatsMsg} />}
          {sundayFreshFoodBlocked && <Alert className="mb-4" type="warning" showIcon message="Chủ nhật chỉ nhận hàng tươi sống" />}
          <DeliveryDateCalendar value={form.deliveryDate} stats={dailyStats} loading={dailyStatsLoading} disabledReasonForDate={(date) => sundayFreshFoodOnly && isSundayDate(date) && form.goodsType !== 'FRESH_FOOD' ? 'Chủ nhật chỉ nhận hàng tươi sống' : undefined} onChange={(date) => set('deliveryDate', date)} />
          {fieldErrors.deliveryDate && <FieldError text={fieldErrors.deliveryDate} />}
        </Card>
      </FieldFrame>

      <Card size="small" title="Thông tin đơn hàng">
        <Form layout="vertical" requiredMark={false}>
          <FieldFrame field="vendorName" highlightedField={highlightedField}>
            <Form.Item label="Tên công ty / Nhà cung cấp" required validateStatus={fieldErrors.vendorName ? 'error' : undefined} className="!mb-4">
              <Input size="large" value={form.vendorName} onChange={(event) => set('vendorName', event.target.value)} placeholder="Công ty TNHH ABC" autoComplete="organization" status={fieldErrors.vendorName ? 'error' : undefined} />
              <FieldHint text="Tên công ty hoặc đơn vị bạn đại diện giao hàng." />
              {fieldErrors.vendorName && <FieldError text={fieldErrors.vendorName} />}
            </Form.Item>
          </FieldFrame>
          <FieldFrame field="poNumber" highlightedField={highlightedField}>
            <Form.Item label="Mã đối chiếu đăng ký" extra="Mã này được lưu cùng lượt đăng ký để đối chiếu hoặc hủy chuyến khi cần." className="!mb-0">
              <Input size="large" value={form.poNumber} readOnly placeholder="Đang tạo mã..." autoComplete="off" className="font-mono font-bold tracking-[0.2em]" suffix={manualReferenceLoading ? <LoadingOutlined /> : undefined} />
              {manualReferenceError && <Alert className="mt-3" type="error" showIcon message={manualReferenceError} action={<Button size="small" icon={<ReloadOutlined />} onClick={onRetryManualReferenceCode}>Thử lại</Button>} />}
              {fieldErrors.poNumber && <FieldError text={fieldErrors.poNumber} />}
            </Form.Item>
          </FieldFrame>
        </Form>
        <Typography.Text type="secondary" className="text-xs">Mã được tạo tự động, không cần nhập thủ công.</Typography.Text>
      </Card>
    </div>
  );
}
