import { useState, useMemo } from 'react';

function relativeTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const POSITION_COLOR = { left: 'var(--brand)', center: 'var(--green)', right: 'var(--orange)' };

export default function MemoryMapDashboard({ observations = [], onClearMemory }) {
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  // Deduplicate — keep most recent per object
  const deduplicated = useMemo(() => {
    const map = {};
    observations.forEach(o => {
      if (!map[o.object] || new Date(o.timestamp) > new Date(map[o.object].timestamp)) {
        map[o.object] = o;
      }
    });
    return Object.values(map);
  }, [observations]);

  const filtered = useMemo(() => {
    let list = deduplicated;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => o.object.includes(q) || o.location?.toLowerCase().includes(q) || o.color?.includes(q));
    }
    if (filterPos !== 'all') list = list.filter(o => o.position === filterPos);
    if (sortBy === 'recent') list = [...list].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (sortBy === 'alpha')  list = [...list].sort((a, b) => a.object.localeCompare(b.object));
    return list;
  }, [deduplicated, search, filterPos, sortBy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search objects, locations…"
          aria-label="Search memory"
          style={{
            flex: 1, minWidth: '160px', height: '40px', padding: '0 14px',
            fontSize: '14px', borderRadius: 'var(--r-full)',
            border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
            color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <select
          value={filterPos}
          onChange={e => setFilterPos(e.target.value)}
          aria-label="Filter by position"
          style={{
            height: '40px', padding: '0 12px', fontSize: '13px',
            borderRadius: 'var(--r-full)', border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          <option value="all">All positions</option>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          aria-label="Sort by"
          style={{
            height: '40px', padding: '0 12px', fontSize: '13px',
            borderRadius: 'var(--r-full)', border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          <option value="recent">Most recent</option>
          <option value="alpha">A → Z</option>
        </select>
      </div>

      {/* Count + clear */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {filtered.length} object{filtered.length !== 1 ? 's' : ''}
          {search || filterPos !== 'all' ? ' (filtered)' : ''}
        </span>
        {observations.length > 0 && (
          <button
            onClick={onClearMemory}
            style={{
              fontSize: '12px', color: 'var(--red)', background: 'none',
              border: '1px solid var(--red)', borderRadius: 'var(--r-full)',
              padding: '4px 12px', cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>🗺</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {search || filterPos !== 'all' ? 'No objects match your filter.' : 'Memory is empty. Start scanning!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
          {filtered.map((obs, i) => {
            const posColor = POSITION_COLOR[obs.position] ?? 'var(--text-muted)';
            return (
              <div
                key={`${obs.object}-${i}`}
                className="fade-up"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${posColor}30`,
                  borderRadius: 'var(--r-lg)',
                  padding: '14px',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  transition: 'border-color 0.2s',
                }}
              >
                <div style={{ fontSize: '24px', lineHeight: 1 }}>
                  {getObjectEmoji(obs.object)}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize', lineHeight: 1.2 }}>
                  {obs.object}
                </div>
                {obs.color && obs.color !== 'unknown' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{obs.color}</div>
                )}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: 'var(--r-full)',
                  background: `${posColor}18`, color: posColor,
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', alignSelf: 'flex-start',
                }}>
                  {obs.position}
                </div>
                {obs.location && obs.location !== 'unknown location' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {obs.location}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 'auto' }}>
                  {relativeTime(obs.timestamp)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getObjectEmoji(name) {
  const map = {
    wallet: '👛', keys: '🔑', phone: '📱', glasses: '👓', remote: '📺',
    book: '📖', cup: '☕', bottle: '🍶', bag: '👜', laptop: '💻',
    watch: '⌚', headphones: '🎧', charger: '🔌', pen: '🖊', notebook: '📓',
    medicine: '💊', medication: '💊', cane: '🦯', umbrella: '☂️',
    shoe: '👟', shoes: '👟', hat: '🧢', jacket: '🧥',
  };
  return map[name.toLowerCase()] ?? '📦';
}
