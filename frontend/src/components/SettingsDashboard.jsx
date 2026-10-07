import { useState } from 'react';
import { speak, setVoiceLang, getVoiceLang, setVoiceGender, getVoiceGender } from '../voiceOutput';

function SettingRow({ label, description, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '16px', padding: '14px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      style={{
        width: '44px', height: '24px', borderRadius: '12px',
        border: 'none', cursor: 'pointer', position: 'relative',
        background: value ? 'var(--brand)' : 'var(--bg-overlay)',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: value ? '23px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  );
}

const PINNABLE = ['wallet', 'keys', 'phone', 'glasses', 'medication', 'cane', 'remote', 'bag'];

const INDIAN_LANGUAGES = [
  { code: 'en-IN', label: '🇮🇳 English (India)' },
  { code: 'hi-IN', label: '🇮🇳 हिन्दी — Hindi' },
  { code: 'ta-IN', label: '🇮🇳 தமிழ் — Tamil' },
  { code: 'te-IN', label: '🇮🇳 తెలుగు — Telugu' },
  { code: 'kn-IN', label: '🇮🇳 ಕನ್ನಡ — Kannada' },
  { code: 'ml-IN', label: '🇮🇳 മലയാളം — Malayalam' },
  { code: 'mr-IN', label: '🇮🇳 मराठी — Marathi' },
  { code: 'bn-IN', label: '🇮🇳 বাংলা — Bengali' },
  { code: 'gu-IN', label: '🇮🇳 ગુજરાતી — Gujarati' },
  { code: 'pa-IN', label: '🇮🇳 ਪੰਜਾਬੀ — Punjabi' },
  { code: 'ur-IN', label: '🇮🇳 اردو — Urdu' },
];

export default function SettingsDashboard({ user, onLogout }) {
  const [speechRate, setSpeechRate]     = useState(1.0);
  const [scanEnabled, setScanEnabled]   = useState(true);
  const [scanInterval, setScanInterval] = useState(30);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [pinned, setPinned]             = useState(['wallet', 'keys', 'phone', 'glasses']);
  const [voiceLang, setVoiceLangState]    = useState(getVoiceLang());
  const [voiceGender, setVoiceGenderState] = useState(getVoiceGender());
  const [provider, setProvider]         = useState(
    import.meta.env.VITE_VISION_PROVIDER ?? 'groq'
  );

  function handleLangChange(code) {
    setVoiceLangState(code);
    setVoiceLang(code);
    const label = INDIAN_LANGUAGES.find(l => l.code === code)?.label ?? code;
    speak(`Voice language set to ${label.replace(/^🇮🇳 /, '').split(' — ')[0]}.`);
  }

  function handleGenderChange(gender) {
    setVoiceGenderState(gender);
    setVoiceGender(gender);
    speak(`${gender === 'female' ? 'Female' : 'Male'} voice selected.`);
  }

  function testVoice() {
    speak(`Speech rate is ${speechRate.toFixed(1)} times normal speed.`, speechRate);
  }

  function togglePin(obj) {
    setPinned(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Profile */}
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--r-lg)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'var(--brand-dim)', border: '1px solid var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
        }}>
          {user?.avatar ?? '👤'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name ?? 'User'}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user?.username ?? 'user'}</div>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '8px 16px', borderRadius: 'var(--r-full)',
            border: '1px solid var(--red)', background: 'var(--red-dim)',
            color: 'var(--red)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      {/* Voice */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '4px 20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '14px 0 0' }}>
          Voice
        </p>
        <SettingRow label="Voice output" description="Speak responses aloud">
          <Toggle value={voiceEnabled} onChange={setVoiceEnabled} label="Toggle voice output" />
        </SettingRow>
        <SettingRow label="Speech rate" description={`${speechRate.toFixed(1)}× speed`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range" min="0.5" max="2.0" step="0.1"
              value={speechRate} aria-label="Speech rate"
              onChange={e => setSpeechRate(parseFloat(e.target.value))}
              style={{ width: '100px' }}
            />
            <button
              onClick={testVoice}
              style={{
                padding: '6px 12px', borderRadius: 'var(--r-full)',
                border: '1px solid var(--border-default)', background: 'var(--bg-overlay)',
                color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
              }}
            >
              Test
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Voice language" description="Language for speech & voice commands">
          <select
            value={voiceLang}
            onChange={e => handleLangChange(e.target.value)}
            aria-label="Voice language"
            style={{
              padding: '6px 10px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-default)', background: 'var(--bg-overlay)',
              color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
              maxWidth: '200px',
            }}
          >
            {INDIAN_LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Voice gender" description="Male or female voice for speech output">
          <div style={{ display: 'flex', gap: '6px' }}>
            {['female', 'male'].map(g => (
              <button
                key={g}
                onClick={() => handleGenderChange(g)}
                aria-pressed={voiceGender === g}
                style={{
                  padding: '6px 16px', borderRadius: 'var(--r-full)',
                  border: `1px solid ${voiceGender === g ? 'var(--brand)' : 'var(--border-default)'}`,
                  background: voiceGender === g ? 'var(--brand-dim)' : 'var(--bg-overlay)',
                  color: voiceGender === g ? 'var(--brand)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: voiceGender === g ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {g === 'female' ? '👩 Female' : '👨 Male'}
              </button>
            ))}
          </div>
        </SettingRow>
      </div>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '4px 20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '14px 0 0' }}>
          Scanning
        </p>
        <SettingRow
          label="Scan interval"
          description={scanEnabled ? `Auto-scan every ${scanInterval}s` : 'Auto-scan disabled'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Toggle value={scanEnabled} onChange={setScanEnabled} label="Toggle auto-scan" />
          </div>
        </SettingRow>
        {scanEnabled && (
          <SettingRow label="Interval duration" description={`Every ${scanInterval} seconds`}>
            <input
              type="range" min="10" max="120" step="10"
              value={scanInterval} aria-label="Scan interval duration"
              onChange={e => setScanInterval(parseInt(e.target.value))}
              style={{ width: '100px' }}
            />
          </SettingRow>
        )}
        <SettingRow label="Haptic guidance" description="Vibrate when object is centered">
          <Toggle value={hapticEnabled} onChange={setHapticEnabled} label="Toggle haptic guidance" />
        </SettingRow>
        <SettingRow label="Vision provider" description="AI model for image analysis">
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-default)', background: 'var(--bg-overlay)',
              color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <option value="groq">Groq (Llama 4 Scout)</option>
            <option value="dummy">Dummy (offline)</option>
          </select>
        </SettingRow>
      </div>

      {/* Pinned objects */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Pinned objects
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Pinned objects are never removed from memory
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {PINNABLE.map(obj => {
            const active = pinned.includes(obj);
            return (
              <button
                key={obj}
                onClick={() => togglePin(obj)}
                aria-pressed={active}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--r-full)',
                  border: `1px solid ${active ? 'var(--green)' : 'var(--border-default)'}`,
                  background: active ? 'var(--green-dim)' : 'var(--bg-overlay)',
                  color: active ? 'var(--green)' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}
              >
                {active ? '📌 ' : ''}{obj}
              </button>
            );
          })}
        </div>
      </div>

      {/* About */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
          About
        </p>
        {[
          ['Version', 'v0.2.0'],
          ['Backend', 'FastAPI + Python 3.9'],
          ['Vision AI', 'Groq Llama 4 Scout'],
          ['Memory', 'JSON circular buffer (100 entries)'],
          ['License', 'MIT'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{k}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
