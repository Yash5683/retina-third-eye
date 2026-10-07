/**
 * ObstacleWarning — continuous background scan that alerts when
 * something enters the path (center of frame, close proximity).
 * Runs silently in the background; only speaks when a hazard is detected.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { speakNow } from '../voiceOutput';

const SCAN_INTERVAL_MS   = 2000;   // scan every 2 seconds
const SPEAK_COOLDOWN_MS  = 4000;   // don't repeat same warning within 4s
const OBSTACLE_PROMPT    = `Analyze this image for obstacles or hazards directly in the path ahead.
Return JSON: {"obstacle": true/false, "type": "object name or null", "urgency": "low|medium|high", "instruction": "brief spoken warning or null"}
- urgency high: immediate danger (step, wall, person very close)
- urgency medium: nearby obstacle (furniture, bag on floor)
- urgency low: distant or minor
- instruction: short, clear, actionable (e.g. "Step ahead", "Chair on your left", "Wall close")
Return ONLY valid JSON, no markdown.`;

const hasVibration = () => typeof navigator.vibrate === 'function';

export default function ObstacleWarning({ cameraRef, enabled, onObstacle }) {
  const [lastWarning, setLastWarning]   = useState('');
  const [urgency, setUrgency]           = useState('');
  const intervalRef   = useRef(null);
  const lastSpokenRef = useRef(0);
  const lastTypeRef   = useRef('');

  const scan = useCallback(async () => {
    if (!cameraRef?.current) return;
    const frame = cameraRef.current.captureFrame();
    if (!frame) return;

    const apiKey = '';  // fetched server-side via proxy
    try {
      const res = await fetch('/api/obstacle-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame }),
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.obstacle && data.instruction) {
        const now = Date.now();
        const sameWarning = data.type === lastTypeRef.current;
        const cooldownOk  = now - lastSpokenRef.current > SPEAK_COOLDOWN_MS;

        if (!sameWarning || cooldownOk) {
          setLastWarning(data.instruction);
          setUrgency(data.urgency);
          lastSpokenRef.current = now;
          lastTypeRef.current   = data.type || '';

          // Speak + vibrate based on urgency
          speakNow(data.instruction);
          if (hasVibration()) {
            if (data.urgency === 'high')   navigator.vibrate([300, 100, 300, 100, 300]);
            else if (data.urgency === 'medium') navigator.vibrate([200, 100, 200]);
            else                                navigator.vibrate([100]);
          }

          if (onObstacle) onObstacle(data);
        }
      } else {
        // Clear warning when path is clear
        if (lastWarning) setLastWarning('');
        if (urgency)     setUrgency('');
        lastTypeRef.current = '';
      }
    } catch {
      // Silently ignore errors — obstacle scan is best-effort
    }
  }, [cameraRef, lastWarning, urgency, onObstacle]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLastWarning('');
      setUrgency('');
      return;
    }
    intervalRef.current = setInterval(scan, SCAN_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [enabled, scan]);

  if (!enabled || !lastWarning) return null;

  const urgencyColors = {
    high:   { bg: 'var(--red-dim)',    border: 'var(--red)',    color: 'var(--red)'    },
    medium: { bg: 'rgba(251,146,60,0.15)', border: 'var(--orange)', color: 'var(--orange)' },
    low:    { bg: 'var(--bg-elevated)', border: 'var(--border-default)', color: 'var(--text-secondary)' },
  };
  const colors = urgencyColors[urgency] || urgencyColors.low;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fade-up"
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-lg)',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontSize: '13px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {urgency === 'high' ? '🚨' : urgency === 'medium' ? '⚠️' : '⚡'} {lastWarning}
    </div>
  );
}
