export default function ProcessGuide({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    { icon: '📝', label: 'Đăng ký', desc: 'Điền form → nhận mã QR' },
    { icon: '🔍', label: 'Check-in', desc: 'Đưa QR cho bảo vệ cổng' },
    { icon: '⏳', label: 'Chờ gọi', desc: 'Theo dõi màn hình TV' },
    { icon: '🚚', label: 'Vào dock', desc: 'Giao hàng & hoàn tất' },
  ];

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sky-600 text-base">ℹ</span>
          <span className="text-sm font-bold text-sky-800">Quy trình giao hàng</span>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-full text-sky-400 hover:bg-sky-200 transition-colors text-xl leading-none"
          aria-label="Đóng hướng dẫn"
        >
          ×
        </button>
      </div>
      <div className="flex items-start gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className="flex-1 text-center min-w-0">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xs font-bold text-sky-800 leading-tight">{s.label}</div>
              <div className="text-[10px] text-sky-500 mt-0.5 leading-tight">{s.desc}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="text-sky-300 text-sm px-0.5 flex-shrink-0 mt-[-18px]">›</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-sky-600 mt-3 border-t border-sky-200 pt-2">
        Đăng ký trước để được ưu tiên gọi xe sớm hơn. Mã QR nhận được dùng để check-in tại cổng.
      </p>
    </div>
  );
}
