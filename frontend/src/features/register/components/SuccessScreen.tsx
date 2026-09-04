import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { UNIT_FALLBACKS, useBranding } from '../../../context/BrandingContext';
import { AUTO_TRACK_SECONDS, GOODS_LABEL } from '../constants';
import type { SuccessInfo } from '../types';

type SuccessScreenProps = {
  info: SuccessInfo;
  onReset: () => void;
};

export default function SuccessScreen({ info, onReset }: SuccessScreenProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsToTrack, setSecondsToTrack] = useState(AUTO_TRACK_SECONDS);
  const { units } = useBranding();
  const navigate = useNavigate();

  const trackPath = `/track/${info.code}`;
  const trackUrl = `${window.location.origin}${trackPath}`;

  useEffect(() => {
    QRCode.toDataURL(trackUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#1C1C1C', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [trackUrl]);

  useEffect(() => {
    setSecondsToTrack(AUTO_TRACK_SECONDS);

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
  }, [navigate, trackPath]);

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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1C1C1C';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    let cy = 20;

    cy += 30;
    ctx.fillStyle = '#1C1C1C';
    ctx.font = 'bold 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Phiếu Đăng Ký Giao Hàng', W / 2, cy);

    cy += 24;
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#818181';
    ctx.fillText(
      info.locationName ? `${unitDisplayName} · ${info.locationName}` : unitDisplayName,
      W / 2, cy,
    );

    cy += 12;
    ctx.fillStyle = '#FFF6E6';
    ctx.fillRect(PAD, cy, W - PAD * 2, 50);
    ctx.fillStyle = '#1C1C1C';
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
        ctx.strokeStyle = '#ebebeb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, rowY);
        ctx.lineTo(W - PAD, rowY);
        ctx.stroke();

        ctx.font = '12px Arial, sans-serif';
        ctx.fillStyle = '#818181';
        ctx.textAlign = 'left';
        ctx.fillText(label, PAD, rowY + 24);

        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillStyle = '#1C1C1C';
        ctx.textAlign = 'right';
        ctx.fillText(value, W - PAD, rowY + 24);

        rowY += ROW_H;
      });

      ctx.strokeStyle = '#ebebeb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, rowY);
      ctx.lineTo(W - PAD, rowY);
      ctx.stroke();

      ctx.font = '11px Arial, sans-serif';
      ctx.fillStyle = '#ababab';
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
  body{font-family:Arial,sans-serif;padding:16px;color:#1C1C1C;margin:0}
  .ticket{max-width:360px;margin:0 auto;border:2px solid #1C1C1C;border-radius:12px;padding:20px}
  h2{text-align:center;font-size:17px;margin:0 0 2px}
  .sub{text-align:center;font-size:11px;color:#818181;margin-bottom:12px}
  .code{text-align:center;font-size:30px;font-weight:900;letter-spacing:5px;font-family:monospace;
        background:#FFF6E6;padding:10px;border-radius:8px;margin:10px 0}
  .qr{text-align:center;margin:14px 0}.qr img{width:200px;height:200px}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #ebebeb}
  .lbl{color:#818181}.val{font-weight:700;text-align:right;max-width:60%}
  .footer{text-align:center;font-size:10px;color:#ababab;margin-top:14px;line-height:1.6}
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
  Theo dõi: <span style="font-size:9px;color:#555">${trackUrl}</span>
</div>
</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const unitBrand = units[info.receivingUnit] ?? UNIT_FALLBACKS[info.receivingUnit];
  const unitFb = UNIT_FALLBACKS[info.receivingUnit];
  const unitDisplayName = info.unitDisplayName || unitBrand?.displayName || info.receivingUnit;
  const unitIcon = info.unitIcon || unitBrand?.icon || unitFb?.icon || '';

  return (
    <div className="min-h-screen bg-thiso-50 flex flex-col">
      <div className="bg-green-500 px-4 pt-10 pb-6 text-center">
        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-black text-white">Đăng ký thành công!</h2>
        <p className="text-green-100 text-sm mt-1">{unitIcon} {unitDisplayName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-6 max-w-sm mx-auto w-full space-y-4">
        <div className="bg-white rounded-2xl border-2 border-thiso-100 p-5 text-center shadow-card">
          <p className="text-[11px] font-bold text-thiso-400 uppercase tracking-widest mb-3">
            Đưa QR này cho bảo vệ scan
          </p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ${info.code}`} className="w-56 h-56 mx-auto rounded-xl" />
          ) : (
            <div className="w-56 h-56 mx-auto rounded-xl bg-thiso-50 flex items-center justify-center">
              <span className="text-2xl animate-pulse">⏳</span>
            </div>
          )}
          <div className="mt-3 font-mono font-black text-2xl tracking-widest text-thiso-800">
            {info.code}
          </div>
          <div className="mt-1 flex items-center justify-center gap-3 text-xs text-thiso-400">
            <span className="font-mono font-semibold">{info.vehiclePlate}</span>
            <span>·</span>
            <span>{info.goodsTypeName || GOODS_LABEL[info.goodsType] || info.goodsType}</span>
            <span>·</span>
            <span>{info.requestedTime.split(' ')[0]}</span>
          </div>
        </div>

        <div className="flex gap-0 bg-thiso-50 rounded-2xl overflow-hidden border border-thiso-100">
          {[
            { icon: '🔐', label: 'Check-in cổng', desc: 'Đưa QR cho bảo vệ' },
            { icon: '⏳', label: 'Chờ gọi', desc: 'Theo dõi màn hình' },
            { icon: '🚚', label: 'Vào dock', desc: 'Khi được gọi số' },
          ].map((s, i) => (
            <div key={i} className={`flex-1 text-center px-2 py-3 ${i < 2 ? 'border-r border-thiso-200' : ''}`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <p className="text-[11px] font-bold text-thiso-700 leading-tight">{s.label}</p>
              <p className="text-[10px] text-thiso-400 mt-0.5 leading-tight">{s.desc}</p>
            </div>
          ))}
        </div>

        <a
          href={trackPath}
          className="h-13 flex items-center justify-center gap-2 w-full rounded-2xl border border-thiso-200 bg-white text-thiso-800 font-bold text-base hover:bg-thiso-50 transition-colors py-3.5"
        >
          📱 Theo dõi hành trình
          <span className="text-thiso-500 text-sm font-semibold">
            {secondsToTrack > 0 ? `(${secondsToTrack}s)` : '...'}
          </span>
        </a>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={downloadQRWithInfo}
            disabled={!qrDataUrl}
            className="h-11 flex items-center justify-center gap-2 bg-thiso-100 text-thiso-700 rounded-xl font-bold text-sm hover:bg-thiso-200 disabled:opacity-40 transition-colors"
          >
            ⬇ Tải QR
          </button>
          <button
            onClick={printTicket}
            disabled={!qrDataUrl}
            className="h-11 flex items-center justify-center gap-2 bg-thiso-100 text-thiso-700 rounded-xl font-bold text-sm hover:bg-thiso-200 disabled:opacity-40 transition-colors"
          >
            🖨 In phiếu
          </button>
        </div>

        <button
          onClick={onReset}
          className="h-11 w-full border border-thiso-200 text-thiso-500 rounded-xl font-semibold text-sm hover:bg-thiso-50 transition-colors"
        >
          Đăng ký chuyến khác
        </button>

        <p className="text-center text-[11px] text-thiso-400">
          Lỡ nhập sai thông tin?{' '}
          <Link
            to={`/cancelled?code=${encodeURIComponent(info.code)}`}
            className="text-red-600 underline font-semibold"
          >
            Hủy chuyến
          </Link>
        </p>
      </div>
    </div>
  );
}
