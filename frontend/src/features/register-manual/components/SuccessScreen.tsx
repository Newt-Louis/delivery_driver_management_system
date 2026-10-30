import { useEffect, useState } from 'react';
import { CheckCircleOutlined, DownloadOutlined, PrinterOutlined, ReloadOutlined, ScanOutlined, TruckOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Descriptions, Result, Space, Spin, Steps, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { UNIT_FALLBACKS, useBranding } from '../../../context/BrandingContext';
import { AUTO_TRACK_SECONDS, GOODS_LABEL } from '../constants';
import type { SuccessInfo } from '../types';
import { useDriverNotifications } from '../../driver-notifications/DriverNotificationsProvider';
import { saveDeliverySession } from '../../../lib/session';

type SuccessScreenProps = {
  info: SuccessInfo;
  onReset: () => void;
};

// The qrcode renderer accepts only #RRGGBB(A) color input, unlike CSS canvas colors.
function qrcodeHex(digits: string) {
  return `${String.fromCharCode(35)}${digits}`;
}

export default function SuccessScreen({ info, onReset }: SuccessScreenProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const [qrGenerationAttempt, setQrGenerationAttempt] = useState(0);
  const [secondsToTrack, setSecondsToTrack] = useState(AUTO_TRACK_SECONDS);
  const { units } = useBranding();
  const navigate = useNavigate();
  const { checkPermissions, setupOpen } = useDriverNotifications();

  const trackPath = `/track/${info.code}`;
  const trackUrl = `${window.location.origin}${trackPath}`;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    saveDeliverySession(info.code);
    checkPermissions();
  }, [info.code, checkPermissions]);

  useEffect(() => {
    let disposed = false;
    setQrDataUrl('');
    setQrError('');
    QRCode.toDataURL(trackUrl, {
      width: 320,
      margin: 2,
      color: { dark: qrcodeHex('1C1C1C'), light: qrcodeHex('ffffff') },
      errorCorrectionLevel: 'M',
    }).then((dataUrl) => {
      if (!disposed) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (!disposed) setQrError('Không thể tạo mã QR. Vui lòng thử lại.');
    });
    return () => { disposed = true; };
  }, [trackUrl, qrGenerationAttempt]);

  useEffect(() => {
    setSecondsToTrack(AUTO_TRACK_SECONDS);
    if (setupOpen) return;

    const interval = window.setInterval(() => {
      setSecondsToTrack((s) => Math.max(0, s - 1));
    }, 1000);
    const timeout = window.setTimeout(() => {
      navigate(trackPath, { replace: true });
    }, AUTO_TRACK_SECONDS * 1000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [navigate, trackPath, setupOpen]);

  function downloadQRWithInfo() {
    if (!qrDataUrl) return;

    const rows: [string, string][] = [
      ['Biển số', info.vehiclePlate],
      ['Tài xế', info.driverName || '—'],
      ['Nhà cung cấp', info.vendorName],
      ['Mã đối chiếu', info.referenceCode],
      ['Loại hàng', info.goodsTypeName || GOODS_LABEL[info.goodsType] || String(info.goodsType)],
      ['Ngày giao', info.requestedTime],
      ...(info.locationName ? [['Khu vực', info.locationName] as [string, string]] : []),
    ];

    const W = 400;
    const PAD = 24;
    const QR_SIZE = 200;
    const ROW_H = 36;
    const H = 20 + 30 + 24 + 12 + 50 + 16 + QR_SIZE + 20 + rows.length * ROW_H + 55 + 20;

    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    let cy = 20;

    cy += 30;
    ctx.fillStyle = 'black';
    ctx.font = 'bold 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Phiếu Đăng Ký Giao Hàng', W / 2, cy);

    cy += 24;
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = 'gray';
    ctx.fillText(
      info.locationName ? `${unitDisplayName} · ${info.locationName}` : unitDisplayName,
      W / 2, cy,
    );

    cy += 12;
    ctx.fillStyle = 'oldlace';
    ctx.fillRect(PAD, cy, W - PAD * 2, 50);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(info.code, W / 2, cy + 33);
    cy += 66;

    const qrY = cy;
    const rowsStartY = cy + QR_SIZE + 20;

    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, (W - QR_SIZE) / 2, qrY, QR_SIZE, QR_SIZE);

      let rowY = rowsStartY;
      rows.forEach(([label, value]) => {
        ctx.strokeStyle = 'gainsboro';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, rowY);
        ctx.lineTo(W - PAD, rowY);
        ctx.stroke();

        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = 'gray';
        ctx.textAlign = 'left';
        ctx.fillText(label, PAD, rowY + 24);

        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'right';
        ctx.fillText(value, W - PAD, rowY + 24);

        rowY += ROW_H;
      });

      ctx.strokeStyle = 'gainsboro';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, rowY);
      ctx.lineTo(W - PAD, rowY);
      ctx.stroke();

      ctx.font = '11px Arial, sans-serif';
      ctx.fillStyle = 'darkgray';
      ctx.textAlign = 'center';
      ctx.fillText('Đưa QR cho bảo vệ scan để check-in', W / 2, rowY + 22);
      ctx.fillText(trackUrl, W / 2, rowY + 38);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `Phieu-${info.code}-${info.vehiclePlate}.png`;
      a.click();
    };
    qrImg.src = qrDataUrl;
  }

  function printTicket() {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return;
    const ub = units[info.receivingUnit] ?? UNIT_FALLBACKS[info.receivingUnit];
    const fb = UNIT_FALLBACKS[info.receivingUnit];
    const unitDisplayName = info.unitDisplayName || ub?.displayName || info.receivingUnit;
    const unitIcon = info.unitIcon || ub?.icon || fb?.icon || '';
    const unitLogoUrl = info.unitLogoUrl ?? ub?.logoUrl ?? null;
    const logoHtml = unitLogoUrl
      ? `<img src="${unitLogoUrl}" style="width:32px;height:32px;object-fit:contain;vertical-align:middle;margin-right:6px"/>`
      : unitIcon;
    const locationRow = info.locationName
      ? `<div class="row"><span class="lbl">Khu vực</span><span class="val">${info.locationName}</span></div>`
      : '';
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Phiếu ${info.code}</title>
<style>
  body{font-family:Arial,sans-serif;padding:16px;color:black;margin:0}
  .ticket{max-width:360px;margin:0 auto;border:2px solid black;border-radius:12px;padding:20px}
  h2{text-align:center;font-size:17px;margin:0 0 2px}
  .sub{text-align:center;font-size:11px;color:gray;margin-bottom:12px}
  .code{text-align:center;font-size:30px;font-weight:900;letter-spacing:5px;font-family:monospace;
        background:oldlace;padding:10px;border-radius:8px;margin:10px 0}
  .qr{text-align:center;margin:14px 0}.qr img{width:200px;height:200px}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid gainsboro}
  .lbl{color:gray}.val{font-weight:700;text-align:right;max-width:60%}
  .footer{text-align:center;font-size:10px;color:darkgray;margin-top:14px;line-height:1.6}
</style></head><body><div class="ticket">
<h2>Phiếu Đăng Ký Giao Hàng</h2>
<div class="sub">${logoHtml} ${unitDisplayName}</div>
<div class="code">${info.code}</div>
<div class="qr"><img src="${qrDataUrl}"/></div>
<div class="row"><span class="lbl">Biển số</span><span class="val">${info.vehiclePlate}</span></div>
<div class="row"><span class="lbl">Tài xế</span><span class="val">${info.driverName || '—'}</span></div>
<div class="row"><span class="lbl">Nhà cung cấp</span><span class="val">${info.vendorName}</span></div>
<div class="row"><span class="lbl">Mã đối chiếu</span><span class="val">${info.referenceCode}</span></div>
<div class="row"><span class="lbl">Loại hàng</span><span class="val">${info.goodsTypeName || GOODS_LABEL[info.goodsType] || info.goodsType}</span></div>
<div class="row"><span class="lbl">Ngày giao</span><span class="val">${info.requestedTime}</span></div>
${locationRow}
<div class="footer">
  Đưa QR cho bảo vệ scan để check-in<br>
  Theo dõi: <span style="font-size:9px;color:dimgray">${trackUrl}</span>
</div>
</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const unitBrand = units[info.receivingUnit] ?? UNIT_FALLBACKS[info.receivingUnit];
  const unitDisplayName = info.unitDisplayName || unitBrand?.displayName || info.receivingUnit;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <Card>
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          title="Đăng ký thành công"
          subTitle={<Space><Avatar size="small" src={info.unitLogoUrl ?? undefined} icon={<TruckOutlined />} />{unitDisplayName}</Space>}
        />

        <div className="space-y-5">
          <Card size="small" title={<Space><ScanOutlined />Mã QR check-in</Space>}>
            <div className="text-center">
              <Typography.Paragraph type="secondary">Đưa mã QR này cho bảo vệ tại cổng để check-in.</Typography.Paragraph>
              {qrDataUrl ? <img src={qrDataUrl} alt={`Mã QR cho ${info.code}`} className="mx-auto h-56 w-56 max-w-full rounded-lg" /> : qrError ? <Alert type="error" showIcon title={qrError} action={<Button size="small" onClick={() => setQrGenerationAttempt((attempt) => attempt + 1)}>Thử lại</Button>} /> : <div className="grid h-56 place-items-center"><Spin description="Đang tạo mã QR..." /></div>}
              <Typography.Paragraph className="!mb-1 !mt-4"><Typography.Text code copyable className="text-base">{info.code}</Typography.Text></Typography.Paragraph>
              <Space size={[4, 4]} wrap className="justify-center"><Tag>{info.vehiclePlate}</Tag><Tag>{info.goodsTypeName || GOODS_LABEL[info.goodsType] || info.goodsType}</Tag><Tag>{info.requestedTime.split(' ')[0]}</Tag></Space>
            </div>
          </Card>

          <Steps size="small" responsive items={[
            { title: 'Check-in cổng', description: 'Đưa QR cho bảo vệ', icon: <ScanOutlined /> },
            { title: 'Chờ gọi', description: 'Theo dõi hàng chờ' },
            { title: 'Vào dock', description: 'Khi được gọi', icon: <TruckOutlined /> },
          ]} />

          <Descriptions size="small" column={1} bordered items={[
            { key: 'plate', label: 'Biển số', children: <Typography.Text code>{info.vehiclePlate}</Typography.Text> },
            { key: 'vendor', label: 'Nhà cung cấp', children: info.vendorName },
            { key: 'reference', label: 'Mã đối chiếu', children: <Typography.Text code>{info.referenceCode}</Typography.Text> },
            { key: 'date', label: 'Ngày giao', children: info.requestedTime },
            ...(info.locationName ? [{ key: 'location', label: 'Khu vực', children: info.locationName }] : []),
          ]} />

          <Button type="primary" size="large" block icon={<TruckOutlined />} onClick={() => navigate(trackPath)}>
            Theo dõi hành trình {secondsToTrack > 0 ? `(${secondsToTrack}s)` : ''}
          </Button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button size="large" icon={<DownloadOutlined />} disabled={!qrDataUrl} onClick={downloadQRWithInfo}>Tải QR</Button>
            <Button size="large" icon={<PrinterOutlined />} disabled={!qrDataUrl} onClick={printTicket}>In phiếu</Button>
          </div>
          <Button size="large" block icon={<ReloadOutlined />} onClick={onReset}>Đăng ký chuyến khác</Button>
        </div>
      </Card>
    </main>
  );
}
