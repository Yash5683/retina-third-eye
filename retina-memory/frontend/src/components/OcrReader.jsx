/**
 * OcrReader — Neural OCR panel for reading text from the camera.
 *
 * Two modes:
 *  • Single shot  — tap "Read Text" once, speaks what it finds
 *  • Continuous   — polls every 3 seconds, speaks whenever text changes
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { speakNow } from '../voiceOutput';
import { getVoiceLang } from '../voiceOutput';

const CONTINUOUS_INTERVAL_MS = 3000;   // poll every 3 s in continuous mode
const SPEAK_COOLDOWN_MS      = 2500;   // don't re-speak identical text within this window

export default function OcrReader({ cameraRef, onClose }) {
  const [mode, setMode]             = useState('idle');   // idle | reading | continuous | error
  const [lastText, setLastText]     = useState('');
  const [statusMsg, setStatusMsg]   = useState('Point camera at text and tap Read');
  const [continuous, setContinuous] = useState(false);

  const intervalRef    = useRef(null);
  const lastSpokenRef  = useRef('');
  const lastSpokenTime = useRef(0);
  const abortRef       = useRef(false);

  // ── Core OCR call ──────────────────────────────────────────────────────────
  const runOcr = useCallback(async () => {
    if (!cameraRef?.current) return;
    const frame = cameraRef.current.captureFrame();
    if (!frame) {
      setStatusMsg('Camera not ready. Please wait.');
      return;
    }

    setMode('reading');
    setStatusMsg('Reading text…');

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame, language: getVoiceLang() }),
      });

      if (!res.ok) {
        setMode('error');
        setStatusMsg('OCR service unavailable. Please try again.');
        return;
      }

      const data = await res.json();

      if (!data.found) {
        setLastText('');
        setStatusMsg('No readable text found.');
        if (!continuous) setMode('idle');
        else setMode('continuous');
        return;
      }

      setLastText(data.text);
      setStatusMsg(data.text);

      // Speak only if text changed or cooldown passed
      const now = Date.now();
      const textChanged = data.spoken !== lastSpokenRef.current;
      const cooldownOk  = now - lastSpokenTime.current > SPEAK_COOLDOWN_MS;

      if (textChanged || cooldownOk) {
        speakNow(data.spoken);
        lastSpokenRef.current  = data.spoken;
        lastSpokenTime.current = now;
      }

      setMode(continuous ? 'continuous' : 'idle');
    } catch {
      if (!abortRef.current) {
        setMode('error');
        setStatusMsg('OCR failed. Check connection.');
      }
    }
  }, [cameraRef, continuous]);

  // ── Continuous mode loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!continuous) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mode === 'continuous') setMode('idle');
      return;
    }
    setMode('continuous');
    setStatusMsg('Continuous OCR active — scanning…');
    runOcr(); // immediate first scan
    intervalRef.current = setInterval(runOcr, CONTINUOUS_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [continuous]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const isScanning = mode === 'reading';
  const isContinuous = mode === 'continuous';

  return (
    <div style={{
      borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🔤</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Text Reader (OCR)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {isContinuous ? '🔴 Live scanning…' : isScanning ? '⏳ Reading…' : 'Ready'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close OCR reader"
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-muted)', fontSize: '14px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 'unset',
          }}
        >×</button>
      </div>

      {/* Text output area */}
      <div style={{
        padding: '14px 16px',
        minHeight: '80px',
        maxHeight: '160px',
        overflowY: 'auto',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {isScanning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand)' }}>
            <span style={{
              width: '14px', height: '14px',
              border: '2px solid var(--brand)', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: '13px' }}>Scanning for text…</span>
          </div>
        ) : lastText ? (
          <pre style={{
            fontSize: '13px', color: 'var(--text-primary)',
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: 'inherit', lineHeight: 1.6,
          }}>
            {lastText}
          </pre>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
            {statusMsg}
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', gap: '8px', alignItems: 'center',
      }}>
        {/* Single shot button */}
        <button
          onClick={runOcr}
          disabled={isScanning || isContinuous}
          style={{
            flex: 1, height: '40px', borderRadius: 'var(--r-full)',
            border: '1px solid var(--brand)',
            background: isScanning ? 'var(--bg-overlay)' : 'var(--brand-dim)',
            color: isScanning ? 'var(--text-muted)' : 'var(--brand)',
            fontSize: '13px', fontWeight: 700,
            cursor: isScanning || isContinuous ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          🔤 Read Text
        </button>

        {/* Continuous toggle */}
        <button
          onClick={() => setContinuous(c => !c)}
          aria-pressed={continuous}
          title={continuous ? 'Stop continuous OCR' : 'Start continuous OCR'}
          style={{
            height: '40px', padding: '0 14px', borderRadius: 'var(--r-full)',
            border: `1px solid ${continuous ? 'var(--red)' : 'var(--border-default)'}`,
            background: continuous ? 'var(--red-dim)' : 'var(--bg-elevated)',
            color: continuous ? 'var(--red)' : 'var(--text-secondary)',
            fontSize: '12px', fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}
        >
          {continuous ? '⏹ Stop' : '🔁 Continuous'}
        </button>

        {/* Re-speak button — only when text is available */}
        {lastText && (
          <button
            onClick={() => speakNow(`I can read: ${lastText.replace(/\n/g, ', ')}`)}
            aria-label="Read text aloud again"
            title="Read aloud"
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', fontSize: '16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 'unset',
            }}
          >🔊</button>
        )}
      </div>

      {/* Continuous mode status bar */}
      {isContinuous && (
        <div style={{
          padding: '6px 16px',
          background: 'rgba(239,68,68,0.08)',
          borderTop: '1px solid rgba(239,68,68,0.2)',
          fontSize: '11px', color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--red)',
            animation: 'pulse-ring 1.5s ease-out infinite',
            display: 'inline-block',
          }} />
          Scanning every 3 seconds — speak when text changes
        </div>
      )}
    </div>
  );
}
