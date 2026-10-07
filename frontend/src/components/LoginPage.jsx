import { useState, useEffect, useRef } from 'react';

const DEMO_USERS = [
  { username: 'admin', password: 'retina123', name: 'Admin User', avatar: '👤' },
  { username: 'demo',  password: 'demo',      name: 'Demo User',  avatar: '🧑' },
];

const VOICE_TRIGGER = 'login';
const WELCOME_MESSAGE = 'WELCOME TO THE RETINA THE THIRD. PLEASE ENSURE TO LOGIN.';
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

function speakWelcome() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(WELCOME_MESSAGE);
  utterance.lang = 'en-IN';
  utterance.rate = 0.95;
  utterance.volume = 1.0;
  utterance.pitch = 1.0; // neutral for welcome — gender pref not loaded yet
  window.speechSynthesis.speak(utterance);
}

export default function LoginPage({ onLogin }) {
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [formError, setFormError]   = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [voiceState, setVoiceState] = useState('idle');
  const [voiceText, setVoiceText]   = useState('');
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);
  const listeningRef   = useRef(false);
  const welcomeSpokenRef = useRef(false);

  // Attempt welcome message on mount; browsers may block until first interaction
  useEffect(() => {
    // Try immediately — works in some browsers / Electron / PWA contexts
    speakWelcome();
    welcomeSpokenRef.current = true;

    // Fallback: speak on first user interaction in case autoplay was blocked by the browser
    function onFirstInteraction() {
      if (!window.speechSynthesis?.speaking) {
        speakWelcome();
      }
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    }

    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('keydown', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);

    return () => {
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 700);
  useEffect(() => {
    const h = () => setIsNarrow(window.innerWidth < 700);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    await new Promise(r => setTimeout(r, 500));
    const user = DEMO_USERS.find(
      u => u.username === username.trim().toLowerCase() && u.password === password
    );
    if (user) { onLogin(user); }
    else { setFormError('Invalid username or password.'); setFormLoading(false); }
  }

  function startListening() {
    if (!SpeechRecognition) { setVoiceError('Speech recognition not supported.'); setVoiceState('error'); return; }
    if (listeningRef.current) return;
    const r = new SpeechRecognition();
    r.lang = 'en-IN'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 3;
    r.onstart  = () => { listeningRef.current = true; setVoiceState('listening'); setVoiceText(''); setVoiceError(''); };
    r.onresult = (e) => {
      const transcripts = Array.from(e.results[0]).map(a => a.transcript.toLowerCase().trim());
      const heard = transcripts[0];
      setVoiceText(heard); setVoiceState('heard');
      if (transcripts.some(t => t.includes(VOICE_TRIGGER))) {
        setVoiceState('success');
        setTimeout(() => onLogin(DEMO_USERS.find(u => u.username === 'demo')), 800);
      } else {
        setVoiceError(`Heard: "${heard}". Say "login" to sign in.`);
        setVoiceState('error');
      }
    };
    r.onerror = (e) => {
      listeningRef.current = false; setVoiceState('error');
      setVoiceError(e.error === 'not-allowed' ? 'Microphone permission denied.' : e.error === 'no-speech' ? 'No speech detected. Try again.' : `Error: ${e.error}`);
    };
    r.onend = () => { listeningRef.current = false; };
    recognitionRef.current = r; r.start();
  }

  function stopListening() { recognitionRef.current?.stop(); listeningRef.current = false; setVoiceState('idle'); }

  const VC = {
    idle:      { color: 'var(--text-muted)', icon: '🎤', label: 'Tap to activate voice login' },
    listening: { color: 'var(--brand)',      icon: '👂', label: 'Listening… say "login"' },
    heard:     { color: 'var(--orange)',     icon: '💬', label: `Heard: "${voiceText}"` },
    error:     { color: 'var(--red)',        icon: '⚠',  label: voiceError },
    success:   { color: 'var(--green)',      icon: '✓',  label: 'Voice recognised! Signing in…' },
  };
  const vc = VC[voiceState];

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '14px',
          background: 'var(--brand-dim)', border: '1px solid var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', margin: '0 auto 12px',
          boxShadow: '0 0 24px var(--brand-glow)',
        }}>👁</div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Retina Memory
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Sign in to continue</p>
      </div>

      {/* Split card */}
      <div style={{
        width: '100%', maxWidth: '760px',
        display: 'flex', flexDirection: isNarrow ? 'column' : 'row',
        borderRadius: 'var(--r-xl)', overflow: 'visible',
        border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)',
        minHeight: isNarrow ? 'auto' : '480px',
        position: 'relative',
      }}>

        {/* ── LEFT: Password login ── */}
        <div style={{
          flex: 1, background: 'var(--bg-surface)',
          padding: '40px 36px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          borderRadius: isNarrow ? 'var(--r-xl) var(--r-xl) 0 0' : 'var(--r-xl) 0 0 var(--r-xl)',
          borderRight: isNarrow ? 'none' : '1px solid var(--border-default)',
          borderBottom: isNarrow ? '1px solid var(--border-default)' : 'none',
        }}>
          <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                🔐 Sign in with password
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Use your username and password
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label htmlFor="username" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Username
                </label>
                <input
                  id="username" type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. demo" autoComplete="username" required
                  style={{
                    width: '100%', height: '42px', padding: '0 12px', fontSize: '14px',
                    borderRadius: 'var(--r-md)',
                    border: `1px solid ${formError ? 'var(--red)' : 'var(--border-default)'}`,
                    background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                  onBlur={e => e.target.style.borderColor = formError ? 'var(--red)' : 'var(--border-default)'}
                />
              </div>

              <div>
                <label htmlFor="password" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password" type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password" required
                    style={{
                      width: '100%', height: '42px', padding: '0 40px 0 12px', fontSize: '14px',
                      borderRadius: 'var(--r-md)',
                      border: `1px solid ${formError ? 'var(--red)' : 'var(--border-default)'}`,
                      background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                    onBlur={e => e.target.style.borderColor = formError ? 'var(--red)' : 'var(--border-default)'}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '4px', minHeight: 'unset', minWidth: 'unset' }}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {formError && (
                <div role="alert" style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '12px' }}>
                  {formError}
                </div>
              )}

              <button type="submit" disabled={formLoading} style={{
                height: '44px', borderRadius: 'var(--r-md)', border: 'none',
                background: formLoading ? 'var(--bg-overlay)' : 'var(--brand)',
                color: formLoading ? 'var(--text-muted)' : '#fff',
                fontSize: '14px', fontWeight: 700, cursor: formLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px',
              }}>
                {formLoading
                  ? <><span style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Signing in…</>
                  : 'Sign in'}
              </button>
            </form>

            {/* Demo credentials */}
            <div style={{ marginTop: '16px', padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', width: '100%' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', fontWeight: 600, textAlign: 'center' }}>DEMO CREDENTIALS</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {DEMO_USERS.map(u => (
                  <button key={u.username} onClick={() => { setUsername(u.username); setPassword(u.password); setFormError(''); }}
                    style={{ flex: 1, padding: '6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-overlay)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                    {u.avatar} {u.username}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* OR divider badge */}
        <div style={{
          position: 'absolute',
          ...(isNarrow
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
          ),
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.04em', zIndex: 3,
          boxShadow: 'var(--shadow-sm)',
        }}>
          OR
        </div>

        {/* ── RIGHT: Voice login ── */}
        <div style={{
          flex: 1, background: 'var(--bg-elevated)',
          padding: '40px 36px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '24px', position: 'relative', overflow: 'hidden',
          borderRadius: isNarrow ? '0 0 var(--r-xl) var(--r-xl)' : '0 var(--r-xl) var(--r-xl) 0',
        }}>

          {/* Background glow */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '220px', height: '220px', borderRadius: '50%', pointerEvents: 'none',
            background: voiceState === 'listening' ? 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)'
              : voiceState === 'success' ? 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 70%)'
              : 'transparent',
            transition: 'background 0.4s ease',
          }} />

          {/* Header */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              🎙 Voice login
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Say <strong style={{ color: 'var(--brand)' }}>"login"</strong> to sign in as demo
            </p>
          </div>

          {/* Mic button */}
          <button
            onClick={voiceState === 'listening' ? stopListening : startListening}
            disabled={voiceState === 'success'}
            aria-label={voiceState === 'listening' ? 'Stop listening' : 'Start voice login'}
            aria-pressed={voiceState === 'listening'}
            style={{
              width: '96px', height: '96px', borderRadius: '50%',
              border: `3px solid ${vc.color}`,
              background: voiceState === 'listening' ? 'rgba(59,130,246,0.12)'
                : voiceState === 'success' ? 'rgba(34,197,94,0.12)'
                : 'var(--bg-overlay)',
              color: vc.color, fontSize: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: voiceState === 'success' ? 'default' : 'pointer',
              transition: 'all 0.2s',
              animation: voiceState === 'listening' ? 'pulse-ring 1.5s ease-out infinite' : 'none',
              zIndex: 1,
            }}
          >
            {vc.icon}
          </button>

          {/* Status */}
          <div style={{ textAlign: 'center', minHeight: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1 }}>
            <p style={{ fontSize: '13px', color: vc.color, fontWeight: 600, margin: 0, transition: 'color 0.2s' }}>
              {vc.label}
            </p>
            {voiceState === 'idle' && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Logs in as demo user</p>
            )}
            {voiceState === 'listening' && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '20px' }}>
                {[6, 12, 18, 12, 8, 16, 10].map((h, i) => (
                  <div key={i} style={{
                    width: '3px', borderRadius: '2px', background: 'var(--brand)',
                    height: `${h}px`,
                    animation: `blink ${0.4 + i * 0.08}s ease-in-out infinite`,
                    animationDelay: `${i * 0.06}s`,
                  }} />
                ))}
              </div>
            )}
          </div>

          {voiceState === 'error' && (
            <button onClick={() => { setVoiceState('idle'); setVoiceError(''); }}
              style={{
                padding: '8px 20px', borderRadius: 'var(--r-full)',
                border: '1px solid var(--border-default)', background: 'var(--bg-overlay)',
                color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', zIndex: 1,
              }}>
              Try again
            </button>
          )}

          <div style={{ position: 'absolute', bottom: '14px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', zIndex: 1 }}>
            {SpeechRecognition ? '🎤 Microphone required' : '⚠ Speech not supported'}
          </div>
        </div>
      </div>

      <p style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Retina Memory v0.2 · The Third Eye
      </p>
    </div>
  );
}
