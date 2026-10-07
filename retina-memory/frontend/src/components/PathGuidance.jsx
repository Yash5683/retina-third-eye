/**
 * PathGuidance — analyzes the current camera frame and provides
 * step-by-step navigation instructions ("Walk forward 3 steps, then turn right").
 */
import { useState, useCallback } from 'react';
import { speakNow } from '../voiceOutput';

export default function PathGuidance({ cameraRef, onClose }) {
  const [steps, setSteps]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const analyze = useCallback(async () => {
    if (!cameraRef?.current) return;
    const frame = cameraRef.current.captureFrame();
    if (!frame) { setError('Camera not ready.'); return; }

    setLoading(true);
    setError('');
    setSteps([]);
    setCurrentStep(0);

    try {
      const res = await fetch('/api/path-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame }),
      });
      if (!res.ok) throw new Error('Path analysis failed.');
      const data = await res.json();

      if (data.steps?.length > 0) {
        setSteps(data.steps);
        // Speak first step immediately
        speakNow(`Path guidance: ${data.steps[0]}`);
      } else {
        setError('No clear path detected. Try moving to an open area.');
      }
    } catch (err) {
      setError(err.message || 'Could not analyze path.');
    } finally {
      setLoading(false);
    }
  }, [cameraRef]);

  function speakStep(idx) {
    if (steps[idx]) {
      setCurrentStep(idx);
      speakNow(`Step ${idx + 1}: ${steps[idx]}`);
    }
  }

  function speakAll() {
    if (steps.length === 0) return;
    const full = steps.map((s, i) => `Step ${i + 1}: ${s}`).join('. ');
    speakNow(full);
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--r-xl)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🧭</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Path Guidance</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
        >×</button>
      </div>

      {/* Analyze button */}
      <button
        onClick={analyze}
        disabled={loading}
        style={{
          height: '44px', borderRadius: 'var(--r-full)',
          border: 'none',
          background: loading ? 'var(--bg-overlay)' : 'var(--brand)',
          color: loading ? 'var(--text-muted)' : '#fff',
          fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {loading ? (
          <>
            <span style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            Analyzing path…
          </>
        ) : '📷 Analyze Path Ahead'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--r-lg)', background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '13px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => speakStep(i)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--r-lg)',
                  border: `1px solid ${i === currentStep ? 'var(--brand)' : 'var(--border-subtle)'}`,
                  background: i === currentStep ? 'var(--brand-dim)' : 'var(--bg-overlay)',
                  color: i === currentStep ? 'var(--brand)' : 'var(--text-primary)',
                  fontSize: '14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                  background: i === currentStep ? 'var(--brand)' : 'var(--bg-elevated)',
                  color: i === currentStep ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                {step}
              </button>
            ))}
          </div>

          {/* Navigation controls */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => speakStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              style={{
                flex: 1, height: '40px', borderRadius: 'var(--r-full)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                fontSize: '13px', cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStep === 0 ? 0.4 : 1,
              }}
            >◀ Previous</button>
            <button
              onClick={speakAll}
              style={{
                flex: 1, height: '40px', borderRadius: 'var(--r-full)',
                border: '1px solid var(--brand)',
                background: 'var(--brand-dim)', color: 'var(--brand)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >🔊 Read All</button>
            <button
              onClick={() => speakStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              style={{
                flex: 1, height: '40px', borderRadius: 'var(--r-full)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                fontSize: '13px', cursor: currentStep === steps.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentStep === steps.length - 1 ? 0.4 : 1,
              }}
            >Next ▶</button>
          </div>
        </>
      )}
    </div>
  );
}
