import { useEffect, useRef, useState, useCallback } from 'react';
import { detectObject } from '../api';
import { speakNow } from '../voiceOutput';

const HAPTIC_DURATION_MS  = 150;
const HAPTIC_INTERVAL_MS  = 500;
const DETECT_INTERVAL_MS  = 250;  // 4 fps — faster detection
const TIMEOUT_MS          = 60_000;
const SPEAK_COOLDOWN_MS   = 2500;
// Require N consecutive high-confidence center frames before auto-confirming
const CONFIRM_FRAMES_NEEDED = 3;

const hasVibration = () => typeof navigator.vibrate === 'function';

export default function HapticCompass({ targetObject, cameraRef, onFound, onTimeout, onCancel }) {
  const [position, setPosition]     = useState('not_found');
  const [distance, setDistance]     = useState('');
  const [confidence, setConfidence] = useState(0);
  const [isActive, setIsActive]     = useState(true);
  const [isPulsing, setIsPulsing]   = useState(false);
  const [confirmed, setConfirmed]   = useState(false);

  const detectIntervalRef   = useRef(null);
  const hapticIntervalRef   = useRef(null);
  const timeoutRef          = useRef(null);
  const lastSpokenRef       = useRef(0);
  const lastInstructionRef  = useRef('');
  const confirmCountRef     = useRef(0);  // consecutive center+confirmed frames

  const triggerHaptic = useCallback((pattern) => {
    if (hasVibration()) {
      navigator.vibrate(pattern?.length > 0 ? pattern : HAPTIC_DURATION_MS);
    } else {
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), HAPTIC_DURATION_MS);
    }
  }, []);

  const stopHaptic = useCallback(() => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    if (hasVibration()) navigator.vibrate(0);
    setIsPulsing(false);
  }, []);

  function speakInstruction(text) {
    if (!text) return;
    const now = Date.now();
    if (text === lastInstructionRef.current && now - lastSpokenRef.current < SPEAK_COOLDOWN_MS) return;
    if (text.includes('not visible') && now - lastSpokenRef.current < 5000) return;
    lastSpokenRef.current = now;
    lastInstructionRef.current = text;
    speakNow(text);
  }

  useEffect(() => {
    if (!isActive) return;

    detectIntervalRef.current = setInterval(async () => {
      if (!cameraRef?.current) return;
      const frame = cameraRef.current.captureFrame();
      if (!frame) return;

      try {
        const result = await detectObject(frame, targetObject);
        setPosition(result.position);
        setConfidence(result.confidence ?? 0);
        setDistance(result.guidance?.distance ?? '');

        const isConfirmedCenter = result.position === 'center' && result.guidance?.confirmed === true;

        if (isConfirmedCenter) {
          confirmCountRef.current += 1;
        } else {
          confirmCountRef.current = 0;
        }

        // Auto-confirm only after CONFIRM_FRAMES_NEEDED consecutive confirmed center frames
        if (confirmCountRef.current >= CONFIRM_FRAMES_NEEDED) {
          setConfirmed(true);
          speakInstruction(`Found your ${targetObject}! ${result.guidance?.distance ?? ''}`);
          triggerHaptic([300, 100, 300, 100, 500]);
          if (!hapticIntervalRef.current) {
            hapticIntervalRef.current = setInterval(
              () => triggerHaptic([200, 100, 200]),
              HAPTIC_INTERVAL_MS
            );
          }
          return;
        }

        if (result.position === 'center') {
          if (result.guidance?.instruction) speakInstruction(result.guidance.instruction);
          if (!hapticIntervalRef.current) {
            triggerHaptic(result.guidance?.vibrate);
            hapticIntervalRef.current = setInterval(
              () => triggerHaptic(result.guidance?.vibrate),
              HAPTIC_INTERVAL_MS
            );
          }
        } else if (result.position !== 'not_found') {
          if (result.guidance?.instruction) speakInstruction(result.guidance.instruction);
          stopHaptic();
        } else {
          if (result.guidance?.instruction) speakInstruction(result.guidance.instruction);
          stopHaptic();
        }
      } catch {
        // Silently ignore detection errors
      }
    }, DETECT_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      setIsActive(false);
      stopHaptic();
      speakNow(`I couldn't find your ${targetObject} in this area. Try moving to a different spot.`);
      if (onTimeout) onTimeout();
    }, TIMEOUT_MS);

    return () => {
      clearInterval(detectIntervalRef.current);
      clearTimeout(timeoutRef.current);
      stopHaptic();
    };
  }, [isActive, targetObject, cameraRef, triggerHaptic, stopHaptic, onTimeout]);

  function handleFound() {
    setIsActive(false);
    stopHaptic();
    clearInterval(detectIntervalRef.current);
    clearTimeout(timeoutRef.current);
    if (onFound) onFound();
  }

  function handleCancel() {
    setIsActive(false);
    stopHaptic();
    clearInterval(detectIntervalRef.current);
    clearTimeout(timeoutRef.current);
    if (onCancel) onCancel();
  }

  const positionColors = {
    left:      'var(--brand)',
    center:    confirmed ? 'var(--green)' : 'var(--orange)',
    right:     'var(--orange)',
    not_found: 'var(--text-muted)',
  };

  const positionLabels = {
    left:      '◀ Move Left',
    center:    confirmed ? '✓ Object Confirmed!' : `● Centering… (${Math.round(confidence * 100)}%)`,
    right:     '▶ Move Right',
    not_found: '🔍 Searching…',
  };

  return (
    <div
      role="region"
      aria-label={`Haptic compass searching for ${targetObject}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
        padding: '20px', borderRadius: 'var(--r-xl)',
        background: 'var(--bg-elevated)',
        border: `2px solid ${positionColors[position]}`,
        transition: 'border-color 0.3s',
      }}
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
        Searching for: <strong style={{ color: 'var(--text-primary)' }}>{targetObject}</strong>
      </p>

      {/* Visual pulse */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: positionColors[position],
          opacity: isPulsing || position === 'center' ? 1 : 0.25,
          transition: 'opacity 0.15s, background 0.3s',
          animation: (position === 'center' || confirmed) ? 'pulse-ring 0.8s ease-out infinite' : 'none',
        }}
      />

      <p style={{ fontSize: '18px', fontWeight: 700, color: positionColors[position], margin: 0, transition: 'color 0.3s' }}>
        {positionLabels[position]}
      </p>

      {/* Distance indicator */}
      {distance && distance !== 'not visible' && distance !== 'distance unknown' && (
        <div style={{
          padding: '6px 14px', borderRadius: 'var(--r-full)',
          background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
          fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          📏 {distance}
        </div>
      )}

      {/* Confidence bar */}
      {position !== 'not_found' && (
        <div style={{ width: '100%', maxWidth: '200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confidence</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{Math.round(confidence * 100)}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--bg-overlay)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${confidence * 100}%`,
              background: confidence >= 0.8 ? 'var(--green)' : confidence >= 0.55 ? 'var(--orange)' : 'var(--red)',
              borderRadius: '2px',
              transition: 'width 0.2s, background 0.2s',
            }} />
          </div>
        </div>
      )}

      {!hasVibration() && (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Vibration not supported — using visual indicator
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleFound}
          aria-label="I found it"
          style={{
            minHeight: '48px', padding: '10px 20px', fontSize: '15px',
            borderRadius: 'var(--r-full)', border: '2px solid var(--green)',
            background: confirmed ? 'var(--green)' : 'var(--green-dim)',
            color: confirmed ? '#000' : 'var(--green)',
            cursor: 'pointer', fontWeight: 700,
            transition: 'all 0.2s',
          }}
        >
          ✓ Found It
        </button>
        <button
          onClick={handleCancel}
          aria-label="Cancel search"
          style={{
            minHeight: '48px', padding: '10px 20px', fontSize: '15px',
            borderRadius: 'var(--r-full)', border: '1px solid var(--border-default)',
            background: 'var(--bg-overlay)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
