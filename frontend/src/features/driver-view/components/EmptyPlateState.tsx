export default function EmptyPlateState({ plate }: { plate: string }) {
  return (
    <div className="card text-center py-8">
      <div className="text-3xl mb-2">🔍</div>
      <div className="text-thiso-500 text-sm font-medium">
        Không tìm thấy xe <span className="font-mono font-bold text-thiso-700">{plate}</span>
      </div>
      <div className="text-thiso-400 text-xs mt-1">
        Xe chưa check-in hoặc chưa đăng ký giao hàng hôm nay
      </div>
    </div>
  );
}
