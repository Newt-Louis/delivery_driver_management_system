import { useCallback, useEffect, useRef, useState } from 'react';
import type { BusinessLocation, SlotInfo, UnitConfig, UnitGoodsType } from '../../../lib/types';
import {
  checkAutoWarehouseVendor,
  getPublicBusinessLocations,
  getPublicUnitConfigs,
  getSlotAvailability,
  getOrderCodes,
  getUnitConfig,
  getUnitGoodsTypes,
  getVehicleAvailability,
  registerDelivery,
  type OrderCodeOption,
  type SlotAvailabilityParams,
  type VehicleAvailabilityOption,
} from '../api';
import { LS_KEY } from '../constants';
import type { FormState, RegisterFieldErrors, SuccessInfo, Unit } from '../types';
import { isSundayDate, todayDate } from '../utils/date';

const REQUIRED_FIELDS_BY_STEP: Record<number, Array<keyof FormState>> = {
  1: ['businessLocationId', 'receivingUnit', 'goodsType', 'vehicleType'],
  2: ['timeSlot', 'vendorName', 'poNumber'],
   3: ['vehiclePlate', 'driverPhone'],
  4: [],
};

export function useRegisterForm() {
  const [step, setStep] = useState(1);
  const [guideOpen, setGuideOpen] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [returnToReviewAfterEdit, setReturnToReviewAfterEdit] = useState(false);
  const [highlightedField, setHighlightedField] = useState<keyof FormState | null>(null);

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
      vendorName: prev.vendorName ?? '',
      vendorCode: prev.vendorCode ?? '',
      poNumber: '',
      driverName: prev.driverName ?? '',
      driverPhone: prev.driverPhone ?? '',
      vehiclePlate: prev.vehiclePlate ?? '',
      deliveryDate: todayDate(),
      timeSlot: '',
      note: '',
    };
  });

  const [rememberInfo, setRememberInfo] = useState(true);
  const [publicLocations, setPublicLocations] = useState<BusinessLocation[]>([]);
  const [publicLocationsLoading, setPublicLocationsLoading] = useState(false);
  const [publicLocationsMsg, setPublicLocationsMsg] = useState('');
  const [publicUnits, setPublicUnits] = useState<UnitConfig[]>([]);
  const [publicUnitsLoading, setPublicUnitsLoading] = useState(false);
  const [publicUnitsMsg, setPublicUnitsMsg] = useState('');
  const [unitConfig, setUnitConfig] = useState<UnitConfig | null>(null);
  const [customGoodsTypes, setCustomGoodsTypes] = useState<UnitGoodsType[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsMsg, setSlotsMsg] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [orderCodes, setOrderCodes] = useState<OrderCodeOption[]>([]);
  const [orderCodesLoading, setOrderCodesLoading] = useState(false);
  const [vehicleAvailability, setVehicleAvailability] = useState<VehicleAvailabilityOption[]>([]);
  const [vehicleAvailabilityMsg, setVehicleAvailabilityMsg] = useState('');
  const [vehicleAvailabilityLoading, setVehicleAvailabilityLoading] = useState(false);
  const [awStatus, setAwStatus] = useState<'idle' | 'loading' | 'match' | 'nomatch'>('idle');
  const [awVendorName, setAwVendorName] = useState('');
  const awDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOtherTimeModal, setShowOtherTimeModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sundayFreshFoodBlocked = Boolean(
    unitConfig?.sundayFreshFoodOnly
      && form.deliveryDate
      && isSundayDate(form.deliveryDate)
      && form.goodsType
      && form.goodsType !== 'FRESH_FOOD',
  );

  const validOrderCodes = new Set(orderCodes.map((item) => item.code));
  const selectedUnitScope = form.businessLocationId && form.unitConfigId
    ? { businessLocationId: form.businessLocationId, unitConfigId: form.unitConfigId }
    : undefined;

  function normalizeOrderCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  const set = useCallback((key: keyof FormState, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setFieldErrors(e => { const n = { ...e }; delete n[key]; return n; });
    setHighlightedField(current => current === key ? null : current);
  }, []);

  useEffect(() => {
    setPublicLocationsLoading(true);
    setPublicLocationsMsg('');
    getPublicBusinessLocations()
      .then((locations) => {
        setPublicLocations(locations);
        if (locations.length === 1) {
          setForm((current) => current.businessLocationId
            ? current
            : { ...current, businessLocationId: locations[0].id });
        }
      })
      .catch(() => {
        setPublicLocations([]);
        setPublicLocationsMsg('Không thể tải danh sách khu vực giao hàng. Vui lòng thử lại.');
      })
      .finally(() => setPublicLocationsLoading(false));
  }, []);

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
    getUnitGoodsTypes(form.receivingUnit, selectedUnitScope).then(setCustomGoodsTypes).catch(() => setCustomGoodsTypes([]));
  }, [form.receivingUnit, form.businessLocationId, form.unitConfigId]);

  useEffect(() => {
    setOrderCodesLoading(true);
    getOrderCodes()
      .then(setOrderCodes)
      .catch(() => setOrderCodes([]))
      .finally(() => setOrderCodesLoading(false));
  }, []);

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
    setSlotsLoading(true);
    setSlotsMsg('');
    setSlots([]);
    setForm(f => ({ ...f, timeSlot: '' }));
    const slotParams: SlotAvailabilityParams = {
      date: form.deliveryDate,
      goodsType: form.goodsType,
      vehicleType: form.vehicleType,
    };
    if (form.unitGoodsTypeId) slotParams.unitGoodsTypeId = form.unitGoodsTypeId;
    getSlotAvailability(form.receivingUnit, slotParams, selectedUnitScope)
      .then(data => { setSlots(data.slots ?? []); if (data.reason) setSlotsMsg(data.reason); })
      .catch(() => setSlotsMsg('Không thể tải danh sách giờ. Vui lòng thử lại.'))
      .finally(() => setSlotsLoading(false));
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
    awDebounceRef.current = setTimeout(async () => {
      try {
        const res = await checkAutoWarehouseVendor(vendorCode, receivingUnit, scope);
        if (res.isAutoWarehouse) {
          setAwStatus('match');
          setAwVendorName(res.vendor?.vendorName ?? '');
        } else {
          setAwStatus('nomatch');
          setAwVendorName('');
        }
      } catch {
        setAwStatus('idle');
      }
    }, 600);
  }, [form.vendorCode, form.receivingUnit, form.businessLocationId, form.unitConfigId]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (sundayFreshFoodBlocked && form.timeSlot) {
      setForm(f => ({ ...f, timeSlot: '' }));
    }
  }, [form.timeSlot, sundayFreshFoodBlocked]);

  function scrollToFirstError(errs: RegisterFieldErrors) {
    const firstField = REQUIRED_FIELDS_BY_STEP[step]?.find(field => errs[field]) ?? null;
    setHighlightedField(firstField);
    if (!firstField) return;

    window.setTimeout(() => {
      const fieldEl = contentRef.current?.querySelector<HTMLElement>(`[data-register-field="${firstField}"]`);
      fieldEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  function validateStep(): boolean {
    const errs: RegisterFieldErrors = {};
    if (step === 1) {
      if (!form.businessLocationId) errs.businessLocationId = 'Vui lòng chọn khu vực giao hàng';
      else if (!form.receivingUnit || !form.unitConfigId) errs.receivingUnit = 'Vui lòng chọn đơn vị nhận hàng';
      else if (!form.goodsType) errs.goodsType = 'Vui lòng chọn loại hàng';
      else if (!form.vehicleType) errs.vehicleType = 'Vui lòng chọn loại phương tiện';
    }
    if (step === 2) {
      if (sundayFreshFoodBlocked) errs.timeSlot = 'Chủ nhật chỉ nhận hàng tươi sống';
      else if (!form.timeSlot) errs.timeSlot = 'Vui lòng chọn khung giờ giao hàng';
      if (!form.vendorName.trim()) errs.vendorName = 'Vui lòng nhập tên công ty / nhà cung cấp';
      const orderCode = normalizeOrderCode(form.poNumber);
      if (!orderCode) errs.poNumber = 'Vui lòng nhập Số PO hoặc Mã số thi công';
      else if (validOrderCodes.size > 0 && !validOrderCodes.has(orderCode)) {
        errs.poNumber = 'Mã PO/Thi Công không hợp lệ';
      }
    }
    if (step === 3) {
      if (!form.vehiclePlate.trim()) errs.vehiclePlate = 'Vui lòng nhập biển số xe';
      if (form.driverPhone.replace(/\D/g, '').length < 9) errs.driverPhone = 'Số điện thoại không hợp lệ (cần ít nhất 9 số)';
    }
    setFieldErrors(errs);
    scrollToFirstError(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep()) return;
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
    setFieldErrors({});
    setHighlightedField(null);
    setSubmitError('');
    setReturnToReviewAfterEdit(false);
    setStep(s => Math.max(s - 1, 1));
  }

  function editStepFromReview(targetStep: 1 | 2 | 3) {
    setFieldErrors({});
    setHighlightedField(null);
    setSubmitError('');
    setReturnToReviewAfterEdit(true);
    setStep(targetStep);
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const requestedTime = form.timeSlot === 'OTHER' ? undefined : `${form.deliveryDate}T${form.timeSlot}:00`;
      const plate = form.vehiclePlate.toUpperCase().replace(/\s+/g, '');
      const poNumber = normalizeOrderCode(form.poNumber);
      const selectedCustomType = customGoodsTypes.find(ct => ct.id === form.unitGoodsTypeId);
      const res = await registerDelivery({
        businessLocationId: form.businessLocationId,
        unitConfigId: form.unitConfigId,
        vendorName: form.vendorName,
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        vehiclePlate: plate,
        vehicleType: form.vehicleType,
        receivingUnit: form.receivingUnit,
        goodsType: form.goodsType,
        unitGoodsTypeId: form.unitGoodsTypeId || undefined,
        poNumber,
        vendorCode: form.vendorCode || undefined,
        requestedTime,
        deliveryDate: form.deliveryDate,
        note: form.note || undefined,
      });
      const selectedLocation = publicLocations.find((l) => l.id === form.businessLocationId);
      setSuccess({
        code: res.registrationCode,
        vehiclePlate: plate,
        vendorName: form.vendorName,
        driverName: form.driverName,
        receivingUnit: form.receivingUnit as Unit,
        unitDisplayName: unitConfig?.displayName || unitConfig?.shortName || form.receivingUnit,
        unitIcon: unitConfig?.icon || '',
        unitLogoUrl: unitConfig?.logoUrl ?? null,
        goodsType: form.goodsType,
        goodsTypeName: selectedCustomType ? `${selectedCustomType.emoji} ${selectedCustomType.name}` : '',
        vehicleType: form.vehicleType,
        requestedTime: form.timeSlot === 'OTHER'
          ? `Ngày ${form.deliveryDate.split('-').reverse().join('/')} (không có giờ cụ thể)`
          : `${form.timeSlot} ngày ${form.deliveryDate.split('-').reverse().join('/')}`,
        locationName: selectedLocation?.locationName ?? '',
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
    setFieldErrors({});
    setHighlightedField(null);
    setSubmitError('');
    setReturnToReviewAfterEdit(false);
    setAwStatus('idle');
    setAwVendorName('');
    setForm(f => ({
      ...f,
      businessLocationId: '',
      unitConfigId: '',
      receivingUnit: '',
      goodsType: '',
      unitGoodsTypeId: '',
      vehicleType: '',
      deliveryDate: todayDate(),
      timeSlot: '',
      note: '',
      poNumber: '',
      vendorCode: '',
    }));
  }

  return {
    step,
    guideOpen,
    setGuideOpen,
    fieldErrors,
    highlightedField,
    submitting,
    submitError,
    success,
    form,
    publicLocations,
    publicLocationsLoading,
    publicLocationsMsg,
    publicUnits,
    publicUnitsLoading,
    publicUnitsMsg,
    rememberInfo,
    setRememberInfo,
    unitConfig,
    customGoodsTypes,
    slots,
    slotsMsg,
    slotsLoading,
    vehicleAvailability,
    vehicleAvailabilityMsg,
    vehicleAvailabilityLoading,
    orderCodes,
    orderCodesLoading,
    sundayFreshFoodBlocked,
    awStatus,
    awVendorName,
    showOtherTimeModal,
    setShowOtherTimeModal,
    contentRef,
    set,
    next,
    back,
    editStepFromReview,
    submit,
    resetForm,
  };
}
