import { useState, useEffect, useRef, useCallback } from 'react';
import CameraFeed from './components/CameraFeed';
import VoiceInput from './components/VoiceInput';
import StatusIndicator from './components/StatusIndicator';
import ObjectList from './components/ObjectList';
import ScanButton from './components/ScanButton';
import HapticCompass from './components/HapticCompass';
import TrainPage from './components/TrainPage';
import LoginPage from './components/LoginPage';
import SplashScreen from './components/SplashScreen';
import UserMenu from './components/UserMenu';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import MemoryMapDashboard from './components/MemoryMapDashboard';
import SettingsDashboard from './components/SettingsDashboard';
import PhoneCameraModal from './components/PhoneCameraModal';
import ObstacleWarning from './components/ObstacleWarning';
import PathGuidance from './components/PathGuidance';
import OcrReader from './components/OcrReader';
import GpsLocation from './components/GpsLocation';
import { captureFrame, queryMemory, clearMemory, getRecentMemory } from './api';
import { speak, speakNow, setSpeechRate } from './voiceOutput';

const SCAN_INTERVAL_NORMAL = 300_000;     // 5 minutes — preserve API quota
const SCAN_INTERVAL_LOW_BATTERY = 600_000; // 10 minutes on low battery

// ─── Nav tabs ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'home',      label: 'Home',     icon: '👁' },
  { id: 'memory',    label: 'Memory',   icon: '🗺' },
  { id: 'analytics', label: 'Stats',    icon: '📊' },
  { id: 'settings',  label: 'Settings', icon: '⚙' },
];

// ─── Shared card ─────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-xl)', padding: '20px', width: '100%', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
        {children}
      </p>
      {action}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]               = useState(null);
  const [showSplash, setShowSplash]   = useState(false);
  const [tab, setTab]                 = useState('home');
  const [trainOpen, setTrainOpen]     = useState(false);
  const [mode, setMode]               = useState('idle');
  const [observations, setObservations] = useState([]);
  const [hapticTarget, setHapticTarget] = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [speechRate, setSpeechRateState] = useState(1.0);
  const [lastResponse, setLastResponse] = useState('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [obstacleEnabled, setObstacleEnabled] = useState(false);
  const [showPathGuidance, setShowPathGuidance] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  const cameraRef        = useRef(null);
  const scanIntervalRef  = useRef(null);
  const scanIntervalMs   = useRef(SCAN_INTERVAL_NORMAL);
  const lowBatteryRef    = useRef(false);

  // Load memory on login
  useEffect(() => {
    if (!user) return;
    getRecentMemory(100)
      .then(res => { if (res.observations?.length > 0) setObservations(res.observations); })
      .catch(() => {});
  }, [user]);

  // Battery monitoring
  useEffect(() => {
    if (!user || !('getBattery' in navigator)) return;
    navigator.getBattery().then(battery => {
      function check() {
        if (battery.level <= 0.15 && !lowBatteryRef.current) {
          scanIntervalMs.current = SCAN_INTERVAL_LOW_BATTERY;
          lowBatteryRef.current = true;
          speak('Battery low. Switching to power-saving mode.');
          restartScanTimer();
        } else if (battery.level > 0.15 && lowBatteryRef.current) {
          scanIntervalMs.current = SCAN_INTERVAL_NORMAL;
          lowBatteryRef.current = false;
          restartScanTimer();
        }
      }
      battery.addEventListener('levelchange', check);
      check();
    }).catch(() => {});
  }, [user]);

  const doScan = useCallback(async () => {
    if (!cameraRef.current) {
      setErrorMsg('Camera not ready. Please allow camera access and try again.');
      return;
    }

    // Poll for camera readiness — up to 5 seconds in 500ms steps
    let frame = cameraRef.current.captureFrame();
    if (!frame) {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        frame = cameraRef.current?.captureFrame();
        if (frame) break;
      }
    }
    if (!frame) {
      setErrorMsg('Camera feed not ready. Please allow camera access and try again.');
      return;
    }
    setScanLoading(true); setMode('scanning');
    try {
      const result = await captureFrame(frame);
      if (result.observations.length > 0) {
        setObservations(prev => [...prev, ...result.observations].slice(-100));
        speakNow(`Scan complete. Found ${result.observations.length} object${result.observations.length > 1 ? 's' : ''}.`);
      } else {
        speakNow('Scan complete. No objects detected.');
      }
    } catch (err) {
      const raw = err?.message || '';
      // Parse friendly message from backend detail
      let msg = 'Scan failed. Please try again.';
      if (raw.includes('429') || raw.includes('rate limit')) {
        msg = 'Rate limit reached. Please wait a few seconds before scanning again.';
        // Don't speak rate limit errors — too noisy
      } else if (raw.includes('502') || raw.includes('Vision API')) {
        msg = 'Vision service unavailable. Please try again shortly.';
        // Don't speak this either — shown in UI
      } else if (raw.includes('504') || raw.includes('timed out')) {
        msg = 'Scan timed out. Please try again.';
      } else {
        speakNow('Scan failed. Please check your connection.');
      }
      setErrorMsg(msg);
      console.error('Scan failed:', err);
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
    if (hapticTarget && text.toLowerCase().includes('found it')) {
      setHapticTarget(null); speak(`Glad you found your ${hapticTarget}.`); return;
    }
    setMode('thinking');
    setLastResponse('');
    try {
      const result = await queryMemory(text);
      const response = result.response_text || 'No response received.';
      setLastResponse(response);
      speakNow(response, speechRate); // speakNow cancels any pending speech and speaks immediately
      // Only activate haptic compass if user explicitly asks for guidance
      // Don't auto-activate — it causes "object not visible" spam
      if (result.intent === 'live_vision') await doScan();
    } catch (err) {
      const msg = err?.message || 'Query failed. Check backend connection.';
      setLastResponse(`⚠ ${msg}`);
      setErrorMsg(msg);
      speakNow("Sorry, I couldn't process that.");
      console.error('Query error:', err);
    } finally {
      setMode('idle');
    }
  }, [hapticTarget, speechRate, doScan]);

  async function handleClearMemory() {
    await clearMemory().catch(() => {});
    setObservations([]);
    speak('Memory cleared.');
  }

  // ── Not logged in ──
  if (!user) return <LoginPage onLogin={u => { setUser(u); setShowSplash(true); }} />;

  // ── Splash screen after login ──
  if (showSplash) return <SplashScreen onDone={() => { setShowSplash(false); speak(`Welcome, ${user.name}. Retina Memory is ready.`); }} />;

  // ── Train page ──
  if (trainOpen) return <TrainPage onDone={() => setTrainOpen(false)} />;

  const showHaptic = !!hapticTarget;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ── Top bar ── */}
      <header style={{
        width: '100%', maxWidth: '640px', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky', top: 0, background: 'var(--bg-base)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'var(--brand-dim)', border: '1px solid var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          }}>👁</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>Retina Memory</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>AI Object Assistant</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusIndicator mode={mode} />
          <button
            onClick={() => setTrainOpen(true)}
            style={{
              height: '34px', padding: '0 12px', borderRadius: 'var(--r-full)',
              border: '1px solid var(--green)', background: 'var(--green-dim)',
              color: 'var(--green)', fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            + Train
          </button>
          <UserMenu
            user={user}
            onLogout={() => { setUser(null); setObservations([]); setLastResponse(''); setShowSplash(false); }}
          />
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ width: '100%', maxWidth: '640px', padding: '16px 20px 80px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Error banner */}
        {errorMsg && (
          <div role="alert" className="fade-up" style={{
            padding: '10px 14px', borderRadius: 'var(--r-lg)',
            background: 'var(--red-dim)', border: '1px solid var(--red)',
            color: 'var(--red)', fontSize: '13px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span>⚠</span> {errorMsg}
            <button onClick={() => setErrorMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--red)', fontSize: '16px', cursor: 'pointer', padding: '0 4px', minHeight: 'unset' }}>×</button>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <>
            {/* Phone camera shortcut + feature buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Obstacle warning toggle */}
                <button
                  onClick={() => {
                    const next = !obstacleEnabled;
                    setObstacleEnabled(next);
                    speak(next ? 'Obstacle warning enabled.' : 'Obstacle warning disabled.');
                  }}
                  title={obstacleEnabled ? 'Disable obstacle warning' : 'Enable obstacle warning'}
                  style={{
                    height: '32px', padding: '0 12px',
                    borderRadius: 'var(--r-full)',
                    border: `1px solid ${obstacleEnabled ? 'var(--red)' : 'var(--border-default)'}`,
                    background: obstacleEnabled ? 'var(--red-dim)' : 'var(--bg-elevated)',
                    color: obstacleEnabled ? 'var(--red)' : 'var(--text-secondary)',
                    fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  {obstacleEnabled ? '🚨 Obstacle ON' : '⚡ Obstacle'}
                </button>

                {/* Path guidance button */}
                <button
                  onClick={() => setShowPathGuidance(p => !p)}
                  title="Path guidance"
                  style={{
                    height: '32px', padding: '0 12px',
                    borderRadius: 'var(--r-full)',
                    border: `1px solid ${showPathGuidance ? 'var(--brand)' : 'var(--border-default)'}`,
                    background: showPathGuidance ? 'var(--brand-dim)' : 'var(--bg-elevated)',
                    color: showPathGuidance ? 'var(--brand)' : 'var(--text-secondary)',
                    fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  🧭 Path
                </button>

                {/* OCR / Text reader button */}
                <button
                  onClick={() => setShowOcr(p => !p)}
                  title="Read text in camera"
                  style={{
                    height: '32px', padding: '0 12px',
                    borderRadius: 'var(--r-full)',
                    border: `1px solid ${showOcr ? 'var(--green)' : 'var(--border-default)'}`,
                    background: showOcr ? 'var(--green-dim)' : 'var(--bg-elevated)',
                    color: showOcr ? 'var(--green)' : 'var(--text-secondary)',
                    fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  🔤 Read Text
                </button>
              </div>

              <button
                onClick={() => setShowPhoneModal(true)}
                style={{
                  height: '32px', padding: '0 12px',
                  borderRadius: 'var(--r-full)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                📱 Use Phone Camera
              </button>
            </div>

            {/* Obstacle warning banner */}
            <ObstacleWarning
              cameraRef={cameraRef}
              enabled={obstacleEnabled}
              onObstacle={() => {}}
            />

            {/* Path guidance panel */}
            {showPathGuidance && (
              <PathGuidance
                cameraRef={cameraRef}
                onClose={() => setShowPathGuidance(false)}
              />
            )}

            {/* OCR text reader panel */}
            {showOcr && (
              <OcrReader
                cameraRef={cameraRef}
                onClose={() => setShowOcr(false)}
              />
            )}

            {/* Camera card */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <CameraFeed ref={cameraRef} hidden={false} onError={msg => { setErrorMsg(msg); speak(msg); }} />
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <VoiceInput onTranscript={handleTranscript} disabled={mode === 'thinking'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {mode === 'thinking' ? (
                    <p style={{ fontSize: '13px', color: 'var(--brand)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '12px', border: '2px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                      Thinking…
                    </p>
                  ) : lastResponse ? (
                    <p style={{ fontSize: '13px', color: lastResponse.startsWith('⚠') ? 'var(--red)' : 'var(--text-secondary)', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {lastResponse}
                    </p>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Tap mic or ask a question</p>
                  )}
                </div>
                <ScanButton onClick={doScan} disabled={mode === 'thinking'} loading={scanLoading} />
              </div>
            </Card>

            {/* Response card — shown when there's a response */}
            {lastResponse && !lastResponse.startsWith('⚠') && (
              <div className="fade-up" style={{
                padding: '14px 16px',
                borderRadius: 'var(--r-lg)',
                background: 'var(--brand-dim)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>🤖</span>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.6, flex: 1 }}>
                    {lastResponse}
                  </p>
                  <button
                    onClick={() => speakNow(lastResponse, speechRate)}
                    aria-label="Read response aloud"
                    title="Read aloud"
                    style={{
                      flexShrink: 0, width: '36px', height: '36px',
                      borderRadius: '50%', border: '1px solid rgba(59,130,246,0.3)',
                      background: 'rgba(59,130,246,0.1)', color: 'var(--brand)',
                      fontSize: '16px', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', minHeight: 'unset',
                    }}
                  >
                    🔊
                  </button>
                </div>
                {/* Guide me button — only show if we have a last query result with an observation */}
                {!showHaptic && (
                  <button
                    onClick={() => {
                      // Extract object name from last response for haptic guidance
                      const match = lastResponse.match(/your (\w+)/i);
                      if (match) { setHapticTarget(match[1].toLowerCase()); }
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--r-full)',
                      border: '1px solid var(--green)', background: 'var(--green-dim)',
                      color: 'var(--green)', fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    🧭 Guide me to it
                  </button>
                )}
              </div>
            )}

            {/* Haptic compass */}
            {showHaptic && (
              <div className="fade-up">
                <HapticCompass
                  targetObject={hapticTarget}
                  cameraRef={cameraRef}
                  onFound={() => { speak(`Found your ${hapticTarget}.`); setHapticTarget(null); }}
                  onTimeout={() => setHapticTarget(null)}
                  onCancel={() => setHapticTarget(null)}
                />
              </div>
            )}

            {/* Recent memory */}
            <section aria-label="Recent memory">
              <SectionLabel action={
                observations.length > 0 && (
                  <button onClick={handleClearMemory} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                    Clear
                  </button>
                )
              }>
                Recent — {observations.length} objects
              </SectionLabel>
              {observations.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: '28px 20px' }}>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔍</div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No objects in memory yet</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Tap <strong style={{ color: 'var(--green)' }}>+ Train</strong> or <strong style={{ color: 'var(--brand)' }}>Scan Now</strong>
                  </p>
                </Card>
              ) : (
                <ObjectList observations={observations.slice(-10)} />
              )}
            </section>
          </>
        )}

        {/* ── MEMORY MAP TAB ── */}
        {tab === 'memory' && (
          <>
            <SectionLabel>Memory Map</SectionLabel>
            <MemoryMapDashboard observations={observations} onClearMemory={handleClearMemory} />
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <>
            <SectionLabel>Analytics</SectionLabel>
            <AnalyticsDashboard observations={observations} />
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <>
            <SectionLabel>Settings</SectionLabel>
            <SettingsDashboard
              user={user}
              onLogout={() => { setUser(null); setObservations([]); setLastResponse(''); setShowSplash(false); }}
            />
          </>
        )}
      </main>

      {/* ── Bottom nav ── */}
      <nav
        aria-label="Main navigation"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'center',
          zIndex: 20,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '640px', display: 'flex' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                style={{
                  flex: 1, padding: '10px 4px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? 'var(--brand)' : 'var(--text-muted)',
                  transition: 'color 0.15s',
                  minHeight: 'unset',
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: active ? 700 : 500, letterSpacing: '0.04em' }}>
                  {t.label}
                </span>
                {active && (
                  <span style={{ width: '20px', height: '2px', borderRadius: '1px', background: 'var(--brand)', marginTop: '1px' }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Phone Camera Modal ── */}
      {showPhoneModal && <PhoneCameraModal onClose={() => setShowPhoneModal(false)} />}
    </div>
  );
}
