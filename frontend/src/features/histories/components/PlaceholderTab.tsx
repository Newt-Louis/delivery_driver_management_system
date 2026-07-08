export default function PlaceholderTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-white rounded-2xl border border-thiso-100 shadow-sm px-8 py-12 text-center max-w-md">
        <div className="text-5xl mb-4">🚧</div>
        <h3 className="text-lg font-black text-thiso-800 mb-2">Tính năng đang phát triển</h3>
        <p className="text-sm text-thiso-500 leading-relaxed">
          Tab này hiện đang trong quá trình xây dựng. Vui lòng quay lại sau hoặc sử dụng các tab khác.
        </p>
      </div>
    </div>
  );
}
