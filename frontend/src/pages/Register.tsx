import { useBranding } from '../context/BrandingContext';
import SuccessScreen from '../features/register/components/SuccessScreen';
import { STEP_HINTS, STEP_TITLES } from '../features/register/constants';
import { useRegisterForm } from '../features/register/hooks/useRegisterForm';
import DriverInfoStep from '../features/register/steps/DriverInfoStep';
import ReviewSubmitStep from '../features/register/steps/ReviewSubmitStep';
import ScheduleStep from '../features/register/steps/ScheduleStep';
import UnitGoodsVehicleStep from '../features/register/steps/UnitGoodsVehicleStep';

export default function Register() {
  const {
    step,
    setStep,
    guideOpen,
    setGuideOpen,
    fieldErrors,
    submitting,
    submitError,
    success,
    form,
    rememberInfo,
    setRememberInfo,
    unitConfig,
    customGoodsTypes,
    slots,
    slotsMsg,
    slotsLoading,
    awStatus,
    awVendorName,
    showOtherTimeModal,
    setShowOtherTimeModal,
    contentRef,
    set,
    next,
    back,
    submit,
    resetForm,
  } = useRegisterForm();

  const { units: brandUnits } = useBranding();
  const slotMinutes = form.vehicleType === 'MOTORBIKE' ? unitConfig?.motorbikeSlotMinutes : unitConfig?.truckSlotMinutes;
  const maxPerSlot = form.vehicleType === 'MOTORBIKE' ? unitConfig?.motorbikeMaxPerSlot : unitConfig?.truckMaxPerSlot;

  if (success) return <SuccessScreen info={success} onReset={resetForm} />;

  return (
    <div className="flex flex-col min-h-screen bg-thiso-50">
      <div className="sticky top-0 z-20 bg-white border-b border-thiso-100 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="flex border-b border-thiso-100">
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black text-sky-600 border-b-2 border-sky-500">
              <span>📝</span> Đăng ký mới
            </div>
            <a
              href="/track"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-thiso-400 hover:text-thiso-700 hover:bg-thiso-50 transition-colors"
            >
              <span>📱</span> Theo dõi đơn
            </a>
          </div>

          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-bold text-thiso-800 leading-tight">{STEP_TITLES[step - 1]}</p>
              <span className="text-xs text-thiso-400">
                Bước <span className="font-black text-thiso-700">{step}</span>/4
              </span>
            </div>
            <div className="h-1 bg-thiso-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pt-5 pb-32 max-w-xl mx-auto w-full">
        <p className="text-sm text-thiso-400 mb-4">{STEP_HINTS[step - 1]}</p>

        {step === 1 && (
          <UnitGoodsVehicleStep
            form={form}
            fieldErrors={fieldErrors}
            guideOpen={guideOpen}
            onDismissGuide={() => setGuideOpen(false)}
            unitConfig={unitConfig}
            customGoodsTypes={customGoodsTypes}
            brandUnits={brandUnits}
            set={set}
          />
        )}

        {step === 2 && (
          <ScheduleStep
            form={form}
            fieldErrors={fieldErrors}
            unitConfig={unitConfig}
            slots={slots}
            slotsMsg={slotsMsg}
            slotsLoading={slotsLoading}
            slotMinutes={slotMinutes}
            maxPerSlot={maxPerSlot}
            showOtherTimeModal={showOtherTimeModal}
            setShowOtherTimeModal={setShowOtherTimeModal}
            set={set}
          />
        )}

        {step === 3 && (
          <DriverInfoStep
            form={form}
            fieldErrors={fieldErrors}
            rememberInfo={rememberInfo}
            setRememberInfo={setRememberInfo}
            awStatus={awStatus}
            awVendorName={awVendorName}
            set={set}
          />
        )}

        {step === 4 && (
          <ReviewSubmitStep
            form={form}
            brandUnits={brandUnits}
            awStatus={awStatus}
            awVendorName={awVendorName}
            submitError={submitError}
            set={set}
            setStep={setStep}
          />
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-thiso-100 px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        <div className="flex gap-3 max-w-xl mx-auto">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              className="h-12 px-5 rounded-xl border-2 border-thiso-200 text-thiso-600 font-bold text-sm hover:bg-thiso-50 transition-colors flex-shrink-0"
            >
              ← Quay lại
            </button>
          )}

          {step < 4 && (
            <button
              type="button"
              onClick={next}
              className="h-12 flex-1 rounded-xl bg-thiso-800 text-white font-bold text-base hover:bg-thiso-900 transition-colors active:scale-[0.98]"
            >
              Tiếp theo →
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-14 flex-1 rounded-xl bg-sky-600 text-white font-black text-base hover:bg-sky-700 transition-colors disabled:opacity-50 active:scale-[0.98] shadow-card-md"
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> Đang xử lý...</span>
                : '✓ Hoàn tất đăng ký'
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
