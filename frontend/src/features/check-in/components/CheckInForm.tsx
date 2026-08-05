import { CHECK_IN_MODES } from '../constants';
import type { CheckInMode } from '../types';

interface CheckInFormProps {
  input: string;
  mode: CheckInMode;
  loading: boolean;
  onInputChange: (value: string) => void;
  onModeChange: (mode: CheckInMode) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export default function CheckInForm({
  input,
  mode,
  loading,
  onInputChange,
  onModeChange,
  onSubmit,
}: CheckInFormProps) {
  const activeMode = CHECK_IN_MODES.find((item) => item.value === mode) ?? CHECK_IN_MODES[0];

  return (
    <>
      <div className="flex gap-2 mb-5 p-1 bg-thiso-50 rounded-xl">
        {CHECK_IN_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onModeChange(item.value)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === item.value
                ? 'bg-white shadow-card text-thiso-800'
                : 'text-thiso-400 hover:text-thiso-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          className="input flex-1 text-lg font-mono font-bold uppercase"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={activeMode.placeholder}
          required
          autoFocus
        />
        <button type="submit" className="btn-primary px-6 text-base" disabled={loading}>
          {loading ? '...' : 'Check-in ↵'}
        </button>
      </form>
    </>
  );
}
