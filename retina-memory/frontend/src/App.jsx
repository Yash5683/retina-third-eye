import { useState, useEffect, useRef, useCallback } from 'react';
import CameraFeed from './components/CameraFeed';
import VoiceInput from './components/VoiceInput';
import StatusIndicator from './components/StatusIndicator';
import ObjectList from './components/ObjectList';
import HapticCompass from './components/HapticCompass';
import TrainPage from './components/TrainPage';
import LoginPage from './components/LoginPage';
import SplashScreen from './components/SplashScreen';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import MemoryMapDashboard from './components/MemoryMapDashboard';
import SettingsDashboard from './components/SettingsDashboard';
import PhoneCameraModal from './components/PhoneCameraModal';
import ObstacleWarning from './components/ObstacleWarning';
import PathGuidance from './components/PathGuidance';
import OcrReader from './components/OcrReader';
import EdgeAIPanel from './components/EdgeAIPanel';
import { captureFrame, queryMemory, clearMemory, getRecentMemory } from './api';
import { speak, speakNow, setSpeechRate } from './voiceOutput';

const SCAN_INTERVAL = 300_000;
const SCAN_LOW_BATTERY = 600_000;

const TABS = [
  { id: 'home',      label: 'Home',    icon: HomeIcon },
  { id: 'edge',      label: 'Edge AI', icon: EdgeIcon },
  { id: 'memory',    label: 'Memory',  icon: MemoryIcon },
  { id: 'analytics', label: 'Stats',   icon: StatsIcon },
  { id: 'settings',  label: 'Settings',icon: SettingsIcon },
];

// ── SVG Icons ──────────────────────────────────────────────────────────────
function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'url(#g1)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
      <circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 10 10c0 4-2.5 7.5-6 9.3"/>
      <path d="M12 2C7.6 2 4 5.6 4 10c0 4 2.5 7.5 6 9.3"/>
    </svg>
  );
}
function MemoryIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'url(#g2)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function StatsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'url(#g3)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function EdgeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'url(#g5)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient></defs>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function SettingsIcon({ active }) {  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'url(#g4)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

// ── Shared UI primitives ───────────────────────────────────────────────────
function GlassCard({ children, style = {}, className = '' }) {
  return (
    <div className={`glass card-hover ${className}`} style={{
      borderRadius: 'var(--r-xl)', padding: '20px', width: '100%',
      boxShadow: 'var(--shadow-md)', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, action, icon }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        {icon && <span style={{ fontSize:'14px' }}>{icon}</span>}
        <span style={{
          fontSize:'10px', fontWeight:700, letterSpacing:'0.14em',
          textTransform:'uppercase', color:'var(--text-muted)',
          fontFamily:'var(--font-display)',
        }}>
          {children}
        </span>
      </div>
      {action}
    </div>
  );
}

function QuickChip({ icon, label, active, color = 'var(--brand)', onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:'6px',
      padding:'8px 14px', borderRadius:'var(--r-full)',
      border:`1px solid ${active ? color : 'var(--border-default)'}`,
      background: active ? `${color}18` : 'var(--bg-glass)',
      backdropFilter:'blur(12px)',
      color: active ? color : 'var(--text-secondary)',
      fontSize:'12px', fontWeight:600,
      transition:'all 0.2s cubic-bezier(0.16,1,0.3,1)',
      boxShadow: active ? `0 0 16px ${color}30` : 'none',
      whiteSpace:'nowrap',
    }}>
      <span style={{ fontSize:'14px' }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]                 = useState(null);
  const [showSplash, setShowSplash]     = useState(false);
  const [tab, setTab]                   = useState('home');
  const [prevTab, setPrevTab]           = useState('home');
  const [trainOpen, setTrainOpen]       = useState(false);
  const [mode, setMode]                 = useState('idle');
  const [observations, setObservations] = useState([]);
  const [hapticTarget, setHapticTarget] = useState(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [scanLoading, setScanLoading]   = useState(false);
  const [speechRate, setSpeechRateState]= useState(1.0);
  const [lastResponse, setLastResponse] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [obstacleEnabled, setObstacleEnabled] = useState(false);
  const [showPathGuidance, setShowPathGuidance] = useState(false);
  const [showOcr, setShowOcr]           = useState(false);
  const [scanCount, setScanCount]       = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);

  const cameraRef       = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanIntervalMs  = useRef(SCAN_INTERVAL);
  const lowBatteryRef   = useRef(false);

  useEffect(() => {
    if (!user) return;
    getRecentMemory(100)
      .then(res => { if (res.observations?.length > 0) setObservations(res.observations); })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || !('getBattery' in navigator)) return;
    navigator.getBattery().then(battery => {
      function check() {
        if (battery.level <= 0.15 && !lowBatteryRef.current) {
          scanIntervalMs.current = SCAN_LOW_BATTERY;
          lowBatteryRef.current = true;
          speak('Battery low. Switching to power-saving mode.');
          restartScanTimer();
        } else if (battery.level > 0.15 && lowBatteryRef.current) {
          scanIntervalMs.current = SCAN_INTERVAL;
          lowBatteryRef.current = false;
          restartScanTimer();
        }
      }
      battery.addEventListener('levelchange', check);
      check();
    }).catch(() => {});
  }, [user]);

  const doScan = useCallback(async () => {
    if (!cameraRef.current) { setErrorMsg('Camera not ready.'); return; }
    let frame = cameraRef.current.captureFrame();
    if (!frame) {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        frame = cameraRef.current?.captureFrame();
        if (frame) break;
      }
    }
    if (!frame) { setErrorMsg('Camera feed not ready. Please allow camera access.'); return; }
    setScanLoading(true); setMode('scanning');
    try {
      const result = await captureFrame(frame);
      if (result.observations.length > 0) {
        setObservations(prev => [...prev, ...result.observations].slice(-100));
        setScanCount(c => c + 1);
        setLastScanTime(new Date());
        speakNow(`Found ${result.observations.length} object${result.observations.length > 1 ? 's' : ''}.`);
      } else {
        speakNow('No objects detected.');
      }
    } catch (err) {
      const raw = err?.message || '';
      let msg = 'Scan failed. Please try again.';
      if (raw.includes('429') || raw.includes('rate limit')) msg = 'Rate limit reached. Please wait a moment.';
      else if (raw.includes('502') || raw.includes('Vision')) msg = 'Vision service unavailable. Please try again shortly.';
      else if (raw.includes('504') || raw.includes('timed out')) msg = 'Scan timed out. Please try again.';
      setErrorMsg(msg);
    } finally { setScanLoading(false); setMode('idle'); }
  }, []);

  function restartScanTimer() {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(doScan, scanIntervalMs.current);
  }

  useEffect(() => {
    if (!user) return;
    restartScanTimer();
    return () => { if (scanIntervalRef.current) clearInterval(scanIntervalRef.current); };
  }, [user, doScan]);

  const handleTranscript = useCallback(async (text) => {
    if (!text.trim()) return;
    if (text.toLowerCase().includes('clear memory')) {
      try { await clearMemory(); setObservations([]); speak('Memory cleared.'); } catch { speak('Could not clear memory.'); }
      return;
    }
    setMode('thinking'); setLastResponse('');
    try {
      const result = await queryMemory(text);
      const response = result.response_text || 'No response.';
      setLastResponse(response);
      speakNow(response, speechRate);
      if (result.intent === 'live_vision') await doScan();
    } catch (err) {
      const msg = err?.message || 'Query failed.';
      setLastResponse(`⚠ ${msg}`);
      speakNow("Sorry, I couldn't process that.");
    } finally { setMode('idle'); }
  }, [speechRate, doScan]);

  async function handleClearMemory() {
    await clearMemory().catch(() => {});
    setObservations([]);
    speak('Memory cleared.');
  }

  function switchTab(id) {
    setPrevTab(tab);
    setTab(id);
  }

  if (!user) return <LoginPage onLogin={u => { setUser(u); setShowSplash(true); }} />;
  if (showSplash) return <SplashScreen onDone={() => { setShowSplash(false); speak(`Welcome, ${user.name}. Retina Memory is ready.`); }} />;
  if (trainOpen) return <TrainPage onDone={() => setTrainOpen(false)} />;

  return (
    <div style={{ minHeight:'100vh', minHeight:'100dvh', background:'var(--bg-base)', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <Header
        user={user}
        mode={mode}
        onTrain={() => setTrainOpen(true)}
        onLogout={() => { setUser(null); setObservations([]); setLastResponse(''); }}
        onPhoneCamera={() => setShowPhoneModal(true)}
      />

      <main style={{ width:'100%', maxWidth:'640px', padding:'16px 16px 88px', flex:1, display:'flex', flexDirection:'column', gap:'12px' }}>

        {errorMsg && (
          <div role="alert" className="fade-down glass" style={{
            padding:'12px 16px', borderRadius:'var(--r-lg)',
            border:'1px solid var(--red)', color:'var(--red)',
            fontSize:'13px', display:'flex', alignItems:'center', gap:'10px',
          }}>
            <span style={{ fontSize:'16px' }}>⚠</span>
            <span style={{ flex:1 }}>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} style={{ background:'none', border:'none', color:'var(--red)', fontSize:'18px', cursor:'pointer', padding:'0 4px', minHeight:'unset', lineHeight:1 }}>×</button>
          </div>
        )}

        {tab === 'home' && (
          <HomeTab
            cameraRef={cameraRef}
            mode={mode}
            observations={observations}
            hapticTarget={hapticTarget}
            setHapticTarget={setHapticTarget}
            lastResponse={lastResponse}
            setLastResponse={setLastResponse}
            scanLoading={scanLoading}
            obstacleEnabled={obstacleEnabled}
            setObstacleEnabled={setObstacleEnabled}
            showPathGuidance={showPathGuidance}
            setShowPathGuidance={setShowPathGuidance}
            showOcr={showOcr}
            setShowOcr={setShowOcr}
            speechRate={speechRate}
            scanCount={scanCount}
            lastScanTime={lastScanTime}
            onScan={doScan}
            onTranscript={handleTranscript}
            onClearMemory={handleClearMemory}
          />
        )}
        {tab === 'edge' && (
          <div className="fade-up">
            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
                ⚡ Edge AI — On-Device Detection
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Runs entirely in your browser. No API calls. Works offline. ~50ms per frame.
              </p>
            </div>
            <EdgeAIPanel onNewObservations={newObs => setObservations(prev => [...prev, ...newObs].slice(-100))} />
          </div>
        )}
        {tab === 'memory' && <MemoryMapDashboard observations={observations} onClearMemory={handleClearMemory} />}
        {tab === 'analytics' && <AnalyticsDashboard observations={observations} />}
        {tab === 'settings' && (
          <SettingsDashboard
            user={user}
            onLogout={() => { setUser(null); setObservations([]); setLastResponse(''); }}
          />
        )}
      </main>

      <BottomNav tab={tab} onTab={switchTab} />
      {showPhoneModal && <PhoneCameraModal onClose={() => setShowPhoneModal(false)} />}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function Header({ user, mode, onTrain, onLogout, onPhoneCamera }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="glass" style={{
      width:'100%', maxWidth:'640px', padding:'12px 16px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      position:'sticky', top:0, zIndex:50,
      borderRadius:'0 0 var(--r-xl) var(--r-xl)',
      borderTop:'none',
      margin:'0 auto',
      borderLeft:'none', borderRight:'none',
      backdropFilter:'blur(24px)',
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{
          width:'36px', height:'36px', borderRadius:'10px',
          background:'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(124,58,237,0.3))',
          border:'1px solid rgba(59,130,246,0.4)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'18px', boxShadow:'0 0 16px rgba(59,130,246,0.2)',
          flexShrink:0,
        }}>👁</div>
        <div>
          <div style={{ fontSize:'15px', fontWeight:800, fontFamily:'var(--font-display)', background:'linear-gradient(135deg,#eef2ff,rgba(59,130,246,0.9))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1 }}>Retina Memory</div>
          <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px', letterSpacing:'0.08em' }}>AI Object Assistant</div>
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <StatusIndicator mode={mode} />

        <button onClick={onTrain} style={{
          height:'34px', padding:'0 14px', borderRadius:'var(--r-full)',
          background:'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))',
          border:'1px solid rgba(16,185,129,0.4)',
          color:'var(--green-bright)', fontSize:'12px', fontWeight:700,
          display:'flex', alignItems:'center', gap:'5px',
          boxShadow:'0 0 12px rgba(16,185,129,0.15)',
          transition:'all 0.2s',
        }}>
          <span style={{ fontSize:'13px' }}>+</span> Train
        </button>

        {/* User avatar */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setMenuOpen(m => !m)} style={{
            width:'34px', height:'34px', borderRadius:'50%',
            background:'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(124,58,237,0.3))',
            border:'1px solid rgba(59,130,246,0.3)',
            fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center',
          }} aria-label="User menu">
            {user?.avatar ?? '👤'}
          </button>
          {menuOpen && (
            <div className="glass" style={{
              position:'absolute', top:'42px', right:0, minWidth:'180px',
              borderRadius:'var(--r-lg)', padding:'6px',
              boxShadow:'var(--shadow-xl)', zIndex:100,
              animation:'menu-pop 0.2s cubic-bezier(0.16,1,0.3,1)',
            }}>
              <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border-subtle)', marginBottom:'4px' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'var(--text-primary)' }}>{user?.name}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>@{user?.username}</div>
              </div>
              <button onClick={() => { setMenuOpen(false); onPhoneCamera(); }} style={{ width:'100%', padding:'8px 12px', background:'none', border:'none', color:'var(--text-secondary)', fontSize:'13px', textAlign:'left', borderRadius:'var(--r-md)', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' }}>
                📱 Phone Camera
              </button>
              <button onClick={() => { setMenuOpen(false); onLogout(); }} style={{ width:'100%', padding:'8px 12px', background:'none', border:'none', color:'var(--red)', fontSize:'13px', textAlign:'left', borderRadius:'var(--r-md)', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' }}>
                ↩ Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Bottom Nav ─────────────────────────────────────────────────────────────
function BottomNav({ tab, onTab }) {
  return (
    <nav aria-label="Main navigation" style={{
      position:'fixed', bottom:0, left:0, right:0,
      display:'flex', justifyContent:'center', zIndex:50,
      padding:'0 0 env(safe-area-inset-bottom)',
    }}>
      <div className="glass" style={{
        width:'100%', maxWidth:'640px',
        display:'flex', alignItems:'stretch',
        borderRadius:'var(--r-2xl) var(--r-2xl) 0 0',
        borderBottom:'none', borderLeft:'none', borderRight:'none',
        padding:'4px 8px',
        backdropFilter:'blur(32px)',
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => onTab(t.id)}
              aria-label={t.label} aria-current={active ? 'page' : undefined}
              style={{
                flex:1, padding:'10px 4px 8px',
                display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                background:'none', border:'none', cursor:'pointer',
                color: active ? 'transparent' : 'var(--text-muted)',
                position:'relative',
                transition:'color 0.2s',
              }}>
              {active && (
                <div style={{
                  position:'absolute', top:'4px', left:'50%', transform:'translateX(-50%)',
                  width:'32px', height:'32px', borderRadius:'50%',
                  background:'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))',
                  boxShadow:'0 0 16px rgba(59,130,246,0.2)',
                }}/>
              )}
              <div style={{ position:'relative', zIndex:1 }}>
                <Icon active={active}/>
              </div>
              <span style={{
                fontSize:'10px', fontWeight: active ? 700 : 500,
                letterSpacing:'0.04em', position:'relative', zIndex:1,
                background: active ? 'var(--brand-gradient-bright)' : 'none',
                WebkitBackgroundClip: active ? 'text' : 'unset',
                WebkitTextFillColor: active ? 'transparent' : 'var(--text-muted)',
                backgroundClip: active ? 'text' : 'unset',
              }}>
                {t.label}
              </span>
              {active && <div className="nav-pill"/>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Home Tab ───────────────────────────────────────────────────────────────
function HomeTab({
  cameraRef, mode, observations, hapticTarget, setHapticTarget,
  lastResponse, setLastResponse, scanLoading, obstacleEnabled,
  setObstacleEnabled, showPathGuidance, setShowPathGuidance,
  showOcr, setShowOcr, speechRate, scanCount, lastScanTime,
  onScan, onTranscript, onClearMemory,
}) {
  const [isListening, setIsListening] = useState(false);

  return (
    <div className="stagger" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

      {/* ── Feature chips row ── */}
      <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'2px', scrollbarWidth:'none' }}>
        <QuickChip icon="🚨" label={obstacleEnabled ? 'Obstacle ON' : 'Obstacle'} active={obstacleEnabled}
          color="var(--red)" onClick={() => { const n = !obstacleEnabled; setObstacleEnabled(n); speak(n ? 'Obstacle warning enabled.' : 'Obstacle warning disabled.'); }} />
        <QuickChip icon="🧭" label="Path" active={showPathGuidance} color="var(--brand)"
          onClick={() => setShowPathGuidance(p => !p)} />
        <QuickChip icon="🔤" label="Read Text" active={showOcr} color="var(--green)"
          onClick={() => setShowOcr(p => !p)} />
      </div>

      {/* ── Feature panels ── */}
      {obstacleEnabled && (
        <div className="fade-down">
          <ObstacleWarning cameraRef={cameraRef} enabled={obstacleEnabled} onObstacle={() => {}} />
        </div>
      )}
      {showPathGuidance && (
        <div className="fade-down">
          <PathGuidance cameraRef={cameraRef} onClose={() => setShowPathGuidance(false)} />
        </div>
      )}
      {showOcr && (
        <div className="fade-down">
          <OcrReader cameraRef={cameraRef} onClose={() => setShowOcr(false)} />
        </div>
      )}

      {/* ── Camera card ── */}
      <GlassCard style={{ padding:0, overflow:'hidden' }}>
        {/* Camera feed */}
        <div style={{ position:'relative' }}>
          <CameraFeed ref={cameraRef} hidden={false} onError={msg => speak(msg)} />
          {/* Scanning overlay */}
          {mode === 'scanning' && (
            <div style={{
              position:'absolute', inset:0, pointerEvents:'none',
              background:'linear-gradient(to bottom, rgba(59,130,246,0.06), transparent)',
            }}>
              <div style={{
                position:'absolute', left:0, right:0, height:'2px',
                background:'linear-gradient(90deg, transparent, rgba(59,130,246,0.8), transparent)',
                boxShadow:'0 0 8px rgba(59,130,246,0.6)',
                animation:'scan-line 1.5s linear infinite',
              }}/>
            </div>
          )}
          {/* Last scan badge */}
          {lastScanTime && (
            <div style={{
              position:'absolute', bottom:'10px', left:'10px',
              padding:'4px 10px', borderRadius:'var(--r-full)',
              background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)',
              border:'1px solid rgba(255,255,255,0.1)',
              fontSize:'10px', color:'rgba(255,255,255,0.6)',
            }}>
              Last scan: {lastScanTime.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div style={{
          padding:'14px 16px', borderTop:'1px solid var(--border-subtle)',
          display:'flex', alignItems:'center', gap:'12px',
        }}>
          <VoiceInput onTranscript={onTranscript} disabled={mode === 'thinking'} />

          {/* Response / status text */}
          <div style={{ flex:1, minWidth:0 }}>
            {mode === 'thinking' ? (
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                  <span className="typing-dot"/>
                  <span className="typing-dot"/>
                  <span className="typing-dot"/>
                </div>
                <span style={{ fontSize:'13px', color:'var(--brand-bright)' }}>Thinking…</span>
              </div>
            ) : mode === 'scanning' ? (
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ width:'12px', height:'12px', border:'2px solid var(--brand-bright)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block', flexShrink:0 }}/>
                <span style={{ fontSize:'13px', color:'var(--brand-bright)' }}>Scanning…</span>
              </div>
            ) : lastResponse ? (
              <p style={{
                fontSize:'13px', color: lastResponse.startsWith('⚠') ? 'var(--red)' : 'var(--text-secondary)',
                margin:0, lineHeight:1.5,
                overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
              }}>{lastResponse}</p>
            ) : (
              <p style={{ fontSize:'13px', color:'var(--text-muted)', margin:0 }}>Tap mic or ask a question</p>
            )}
          </div>

          {/* Scan button */}
          <button onClick={onScan} disabled={mode === 'thinking'} style={{
            width:'48px', height:'48px', borderRadius:'50%',
            background: scanLoading ? 'var(--bg-overlay)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
            border:'none', color:'#fff', fontSize:'20px',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow: scanLoading ? 'none' : '0 0 20px rgba(59,130,246,0.4)',
            animation: scanLoading ? 'none' : 'pulse-glow 2s ease-in-out infinite',
            transition:'all 0.2s', flexShrink:0,
          }}>
            {scanLoading
              ? <span style={{ width:'18px', height:'18px', border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'block' }}/>
              : '👁'}
          </button>
        </div>
      </GlassCard>

      {/* ── AI Response card ── */}
      {lastResponse && !lastResponse.startsWith('⚠') && (
        <div className="fade-up glass" style={{
          padding:'16px', borderRadius:'var(--r-xl)',
          border:'1px solid rgba(59,130,246,0.2)',
          background:'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(124,58,237,0.06))',
          boxShadow:'0 4px 24px rgba(59,130,246,0.1)',
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', marginBottom:'12px' }}>
            <div style={{
              width:'36px', height:'36px', borderRadius:'50%', flexShrink:0,
              background:'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(124,58,237,0.3))',
              border:'1px solid rgba(59,130,246,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px',
            }}>🤖</div>
            <p style={{ fontSize:'14px', color:'var(--text-primary)', margin:0, lineHeight:1.7, flex:1 }}>
              {lastResponse}
            </p>
            <button onClick={() => speakNow(lastResponse, speechRate)} style={{
              width:'32px', height:'32px', borderRadius:'50%',
              background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)',
              color:'var(--brand-bright)', fontSize:'14px',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0, minHeight:'unset',
            }} aria-label="Read aloud">🔊</button>
          </div>
          {!hapticTarget && (
            <button onClick={() => {
              const match = lastResponse.match(/your (\w+)/i);
              if (match) setHapticTarget(match[1].toLowerCase());
            }} style={{
              padding:'8px 16px', borderRadius:'var(--r-full)',
              background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)',
              color:'var(--green-bright)', fontSize:'12px', fontWeight:700,
              display:'flex', alignItems:'center', gap:'6px',
            }}>
              🧭 Guide me to it
            </button>
          )}
        </div>
      )}

      {/* ── Haptic compass ── */}
      {hapticTarget && (
        <div className="fade-up">
          <HapticCompass targetObject={hapticTarget} cameraRef={cameraRef}
            onFound={() => { speak(`Found your ${hapticTarget}.`); setHapticTarget(null); }}
            onTimeout={() => setHapticTarget(null)}
            onCancel={() => setHapticTarget(null)} />
        </div>
      )}

      {/* ── Recent memory ── */}
      <section aria-label="Recent memory" className="fade-up">
        <SectionLabel icon="🧠" action={
          observations.length > 0 && (
            <button onClick={onClearMemory} style={{ fontSize:'11px', color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', padding:'2px 8px' }}>
              Clear all
            </button>
          )
        }>
          Memory — {observations.length} objects
        </SectionLabel>

        {observations.length === 0 ? (
          <GlassCard style={{ textAlign:'center', padding:'36px 20px' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px', animation:'float 3s ease-in-out infinite' }}>🔍</div>
            <p style={{ fontSize:'15px', fontWeight:600, color:'var(--text-secondary)', marginBottom:'6px' }}>No objects in memory yet</p>
            <p style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6 }}>
              Tap <strong style={{ color:'var(--green-bright)' }}>+ Train</strong> to teach an object,<br/>or <strong style={{ color:'var(--brand-bright)' }}>👁 Scan</strong> to detect what's in view
            </p>
          </GlassCard>
        ) : (
          <ObjectList observations={observations.slice(-10)} />
        )}
      </section>
    </div>
  );
}
