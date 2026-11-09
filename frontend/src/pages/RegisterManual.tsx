import { ArrowLeftOutlined, ArrowRightOutlined, EnvironmentOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Steps, theme, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useBranding } from '../context/BrandingContext';
import { usePublicBusinessLocation } from '../context/PublicBusinessLocationContext';
import { useThemeMode } from '../context/ThemeModeContext';
import SuccessScreen from '../features/register-manual/components/SuccessScreen';
import { REGISTER_FORM_NAME, STEP_HINTS, STEP_TITLES } from '../features/register-manual/constants';
import { useRegisterForm } from '../features/register-manual/hooks/useRegisterForm';
import DriverInfoStep from '../features/register-manual/steps/DriverInfoStep';
import ReviewSubmitStep from '../features/register-manual/steps/ReviewSubmitStep';
import ScheduleStep from '../features/register-manual/steps/ScheduleStep';
import UnitGoodsVehicleStep from '../features/register-manual/steps/UnitGoodsVehicleStep';
import type { FormState } from '../features/register-manual/types';

export default function RegisterManual() {
  const register = useRegisterForm();
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const { units: brandUnits } = useBranding();
  const { selectedBusinessLocation, isLoading: publicLocationLoading, error: publicLocationError } = usePublicBusinessLocation();
  const {
    antForm, step, submitting, submitError, success, form, rememberInfo, setRememberInfo,
    publicUnits, publicUnitsLoading, publicUnitsMsg, unitConfig, customGoodsTypes, dailyStats, dailyStatsMsg,
    dailyStatsLoading, manualReferenceLoading, manualReferenceError, vehicleAvailability, vehicleAvailabilityMsg,
    vehicleAvailabilityLoading, sundayFreshFoodBlocked, awStatus, awVendorName,
    contentRef, set, handleValuesChange, retryManualReferenceCode,
    next, back, editStepFromReview, submit, resetForm,
  } = register;

  if (success) return <SuccessScreen info={success} onReset={resetForm} />;

  const selectedLocationName = selectedBusinessLocation?.locationName ?? '';
  const progressStyle = {
    '--register-step-finish-color': mode === 'dark' ? token.colorSuccessHover : token.colorSuccess,
    '--register-step-finish-icon-color': token.colorTextLightSolid,
  } as CSSProperties;

  return (
    <main ref={contentRef} className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <Card className="overflow-hidden" styles={{ body: { padding: 0 } }}>
        <div className="border-b px-5 py-5 sm:px-7" style={{ borderColor: 'var(--ant-color-border-secondary)' }}>
          <Typography.Title level={2} className="!mb-1 !text-xl sm:!text-2xl">Đăng ký giao hàng thủ công</Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            Dùng khi mã PO hoặc mã Thi Công chưa thể xác thực từ hệ thống đối tác.
          </Typography.Paragraph>
          <div className="mt-4 flex items-center gap-2">
            <EnvironmentOutlined />
            <Typography.Text strong ellipsis>{selectedLocationName || 'Chưa chọn khu vực giao hàng'}</Typography.Text>
          </div>
        </div>

        <div className="register-progress px-5 pt-5 sm:px-7" style={progressStyle}>
          <Steps current={step - 1} size="small" responsive items={STEP_TITLES.map((title) => ({ title }))} />
        </div>

        <div className="space-y-4 px-5 py-6 sm:px-7">
          <Typography.Paragraph type="secondary" className="!mb-0">{STEP_HINTS[step - 1]}</Typography.Paragraph>

          {!selectedLocationName && !publicLocationLoading && (
            <Alert
              type="info"
              showIcon
              title="Hãy chọn khu vực giao hàng"
              description={publicLocationError ?? 'Dùng nút chọn khu vực ở góc dưới phải trước khi tiếp tục đăng ký.'}
            />
          )}

          <Form<FormState> form={antForm} name={REGISTER_FORM_NAME} layout="vertical" requiredMark={false} component="div" onValuesChange={handleValuesChange}>
            {step === 1 && <UnitGoodsVehicleStep form={form} publicUnits={publicUnits} publicUnitsLoading={publicUnitsLoading} publicUnitsMsg={publicUnitsMsg} unitConfig={unitConfig} customGoodsTypes={customGoodsTypes} vehicleAvailability={vehicleAvailability} vehicleAvailabilityMsg={vehicleAvailabilityMsg} vehicleAvailabilityLoading={vehicleAvailabilityLoading} brandUnits={brandUnits} hasPublicLocation={Boolean(selectedLocationName)} set={set} />}
            {step === 2 && <ScheduleStep form={form} dailyStats={dailyStats} dailyStatsMsg={dailyStatsMsg} dailyStatsLoading={dailyStatsLoading} manualReferenceLoading={manualReferenceLoading} manualReferenceError={manualReferenceError} sundayFreshFoodBlocked={sundayFreshFoodBlocked} set={set} onRetryManualReferenceCode={retryManualReferenceCode} />}
            {step === 3 && <DriverInfoStep form={form} rememberInfo={rememberInfo} setRememberInfo={setRememberInfo} />}
            {step === 4 && <ReviewSubmitStep form={form} unitConfig={unitConfig} brandUnits={brandUnits} locationName={selectedLocationName} awStatus={awStatus} awVendorName={awVendorName} submitError={submitError} onEditStep={editStepFromReview} />}
          </Form>

          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
            {step > 1 ? <Button size="large" icon={<ArrowLeftOutlined />} onClick={back}>Quay lại</Button> : <span />}
            {step < 4 && <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPlacement="end" onClick={next}>Tiếp theo</Button>}
            {step === 4 && <Button type="primary" size="large" icon={<SendOutlined />} loading={submitting} onClick={submit}>Hoàn tất đăng ký</Button>}
          </div>
        </div>
      </Card>
    </main>
  );
}
