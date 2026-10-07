import { useEffect, useState } from 'react';

const LETTERS = ['R', 'E', 'T', 'I', 'N', 'A'];

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('eye');
  const [dotStep, setDotStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('letters'),  700);
    const t2 = setTimeout(() => setPhase('subtitle'), 1500);
    const t3 = setTimeout(() => setPhase('dots'),     2200);
    const t4 = setTimeout(() => setPhase('out'),      3200);
    const t5 = setTimeout(() => onDone(),             3700);
    return () => [t1,t2,t3,t4,t5].forEach(clearTimeout);
  }, [onDone]);

  useEffect(() => {
    if (phase !== 'dots') return;
    const iv = setInterval(() => setDotStep(s => (s+1) % 3), 220);
    return () => clearInterval(iv);
  }, [phase]);

  // Progress bar
  useEffect(() => {
    const start = Date.now();
    const duration = 3200;
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '32px',
      animation: phase === 'out' ? 'splash-exit 0.5s ease-in forwards' : 'none',
      overflow: 'hidden',
    }}>

      {/* Aurora orbs */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <div style={{
          position:'absolute', top:'15%', left:'10%',
          width:'400px', height:'400px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
          filter:'blur(40px)',
        }}/>
        <div style={{
          position:'absolute', bottom:'15%', right:'10%',
          width:'300px', height:'300px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)',
          filter:'blur(40px)',
        }}/>
      </div>

      {/* Eye */}
      <div style={{ position:'relative', width:'140px', height:'140px', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {/* Outer rings */}
        {[1,2,3].map((i) => (
          <div key={i} style={{
            position:'absolute', inset:`${-i*16}px`,
            borderRadius:'50%',
            border:`1px solid rgba(59,130,246,${0.15 - i*0.04})`,
            animation: phase !== 'eye' ? `pulse-scale ${1.5 + i*0.3}s ease-in-out infinite` : 'none',
          }}/>
        ))}

        {/* Eye orb */}
        <div style={{
          width:'120px', height:'120px', borderRadius:'50%',
          background:'radial-gradient(circle at 38% 32%, #1a3a6e 0%, #0a1628 55%, #040a14 100%)',
          border:'2px solid rgba(59,130,246,0.6)',
          display:'flex', alignItems:'center', justifyContent:'center',
          overflow:'hidden', position:'relative',
          animation:'eye-open 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards',
          transformOrigin:'center',
          boxShadow:'0 0 40px rgba(59,130,246,0.3), inset 0 0 30px rgba(0,0,0,0.5)',
        }}>
          {/* Iris */}
          <div style={{
            width:'60px', height:'60px', borderRadius:'50%',
            background:'radial-gradient(circle at 35% 32%, #3b82f6 0%, #1d4ed8 45%, #1e3a8a 100%)',
            display:'flex', alignItems:'center', justifyContent:'center',
            position:'relative',
            animation: phase !== 'eye' ? 'iris-pulse 2s ease-in-out infinite' : 'none',
            boxShadow:'0 0 20px rgba(59,130,246,0.5)',
          }}>
            {/* Pupil */}
            <div style={{
              width:'24px', height:'24px', borderRadius:'50%',
              background:'#010408',
              boxShadow:'inset 0 0 10px rgba(59,130,246,0.5)',
            }}/>
            {/* Catchlight */}
            <div style={{
              position:'absolute', top:'10px', left:'15px',
              width:'9px', height:'9px', borderRadius:'50%',
              background:'rgba(255,255,255,0.75)',
            }}/>
            <div style={{
              position:'absolute', bottom:'12px', right:'10px',
              width:'4px', height:'4px', borderRadius:'50%',
              background:'rgba(255,255,255,0.35)',
            }}/>
          </div>

          {/* Scan line */}
          {phase !== 'eye' && (
            <div style={{
              position:'absolute', left:0, right:0, height:'2px',
              background:'linear-gradient(90deg, transparent, rgba(59,130,246,0.9), transparent)',
              boxShadow:'0 0 8px rgba(59,130,246,0.8)',
              animation:'scan-line 1.6s linear infinite',
            }}/>
          )}
        </div>
      </div>

      {/* RETINA letters */}
      <div style={{ display:'flex', gap:'2px', alignItems:'center' }}>
        {LETTERS.map((letter, i) => (
          <span key={letter} style={{
            fontSize:'48px', fontWeight:900,
            fontFamily:'var(--font-display)',
            letterSpacing:'0.06em',
            background:'linear-gradient(135deg, #fff 30%, rgba(59,130,246,0.9) 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            opacity: phase === 'eye' ? 0 : 1,
            transform: phase === 'eye' ? 'translateY(-30px) rotate(-4deg)' : 'translateY(0) rotate(0)',
            transition:`opacity 0.4s ease ${i*0.07}s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i*0.07}s`,
            display:'inline-block',
          }}>
            {letter}
          </span>
        ))}
      </div>

      {/* Subtitle */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
        opacity: phase === 'eye' || phase === 'letters' ? 0 : 1,
        transform: phase === 'eye' || phase === 'letters' ? 'translateY(20px)' : 'translateY(0)',
        transition:'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'40px', height:'1px', background:'linear-gradient(90deg, transparent, rgba(59,130,246,0.5))' }}/>
          <span style={{
            fontSize:'11px', fontWeight:700, letterSpacing:'0.3em',
            textTransform:'uppercase', color:'rgba(59,130,246,0.8)',
          }}>THE THIRD EYE</span>
          <div style={{ width:'40px', height:'1px', background:'linear-gradient(90deg, rgba(59,130,246,0.5), transparent)' }}/>
        </div>
        <span style={{ fontSize:'13px', color:'rgba(148,163,184,0.7)', letterSpacing:'0.1em' }}>
          AI Object Memory Assistant
        </span>
      </div>

      {/* Loading bar + dots */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', width:'200px' }}>
        {/* Progress bar */}
        <div style={{
          width:'100%', height:'2px', borderRadius:'1px',
          background:'rgba(255,255,255,0.06)', overflow:'hidden',
          opacity: phase === 'dots' || phase === 'out' ? 1 : 0,
          transition:'opacity 0.3s ease',
        }}>
          <div style={{
            height:'100%', borderRadius:'1px',
            background:'linear-gradient(90deg, var(--brand), var(--purple))',
            width:`${progress}%`,
            transition:'width 0.1s linear',
            boxShadow:'0 0 8px rgba(59,130,246,0.6)',
          }}/>
        </div>

        {/* Dots */}
        <div style={{
          display:'flex', gap:'8px',
          opacity: phase === 'dots' || phase === 'out' ? 1 : 0,
          transition:'opacity 0.3s ease',
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width:'7px', height:'7px', borderRadius:'50%',
              background: dotStep === i ? 'var(--brand-bright)' : 'rgba(59,130,246,0.25)',
              boxShadow: dotStep === i ? '0 0 8px rgba(59,130,246,0.6)' : 'none',
              transform: dotStep === i ? 'translateY(-8px) scale(1.3)' : 'translateY(0) scale(1)',
              transition:'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}/>
          ))}
        </div>
      </div>
    </div>
  );
}
