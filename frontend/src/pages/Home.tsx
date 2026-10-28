import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { ArrowRightOutlined, CameraOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Descriptions, Empty, Form, Input, Modal, Row, Space, Spin, Steps, Typography } from 'antd';
import { useToast } from '../context/ToastContext';
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
import SavedTrips from '../features/driver-notifications/SavedTrips';
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

export default function Home() {
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

  async function handleVerify(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
    <main className="flex flex-1 bg-[var(--dqm-color-bg-layout)] px-4 py-6 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Space orientation="vertical" size="large" className="w-full">
          <SavedTrips />
          <div className="justify-items-center">
            <Typography.Title level={1} className="!mb-2 !text-3xl sm:!text-4xl">Hệ thống điều phối nhận hàng THISO</Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0 !max-w-2xl !text-base ">
              Nhập mã PO hoặc mã Thi Công để hệ thống kiểm tra nhanh thông tin đơn vị nhận, khu vực và loại hàng trước khi đăng ký.
            </Typography.Paragraph>
          </div>

          <Card>
            <Steps
              current={step - 1}
              size="small"
              responsive
              className="mb-8"
              items={[{ title: 'Kiểm tra mã' }, { title: 'Thông tin xe' }, { title: 'Xác nhận' }]}
            />

            {step === 1 && (
              <Form layout="vertical" onFinish={() => { void handleVerify(); }} requiredMark={false}>
                <Form.Item label="Mã PO / Thi Công" validateStatus={orderCodeNotFound ? 'error' : undefined}>
                  <Space.Compact block>
                    <Input
                      id="home-order-code"
                      size="large"
                      value={orderCode}
                      onChange={(event) => handleOrderCodeChange(event.target.value)}
                      placeholder="VD: 4500771144 hoặc AbCdE"
                      autoComplete="off"
                      autoCapitalize="none"
                      className="font-mono tracking-wide"
                    />
                    <Button type="primary" size="large" htmlType="submit" loading={verifying} icon={<ArrowRightOutlined />} iconPlacement="end">
                      Kiểm tra
                    </Button>
                  </Space.Compact>
                </Form.Item>
                <Button block size="large" icon={<CameraOutlined />} onClick={() => setScannerOpen(true)}>
                  Quét QR hoặc Barcode tại đây
                </Button>
              </Form>
            )}

            {step === 2 && verified && (
              <Space direction="vertical" size="large" className="w-full">
                <Alert
                  type="info"
                  showIcon
                  title={verified.kind === 'PO' ? 'PO đã xác thực' : 'Mã Thi Công đã xác thực'}
                  description={<><Typography.Text code>{verified.orderCode}</Typography.Text><br />{verified.unitDisplayName} · {verified.businessLocationName}{effectiveGoodsType ? ` · ${GOODS_LABEL[effectiveGoodsType]}` : ''}</>}
                />

                {needsCalendar ? (
                  <Space direction="vertical" size="middle" className="w-full">
                    {dailyStatsMsg && <Alert type="warning" showIcon title={dailyStatsMsg} />}
                    <div>
                      <Typography.Text strong>Ngày giao hàng</Typography.Text>
                      <div className="mt-2"><DeliveryDateCalendar value={form.deliveryDate} stats={dailyStats} loading={dailyStatsLoading} disabledReasonForDate={(date) => (
                        unitConfig?.sundayFreshFoodOnly && form.goodsType && form.goodsType !== 'FRESH_FOOD' && isSundayDate(date) ? 'Chủ nhật chỉ nhận hàng tươi sống' : undefined
                      )} onChange={(date) => setField('deliveryDate', date)} /></div>
                    </div>
                    <div>
                      <Typography.Text strong>Loại hàng bạn giao</Typography.Text>
                      <div className="mt-2">
                        {unitConfigLoading && <div className="py-4 text-center"><Spin description="Đang tải loại hàng..." /></div>}
                        {unitConfigMsg && <Alert type="warning" showIcon title={unitConfigMsg} />}
                        {!unitConfigLoading && !unitConfigMsg && goodsOptions.length > 0 && (
                          <Row gutter={[12, 12]}>{goodsOptions.map((option) => (
                            <Col key={option.value} xs={24} sm={8}>
                              <Card size="small" hoverable onClick={() => setField('goodsType', option.value)} className={form.goodsType === option.value ? 'border-[var(--dqm-color-primary)]' : undefined}>
                                <Space direction="vertical" size={2}><Typography.Text className="text-2xl">{option.icon}</Typography.Text><Typography.Text strong>{option.title}</Typography.Text>{option.hint && <Typography.Text type="secondary">{option.hint}</Typography.Text>}</Space>
                              </Card>
                            </Col>
                          ))}</Row>
                        )}
                        {!unitConfigLoading && !unitConfigMsg && goodsOptions.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đơn vị này chưa mở loại hàng nào để đăng ký." />}
                      </div>
                    </div>
                  </Space>
                ) : (
                  <Descriptions bordered size="small" column={1} items={[{ key: 'delivery-date', label: 'Ngày giao từ PO', children: formatDate(form.deliveryDate) }]} />
                )}

                <Form layout="vertical" requiredMark="optional">
                  <Row gutter={[16, 0]}>
                    <Col xs={24} sm={12}><Form.Item label="Tên tài xế"><Input value={form.driverName} onChange={(event) => setField('driverName', event.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" /></Form.Item></Col>
                    <Col xs={24} sm={12}><Form.Item label="Số điện thoại" required><Input value={form.driverPhone} onChange={(event) => setField('driverPhone', event.target.value)} placeholder="090..." inputMode="tel" autoComplete="tel" /></Form.Item></Col>
                    <Col xs={24} sm={12}><Form.Item label="Biển số xe" required><Input value={form.vehiclePlate} onChange={(event) => setField('vehiclePlate', event.target.value.toUpperCase())} placeholder="51C12345" autoComplete="off" className="font-mono uppercase" /></Form.Item></Col>
                    <Col xs={24} sm={12}><Form.Item label="Mã NCC"><Input value={form.vendorCode} onChange={(event) => setField('vendorCode', event.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="08723875" autoComplete="off" className="font-mono" /></Form.Item></Col>
                    <Col span={24}><Form.Item label="Tên NCC / Công ty"><Input value={form.vendorName} onChange={(event) => setField('vendorName', event.target.value)} placeholder="Công ty TNHH ABC" autoComplete="organization" /></Form.Item></Col>
                  </Row>
                </Form>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button onClick={() => setStep(1)}>Nhập mã khác</Button><Button type="primary" icon={<ArrowRightOutlined />} iconPlacement="end" onClick={goReview}>Tiếp tục</Button></div>
              </Space>
            )}

            {step === 3 && verified && (
              <Space direction="vertical" size="large" className="w-full">
                <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} items={[
                  { key: 'type', label: 'Loại đăng ký', children: verified.kind === 'PO' ? 'PO' : 'Thi Công' },
                  { key: 'code', label: 'Mã', children: <Typography.Text code>{verified.orderCode}</Typography.Text> },
                  { key: 'location', label: 'Khu vực', children: `${verified.businessLocationName} (${verified.businessLocationCode})` },
                  { key: 'unit', label: 'Đơn vị', children: verified.unitDisplayName },
                  { key: 'date', label: 'Ngày giao', children: formatDate(form.deliveryDate) },
                  { key: 'goods', label: 'Loại hàng', children: effectiveGoodsType ? GOODS_LABEL[effectiveGoodsType] : 'Chưa chọn' },
                  { key: 'vehicle', label: 'Loại xe', children: VEHICLE_LABEL[verified.vehicleType] },
                  { key: 'driver', label: 'Tài xế', children: form.driverName || '—' },
                  { key: 'phone', label: 'Số điện thoại', children: form.driverPhone },
                  { key: 'plate', label: 'Biển số', children: <Typography.Text code>{form.vehiclePlate.toUpperCase().replace(/\s+/g, '')}</Typography.Text> },
                  { key: 'vendor-code', label: 'Mã NCC', children: form.vendorCode || '—' },
                  { key: 'vendor', label: 'Tên NCC / Công ty', children: form.vendorName || '—' },
                ]} />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button disabled={submitting} onClick={() => setStep(2)}>Sửa thông tin</Button><Button type="primary" loading={submitting} onClick={submitRegistration}>Hoàn tất đăng ký</Button></div>
              </Space>
            )}
          </Card>
        </Space>
      </div>

      <Modal
        open={scannerOpen}
        title="Quét mã"
        onCancel={() => { stopScanner(); setScannerOpen(false); }}
        footer={<Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>Chọn ảnh mã QR</Button>}
        destroyOnHidden
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <Typography.Text type="secondary">{scannerStatus || 'Đang khởi động...'}</Typography.Text>
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-black sm:aspect-video"><video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay /><div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-white/90" /></div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageCodeFile} />
        </Space>
      </Modal>
    </main>
  );
}
