export default function ReceivingTimesInfo() {
  return (
    <div className="bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
      <span className="text-2xl shrink-0">💡</span>
      <div className="text-sm text-sky-800">
        <strong>Cách hoạt động:</strong> Hệ thống tính trung bình thời gian từ "Bắt đầu nhận hàng" đến "Hoàn tất" theo từng đơn vị, loại xe và loại hàng.
        Nhấn <strong>Phân tích lịch sử</strong> để cập nhật khuyến nghị AI, sau đó nhấn <strong>Chấp nhận</strong> để áp dụng.
        Giá trị được chấp nhận sẽ dùng để tính <em>ước tính thời gian chờ</em> hiển thị cho tài xế trên trang theo dõi.
      </div>
    </div>
  );
}
