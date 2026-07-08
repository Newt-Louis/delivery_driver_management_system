import { UNIT_FALLBACKS, type UnitBranding } from '../../../context/BrandingContext';
import type { UnitConfig, UnitGoodsType } from '../../../lib/types';
import type { VehicleAvailabilityOption } from '../api';
import FieldFrame from '../components/FieldFrame';
import ProcessGuide from '../components/ProcessGuide';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import { UNIT_STYLE, VEHICLE_INFO } from '../constants';
import type { FormState, RegisterFieldErrors, SetFormField, Unit } from '../types';

type UnitGoodsVehicleStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  highlightedField: keyof FormState | null;
  guideOpen: boolean;
  onDismissGuide: () => void;
  unitConfig: UnitConfig | null;
  customGoodsTypes: UnitGoodsType[];
  vehicleAvailability: VehicleAvailabilityOption[];
  vehicleAvailabilityMsg: string;
  vehicleAvailabilityLoading: boolean;
  brandUnits: Record<Unit, UnitBranding>;
  set: SetFormField;
};

export default function UnitGoodsVehicleStep({
  form,
  fieldErrors,
  highlightedField,
  guideOpen,
  onDismissGuide,
  unitConfig,
  customGoodsTypes,
  vehicleAvailability,
  vehicleAvailabilityMsg,
  vehicleAvailabilityLoading,
  brandUnits,
  set,
}: UnitGoodsVehicleStepProps) {
  return (
    <div className="space-y-5">
      <a
        href="/track"
        className="flex items-center gap-3 p-3.5 bg-thiso-800 rounded-2xl text-white active:opacity-80 transition-opacity"
      >
        <span className="text-2xl flex-shrink-0">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Đã đăng ký rồi?</p>
          <p className="text-thiso-300 text-xs mt-0.5">Theo dõi đơn hoặc tra cứu bằng biển số xe</p>
        </div>
        <span className="text-thiso-400 text-lg flex-shrink-0">›</span>
      </a>

      {guideOpen && <ProcessGuide onDismiss={onDismissGuide} />}

      <FieldFrame field="receivingUnit" highlightedField={highlightedField}>
        <p className="label">Bạn giao hàng đến đâu? <span className="text-red-400">*</span></p>
        <div className="space-y-2.5">
          {(['EMART', 'THISKYHALL', 'TENANT'] as Unit[]).map((u) => {
            const style = UNIT_STYLE[u];
            const brand = brandUnits[u] ?? UNIT_FALLBACKS[u];
            const fb = UNIT_FALLBACKS[u];
            const active = form.receivingUnit === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => { set('receivingUnit', u); set('goodsType', ''); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                  ${active
                    ? `${style.activeBorder} ${style.activeBg} shadow-card-md`
                    : `${style.border} ${style.bg} hover:border-thiso-300`}`}
              >
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.displayName} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-white p-1 border border-thiso-100" />
                ) : (
                  <span className="text-3xl flex-shrink-0">{brand.icon || fb.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-base ${active ? style.activeText : 'text-thiso-800'}`}>{brand.displayName}</p>
                  <p className="text-xs text-thiso-400 mt-0.5">{brand.description || fb.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all
                  ${active ? style.activeBorder : 'border-thiso-200'}`}>
                  {active && <div className="w-full h-full rounded-full bg-current opacity-60" />}
                </div>
              </button>
            );
          })}
        </div>
        {fieldErrors.receivingUnit && <FieldError text={fieldErrors.receivingUnit} />}
      </FieldFrame>

      {form.receivingUnit && (
        <FieldFrame field="goodsType" highlightedField={highlightedField} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="label">Loại hàng bạn giao <span className="text-red-400">*</span></p>
          {!unitConfig && <p className="text-xs text-thiso-400 py-2">Đang tải...</p>}
          {unitConfig && (
            customGoodsTypes.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {customGoodsTypes.map(ct => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => { set('goodsType', ct.baseType); set('unitGoodsTypeId', ct.id); set('vehicleType', ''); }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all
                      ${form.unitGoodsTypeId === ct.id
                        ? 'border-sky-400 bg-sky-50 shadow-card-md'
                        : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                  >
                    <div className="text-2xl mb-2">{ct.emoji}</div>
                    <p className="font-bold text-sm text-thiso-800">{ct.name}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {unitConfig.freshFoodEnabled && (
                  <button
                    type="button"
                    onClick={() => { set('goodsType', 'FRESH_FOOD'); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all
                      ${form.goodsType === 'FRESH_FOOD' && !form.unitGoodsTypeId
                        ? 'border-sky-400 bg-sky-50 shadow-card-md'
                        : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                  >
                    <div className="text-2xl mb-2">🥬</div>
                    <p className="font-bold text-sm text-thiso-800">Hàng tươi sống</p>
                    {unitConfig.sundayFreshFoodOnly && (
                      <span className="inline-block mt-1 text-[10px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">Cả Chủ nhật</span>
                    )}
                  </button>
                )}
                {unitConfig.generalGoodsEnabled && (
                  <button
                    type="button"
                    onClick={() => { set('goodsType', 'GENERAL_GOODS'); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all
                      ${form.goodsType === 'GENERAL_GOODS' && !form.unitGoodsTypeId
                        ? 'border-thiso-500 bg-thiso-100 shadow-card-md'
                        : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                  >
                    <div className="text-2xl mb-2">📦</div>
                    <p className="font-bold text-sm text-thiso-800">Hàng thường</p>
                    {unitConfig.sundayFreshFoodOnly && (
                      <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Không nhận CN</span>
                    )}
                  </button>
                )}
                {unitConfig.thiCongEnabled && (
                  <button
                    type="button"
                    onClick={() => { set('goodsType', 'THI_CONG'); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all
                      ${form.goodsType === 'THI_CONG' && !form.unitGoodsTypeId
                        ? 'border-amber-400 bg-amber-50 shadow-card-md'
                        : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                  >
                    <div className="text-2xl mb-2">🔨</div>
                    <p className="font-bold text-sm text-thiso-800">Thi công</p>
                    <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Công trình</span>
                  </button>
                )}
              </div>
            )
          )}
          {fieldErrors.goodsType && <FieldError text={fieldErrors.goodsType} />}
        </FieldFrame>
      )}

      {form.goodsType && (
        <FieldFrame field="vehicleType" highlightedField={highlightedField} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="label">Loại phương tiện <span className="text-red-400">*</span></p>
          {vehicleAvailabilityLoading && (
            <div className="p-3.5 rounded-xl border border-thiso-100 bg-white text-sm text-thiso-400">
              Đang kiểm tra slot phù hợp...
            </div>
          )}
          {!vehicleAvailabilityLoading && vehicleAvailability.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {vehicleAvailability.map(({ vehicleType }) => {
                const info = VEHICLE_INFO[vehicleType];
                const active = form.vehicleType === vehicleType;
                return (
                  <button
                    key={vehicleType}
                    type="button"
                    onClick={() => set('vehicleType', vehicleType)}
                    className={`p-3.5 rounded-2xl border-2 text-center transition-all
                      ${active
                        ? `${info.activeBorder} ${info.activeBg} shadow-card-md scale-[1.03]`
                        : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                  >
                    <div className="text-2xl mb-1.5">{info.icon}</div>
                    <p className="font-bold text-xs text-thiso-800">{info.label}</p>
                  </button>
                );
              })}
            </div>
          )}
          {!vehicleAvailabilityLoading && vehicleAvailability.length === 0 && (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
              {vehicleAvailabilityMsg || 'Không có slot phù hợp cho loại hàng này.'}
            </div>
          )}
          <FieldHint text={form.vehicleType && VEHICLE_INFO[form.vehicleType] ? VEHICLE_INFO[form.vehicleType].hint : 'Chọn đúng loại để hệ thống xếp đúng bãi'} />
          {fieldErrors.vehicleType && <FieldError text={fieldErrors.vehicleType} />}
        </FieldFrame>
      )}
    </div>
  );
}
