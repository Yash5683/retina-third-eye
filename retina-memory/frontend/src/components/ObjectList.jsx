const OBJECT_EMOJI = {
  wallet:'💳', keys:'🔑', phone:'📱', glasses:'👓', laptop:'💻',
  book:'📖', cup:'☕', mug:'☕', bottle:'🧴', bag:'👜',
  remote:'📺', charger:'🔌', headphones:'🎧', watch:'⌚',
  medicine:'💊', medication:'💊', cane:'🦯', shoes:'👟',
  door:'🚪', chair:'🪑', table:'🪑', desk:'🖥', window:'🪟',
  person:'🧑', man:'🧑', woman:'👩', sign:'🪧', screen:'🖥',
};

const POSITION_CFG = {
  left:   { label:'Left',   color:'#3b82f6', bar:'←' },
  center: { label:'Center', color:'#10b981', bar:'↕' },
  right:  { label:'Right',  color:'#f59e0b', bar:'→' },
};

function relativeTime(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 10)    return 'just now';
  if (d < 60)    return `${d}s ago`;
  if (d < 3600)  return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}

function getEmoji(name) {
  const key = name?.toLowerCase() ?? '';
  for (const [k,v] of Object.entries(OBJECT_EMOJI)) {
    if (key.includes(k)) return v;
  }
  return '📦';
}

export default function ObjectList({ observations = [] }) {
  if (observations.length === 0) return null;
  const items = [...observations].reverse();

  return (
    <ul role="list" aria-label="Recently detected objects"
      style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:'6px' }}>
      {items.map((obs, idx) => {
        const pos = POSITION_CFG[obs.position] ?? { label: obs.position, color:'#8899aa', bar:'?' };
        const emoji = getEmoji(obs.object);
        const conf = obs.confidence ? Math.round(obs.confidence * 100) : null;
        return (
          <li key={`${obs.object}-${obs.timestamp}-${idx}`}
            className="fade-up card-hover glass"
            style={{
              display:'flex', alignItems:'center', gap:'14px',
              padding:'12px 16px', borderRadius:'var(--r-lg)',
              animationDelay:`${idx * 0.04}s`,
            }}>
            {/* Emoji icon */}
            <div style={{
              width:'40px', height:'40px', borderRadius:'var(--r-md)', flexShrink:0,
              background:`${pos.color}15`,
              border:`1px solid ${pos.color}25`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'20px',
            }}>{emoji}</div>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
                <span style={{ fontSize:'14px', fontWeight:700, color:'var(--text-primary)', textTransform:'capitalize' }}>
                  {obs.object}
                </span>
                {obs.color && obs.color !== 'unknown' && (
                  <span style={{
                    fontSize:'10px', fontWeight:600, color:'var(--text-muted)',
                    padding:'1px 7px', borderRadius:'var(--r-full)',
                    background:'var(--bg-overlay)', border:'1px solid var(--border-subtle)',
                    textTransform:'capitalize',
                  }}>{obs.color}</span>
                )}
              </div>
              {obs.location && obs.location !== 'unknown location' && (
                <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.4,
                  overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                  {obs.location}
                </div>
              )}
            </div>

            {/* Right side */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'5px', flexShrink:0 }}>
              <span style={{
                fontSize:'10px', fontWeight:700, letterSpacing:'0.08em',
                padding:'3px 9px', borderRadius:'var(--r-full)',
                color: pos.color, background:`${pos.color}15`,
                border:`1px solid ${pos.color}30`,
              }}>{pos.bar} {pos.label}</span>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                {conf !== null && (
                  <div style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                    <div style={{ width:'32px', height:'3px', borderRadius:'2px', background:'var(--bg-overlay)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${conf}%`, borderRadius:'2px', background:`${pos.color}`, transition:'width 0.5s ease' }}/>
                    </div>
                    <span style={{ fontSize:'10px', color:'var(--text-muted)' }}>{conf}%</span>
                  </div>
                )}
                <span style={{ fontSize:'10px', color:'var(--text-dim)' }}>{relativeTime(obs.timestamp)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
