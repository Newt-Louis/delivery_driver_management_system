import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useToast } from '../context/ToastContext';
import { CameraIcon, ArrowRightIcon } from '../components/Icon';
import {
  getDailyRegistrationStats,
  getUnitConfig,
  quickVerifyOrderCode,
  registerDelivery,
  type DailyRegistrationStat,
  type QuickVerifyResponse,
} from '../features/register/api';
import DeliveryDateCalendar from '../features/register/components/DeliveryDateCalendar';
import SuccessScreen from '../features/register/components/SuccessScreen';
import { isSundayDate, todayDate } from '../features/register/utils/date';
import type { SuccessInfo } from '../features/register/types';
import type { GoodsType, UnitConfig, VehicleType } from '../lib/types';

type Step = 1 | 2 | 3;

type QuickForm = {
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  vendorCode: string;
  vendorName: string;
  deliveryDate: string;
  goodsType: GoodsType | '';
};

type GoodsOption = {
  value: GoodsType;
  icon: string;
  title: string;
  hint: string;
};

const GOODS_LABEL: Record<GoodsType, string> = {
  FRESH_FOOD: 'Hàng tươi sống',
  AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng hóa thông thường',
  THI_CONG: 'Thi công',
};

const VEHICLE_LABEL: Record<VehicleType, string> = {
  TRUCK: 'Xe tải',
  MOTORBIKE: 'Xe máy',
  OTHER: 'Xe khác',
};

function normalizeOrderCode(value: string) {
  return value.trim().replace(/[^A-Za-z0-9]/g, '');
}

function formatDate(value?: string) {
  if (!value) return 'Chưa chọn';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function errorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message ?? data?.error ?? fallback;
}

function emptyForm(): QuickForm {
  return {
    driverName: '',
    driverPhone: '',
    vehiclePlate: '',
    vendorCode: '',
    vendorName: '',
    deliveryDate: todayDate(),
    goodsType: '',
  };
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-thiso-100 py-2 last:border-b-0">
      <span className="text-sm text-thiso-400">{label}</span>
      <span className="max-w-[58%] text-right text-sm font-bold text-thiso-900 break-words">{value || '-'}</span>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const { mall } = useBranding();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [orderCode, setOrderCode] = useState('');
  const [verified, setVerified] = useState<QuickVerifyResponse | null>(null);
  const [form, setForm] = useState<QuickForm>(emptyForm);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dailyStats, setDailyStats] = useState<DailyRegistrationStat[]>([]);
  const [dailyStatsMsg, setDailyStatsMsg] = useState('');
  const [dailyStatsLoading, setDailyStatsLoading] = useState(false);
  const [unitConfig, setUnitConfig] = useState<UnitConfig | null>(null);
  const [unitConfigLoading, setUnitConfigLoading] = useState(false);
  const [unitConfigMsg, setUnitConfigMsg] = useState('');
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const normalizedCode = useMemo(() => normalizeOrderCode(orderCode), [orderCode]);
  const constructionCodeLooksSupported = /^[A-Za-z0-9]{5}$/.test(normalizedCode) && /[A-Za-z]/.test(normalizedCode) && /\d/.test(normalizedCode);
  const codeLooksSupported = /^450\d{7}$/.test(normalizedCode) || constructionCodeLooksSupported;
  const staffHomePath = user?.role === 'CHECKIN' ? '/check-in' : '/dashboard';
  const needsCalendar = verified?.kind === 'CONSTRUCTION';
  const effectiveGoodsType = needsCalendar ? form.goodsType : (verified?.goodsType ?? '');
  const selectedDayStats = dailyStats.find((item) => item.date === form.deliveryDate);
  const goodsOptions = useMemo(() => {
    if (!unitConfig) return [];
    const options: GoodsOption[] = [];
    if (unitConfig.freshFoodEnabled) {
      options.push({ value: 'FRESH_FOOD', icon: '🥬', title: 'Hàng tươi sống / mát / đông lạnh', hint: unitConfig.sundayFreshFoodOnly ? 'Cả Chủ nhật' : '' });
    }
    if (unitConfig.generalGoodsEnabled) {
      options.push({ value: 'GENERAL_GOODS', icon: '📦', title: 'Hàng thường', hint: unitConfig.sundayFreshFoodOnly ? 'Không nhận CN' : '' });
    }
    if (unitConfig.thiCongEnabled) {
      options.push({ value: 'THI_CONG', icon: '🔨', title: 'Thi công', hint: 'Công trình' });
    }
    return options;
  }, [unitConfig]);

  useEffect(() => {
    if (!verified || !needsCalendar) {
      setUnitConfig(null);
      setUnitConfigMsg('');
      setUnitConfigLoading(false);
      return;
    }

    let cancelled = false;
    setUnitConfigLoading(true);
    setUnitConfigMsg('');
    getUnitConfig(verified.receivingUnit, {
      businessLocationId: verified.businessLocationId,
      unitConfigId: verified.unitConfigId,
    })
      .then((config) => {
        if (cancelled) return;
        setUnitConfig(config);
      })
      .catch(() => {
        if (cancelled) return;
        setUnitConfig(null);
        setUnitConfigMsg('Không tải được loại hàng đang mở cho đơn vị này.');
      })
      .finally(() => {
        if (!cancelled) setUnitConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needsCalendar, verified]);

  useEffect(() => {
    if (!verified || !needsCalendar || !effectiveGoodsType) {
      setDailyStats([]);
      setDailyStatsMsg('');
      setDailyStatsLoading(false);
      return;
    }

    const month = form.deliveryDate.slice(0, 7);
    let cancelled = false;
    setDailyStatsLoading(true);
    setDailyStatsMsg('');
    getDailyRegistrationStats(
      verified.receivingUnit,
      {
        month,
        goodsType: effectiveGoodsType,
        vehicleType: verified.vehicleType,
      },
      {
        businessLocationId: verified.businessLocationId,
        unitConfigId: verified.unitConfigId,
      },
    )
      .then((res) => {
        if (cancelled) return;
        setDailyStats(res.days);
        setDailyStatsMsg(res.reason ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setDailyStats([]);
        setDailyStatsMsg('Không tải được công suất đăng ký theo ngày.');
      })
      .finally(() => {
        if (!cancelled) setDailyStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveGoodsType, form.deliveryDate, needsCalendar, verified]);

  function setField<K extends keyof QuickForm>(key: K, value: QuickForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedCode) {
      toast.error('Vui lòng nhập mã PO hoặc mã Thi Công.');
      return;
    }
    if (!codeLooksSupported) {
      toast.error('Mã PO cần có 10 chữ số và bắt đầu bằng 450, mã Thi Công gồm đúng 5 ký tự có cả chữ và số.');
      return;
    }

    setVerifying(true);
    try {
      const data = await quickVerifyOrderCode(normalizedCode);
      setVerified(data);
      setForm({
        ...emptyForm(),
        vendorCode: data.vendorCode ?? '',
        vendorName: data.vendorName ?? '',
        deliveryDate: data.deliveryDate ?? todayDate(),
        goodsType: data.kind === 'CONSTRUCTION' ? '' : data.goodsType,
      });
      setDailyStats([]);
      setDailyStatsMsg('');
      setUnitConfig(null);
      setUnitConfigMsg('');
      setStep(2);
      toast.success(data.kind === 'PO' ? 'Mã PO hợp lệ.' : 'Mã Thi Công hợp lệ.');
    } catch (err) {
      setVerified(null);
      toast.error(errorMessage(err, 'Không thể kiểm tra mã lúc này. Vui lòng thử lại.'));
    } finally {
      setVerifying(false);
    }
  }

  function validateDetails() {
    if (!verified) return false;
    if (needsCalendar && !form.deliveryDate) {
      toast.error('Vui lòng chọn ngày giao hàng.');
      return false;
    }
    if (needsCalendar && !form.goodsType) {
      toast.error('Vui lòng chọn loại hàng giao.');
      return false;
    }
    if (unitConfig?.sundayFreshFoodOnly && isSundayDate(form.deliveryDate) && effectiveGoodsType && effectiveGoodsType !== 'FRESH_FOOD') {
      toast.error('Chủ nhật chỉ nhận hàng tươi sống.');
      return false;
    }
    if (needsCalendar && selectedDayStats?.available === false) {
      toast.error(selectedDayStats.reason ?? 'Ngày này đã đạt công suất đăng ký.');
      return false;
    }
    if (form.driverPhone.replace(/\D/g, '').length < 9) {
      toast.error('Số điện thoại không hợp lệ.');
      return false;
    }
    if (!form.vehiclePlate.trim()) {
      toast.error('Vui lòng nhập biển số xe.');
      return false;
    }
    return true;
  }

  function goReview() {
    if (!validateDetails()) return;
    setStep(3);
  }

  async function submitRegistration() {
    if (!verified || !validateDetails()) return;
    const submitGoodsType = effectiveGoodsType || verified.goodsType;

    setSubmitting(true);
    try {
      const plate = form.vehiclePlate.toUpperCase().replace(/\s+/g, '');
      const res = await registerDelivery({
        businessLocationId: verified.businessLocationId,
        unitConfigId: verified.unitConfigId,
        vendorName: form.vendorName.trim(),
        driverName: form.driverName.trim(),
        driverPhone: form.driverPhone.trim(),
        vehiclePlate: plate,
        vehicleType: verified.vehicleType,
        receivingUnit: verified.receivingUnit,
        goodsType: submitGoodsType,
        poNumber: verified.orderCode,
        vendorCode: form.vendorCode.trim() || undefined,
        deliveryDate: form.deliveryDate,
        quickVerificationToken: verified.verificationToken,
        note: verified.kind === 'CONSTRUCTION' && verified.title ? verified.title : undefined,
      });

      setSuccess({
        code: res.registrationCode,
        vehiclePlate: plate,
        vendorName: form.vendorName.trim(),
        driverName: form.driverName.trim(),
        receivingUnit: verified.receivingUnit,
        unitDisplayName: verified.unitDisplayName,
        unitIcon: verified.unitIcon ?? '',
        unitLogoUrl: verified.unitLogoUrl,
        goodsType: submitGoodsType,
        goodsTypeName: GOODS_LABEL[submitGoodsType],
        vehicleType: verified.vehicleType,
        requestedTime: formatDate(form.deliveryDate),
        locationName: verified.businessLocationName,
      });
      toast.success('Đăng ký giao hàng thành công.');
    } catch (err) {
      toast.error(errorMessage(err, 'Đăng ký thất bại. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setStep(1);
    setOrderCode('');
    setVerified(null);
    setForm(emptyForm());
    setDailyStats([]);
    setDailyStatsMsg('');
    setUnitConfig(null);
    setUnitConfigMsg('');
    setSuccess(null);
  }

  if (success) {
    return <SuccessScreen info={success} onReset={resetFlow} />;
  }

  return (
    <main className="min-h-screen bg-thiso-50 text-thiso-800">
      <section className="border-b border-thiso-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {mall.logoUrl ? (
              <img src={mall.logoUrl} alt={mall.mallName} className="h-10 w-10 flex-shrink-0 rounded-lg border border-thiso-100 bg-white object-contain p-1" />
            ) : (
              <img src="/truck.svg" alt="Delivery" className="h-10 w-10 flex-shrink-0 rounded-lg" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-widest text-thiso-900">{mall.mallName}</p>
              <p className="truncate text-xs font-semibold text-thiso-400">{mall.tagline ?? 'Delivery Management System'}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/track" className="btn btn-ghost h-10 px-3">
              Theo dõi
            </Link>
            {isAuthenticated ? (
              <Link to={staffHomePath} className="btn btn-primary h-10 px-3">
                Vận hành
              </Link>
            ) : (
              <Link to="/login" className="btn btn-secondary h-10 px-3">
                Nhân viên
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-3xl justify-items-center gap-8 px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="w-full space-y-6">
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-thiso-900 sm:text-4xl">
              Hệ thống điều phối giao hàng THISO
            </h1>
            <p className="max-w-2xl text-base leading-7 text-thiso-500">
              Nhập mã PO hoặc mã Thi Công để hệ thống kiểm tra nhanh thông tin đơn vị nhận, khu vực và loại hàng trước khi đăng ký.
            </p>
          </div>

          <div className="max-w-2xl rounded-lg border border-thiso-100 bg-white p-4 shadow-card-md sm:p-5">
            <div className="mb-5 grid grid-cols-3 gap-2 text-xs font-bold">
              {[
                ['1', 'Kiểm tra mã'],
                ['2', 'Thông tin xe'],
                ['3', 'Xác nhận'],
              ].map(([num, label]) => {
                const active = Number(num) === step;
                const done = Number(num) < step;
                return (
                  <div key={num} className={`rounded-lg border px-2 py-2 text-center ${active || done ? 'border-thiso-700 bg-thiso-700 text-white' : 'border-thiso-100 bg-thiso-50 text-thiso-400'}`}>
                    <span className="block text-sm">{num}</span>
                    <span className="block truncate">{label}</span>
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="home-order-code" className="label">
                    Mã PO / Thi Công
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <input
                        id="home-order-code"
                        type="text"
                        value={orderCode}
                        onChange={(event) => setOrderCode(event.target.value.replace(/\s/g, ''))}
                        placeholder="VD: 4500771144 hoặc A1B2C"
                        autoComplete="off"
                        autoCapitalize="none"
                        className="input h-12 pr-12 font-mono text-base tracking-wide"
                        style={{ fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => toast.info('Quét QR bằng camera sẽ được kết nối ở bước thiết bị sau.')}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-thiso-500 transition-colors hover:bg-thiso-100 hover:text-thiso-900"
                        aria-label="Quét mã bằng camera"
                        title="Quét mã bằng camera"
                      >
                        <CameraIcon />
                      </button>
                    </div>
                    <button type="submit" className="btn btn-primary h-12 w-full shrink-0 justify-center gap-2 px-4 sm:w-auto" disabled={verifying}>
                      <span>{verifying ? 'Đang kiểm tra...' : 'Kiểm tra'}</span>
                      <ArrowRightIcon />
                    </button>
                  </div>
                  {normalizedCode && (
                    <p className={`mt-2 text-xs font-semibold ${codeLooksSupported ? 'text-sky-700' : 'text-amber-600'}`}>
                      Mã chuẩn hóa: <span className="font-mono">{normalizedCode}</span>
                    </p>
                  )}
                </div>
              </form>
            )}

            {step === 2 && verified && (
              <div className="space-y-5">
                <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-3">
                  <p className="text-xs font-black uppercase tracking-wider text-sky-700">
                    {verified.kind === 'PO' ? 'PO đã xác thực' : 'Mã Thi Công đã xác thực'}
                  </p>
                  <p className="mt-1 font-mono text-sm font-black text-thiso-900">{verified.orderCode}</p>
                  <p className="mt-1 text-sm text-thiso-500">
                    {verified.unitDisplayName} · {verified.businessLocationName}
                    {effectiveGoodsType ? ` · ${GOODS_LABEL[effectiveGoodsType]}` : ''}
                  </p>
                </div>

                {needsCalendar ? (
                  <div>
                    <p className="label">Ngày giao hàng <span className="text-red-400">*</span></p>
                    {dailyStatsMsg && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                        {dailyStatsMsg}
                      </div>
                    )}
                    <DeliveryDateCalendar
                      value={form.deliveryDate}
                      stats={dailyStats}
                      loading={dailyStatsLoading}
                      disabledReasonForDate={(date) => (
                        unitConfig?.sundayFreshFoodOnly && form.goodsType && form.goodsType !== 'FRESH_FOOD' && isSundayDate(date)
                          ? 'Chủ nhật chỉ nhận hàng tươi sống'
                          : undefined
                      )}
                      onChange={(date) => setField('deliveryDate', date)}
                    />

                    <div className="mt-4">
                      <p className="label">Loại hàng bạn giao <span className="text-red-400">*</span></p>
                      {unitConfigLoading && (
                        <div className="rounded-lg border border-thiso-100 bg-white px-3 py-3 text-sm text-thiso-400">
                          Đang tải loại hàng...
                        </div>
                      )}
                      {unitConfigMsg && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          {unitConfigMsg}
                        </div>
                      )}
                      {!unitConfigLoading && !unitConfigMsg && goodsOptions.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {goodsOptions.map((option) => {
                            const active = form.goodsType === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setField('goodsType', option.value)}
                                className={`rounded-2xl border-2 p-4 text-left transition-all ${
                                  active
                                    ? 'border-sky-400 bg-sky-50 shadow-card-md'
                                    : 'border-thiso-200 bg-white hover:border-thiso-300'
                                }`}
                              >
                                <div className="mb-2 text-2xl">{option.icon}</div>
                                <p className="text-sm font-bold text-thiso-800">{option.title}</p>
                                {option.hint && (
                                  <span className="mt-1 inline-block rounded-full bg-thiso-100 px-1.5 py-0.5 text-[10px] font-semibold text-thiso-500">
                                    {option.hint}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {!unitConfigLoading && !unitConfigMsg && goodsOptions.length === 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          Đơn vị này chưa mở loại hàng nào để đăng ký.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-thiso-100 bg-thiso-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-thiso-400">Ngày giao từ PO</p>
                    <p className="mt-1 text-sm font-black text-thiso-900">{formatDate(form.deliveryDate)}</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Tên tài xế</label>
                    <input className="input h-11" value={form.driverName} onChange={(e) => setField('driverName', e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" style={{ fontSize: '16px' }} />
                  </div>
                  <div>
                    <label className="label">Số điện thoại <span className="text-red-400">*</span></label>
                    <input className="input h-11" value={form.driverPhone} onChange={(e) => setField('driverPhone', e.target.value)} placeholder="090..." inputMode="tel" autoComplete="tel" style={{ fontSize: '16px' }} />
                  </div>
                  <div>
                    <label className="label">Biển số xe <span className="text-red-400">*</span></label>
                    <input className="input h-11 font-mono uppercase" value={form.vehiclePlate} onChange={(e) => setField('vehiclePlate', e.target.value.toUpperCase())} placeholder="51C12345" autoComplete="off" style={{ fontSize: '16px' }} />
                  </div>
                  <div>
                    <label className="label">Mã NCC</label>
                    <input className="input h-11 font-mono" value={form.vendorCode} onChange={(e) => setField('vendorCode', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="08723875" autoComplete="off" style={{ fontSize: '16px' }} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Tên NCC / Công ty</label>
                    <input className="input h-11" value={form.vendorName} onChange={(e) => setField('vendorName', e.target.value)} placeholder="Công ty TNHH ABC" autoComplete="organization" style={{ fontSize: '16px' }} />
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <button type="button" className="btn btn-secondary h-11 justify-center" onClick={() => setStep(1)}>
                    Nhập mã khác
                  </button>
                  <button type="button" className="btn btn-primary h-11 justify-center gap-2" onClick={goReview}>
                    <span>Tiếp tục</span>
                    <ArrowRightIcon />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && verified && (
              <div className="space-y-5">
                <div className="rounded-lg border border-thiso-100 bg-thiso-50 p-4">
                  <ReviewRow label="Loại đăng ký" value={verified.kind === 'PO' ? 'PO' : 'Thi Công'} />
                  <ReviewRow label="Mã" value={verified.orderCode} />
                  <ReviewRow label="Khu vực" value={`${verified.businessLocationName} (${verified.businessLocationCode})`} />
                  <ReviewRow label="Đơn vị" value={verified.unitDisplayName} />
                  <ReviewRow label="Ngày giao" value={formatDate(form.deliveryDate)} />
                  <ReviewRow label="Loại hàng" value={effectiveGoodsType ? GOODS_LABEL[effectiveGoodsType] : 'Chưa chọn'} />
                  <ReviewRow label="Loại xe" value={VEHICLE_LABEL[verified.vehicleType]} />
                  <ReviewRow label="Tài xế" value={form.driverName} />
                  <ReviewRow label="Số điện thoại" value={form.driverPhone} />
                  <ReviewRow label="Biển số" value={form.vehiclePlate.toUpperCase().replace(/\s+/g, '')} />
                  <ReviewRow label="Mã NCC" value={form.vendorCode} />
                  <ReviewRow label="Tên NCC / Công ty" value={form.vendorName} />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <button type="button" className="btn btn-secondary h-11 justify-center" onClick={() => setStep(2)} disabled={submitting}>
                    Sửa thông tin
                  </button>
                  <button type="button" className="btn btn-primary h-11 justify-center gap-2" onClick={submitRegistration} disabled={submitting}>
                    <span>{submitting ? 'Đang đăng ký...' : 'Hoàn tất đăng ký'}</span>
                    <ArrowRightIcon />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Link to="/register" className="rounded-lg border border-thiso-200 bg-white p-4 shadow-card transition-all hover:border-thiso-400 hover:shadow-card-md">
              <p className="text-sm font-black text-thiso-900">Đăng ký thủ công</p>
              <p className="mt-1 text-sm leading-6 text-thiso-500">Dùng khi mã chưa có dữ liệu hoặc hệ thống xác thực online gặp sự cố.</p>
            </Link>
            <Link to="/track" className="rounded-lg border border-thiso-200 bg-white p-4 shadow-card transition-all hover:border-thiso-400 hover:shadow-card-md">
              <p className="text-sm font-black text-thiso-900">Theo dõi đơn</p>
              <p className="mt-1 text-sm leading-6 text-thiso-500">Tra cứu trạng thái bằng mã đăng ký hoặc biển số xe sau khi đăng ký.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
