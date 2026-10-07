import { useRef, useState } from 'react';
import CameraFeed from './CameraFeed';

export default function TrainPage({ onDone }) {
  const cameraRef = useRef(null);
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [trained, setTrained] = useState([]);
  const [cameraError, setCameraError] = useState('');

  async function handleTrain(e) {
    e.preventDefault();
    if (!label.trim()) return;
    const frame = cameraRef.current?.captureFrame();
    if (!frame) { setMessage('Camera not ready. Try again.'); setStatus('error'); return; }
    setStatus('training'); setMessage('');
    try {
      const res = await fetch(`/api/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame, label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Training failed');
      setTrained(prev => [data.observation, ...prev]);
      setMessage(data.message);
      setStatus('success');
      setLabel('');
    } catch (err) {
      setMessage(err.message);
      setStatus('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Header */}
      <header style={{
        width: '100%', maxWidth: '640px', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'var(--green-dim)', border: '1px solid var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
          }}>🎓</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>Train Object</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Teach Retina Memory</div>
          </div>
        </div>
        <button
          onClick={onDone}
          aria-label="Back to main app"
          style={{
            height: '36px', padding: '0 14px', borderRadius: 'var(--r-full)',
            border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          ← Back
        </button>
      </header>

      <main style={{ width: '100%', maxWidth: '640px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Instructions */}
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--r-lg)',
          background: 'var(--brand-dim)', border: '1px solid rgba(59,130,246,0.2)',
          fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          Point your camera at an object, type its name below, then tap <strong style={{ color: 'var(--green)' }}>Train</strong>.
          The AI will detect and remember it.
        </div>

        {/* Camera */}
        <div style={{ borderRadius: 'var(--r-xl)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          {cameraError ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--red)', background: 'var(--bg-surface)' }}>
              ⚠ {cameraError}
            </div>
          ) : (
            <CameraFeed ref={cameraRef} hidden={false} onError={setCameraError} />
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleTrain} style={{ display: 'flex', gap: '8px' }}>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Object name (e.g. wallet, keys, mug)"
            aria-label="Object name"
            disabled={status === 'training'}
            style={{
              flex: 1, padding: '0 16px', height: '48px', fontSize: '15px',
              borderRadius: 'var(--r-full)', border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--green)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
          />
          <button
            type="submit"
            disabled={!label.trim() || status === 'training'}
            style={{
              height: '48px', padding: '0 20px', borderRadius: 'var(--r-full)',
              border: 'none',
              background: !label.trim() || status === 'training' ? 'var(--bg-elevated)' : 'var(--green)',
              color: !label.trim() || status === 'training' ? 'var(--text-muted)' : '#000',
              fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {status === 'training' ? '…' : '✓ Train'}
          </button>
        </form>

        {/* Status message */}
        {message && (
          <div
            role="status"
            aria-live="polite"
            className="fade-up"
            style={{
              padding: '12px 16px', borderRadius: 'var(--r-lg)',
              background: status === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${status === 'success' ? 'var(--green)' : 'var(--red)'}`,
              color: status === 'success' ? 'var(--green)' : 'var(--red)',
              fontSize: '14px',
            }}
          >
            {status === 'success' ? '✓ ' : '⚠ '}{message}
          </div>
        )}

        {/* Trained list */}
        {trained.length > 0 && (
          <section>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Trained this session — {trained.length}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {trained.map((obs, i) => (
                <li key={i} style={{
                  padding: '10px 16px', borderRadius: 'var(--r-lg)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)', fontSize: '14px' }}>
                    {obs.object}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {obs.position} · {obs.location}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
