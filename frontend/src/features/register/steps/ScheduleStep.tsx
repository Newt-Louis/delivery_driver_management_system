import { CalendarOutlined, CheckCircleOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Card, Form, Input, Space, Typography } from 'antd';
import type { AutoWarehouseVendorSuggestion, DailyRegistrationStat } from '../api';
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
  awStatus: 'idle' | 'loading' | 'match' | 'nomatch';
  awVendorName: string;
  awVendorSuggestions: AutoWarehouseVendorSuggestion[];
  awVendorSuggestionsLoading: boolean;
  set: SetFormField;
  onRetryManualReferenceCode: () => void;
  onSelectAutoWarehouseVendor: (vendor: AutoWarehouseVendorSuggestion) => void;
};

export default function ScheduleStep({ form, fieldErrors, highlightedField, dailyStats, dailyStatsMsg, dailyStatsLoading, manualReferenceLoading, manualReferenceError, sundayFreshFoodBlocked, sundayFreshFoodOnly, awStatus, awVendorName, awVendorSuggestions, awVendorSuggestionsLoading, set, onRetryManualReferenceCode, onSelectAutoWarehouseVendor }: ScheduleStepProps) {
  const vendorOptions = awVendorSuggestions.map((vendor) => ({
    value: vendor.vendorCode,
    label: <div className="py-1"><Typography.Text strong>{vendor.vendorCode}</Typography.Text><Typography.Text type="secondary" className="block text-xs">{vendor.vendorName}</Typography.Text></div>,
    vendor,
  }));
  const vendorSuffix = <span className="inline-flex w-4 justify-center" aria-live="polite">{awStatus === 'loading' ? <LoadingOutlined /> : awStatus === 'match' ? <CheckCircleOutlined /> : null}</span>;

  return (
    <div className="space-y-5">
      <FieldFrame field="deliveryDate" highlightedField={highlightedField} variant="choice">
        <Card size="small" title={<><CalendarOutlined /> Ngày giao hàng</>}>
          {dailyStatsMsg && <Alert className="mb-4" type="warning" showIcon title={dailyStatsMsg} />}
          {sundayFreshFoodBlocked && <Alert className="mb-4" type="warning" showIcon title="Chủ nhật chỉ nhận hàng tươi sống" />}
          <DeliveryDateCalendar value={form.deliveryDate} stats={dailyStats} loading={dailyStatsLoading} disabledReasonForDate={(date) => sundayFreshFoodOnly && isSundayDate(date) && form.goodsType !== 'FRESH_FOOD' ? 'Chủ nhật chỉ nhận hàng tươi sống' : undefined} onChange={(date) => set('deliveryDate', date)} />
          {fieldErrors.deliveryDate && <FieldError text={fieldErrors.deliveryDate} />}
        </Card>
      </FieldFrame>

      <Card size="small" title="Thông tin đơn hàng">
        <Form layout="vertical" requiredMark={false}>
          <FieldFrame field="vendorCode" highlightedField={highlightedField}>
            <Form.Item label="Mã nhà cung cấp (NCC)" className="!mb-4">
              <AutoComplete
                value={form.vendorCode}
                options={vendorOptions}
                filterOption={false}
                notFoundContent={awVendorSuggestionsLoading ? <Space><LoadingOutlined />Đang tìm NCC...</Space> : null}
                onChange={(value) => set('vendorCode', value)}
                onSelect={(_value, option) => {
                  const vendor = (option as { vendor?: AutoWarehouseVendorSuggestion }).vendor;
                  if (vendor) onSelectAutoWarehouseVendor(vendor);
                }}
              >
                <Input size="large" placeholder="VD: Sup001, NccAbc..." autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} suffix={vendorSuffix} />
              </AutoComplete>
              <FieldHint text="Nếu có mã NCC, hệ thống sẽ tự gợi ý dữ liệu và xếp vào khu kho tự động khi được phép." />
              {awStatus === 'match' && <Alert className="mt-3" type="success" showIcon title="Kho tự động — NCC được phép vào kho" description={awVendorName || undefined} />}
            </Form.Item>
          </FieldFrame>
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
              {manualReferenceError && <Alert className="mt-3" type="error" showIcon title={manualReferenceError} action={<Button size="small" icon={<ReloadOutlined />} onClick={onRetryManualReferenceCode}>Thử lại</Button>} />}
              {fieldErrors.poNumber && <FieldError text={fieldErrors.poNumber} />}
            </Form.Item>
          </FieldFrame>
        </Form>
        <Typography.Text type="secondary" className="text-xs">Mã được tạo tự động, không cần nhập thủ công.</Typography.Text>
      </Card>
    </div>
  );
}
