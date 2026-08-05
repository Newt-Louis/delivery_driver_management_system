export default function TrackFooter({ wakeLockActive }: { wakeLockActive: boolean }) {
  return (
    <div className="space-y-1.5 pb-2">
      <p className="text-center text-[11px] text-thiso-300">
        Trang nhận trạng thái realtime khi có thay đổi
      </p>
      {wakeLockActive ? (
        <p className="text-center text-[11px] text-green-500 font-medium">
          🔆 Màn hình đang được giữ sáng
        </p>
      ) : (
        <p className="text-center text-[11px] text-amber-500 font-medium">
          ⚠ Giữ màn hình sáng để nhận cảnh báo âm thanh — nhấn vào trang để bật
        </p>
      )}
    </div>
  );
}
