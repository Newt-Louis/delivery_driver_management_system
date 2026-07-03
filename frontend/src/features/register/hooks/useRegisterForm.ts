import { useCallback, useEffect, useRef, useState } from 'react';
import type { SlotInfo, UnitConfig, UnitGoodsType } from '../../../lib/types';
import {
  checkAutoWarehouseVendor,
  getSlotAvailability,
  getUnitConfig,
  getUnitGoodsTypes,
  registerDelivery,
  type SlotAvailabilityParams,
} from '../api';
import { LS_KEY } from '../constants';
import type { FormState, RegisterFieldErrors, SuccessInfo, Unit } from '../types';
import { todayDate } from '../utils/date';

export function useRegisterForm() {
  const [step, setStep] = useState(1);
  const [guideOpen, setGuideOpen] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const [form, setForm] = useState<FormState>(() => {
    const saved = localStorage.getItem(LS_KEY);
    const prev = saved ? (JSON.parse(saved) as Partial<FormState>) : {};
    return {
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
  const [unitConfig, setUnitConfig] = useState<UnitConfig | null>(null);
  const [customGoodsTypes, setCustomGoodsTypes] = useState<UnitGoodsType[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsMsg, setSlotsMsg] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [awStatus, setAwStatus] = useState<'idle' | 'loading' | 'match' | 'nomatch'>('idle');
  const [awVendorName, setAwVendorName] = useState('');
  const awDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOtherTimeModal, setShowOtherTimeModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const set = useCallback((key: keyof FormState, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setFieldErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  useEffect(() => {
    if (!form.receivingUnit) {
      setUnitConfig(null);
      setCustomGoodsTypes([]);
      return;
    }
    getUnitConfig(form.receivingUnit).then(setUnitConfig).catch(() => {});
    getUnitGoodsTypes(form.receivingUnit).then(setCustomGoodsTypes).catch(() => setCustomGoodsTypes([]));
  }, [form.receivingUnit]);

  useEffect(() => {
    if (step !== 2 || !form.receivingUnit || !form.goodsType || !form.vehicleType || !form.deliveryDate) return;
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
    getSlotAvailability(form.receivingUnit, slotParams)
      .then(data => { setSlots(data.slots ?? []); if (data.reason) setSlotsMsg(data.reason); })
      .catch(() => setSlotsMsg('Không thể tải danh sách giờ. Vui lòng thử lại.'))
      .finally(() => setSlotsLoading(false));
  }, [step, form.receivingUnit, form.goodsType, form.vehicleType, form.deliveryDate, form.unitGoodsTypeId]);

  useEffect(() => {
    if (awDebounceRef.current) clearTimeout(awDebounceRef.current);
    if (!form.vendorCode?.trim() || !form.receivingUnit) {
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
    setAwStatus('loading');
    awDebounceRef.current = setTimeout(async () => {
      try {
        const res = await checkAutoWarehouseVendor(vendorCode, receivingUnit);
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
  }, [form.vendorCode, form.receivingUnit]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  function validateStep(): boolean {
    const errs: RegisterFieldErrors = {};
    if (step === 1) {
      if (!form.receivingUnit) errs.receivingUnit = 'Vui lòng chọn đơn vị nhận hàng';
      else if (!form.goodsType) errs.goodsType = 'Vui lòng chọn loại hàng';
      else if (!form.vehicleType) errs.vehicleType = 'Vui lòng chọn loại phương tiện';
    }
    if (step === 2) {
      if (!form.timeSlot) errs.timeSlot = 'Vui lòng chọn khung giờ giao hàng';
      if (!form.vendorName.trim()) errs.vendorName = 'Vui lòng nhập tên công ty / nhà cung cấp';
      if (!form.poNumber.trim()) errs.poNumber = 'Vui lòng nhập Số PO hoặc Mã số thi công';
    }
    if (step === 3) {
      if (!form.vehiclePlate.trim()) errs.vehiclePlate = 'Vui lòng nhập biển số xe';
      if (!form.driverName.trim()) errs.driverName = 'Vui lòng nhập tên tài xế';
      if (form.driverPhone.replace(/\D/g, '').length < 9) errs.driverPhone = 'Số điện thoại không hợp lệ (cần ít nhất 9 số)';
    }
    setFieldErrors(errs);
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
    setStep(s => Math.min(s + 1, 4));
  }

  function back() {
    setFieldErrors({});
    setSubmitError('');
    setStep(s => Math.max(s - 1, 1));
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const requestedTime = form.timeSlot === 'OTHER' ? undefined : `${form.deliveryDate}T${form.timeSlot}:00`;
      const plate = form.vehiclePlate.toUpperCase().replace(/\s+/g, '');
      const selectedCustomType = customGoodsTypes.find(ct => ct.id === form.unitGoodsTypeId);
      const res = await registerDelivery({
        vendorName: form.vendorName,
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        vehiclePlate: plate,
        vehicleType: form.vehicleType,
        receivingUnit: form.receivingUnit,
        goodsType: form.goodsType,
        unitGoodsTypeId: form.unitGoodsTypeId || undefined,
        poNumber: form.poNumber,
        vendorCode: form.vendorCode || undefined,
        requestedTime,
        note: form.note || undefined,
      });
      setSuccess({
        code: res.registrationCode,
        vehiclePlate: plate,
        vendorName: form.vendorName,
        driverName: form.driverName,
        receivingUnit: form.receivingUnit as Unit,
        goodsType: form.goodsType,
        goodsTypeName: selectedCustomType ? `${selectedCustomType.emoji} ${selectedCustomType.name}` : '',
        vehicleType: form.vehicleType,
        requestedTime: form.timeSlot === 'OTHER'
          ? `Ngày ${form.deliveryDate.split('-').reverse().join('/')} (không có giờ cụ thể)`
          : `${form.timeSlot} ngày ${form.deliveryDate.split('-').reverse().join('/')}`,
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
    setSubmitError('');
    setAwStatus('idle');
    setAwVendorName('');
    setForm(f => ({
      ...f,
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
  };
}
