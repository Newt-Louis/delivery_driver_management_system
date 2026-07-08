import { useState, useRef, useEffect } from 'react';
import type { ColumnConfig } from '../types';

interface ColumnToggleProps {
  columns: ColumnConfig[];
  visibleKeys: string[];
  onChange: (keys: string[]) => void;
}

export default function ColumnToggle({ columns, visibleKeys, onChange }: ColumnToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(key: string) {
    if (visibleKeys.includes(key)) {
      if (visibleKeys.length <= 1) return;
      onChange(visibleKeys.filter((k) => k !== key));
    } else {
      onChange([...visibleKeys, key]);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-thiso-200 rounded-xl text-thiso-600 hover:bg-thiso-50 transition-colors"
      >
        <span>⚙</span> Cột hiển thị
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-thiso-200 rounded-xl shadow-lg z-20 w-56 max-h-80 overflow-y-auto py-1">
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-thiso-700 hover:bg-thiso-50 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={visibleKeys.includes(col.key)}
                onChange={() => toggle(col.key)}
                className="rounded border-thiso-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="truncate">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
