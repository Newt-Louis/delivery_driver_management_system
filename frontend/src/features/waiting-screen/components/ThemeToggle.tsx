export default function ThemeToggle({ view, onToggle }: { view: 'dark' | 'bright'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={view === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all touch-manipulation"
      style={view === 'dark'
        ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)' }
        : { background: 'rgba(28,28,28,0.08)', color: '#374151', border: '1px solid rgba(0,0,0,0.12)' }
      }
    >
      {view === 'dark' ? '🌞' : '🌑'}
      <span className="hidden sm:inline">{view === 'dark' ? 'Sáng' : 'Tối'}</span>
    </button>
  );
}
