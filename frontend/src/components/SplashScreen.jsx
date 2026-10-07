import { useEffect, useState } from 'react';

const LETTERS = ['R', 'E', 'T', 'I', 'N', 'A'];

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('eye');   // eye → letters → subtitle → dots → out
  const [dotStep, setDotStep] = useState(0);

  useEffect(() => {
    // eye open: 0–700ms
    const t1 = setTimeout(() => setPhase('letters'), 700);
    // letters: 700–1600ms
    const t2 = setTimeout(() => setPhase('subtitle'), 1600);
    // subtitle: 1600–2400ms
    const t3 = setTimeout(() => setPhase('dots'), 2400);
    // dots bounce for 900ms then fade out
    const t4 = setTimeout(() => setPhase('out'), 3300);
    // unmount after fade
    const t5 = setTimeout(() => onDone(), 3800);
    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, [onDone]);

  // Cycle dot highlight
  useEffect(() => {
    if (phase !== 'dots') return;
    const iv = setInterval(() => setDotStep(s => (s + 1) % 3), 220);
    return () => clearInterval(iv);
  }, [phase]);

  const visible = phase !== 'out';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '28px',
      animation: phase === 'out' ? 'splash-fade-out 0.5s ease-out forwards' : 'none',
    }}>

      {/* ── Eye logo ── */}
      <div style={{
        position: 'relative',
        width: '120px', height: '120px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Outer glow ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          animation: phase !== 'eye' ? 'glow-ring 2s ease-in-out infinite' : 'none',
          border: '1px solid rgba(59,130,246,0.3)',
        }} />

        {/* Eye shape */}
        <div style={{
          width: '110px', height: '110px', borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, #1e3a5f 0%, #0a1628 60%, #050d1a 100%)',
          border: '2px solid rgba(59,130,246,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
          animation: 'eye-open 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards',
          transformOrigin: 'center',
        }}>
          {/* Iris */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #3b82f6 0%, #1d4ed8 50%, #1e3a8a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: phase !== 'eye' ? 'iris-pulse 2s ease-in-out infinite' : 'none',
            position: 'relative',
          }}>
            {/* Pupil */}
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: '#020408',
              boxShadow: 'inset 0 0 8px rgba(59,130,246,0.4)',
            }} />
            {/* Catchlight */}
            <div style={{
              position: 'absolute', top: '10px', left: '14px',
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.7)',
            }} />
          </div>

          {/* Scan line */}
          {phase !== 'eye' && (
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.8), transparent)',
              animation: 'scan-line 1.8s linear infinite',
            }} />
          )}
        </div>
      </div>

      {/* ── RETINA letters ── */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {LETTERS.map((letter, i) => (
          <span
            key={letter}
            style={{
              fontSize: '42px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              color: '#fff',
              textShadow: '0 0 20px rgba(59,130,246,0.6)',
              opacity: phase === 'eye' ? 0 : 1,
              transform: phase === 'eye' ? 'translateY(-24px)' : 'translateY(0)',
              transition: `opacity 0.35s ease ${i * 0.07}s, transform 0.35s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s`,
              display: 'inline-block',
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* ── THE THIRD EYE subtitle ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        opacity: phase === 'eye' || phase === 'letters' ? 0 : 1,
        transform: phase === 'eye' || phase === 'letters' ? 'translateY(16px)' : 'translateY(0)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'rgba(59,130,246,0.7)',
        }}>
          THE
        </span>
        <span style={{
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'rgba(59,130,246,0.9)',
          textShadow: '0 0 12px rgba(59,130,246,0.4)',
        }}>
          THIRD EYE
        </span>
      </div>

      {/* ── Loading dots ── */}
      <div style={{
        display: 'flex', gap: '8px', alignItems: 'center',
        opacity: phase === 'dots' || phase === 'out' ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: dotStep === i ? 'var(--brand)' : 'rgba(59,130,246,0.3)',
              transform: dotStep === i ? 'translateY(-8px)' : 'translateY(0)',
              transition: 'transform 0.2s ease, background 0.2s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
