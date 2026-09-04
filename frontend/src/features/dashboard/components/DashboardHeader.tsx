export default function DashboardHeader() {
  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
      <h1 className="page-title">Điều phối nhận hàng</h1>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-thiso-400">
          <span className="w-2 h-2 rounded-full bg-thisodominant-500 animate-pulse inline-block" />
          Realtime · cập nhật 15s
        </div>
      </div>
    </div>
  );
}
