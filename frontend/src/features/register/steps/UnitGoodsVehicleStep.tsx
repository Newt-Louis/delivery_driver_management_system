import { UNIT_FALLBACKS, type UnitBranding } from '../../../context/BrandingContext';
import type { BusinessLocation, UnitConfig, UnitGoodsType } from '../../../lib/types';
import type { VehicleAvailabilityOption } from '../api';
import FieldFrame from '../components/FieldFrame';
import ProcessGuide from '../components/ProcessGuide';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import { VEHICLE_INFO } from '../constants';
import { unitFallbackColor } from '../../../lib/unitPresentation';
import type { FormState, RegisterFieldErrors, SetFormField, Unit } from '../types';

type UnitGoodsVehicleStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  highlightedField: keyof FormState | null;
  guideOpen: boolean;
  onDismissGuide: () => void;
  publicLocations: BusinessLocation[];
  publicLocationsLoading: boolean;
  publicLocationsMsg: string;
  publicUnits: UnitConfig[];
  publicUnitsLoading: boolean;
  publicUnitsMsg: string;
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
  publicLocations,
  publicLocationsLoading,
  publicLocationsMsg,
  publicUnits,
  publicUnitsLoading,
  publicUnitsMsg,
  unitConfig,
  customGoodsTypes,
  vehicleAvailability,
  vehicleAvailabilityMsg,
  vehicleAvailabilityLoading,
  brandUnits,
  set,
}: UnitGoodsVehicleStepProps) {
  const selectedLocation = publicLocations.find((location) => location.id === form.businessLocationId);

  function unitBrand(unitConfig: UnitConfig) {
    const legacyBrand = brandUnits[unitConfig.unit] ?? UNIT_FALLBACKS[unitConfig.unit];
    return {
      displayName: unitConfig.displayName || legacyBrand?.displayName || unitConfig.unit,
      description: unitConfig.description || legacyBrand?.description || unitConfig.shortName || unitConfig.unit,
      logoUrl: unitConfig.logoUrl ?? legacyBrand?.logoUrl ?? null,
      icon: unitConfig.icon || legacyBrand?.icon || '◆',
    };
  }

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

      <FieldFrame field="businessLocationId" highlightedField={highlightedField}>
        <p className="label">Bạn giao hàng tại khu vực nào? <span className="text-red-400">*</span></p>
        {publicLocationsLoading && (
          <div className="p-3.5 rounded-xl border border-thiso-100 bg-white text-sm text-thiso-400">
            Đang tải khu vực giao hàng...
          </div>
        )}
        {!publicLocationsLoading && publicLocations.length > 0 && (
          <div className="space-y-2.5">
            {publicLocations.map((location) => {
              const active = form.businessLocationId === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => {
                    set('businessLocationId', location.id);
                    set('unitConfigId', '');
                    set('receivingUnit', '');
                    set('goodsType', '');
                    set('unitGoodsTypeId', '');
                    set('vehicleType', '');
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    active
                      ? 'border-thiso-700 bg-thiso-50 shadow-card-md'
                      : 'border-thiso-200 bg-white hover:border-thiso-300'
                  }`}
                >
                  {location.logoUrl ? (
                    <img src={location.logoUrl} alt={location.locationName} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-white p-1 border border-thiso-100" />
                  ) : (
                    <span className="w-10 h-10 rounded-xl bg-thiso-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                      {location.code.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-base ${active ? 'text-thiso-900' : 'text-thiso-800'}`}>{location.locationName}</p>
                    <p className="text-xs text-thiso-400 mt-0.5">{location.address || location.code}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${active ? 'border-thiso-700' : 'border-thiso-200'}`}>
                    {active && <div className="w-full h-full rounded-full bg-thiso-700 opacity-60" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {!publicLocationsLoading && publicLocations.length === 0 && (
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
            {publicLocationsMsg || 'Chưa có khu vực giao hàng đang hoạt động.'}
          </div>
        )}
        {fieldErrors.businessLocationId && <FieldError text={fieldErrors.businessLocationId} />}
      </FieldFrame>

      <FieldFrame field="receivingUnit" highlightedField={highlightedField}>
        <p className="label">Bạn giao hàng đến đâu? <span className="text-red-400">*</span></p>
        {!form.businessLocationId && (
          <div className="p-3.5 rounded-xl border border-thiso-100 bg-white text-sm text-thiso-400">
            Chọn khu vực giao hàng trước để xem đơn vị nhận hàng.
          </div>
        )}
        {form.businessLocationId && publicUnitsLoading && (
          <div className="p-3.5 rounded-xl border border-thiso-100 bg-white text-sm text-thiso-400">
            Đang tải đơn vị nhận hàng...
          </div>
        )}
        {form.businessLocationId && !publicUnitsLoading && publicUnits.length > 0 && (
          <div className="space-y-2.5">
            {publicUnits.map((unitConfig) => {
            const brand = unitBrand(unitConfig);
            const active = form.unitConfigId === unitConfig.id;
            const color = unitConfig.primaryColor || unitFallbackColor(unitConfig.unit);
            return (
              <button
                key={unitConfig.id}
                type="button"
                onClick={() => {
                  set('unitConfigId', unitConfig.id);
                  set('receivingUnit', unitConfig.unit);
                  set('goodsType', '');
                  set('unitGoodsTypeId', '');
                  set('vehicleType', '');
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                  ${active
                    ? 'shadow-card-md bg-white'
                    : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                style={active ? { borderColor: color, backgroundColor: `${color}10` } : undefined}
              >
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.displayName} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-white p-1 border border-thiso-100" />
                ) : (
                  <span className="text-3xl flex-shrink-0">{brand.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-thiso-800" style={active ? { color } : undefined}>{brand.displayName}</p>
                  <p className="text-xs text-thiso-400 mt-0.5">{brand.description}</p>
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all border-thiso-200"
                  style={active ? { borderColor: color, color } : undefined}
                >
                  {active && <div className="w-full h-full rounded-full bg-current opacity-60" />}
                </div>
              </button>
            );
          })}
        </div>
        )}
        {form.businessLocationId && !publicUnitsLoading && publicUnits.length === 0 && (
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
            {publicUnitsMsg || `${selectedLocation?.locationName ?? 'Khu vực này'} chưa có đơn vị nhận hàng đang hoạt động.`}
          </div>
        )}
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
