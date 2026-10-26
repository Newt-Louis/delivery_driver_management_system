import { ArrowLeftOutlined, ArrowRightOutlined, EnvironmentOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Steps, theme, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { useBranding } from '../context/BrandingContext';
import { usePublicBusinessLocation } from '../context/PublicBusinessLocationContext';
import { useThemeMode } from '../context/ThemeModeContext';
import SuccessScreen from '../features/register/components/SuccessScreen';
import { STEP_HINTS, STEP_TITLES } from '../features/register/constants';
import { useRegisterForm } from '../features/register/hooks/useRegisterForm';
import DriverInfoStep from '../features/register/steps/DriverInfoStep';
import ReviewSubmitStep from '../features/register/steps/ReviewSubmitStep';
import ScheduleStep from '../features/register/steps/ScheduleStep';
import UnitGoodsVehicleStep from '../features/register/steps/UnitGoodsVehicleStep';

function canAdvance(step: number, form: ReturnType<typeof useRegisterForm>['form'], sundayFreshFoodBlocked: boolean, manualReferenceLoading: boolean) {
  if (step === 1) return Boolean(form.businessLocationId && form.unitConfigId && form.receivingUnit && form.goodsType && form.vehicleType);
  if (step === 2) return Boolean(form.deliveryDate && form.vendorName.trim() && form.poNumber && !sundayFreshFoodBlocked && !manualReferenceLoading);
  if (step === 3) return Boolean(form.vehiclePlate.trim() && form.driverPhone.replace(/\D/g, '').length >= 9);
  return true;
}

export default function Register() {
  const register = useRegisterForm();
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const { units: brandUnits } = useBranding();
  const { selectedBusinessLocation, isLoading: publicLocationLoading, error: publicLocationError } = usePublicBusinessLocation();
  const {
    step, fieldErrors, highlightedField, submitting, submitError, success, form, rememberInfo, setRememberInfo,
    publicUnits, publicUnitsLoading, publicUnitsMsg, unitConfig, customGoodsTypes, dailyStats, dailyStatsMsg,
    dailyStatsLoading, manualReferenceLoading, manualReferenceError, vehicleAvailability, vehicleAvailabilityMsg,
    vehicleAvailabilityLoading, sundayFreshFoodBlocked, awStatus, awVendorName, awVendorSuggestions,
    awVendorSuggestionsLoading, contentRef, set, retryManualReferenceCode, selectAutoWarehouseVendor,
    next, back, editStepFromReview, submit, resetForm,
  } = register;

  if (success) return <SuccessScreen info={success} onReset={resetForm} />;

  const readyForNext = canAdvance(step, form, sundayFreshFoodBlocked, manualReferenceLoading);
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
              message="Hãy chọn khu vực giao hàng"
              description={publicLocationError ?? 'Dùng nút chọn khu vực ở góc dưới phải trước khi tiếp tục đăng ký.'}
            />
          )}

          {step === 1 && <UnitGoodsVehicleStep form={form} fieldErrors={fieldErrors} highlightedField={highlightedField} publicUnits={publicUnits} publicUnitsLoading={publicUnitsLoading} publicUnitsMsg={publicUnitsMsg} unitConfig={unitConfig} customGoodsTypes={customGoodsTypes} vehicleAvailability={vehicleAvailability} vehicleAvailabilityMsg={vehicleAvailabilityMsg} vehicleAvailabilityLoading={vehicleAvailabilityLoading} brandUnits={brandUnits} hasPublicLocation={Boolean(selectedLocationName)} set={set} />}
          {step === 2 && <ScheduleStep form={form} fieldErrors={fieldErrors} highlightedField={highlightedField} dailyStats={dailyStats} dailyStatsMsg={dailyStatsMsg} dailyStatsLoading={dailyStatsLoading} manualReferenceLoading={manualReferenceLoading} manualReferenceError={manualReferenceError} sundayFreshFoodBlocked={sundayFreshFoodBlocked} sundayFreshFoodOnly={Boolean(unitConfig?.sundayFreshFoodOnly)} awStatus={awStatus} awVendorName={awVendorName} awVendorSuggestions={awVendorSuggestions} awVendorSuggestionsLoading={awVendorSuggestionsLoading} set={set} onRetryManualReferenceCode={retryManualReferenceCode} onSelectAutoWarehouseVendor={selectAutoWarehouseVendor} />}
          {step === 3 && <DriverInfoStep form={form} fieldErrors={fieldErrors} highlightedField={highlightedField} rememberInfo={rememberInfo} setRememberInfo={setRememberInfo} set={set} />}
          {step === 4 && <ReviewSubmitStep form={form} unitConfig={unitConfig} brandUnits={brandUnits} locationName={selectedLocationName} awStatus={awStatus} awVendorName={awVendorName} submitError={submitError} set={set} onEditStep={editStepFromReview} />}

          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
            {step > 1 ? <Button size="large" icon={<ArrowLeftOutlined />} onClick={back}>Quay lại</Button> : <span />}
            {step < 4 && readyForNext && <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPosition="end" onClick={next}>Tiếp theo</Button>}
            {step === 4 && <Button type="primary" size="large" icon={<SendOutlined />} loading={submitting} onClick={submit}>Hoàn tất đăng ký</Button>}
          </div>
        </div>
      </Card>
    </main>
  );
}
