export default function DashboardLegend() {
  return (
    <div className="mt-6 pt-4 border-t border-thiso-100 flex flex-wrap gap-4 text-xs text-thiso-400">
      <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded bg-red-500 inline-block" /> FF &gt;30 phút (khẩn)</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded bg-yellow-400 inline-block" /> FF &gt;20 phút / No-show &gt;15 phút</span>
      <span>🎫 Số thẻ dùng prefix từ tên rút gọn của đơn vị &nbsp;|&nbsp; T=Xe Tải · M=Xe Máy</span>
    </div>
  );
}
