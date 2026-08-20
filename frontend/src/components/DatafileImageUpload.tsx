import { useCallback, useRef } from 'react';

export type DatafileImageValue = {
  url: string | null;
  originalName?: string;
  file?: File;
};

interface DatafileImageUploadProps {
  value: DatafileImageValue;
  onChange: (value: DatafileImageValue) => void;
  label: string;
  maxSizeKB?: number;
  buttonLabel?: string;
}

export default function DatafileImageUpload({
  value,
  onChange,
  label,
  maxSizeKB = 102400,
  buttonLabel = 'Tải lên',
}: DatafileImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeKB * 1000) {
      alert(`File quá lớn — tối đa ${maxSizeKB}KB`);
      e.target.value = '';
      return;
    }
    onChange({ url: URL.createObjectURL(file), originalName: file.name, file });
    e.target.value = '';
  }, [maxSizeKB, onChange]);

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-start gap-3">
        <div className="rounded-xl border-2 border-thiso-200 bg-thiso-50 flex items-center justify-center overflow-hidden flex-shrink-0 w-16 h-16">
          {value.url
            ? <img src={value.url} alt="preview" className="w-full h-full object-contain p-1" />
            : <span className="text-2xl text-thiso-300">🖼</span>}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => inputRef.current?.click()}>
            {value.url ? `Thay ${buttonLabel.toLowerCase()}` : buttonLabel}
          </button>
          {value.url && (
            <button type="button" className="text-xs text-red-500 hover:text-red-700 text-left" onClick={() => onChange({ url: null })}>
              Xóa
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-[11px] text-thiso-400 leading-relaxed">PNG, JPG, WebP, GIF — tối đa {Math.round(maxSizeKB / 1024)}MB<br />PNG nền trong suốt hiển thị tốt hơn</p>
        </div>
      </div>
    </div>
  );
}
