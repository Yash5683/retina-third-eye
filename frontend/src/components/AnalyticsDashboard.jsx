import { useMemo } from 'react';

function StatCard({ label, value, sub, color = 'var(--brand)' }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-lg)', padding: '16px 20px', flex: 1, minWidth: '120px',
    }}>
      <div style={{ fontSize: '26px', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, maxVal, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '100%', borderRadius: '3px 3px 0 0',
            background: color,
            height: `${maxVal > 0 ? (d.count / maxVal) * 72 : 0}px`,
            minHeight: d.count > 0 ? '4px' : '0',
            transition: 'height 0.4s ease',
            opacity: 0.7 + (d.count / (maxVal || 1)) * 0.3,
          }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard({ observations = [] }) {
  const stats = useMemo(() => {
    if (!observations.length) return null;

    // Object frequency
    const freq = {};
    observations.forEach(o => { freq[o.object] = (freq[o.object] || 0) + 1; });
    const topObjects = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Position distribution
    const positions = { left: 0, center: 0, right: 0 };
    observations.forEach(o => { if (positions[o.position] !== undefined) positions[o.position]++; });

    // Activity by hour (last 24h)
    const now = Date.now();
    const hourBuckets = Array.from({ length: 12 }, (_, i) => ({
      label: `${(new Date(now - (11 - i) * 2 * 3600000)).getHours()}h`,
      count: 0,
    }));
    observations.forEach(o => {
      const age = (now - new Date(o.timestamp).getTime()) / 3600000;
      if (age <= 24) {
        const bucket = Math.floor((24 - age) / 2);
        if (bucket >= 0 && bucket < 12) hourBuckets[bucket].count++;
      }
    });

    // Recent 24h count
    const last24h = observations.filter(o => (now - new Date(o.timestamp).getTime()) < 86400000).length;

    return { topObjects, positions, hourBuckets, last24h, total: observations.length, unique: Object.keys(freq).length };
  }, [observations]);

  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>No data yet. Start scanning to see analytics.</p>
      </div>
    );
  }

  const maxBar = Math.max(...stats.hourBuckets.map(b => b.count), 1);
  const maxObj = Math.max(...stats.topObjects.map(o => o.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <StatCard label="Total scans" value={stats.total} color="var(--brand)" />
        <StatCard label="Unique objects" value={stats.unique} color="var(--green)" />
        <StatCard label="Last 24h" value={stats.last24h} color="var(--orange)" />
      </div>

      {/* Activity chart */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Activity — last 24 hours
        </p>
        <BarChart data={stats.hourBuckets} maxVal={maxBar} color="var(--brand)" />
      </div>

      {/* Top objects */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Most seen objects
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stats.topObjects.map(({ name, count }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize', minWidth: '80px' }}>{name}</span>
              <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--bg-overlay)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', background: 'var(--green)', width: `${(count / maxObj) * 100}%`, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '24px', textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Position distribution */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Position distribution
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { key: 'left',   label: 'Left',   color: 'var(--brand)' },
            { key: 'center', label: 'Center', color: 'var(--green)' },
            { key: 'right',  label: 'Right',  color: 'var(--orange)' },
          ].map(({ key, label, color }) => {
            const pct = stats.total > 0 ? Math.round((stats.positions[key] / stats.total) * 100) : 0;
            return (
              <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color }}>{pct}%</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-overlay)', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
