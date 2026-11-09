import { Form } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePublicBusinessLocation } from '../../../context/PublicBusinessLocationContext';
import type { UnitConfig, UnitGoodsType } from '../../../lib/types';
import {
  checkAutoWarehouseVendor,
  createManualRegistrationCode,
  getDailyRegistrationStats,
  getAutoWarehouseVendorSuggestions,
  getPublicUnitConfigs,
  getUnitConfig,
  // getUnitGoodsTypes, ⛔ Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa
  getVehicleAvailability,
  registerDelivery,
  type DailyRegistrationStat,
  type DailyRegistrationStatsParams,
  type AutoWarehouseVendorSuggestion,
  type VehicleAvailabilityOption,
} from '../api';
import { LS_KEY, REGISTER_FORM_NAME } from '../constants';
import type { FormState, SuccessInfo, Unit } from '../types';
import { isSundayDate } from '../utils/date';

type ErrorField = { name: Array<string | number> };

function hasErrorFields(error: unknown): error is { errorFields: ErrorField[] } {
  return Array.isArray((error as { errorFields?: unknown })?.errorFields);
}

/** Cuộn tới field lỗi nằm cao nhất trên màn hình (không phụ thuộc thứ tự đăng ký field). */
function scrollToTopMostError(errorFields: ErrorField[]) {
  const targets = errorFields
    .map(({ name }) => document.getElementById(`${REGISTER_FORM_NAME}_${name.join('_')}`))
    .filter((node): node is HTMLElement => Boolean(node))
    .map((node) => ({ node, item: node.closest<HTMLElement>('.ant-form-item') ?? node }))
    .sort((a, b) => a.item.getBoundingClientRect().top - b.item.getBoundingClientRect().top);
  const first = targets[0];
  if (!first) return;
  first.item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (first.node instanceof HTMLInputElement || first.node instanceof HTMLTextAreaElement) {
    first.node.focus({ preventScroll: true });
  }
}

export function useRegisterForm() {
  const { selectedBusinessLocationId, selectedBusinessLocation } = usePublicBusinessLocation();
  const [antForm] = Form.useForm<FormState>();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [returnToReviewAfterEdit, setReturnToReviewAfterEdit] = useState(false);

  const [form, setForm] = useState<FormState>(() => {
    const saved = localStorage.getItem(LS_KEY);
    const prev = saved ? (JSON.parse(saved) as Partial<FormState>) : {};
    return {
      businessLocationId: '',
      unitConfigId: '',
      receivingUnit: '',
      goodsType: '',
      unitGoodsTypeId: '',
      vehicleType: '',
      vendorName: '',
      vendorCode: '',
      poNumber: '',
      driverName: prev.driverName ?? '',
      driverPhone: prev.driverPhone ?? '',
      vehiclePlate: prev.vehiclePlate ?? '',
      deliveryDate: '',
      timeSlot: '',
      note: '',
    };
  });

  const [rememberInfo, setRememberInfo] = useState(true);
  const [publicUnits, setPublicUnits] = useState<UnitConfig[]>([]);
  const [publicUnitsLoading, setPublicUnitsLoading] = useState(false);
  const [publicUnitsMsg, setPublicUnitsMsg] = useState('');
  const [unitConfig, setUnitConfig] = useState<UnitConfig | null>(null);
  const [customGoodsTypes, setCustomGoodsTypes] = useState<UnitGoodsType[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyRegistrationStat[]>([]);
  const [dailyStatsMsg, setDailyStatsMsg] = useState('');
  const [dailyStatsLoading, setDailyStatsLoading] = useState(false);
  const [vehicleAvailability, setVehicleAvailability] = useState<VehicleAvailabilityOption[]>([]);
  const [vehicleAvailabilityMsg, setVehicleAvailabilityMsg] = useState('');
  const [vehicleAvailabilityLoading, setVehicleAvailabilityLoading] = useState(false);
  const [awStatus, setAwStatus] = useState<'idle' | 'loading' | 'match' | 'nomatch'>('idle');
  const [awVendorName, setAwVendorName] = useState('');
  const [awVendorSuggestions, setAwVendorSuggestions] = useState<AutoWarehouseVendorSuggestion[]>([]);
  const [awVendorSuggestionsLoading, setAwVendorSuggestionsLoading] = useState(false);
  const [manualReferenceLoading, setManualReferenceLoading] = useState(false);
  const [manualReferenceError, setManualReferenceError] = useState('');
  const [manualReferenceRequest, setManualReferenceRequest] = useState(0);
  const awDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awSuggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sundayFreshFoodBlocked = Boolean(
    unitConfig?.sundayFreshFoodOnly
      && form.deliveryDate
      && isSundayDate(form.deliveryDate)
      && form.goodsType
      && form.goodsType !== 'FRESH_FOOD',
  );

  const selectedUnitScope = form.businessLocationId && form.unitConfigId
    ? { businessLocationId: form.businessLocationId, unitConfigId: form.unitConfigId }
    : undefined;

  const set = useCallback((key: keyof FormState, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
  }, []);

  /** Antd form -> state: giá trị người dùng nhập trực tiếp vào Form.Item (đã qua normalize). */
  const handleValuesChange = useCallback((changed: Partial<FormState>) => {
    setForm(f => ({ ...f, ...changed }));
  }, []);

  /** Xóa lỗi validate đang hiển thị (khi lùi bước, sửa từ review hoặc đổi khu vực). */
  const resetValidation = useCallback(() => {
    antForm.setFields(antForm.getFieldsError().map(({ name }) => ({ name: name[0] as keyof FormState, errors: [] as string[] })));
  }, [antForm]);

  /**
   * State -> antd form: đồng bộ các thay đổi lập trình (chọn thẻ, quét mã, reset, dữ liệu API)
   * và xóa lỗi của field vừa đổi. Field do người dùng gõ đã trùng giá trị nên được bỏ qua để
   * giữ nguyên kết quả validate onChange của antd.
   */
  useEffect(() => {
    if (success) return;
    const updates = (Object.keys(form) as Array<keyof FormState>)
      .filter((key) => antForm.getFieldValue(key) !== form[key])
      .map((key) => ({ name: key, value: form[key], errors: [] as string[] }));
    if (updates.length) antForm.setFields(updates);
  }, [antForm, form, success]);

  useEffect(() => {
    setStep((current) => current > 1 ? 1 : current);
    resetValidation();
    setSubmitError('');
    setReturnToReviewAfterEdit(false);
    setForm((current) => {
      const businessLocationId = selectedBusinessLocationId ?? '';
      if (current.businessLocationId === businessLocationId) return current;
      return {
        ...current,
        businessLocationId,
        unitConfigId: '',
        receivingUnit: '',
        goodsType: '',
        unitGoodsTypeId: '',
        vehicleType: '',
        timeSlot: '',
      };
    });
  }, [resetValidation, selectedBusinessLocationId]);

  useEffect(() => {
    if (!form.businessLocationId) {
      setPublicUnits([]);
      setPublicUnitsMsg('');
      setForm((current) => ({
        ...current,
        unitConfigId: '',
        receivingUnit: '',
        goodsType: '',
        unitGoodsTypeId: '',
        vehicleType: '',
        timeSlot: '',
      }));
      return;
    }

    setPublicUnitsLoading(true);
    setPublicUnitsMsg('');
    getPublicUnitConfigs(form.businessLocationId)
      .then((units) => {
        setPublicUnits(units);
        setForm((current) => {
          if (current.businessLocationId !== form.businessLocationId) return current;
          if (units.some((unit) => unit.id === current.unitConfigId)) return current;
          return {
            ...current,
            unitConfigId: '',
            receivingUnit: '',
            goodsType: '',
            unitGoodsTypeId: '',
            vehicleType: '',
            timeSlot: '',
          };
        });
        if (units.length === 0) setPublicUnitsMsg('Khu vực này chưa có đơn vị nhận hàng đang hoạt động.');
      })
      .catch(() => {
        setPublicUnits([]);
        setPublicUnitsMsg('Không thể tải danh sách đơn vị. Vui lòng thử lại.');
      })
      .finally(() => setPublicUnitsLoading(false));
  }, [form.businessLocationId]);

  useEffect(() => {
    if (!form.receivingUnit || !selectedUnitScope) {
      setUnitConfig(null);
      setCustomGoodsTypes([]);
      setVehicleAvailability([]);
      setVehicleAvailabilityMsg('');
      return;
    }
    getUnitConfig(form.receivingUnit, selectedUnitScope).then(setUnitConfig).catch(() => {});
    // ⛔ Tính năng thêm loại hàng (unit_goods_types) đang tạm khóa — chỉ dùng 3 loại mặc định từ enum GoodsType.
    // getUnitGoodsTypes(form.receivingUnit, selectedUnitScope).then(setCustomGoodsTypes).catch(() => setCustomGoodsTypes([]));
    setCustomGoodsTypes([]);
  }, [form.receivingUnit, form.businessLocationId, form.unitConfigId]);

  useEffect(() => {
    if (step !== 2 || form.deliveryDate) return;

    let cancelled = false;
    setManualReferenceLoading(true);
    setManualReferenceError('');
    createManualRegistrationCode()
      .then(({ deliveryDate }) => {
        if (cancelled) return;
        setForm((current) => ({ ...current, deliveryDate }));
        setManualReferenceLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setManualReferenceError('Không thể xác định ngày giao hàng. Vui lòng thử lại.');
          setManualReferenceLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [step, form.deliveryDate, manualReferenceRequest]);

  useEffect(() => {
    if (!form.receivingUnit || !form.goodsType || !selectedUnitScope) {
      setVehicleAvailability([]);
      setVehicleAvailabilityMsg('');
      return;
    }

    setVehicleAvailability([]);
    setVehicleAvailabilityMsg('');
    setVehicleAvailabilityLoading(true);
    const params = {
      goodsType: form.goodsType,
      ...(form.unitGoodsTypeId ? { unitGoodsTypeId: form.unitGoodsTypeId } : {}),
    };

    getVehicleAvailability(form.receivingUnit, params, selectedUnitScope)
      .then(data => {
        const vehicles = data.vehicles ?? [];
        setVehicleAvailability(vehicles);
        setVehicleAvailabilityMsg(data.reason ?? '');
        if (form.vehicleType && !vehicles.some(v => v.vehicleType === form.vehicleType)) {
          setForm(f => ({ ...f, vehicleType: '' }));
        }
      })
      .catch(() => setVehicleAvailabilityMsg('Không thể tải loại phương tiện khả dụng. Vui lòng thử lại.'))
      .finally(() => setVehicleAvailabilityLoading(false));
  }, [form.receivingUnit, form.businessLocationId, form.unitConfigId, form.goodsType, form.unitGoodsTypeId]);

  useEffect(() => {
    if (step !== 2 || !form.receivingUnit || !selectedUnitScope || !form.goodsType || !form.vehicleType || !form.deliveryDate) return;
    let cancelled = false;
    setDailyStatsLoading(true);
    setDailyStatsMsg('');
    setDailyStats([]);
    setForm(f => ({ ...f, timeSlot: '' }));
    const statsParams: DailyRegistrationStatsParams = {
      month: form.deliveryDate.slice(0, 7),
      goodsType: form.goodsType,
      vehicleType: form.vehicleType,
    };
    if (form.unitGoodsTypeId) statsParams.unitGoodsTypeId = form.unitGoodsTypeId;
    getDailyRegistrationStats(form.receivingUnit, statsParams, selectedUnitScope)
      .then(data => { if (!cancelled) { setDailyStats(data.days ?? []); if (data.reason) setDailyStatsMsg(data.reason); } })
      .catch(() => { if (!cancelled) setDailyStatsMsg('Không thể tải thông tin ngày đăng ký. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setDailyStatsLoading(false); });
    return () => { cancelled = true; };
  }, [step, form.receivingUnit, form.businessLocationId, form.unitConfigId, form.goodsType, form.vehicleType, form.deliveryDate, form.unitGoodsTypeId]);

  useEffect(() => {
    if (awDebounceRef.current) clearTimeout(awDebounceRef.current);
    if (!form.vendorCode?.trim() || !form.receivingUnit || !selectedUnitScope) {
      setAwStatus('idle');
      setAwVendorName('');
      return;
    }
    if (form.vendorCode.trim().length < 2) {
      setAwStatus('idle');
      return;
    }
    const vendorCode = form.vendorCode;
    const receivingUnit = form.receivingUnit;
    const scope = selectedUnitScope;
    setAwStatus('loading');
    let cancelled = false;
    awDebounceRef.current = setTimeout(async () => {
      try {
        const res = await checkAutoWarehouseVendor(vendorCode, receivingUnit, scope);
        if (cancelled) return;
        if (res.isAutoWarehouse) {
          setAwStatus('match');
          setAwVendorName(res.vendor?.vendorName ?? '');
        } else {
          setAwStatus('nomatch');
          setAwVendorName('');
        }
      } catch {
        if (!cancelled) setAwStatus('idle');
      }
    }, 600);
    return () => {
      cancelled = true;
      if (awDebounceRef.current) clearTimeout(awDebounceRef.current);
    };
  }, [form.vendorCode, form.receivingUnit, form.businessLocationId, form.unitConfigId]);

  useEffect(() => {
    if (awSuggestionsDebounceRef.current) clearTimeout(awSuggestionsDebounceRef.current);
    const query = form.vendorCode.trim();
    if (query.length < 2 || !form.businessLocationId || !form.unitConfigId) {
      setAwVendorSuggestions([]);
      setAwVendorSuggestionsLoading(false);
      return;
    }

    const scope = {
      businessLocationId: form.businessLocationId,
      unitConfigId: form.unitConfigId,
    };
    let cancelled = false;
    setAwVendorSuggestionsLoading(true);
    awSuggestionsDebounceRef.current = setTimeout(async () => {
      try {
        const vendors = await getAutoWarehouseVendorSuggestions(query, scope);
        if (!cancelled) setAwVendorSuggestions(vendors);
      } catch {
        if (!cancelled) setAwVendorSuggestions([]);
      } finally {
        if (!cancelled) setAwVendorSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      if (awSuggestionsDebounceRef.current) clearTimeout(awSuggestionsDebounceRef.current);
    };
  }, [form.vendorCode, form.businessLocationId, form.unitConfigId]);

  useEffect(() => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  /** Validate các Form.Item đang hiển thị của step hiện tại theo `rules`; lỗi thì cuộn tới field cao nhất. */
  async function validateStep(): Promise<boolean> {
    try {
      await antForm.validateFields();
      return true;
    } catch (error) {
      if (hasErrorFields(error)) window.setTimeout(() => scrollToTopMostError(error.errorFields), 0);
      return false;
    }
  }

  async function next() {
    if (!(await validateStep())) return;
    if (rememberInfo && step === 3) {
      localStorage.setItem(LS_KEY, JSON.stringify({
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        vehiclePlate: form.vehiclePlate,
        vendorName: form.vendorName,
        vendorCode: form.vendorCode,
      }));
    }
    if (returnToReviewAfterEdit) {
      setReturnToReviewAfterEdit(false);
      setStep(4);
      return;
    }
    setStep(s => Math.min(s + 1, 4));
  }

  function back() {
    resetValidation();
    setSubmitError('');
    setReturnToReviewAfterEdit(false);
    setStep(s => Math.max(s - 1, 1));
  }

  function editStepFromReview(targetStep: 1 | 2 | 3) {
    resetValidation();
    setSubmitError('');
    setReturnToReviewAfterEdit(true);
    setStep(targetStep);
  }

  async function submit() {
    if (!(await validateStep())) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const plate = form.vehiclePlate.toUpperCase().replace(/\s+/g, '');
      const poNumber = form.poNumber.trim();
      const selectedCustomType = customGoodsTypes.find(ct => ct.id === form.unitGoodsTypeId);
      const res = await registerDelivery({
        businessLocationId: form.businessLocationId,
        unitConfigId: form.unitConfigId,
        vendorName: '',
        manualRegistration: true,
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        vehiclePlate: plate,
        vehicleType: form.vehicleType,
        receivingUnit: form.receivingUnit,
        goodsType: form.goodsType,
        unitGoodsTypeId: form.unitGoodsTypeId || undefined,
        poNumber,
        deliveryDate: form.deliveryDate,
        note: form.note || undefined,
      });
      setSuccess({
        code: res.registrationCode,
        referenceCode: poNumber,
        vehiclePlate: plate,
        vendorName: '',
        driverName: form.driverName,
        receivingUnit: form.receivingUnit as Unit,
        unitDisplayName: unitConfig?.displayName || unitConfig?.shortName || form.receivingUnit,
        unitIcon: unitConfig?.icon || '',
        unitLogoUrl: unitConfig?.logoUrl ?? null,
        goodsType: res.goodsType,
        goodsTypeName: res.goodsType !== 'AUTO_WAREHOUSE' && selectedCustomType ? `${selectedCustomType.emoji} ${selectedCustomType.name}` : '',
        vehicleType: form.vehicleType,
        requestedTime: form.deliveryDate.split('-').reverse().join('/'),
        locationName: selectedBusinessLocation?.locationName ?? '',
      });
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setSubmitError(d?.message ?? d?.error ?? 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSuccess(null);
    setStep(1);
    setSubmitError('');
    setReturnToReviewAfterEdit(false);
    setAwStatus('idle');
    setAwVendorName('');
    setManualReferenceLoading(false);
    setManualReferenceError('');
    setForm(f => ({
      ...f,
      businessLocationId: selectedBusinessLocationId ?? '',
      unitConfigId: '',
      receivingUnit: '',
      goodsType: '',
      unitGoodsTypeId: '',
      vehicleType: '',
      deliveryDate: '',
      timeSlot: '',
      note: '',
      poNumber: '',
      vendorCode: '',
    }));
  }

  const retryManualReferenceCode = useCallback(() => {
    setManualReferenceRequest((current) => current + 1);
  }, []);

  const selectAutoWarehouseVendor = useCallback((vendor: AutoWarehouseVendorSuggestion) => {
    set('vendorCode', vendor.vendorCode);
    set('vendorName', vendor.vendorName);
  }, [set]);

  return {
    antForm,
    step,
    submitting,
    submitError,
    success,
    form,
    publicUnits,
    publicUnitsLoading,
    publicUnitsMsg,
    rememberInfo,
    setRememberInfo,
    unitConfig,
    customGoodsTypes,
    dailyStats,
    dailyStatsMsg,
    dailyStatsLoading,
    manualReferenceLoading,
    manualReferenceError,
    vehicleAvailability,
    vehicleAvailabilityMsg,
    vehicleAvailabilityLoading,
    sundayFreshFoodBlocked,
    awStatus,
    awVendorName,
    awVendorSuggestions,
    awVendorSuggestionsLoading,
    contentRef,
    set,
    handleValuesChange,
    retryManualReferenceCode,
    selectAutoWarehouseVendor,
    next,
    back,
    editStepFromReview,
    submit,
    resetForm,
  };
}
