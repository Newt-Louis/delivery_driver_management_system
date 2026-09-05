import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
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

function isPoCode(value: string) {
  return /^450\d{7}$/.test(value);
}

function isConstructionCode(value: string) {
  return /^[A-Za-z0-9]{5}$/.test(value) && /[A-Za-z]/.test(value);
}

function extractScannedOrderCode(raw: string) {
  const value = raw.trim();
  const candidates: string[] = [];

  try {
    const url = new URL(value);
    ['code', 'orderCode', 'poNumber', 'registrationCode'].forEach((key) => {
      const param = url.searchParams.get(key);
      if (param) candidates.push(param);
    });
    const lastPathPart = url.pathname.split('/').filter(Boolean).pop();
    if (lastPathPart) candidates.push(lastPathPart);
  } catch {
    // Plain barcode/QR content is the common path.
  }

  candidates.push(value);
  candidates.push(...(value.match(/450\d{7}/g) ?? []));
  candidates.push(...(value.match(/[A-Za-z0-9]{5,}/g) ?? []));

  for (const candidate of candidates) {
    const cleaned = normalizeOrderCode(candidate);
    if (isPoCode(cleaned) || isConstructionCode(cleaned)) return cleaned;
  }

  return normalizeOrderCode(value);
}

function scannerErrorMessage(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Trình duyệt chưa được cấp quyền camera.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Không tìm thấy camera trên thiết bị này.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Camera đang được ứng dụng khác sử dụng.';
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return 'Camera cần HTTPS hoặc localhost để hoạt động.';
  }
  return 'Không mở được camera. Vui lòng thử lại.';
}

function createScanHints(library: typeof import('@zxing/library')) {
  const formats = [
    library.BarcodeFormat.QR_CODE,
    library.BarcodeFormat.CODE_128,
    library.BarcodeFormat.CODE_39,
    library.BarcodeFormat.CODE_93,
    library.BarcodeFormat.EAN_13,
    library.BarcodeFormat.EAN_8,
    library.BarcodeFormat.UPC_A,
    library.BarcodeFormat.UPC_E,
    library.BarcodeFormat.ITF,
    library.BarcodeFormat.DATA_MATRIX,
    library.BarcodeFormat.PDF_417,
  ];
  const hints = new Map<import('@zxing/library').DecodeHintType, import('@zxing/library').BarcodeFormat[]>();
  hints.set(library.DecodeHintType.POSSIBLE_FORMATS, formats);
  return hints;
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const [orderCodeNotFound, setOrderCodeNotFound] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);

  const normalizedCode = useMemo(() => normalizeOrderCode(orderCode), [orderCode]);
  const constructionCodeLooksSupported = isConstructionCode(normalizedCode);
  const codeLooksSupported = isPoCode(normalizedCode) || constructionCodeLooksSupported;
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

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function applyScannedCode(raw: string, successMessage: string) {
    const scannedCode = extractScannedOrderCode(raw);
    if (!scannedCode) {
      setScannerStatus('Không đọc được mã.');
      return;
    }

    setOrderCode(scannedCode);
    setOrderCodeNotFound(false);
    setVerified(null);
    setDailyStats([]);
    setDailyStatsMsg('');
    setUnitConfig(null);
    setUnitConfigMsg('');
    setStep(1);
    toast.success(`${successMessage}: ${scannedCode}`);
    stopScanner();
    setScannerOpen(false);
  }

  async function handleImageCodeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setScannerStatus('Đang đọc mã trong ảnh...');

    try {
      const [browser, library] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
      const reader = new browser.BrowserMultiFormatReader(createScanHints(library), {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 500,
        tryPlayVideoTimeout: 5000,
      });
      const result = await reader.decodeFromImageUrl(imageUrl);
      applyScannedCode(result.getText(), 'Đã đọc mã từ ảnh');
    } catch {
      const message = 'Không tìm thấy QR hoặc Barcode rõ ràng trong ảnh. Vui lòng chọn ảnh khác hoặc quét trực tiếp.';
      setScannerStatus(message);
      toast.error(message);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  useEffect(() => {
    if (!scannerOpen) return;

    const video = videoRef.current;
    if (!video) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerStatus('Trình duyệt không hỗ trợ camera.');
      return;
    }

    let active = true;
    scanHandledRef.current = false;
    setScannerStatus('Đang mở camera...');

    Promise.all([import('@zxing/browser'), import('@zxing/library')])
      .then(([browser, library]) => {
        if (!active) return null;
        const reader = new browser.BrowserMultiFormatReader(createScanHints(library), {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 500,
          tryPlayVideoTimeout: 5000,
        });

        return reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result, _error, controls) => {
            if (!active || scanHandledRef.current) return;
            scannerControlsRef.current = controls;

            if (!result) return;
            scanHandledRef.current = true;
            applyScannedCode(result.getText(), 'Đã quét mã');
          },
        );
      })
      .then((controls) => {
        if (!controls) return;
        if (!active) {
          controls.stop();
          return;
        }
        scannerControlsRef.current = controls;
        setScannerStatus('Đang quét...');
      })
      .catch((error) => {
        if (!active) return;
        const message = scannerErrorMessage(error);
        setScannerStatus(message);
        toast.error(message);
      });

    return () => {
      active = false;
      stopScanner();
    };
  }, [scannerOpen, toast]);

  function setField<K extends keyof QuickForm>(key: K, value: QuickForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleOrderCodeChange(value: string) {
    setOrderCode(value.replace(/\s/g, ''));
    setOrderCodeNotFound(false);
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedCode) {
      setOrderCodeNotFound(false);
      toast.error('Vui lòng nhập mã PO hoặc mã Thi Công.');
      return;
    }
    if (!codeLooksSupported) {
      setOrderCodeNotFound(false);
      toast.error('Mã PO cần có 10 chữ số và bắt đầu bằng 450, mã Thi Công gồm đúng 5 ký tự chữ/số và không được toàn số.');
      return;
    }

    setVerifying(true);
    try {
      const data = await quickVerifyOrderCode(normalizedCode);
      setOrderCodeNotFound(false);
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
      const message = errorMessage(err, 'Không thể kiểm tra mã lúc này. Vui lòng thử lại.');
      setOrderCodeNotFound(/không tồn tại/i.test(message));
      toast.error(message);
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
        referenceCode: verified.orderCode,
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
    setOrderCodeNotFound(false);
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
            <Link to="/cancelled" className="btn btn-ghost h-10 px-3">
              Hủy chuyến
            </Link>
            <Link to="/track" className="btn btn-ghost h-10 px-3">
              Theo dõi
            </Link>
            <Link to="/register" className="btn btn-ghost h-10 px-3">
              Đăng ký thủ công
            </Link>
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
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="home-order-code"
                        type="text"
                        value={orderCode}
                        onChange={(event) => handleOrderCodeChange(event.target.value)}
                        placeholder="VD: 4500771144 hoặc AbCdE"
                        autoComplete="off"
                        autoCapitalize="none"
                        className={`input h-12 min-w-0 flex-1 font-mono text-base tracking-wide ${orderCodeNotFound ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                        style={{ fontSize: '16px' }}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary h-12 w-full shrink-0 justify-center gap-2 px-4 sm:w-auto"
                        disabled={verifying}
                      >
                        <span>{verifying ? 'Đang kiểm tra...' : 'Kiểm tra'}</span>
                        <ArrowRightIcon />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-black text-gray-700 shadow-[2px_3px_6px_rgba(15,23,42,0.16),4px_6px_16px_rgba(15,23,42,0.08)] transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-[3px_4px_8px_rgba(15,23,42,0.18),5px_8px_18px_rgba(15,23,42,0.09)] active:translate-x-0.5 active:translate-y-0.5 active:bg-gray-100 active:shadow-[1px_1px_4px_rgba(15,23,42,0.10)]"
                    >
                      <span className="flex h-8 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 transition-colors group-hover:bg-gray-200 group-hover:text-gray-900">
                        <CameraIcon />
                      </span>
                      <span className="truncate leading-tight">
                        Quét QR hoặc Barcode tại đây
                      </span>
                    </button>
                  </div>
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

          {/* <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Link to="/register" className="rounded-lg border border-thiso-200 bg-white p-4 shadow-card transition-all hover:border-thiso-400 hover:shadow-card-md">
              <p className="text-sm font-black text-thiso-900">Đăng ký thủ công</p>
              <p className="mt-1 text-sm leading-6 text-thiso-500">Dùng khi mã chưa có dữ liệu hoặc hệ thống xác thực online gặp sự cố.</p>
            </Link>
            <Link to="/track" className="rounded-lg border border-thiso-200 bg-white p-4 shadow-card transition-all hover:border-thiso-400 hover:shadow-card-md">
              <p className="text-sm font-black text-thiso-900">Theo dõi đơn</p>
              <p className="mt-1 text-sm leading-6 text-thiso-500">Tra cứu trạng thái bằng mã đăng ký hoặc biển số xe sau khi đăng ký.</p>
            </Link>
          </div> */}
        </div>
      </section>

      {scannerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-scanner-title"
          onClick={() => {
            stopScanner();
            setScannerOpen(false);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-card-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-thiso-100 px-4 py-3">
              <div>
                <h2 id="home-scanner-title" className="text-base font-black text-thiso-900">Quét mã</h2>
                <p className="text-xs font-semibold text-thiso-400">{scannerStatus || 'Đang khởi động...'}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary h-9 px-3"
                onClick={() => {
                  stopScanner();
                  setScannerOpen(false);
                }}
              >
                Đóng
              </button>
            </div>
            <div className="relative aspect-[3/4] bg-black sm:aspect-video">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
                autoPlay
              />
              <div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
            </div>
            <div className="border-t border-thiso-100 bg-white px-4 py-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageCodeFile}
              />
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-thiso-200 bg-thiso-50 px-4 py-3 text-sm font-black text-thiso-700 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                onClick={() => fileInputRef.current?.click()}
              >
                Hoặc chọn ảnh mã QR
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
