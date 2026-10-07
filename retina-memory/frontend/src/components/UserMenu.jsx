import { useState, useRef, useEffect } from 'react';

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const joinedDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Three-dot trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          width: '34px', height: '34px', borderRadius: '50%',
          border: `1px solid ${open ? 'var(--brand)' : 'var(--border-default)'}`,
          background: open ? 'var(--brand-dim)' : 'var(--bg-elevated)',
          color: open ? 'var(--brand)' : 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s', fontSize: '16px',
          letterSpacing: '1px', fontWeight: 900,
          minHeight: 'unset',
        }}
      >
        ···
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          aria-label="User options"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: '240px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            animation: 'menu-pop 0.18s ease-out forwards',
            zIndex: 100,
          }}
        >
          {/* User info header */}
          <div style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
              background: 'var(--brand-dim)', border: '2px solid var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px',
            }}>
              {user?.avatar ?? '👤'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? 'User'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                @{user?.username ?? 'user'}
              </div>
            </div>
          </div>

          {/* Info rows */}
          <div style={{ padding: '8px 0' }}>
            {[
              { icon: '📅', label: 'Member since', value: joinedDate },
              { icon: '🔒', label: 'Account type', value: user?.username === 'admin' ? 'Administrator' : 'Standard user' },
              { icon: '🌐', label: 'Session', value: 'Active' },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 16px',
                }}
              >
                <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 12px' }} />

          {/* Logout */}
          <div style={{ padding: '8px' }}>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                width: '100%', padding: '10px 12px',
                borderRadius: 'var(--r-md)', border: 'none',
                background: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                color: 'var(--red)', fontSize: '14px', fontWeight: 600,
                transition: 'background 0.15s', minHeight: 'unset',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '16px' }}>→</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
