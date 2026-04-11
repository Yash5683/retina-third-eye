export default function ScanButton({ onClick, disabled = false, loading = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-label="Scan now"
      aria-busy={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 24px',
        height: '48px',
        fontSize: '14px',
        fontWeight: 600,
        borderRadius: 'var(--r-full)',
        border: '1px solid var(--border-default)',
        background: disabled || loading ? 'var(--bg-elevated)' : 'var(--brand-dim)',
        color: disabled || loading ? 'var(--text-muted)' : 'var(--brand)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
      onMouseLeave={e => { if (!disabled && !loading) e.currentTarget.style.background = 'var(--brand-dim)'; }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: loading ? '2px solid var(--brand)' : 'none',
          borderTopColor: loading ? 'transparent' : undefined,
          animation: loading ? 'spin 0.8s linear infinite' : 'none',
          fontSize: loading ? 0 : '15px',
        }}
      >
        {!loading && '⬤'}
      </span>
      {loading ? 'Scanning…' : 'Scan Now'}
    </button>
  );
}
