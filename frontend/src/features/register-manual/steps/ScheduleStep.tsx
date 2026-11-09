import { CalendarOutlined, CameraOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { createScanHints } from '../utils/scanner';
import { Alert, Button, Card, Form, Input, Modal, Space, Typography } from 'antd';
import type { DailyRegistrationStat } from '../api';
import FormFieldSlot from '../components/FormFieldSlot';
import type { FormState, SetFormField } from '../types';

type ScheduleStepProps = {
  form: FormState;
  dailyStats: DailyRegistrationStat[];
  dailyStatsMsg: string;
  dailyStatsLoading: boolean;
  manualReferenceLoading: boolean;
  manualReferenceError: string;
  sundayFreshFoodBlocked: boolean;
  set: SetFormField;
  onRetryManualReferenceCode: () => void;
};

export default function ScheduleStep({ form, dailyStats, dailyStatsMsg, dailyStatsLoading, manualReferenceLoading, manualReferenceError, sundayFreshFoodBlocked, set, onRetryManualReferenceCode }: ScheduleStepProps) {
  const todayStats = dailyStats.find((item) => item.date === form.deliveryDate);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onCodeRef = useRef(set);
  onCodeRef.current = set;

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let active = true;
    let handled = false;
    const video = videoRef.current;
    setStatus('Đang mở camera...');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Không thể mở camera. Hãy kiểm tra quyền camera và sử dụng HTTPS hoặc localhost.');
      return;
    }
    Promise.all([import('@zxing/browser'), import('@zxing/library')]).then(([browser, library]) => {
      if (!active) return null;
      const reader = new browser.BrowserMultiFormatReader(createScanHints(library), { delayBetweenScanAttempts: 250, delayBetweenScanSuccess: 500, tryPlayVideoTimeout: 5000 });
      return reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video, (result, _error, controls) => {
        if (!active || handled || !result) return;
        handled = true;
        controls.stop();
        onCodeRef.current('poNumber', result.getText().trim());
        setOpen(false);
      });
    }).then((controls) => {
      if (!controls) return;
      if (!active) { controls.stop(); return; }
      controlsRef.current = controls;
      setStatus('Đang quét...');
    }).catch(() => { if (active) setStatus('Không mở được camera. Vui lòng kiểm tra quyền camera hoặc chọn ảnh mã.'); });
    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
      const stream = video.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [open]);

  async function readImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    setStatus('Đang đọc mã trong ảnh...');
    try {
      const [browser, library] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
      const reader = new browser.BrowserMultiFormatReader(createScanHints(library));
      const result = await reader.decodeFromImageUrl(url);
      set('poNumber', result.getText().trim());
      setOpen(false);
    } catch {
      setStatus('Không tìm thấy QR hoặc Barcode rõ ràng trong ảnh. Vui lòng thử lại.');
    } finally { URL.revokeObjectURL(url); }
  }

  return (
    <div className="space-y-5">
      <Card size="small" title={<><CalendarOutlined /> Ngày giao hàng</>}>
        {dailyStatsMsg && <Alert className="mb-4" type="warning" showIcon title={dailyStatsMsg} />}
        {sundayFreshFoodBlocked && <Alert className="mb-4" type="warning" showIcon title="Chủ nhật chỉ nhận hàng tươi sống" />}
        <Form.Item<FormState>
          name="deliveryDate"
          className="!mb-0"
          rules={[{
            validator: async (_, value: string = '') => {
              if (manualReferenceLoading) throw new Error('Đang xác định ngày giao hàng, vui lòng đợi trong giây lát.');
              if (!value) throw new Error(manualReferenceError || 'Không thể xác định ngày giao hàng. Vui lòng thử lại.');
              if (sundayFreshFoodBlocked) throw new Error('Chủ nhật chỉ nhận hàng tươi sống. Vui lòng quay lại bước 1 để đổi loại hàng.');
            },
          }]}
        >
          <FormFieldSlot>
            <Typography.Text strong>{form.deliveryDate ? form.deliveryDate.split('-').reverse().join('/') : 'Đang xác định ngày giao hàng...'}</Typography.Text>
            {dailyStatsLoading && <div><Typography.Text type="secondary">Đang kiểm tra công suất đăng ký...</Typography.Text></div>}
            {todayStats?.available === false && <Alert className="mt-3" type="warning" showIcon title={todayStats.reason ?? 'Hôm nay đã đạt công suất đăng ký.'} />}
          </FormFieldSlot>
        </Form.Item>
      </Card>

      <Card size="small" title="Thông tin đơn hàng">
        <Form.Item<FormState>
          label="Mã PO / Thi Công"
          name="poNumber"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập mã PO / Thi Công' }]}
          className="!mb-0"
        >
          <Input size="large" placeholder="Nhập mã PO / Thi Công" autoComplete="off" suffix={<Button type="text" icon={<CameraOutlined style={{ fontSize: 24 }} />} aria-label="Quét mã QR hoặc barcode" onClick={() => setOpen(true)} />} />
        </Form.Item>
        {manualReferenceError && <Alert className="mt-3" type="error" showIcon title={manualReferenceError} action={<Button size="small" icon={<ReloadOutlined />} onClick={onRetryManualReferenceCode}>Thử lại</Button>} />}
        {manualReferenceLoading && <Typography.Text type="secondary">Đang xác định ngày giao hàng...</Typography.Text>}
        <Modal open={open} title="Quét mã QR hoặc Barcode" onCancel={() => setOpen(false)} footer={<Button icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>Chọn ảnh mã</Button>} destroyOnHidden>
          <Space orientation="vertical" size="middle" className="w-full">
            <Typography.Text type="secondary">{status}</Typography.Text>
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-black sm:aspect-video"><video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay /><div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-white/90" /></div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={readImage} />
          </Space>
        </Modal>
      </Card>
    </div>
  );
}
