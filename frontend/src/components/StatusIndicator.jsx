const MODES = {
  idle:      { label: 'Ready',     dot: '#4a5568', ring: 'transparent', pulse: false },
  scanning:  { label: 'Scanning',  dot: '#3b82f6', ring: 'rgba(59,130,246,0.3)', pulse: true },
  listening: { label: 'Listening', dot: '#f97316', ring: 'rgba(249,115,22,0.3)', pulse: true },
  thinking:  { label: 'Thinking',  dot: '#a855f7', ring: 'rgba(168,85,247,0.3)', pulse: true },
};

export default function StatusIndicator({ mode = 'idle' }) {
  const { label, dot, ring, pulse } = MODES[mode] ?? MODES.idle;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Status: ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '9999px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        fontSize: '13px',
        fontWeight: 600,
        color: dot,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
          animation: pulse ? `pulse-ring 1.5s ease-out infinite` : 'none',
          boxShadow: pulse ? `0 0 0 0 ${ring}` : 'none',
        }}
      />
      {label}
    </div>
  );
}
