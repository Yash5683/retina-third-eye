const MODES = {
  idle:      { label: 'READY',     color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)', pulse: false, icon: '●' },
  scanning:  { label: 'SCANNING',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  pulse: true,  icon: '◉' },
  listening: { label: 'LISTENING', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  pulse: true,  icon: '◎' },
  thinking:  { label: 'THINKING',  color: '#a855f7', bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.3)',  pulse: true,  icon: '◈' },
};

export default function StatusIndicator({ mode = 'idle' }) {
  const { label, color, bg, border, pulse } = MODES[mode] ?? MODES.idle;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Status: ${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '5px 12px', borderRadius: 'var(--r-full)',
        background: bg, border: `1px solid ${border}`,
        fontSize: '10px', fontWeight: 700, color,
        letterSpacing: '0.12em', fontFamily: 'var(--font-display)',
        transition: 'all 0.3s ease',
        boxShadow: pulse ? `0 0 12px ${border}` : 'none',
      }}
    >
      <span aria-hidden="true" style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: color, flexShrink: 0,
        animation: pulse ? 'pulse-scale 1.2s ease-in-out infinite' : 'none',
        boxShadow: pulse ? `0 0 6px ${color}` : 'none',
      }}/>
      {label}
    </div>
  );
}
