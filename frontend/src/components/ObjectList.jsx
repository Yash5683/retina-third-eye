function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10)    return 'just now';
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const POSITION_CONFIG = {
  left:   { label: 'Left',   color: '#3b82f6', icon: '◀' },
  center: { label: 'Center', color: '#22c55e', icon: '●' },
  right:  { label: 'Right',  color: '#f97316', icon: '▶' },
};

function PositionBadge({ position }) {
  const cfg = POSITION_CONFIG[position] ?? { label: position, color: '#8899aa', icon: '?' };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: `${cfg.color}18`,
      border: `1px solid ${cfg.color}30`,
    }}>
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

export default function ObjectList({ observations = [] }) {
  if (observations.length === 0) return null;

  return (
    <ul
      role="list"
      aria-label="Recently detected objects"
      style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      {[...observations].reverse().map((obs, idx) => (
        <li
          key={`${obs.object}-${obs.timestamp}-${idx}`}
          role="listitem"
          className="fade-up"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--r-lg)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            transition: 'border-color 0.2s',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {obs.object}
              </span>
              {obs.color && obs.color !== 'unknown' && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {obs.color}
                </span>
              )}
            </div>
            {obs.location && obs.location !== 'unknown location' && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {obs.location}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <PositionBadge position={obs.position} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {relativeTime(obs.timestamp)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
