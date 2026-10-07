import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';

/**
 * CameraFeed — manages getUserMedia stream and exposes captureFrame().
 * Supports switching between available camera devices (laptop / phone).
 * @param {object} props
 * @param {boolean} props.hidden - hide the video preview
 * @param {function} props.onError - called with error message string
 */
const CameraFeed = forwardRef(function CameraFeed({ hidden = false, onError }, ref) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const [devices, setDevices]         = useState([]);   // available video input devices
  const [activeId, setActiveId]       = useState(null); // currently selected deviceId
  const [showPicker, setShowPicker]   = useState(false);

  // ── Enumerate cameras ──────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === 'videoinput');
      setDevices(cams);
      return cams;
    } catch {
      return [];
    }
  }, []);

  // ── Start / restart stream ─────────────────────────────────────────────────
  const startStream = useCallback(async (deviceId) => {
    // Stop existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: 'environment' },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (onError) onError('Camera disconnected. Please reconnect and refresh.');
        };
      });

      // After first permission grant, enumerate so labels are populated
      const cams = await loadDevices();
      if (!deviceId && cams.length > 0) setActiveId(cams[0].deviceId);

    } catch (err) {
      if (onError) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          onError('Camera permission required. Please allow camera access.');
        } else if (err.name === 'OverconstrainedError') {
          onError('Selected camera is no longer available.');
        } else {
          onError(`Camera error: ${err.message}`);
        }
      }
    }
  }, [onError, loadDevices]);

  // Initial start
  useEffect(() => {
    let cancelled = false;
    startStream(null).then(() => {
      if (cancelled) streamRef.current?.getTracks().forEach(t => t.stop());
    });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch camera when activeId changes (but not on first mount)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (activeId) startStream(activeId);
  }, [activeId, startStream]);

  // ── captureFrame / isReady ─────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    captureFrame() {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
      const canvas = document.createElement('canvas');
      const maxW   = 640;
      const scale  = Math.min(1, maxW / (video.videoWidth || maxW));
      canvas.width  = Math.round((video.videoWidth  || 640) * scale);
      canvas.height = Math.round((video.videoHeight || 480) * scale);
      const ctx = canvas.getContext('2d');
      // Flip horizontally to undo the CSS mirror — AI receives correct orientation
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    },
    isReady() {
      const video = videoRef.current;
      return !!(video && video.readyState >= 2 && video.videoWidth > 0);
    },
  }));

  // ── Label helper ───────────────────────────────────────────────────────────
  function deviceLabel(d, i) {
    if (d.label) return d.label;
    // Guess from index / facingMode hint
    if (i === 0) return 'Laptop Camera';
    return `Camera ${i + 1}`;
  }

  function shortLabel(d, i) {
    const full = deviceLabel(d, i).toLowerCase();
    if (full.includes('front') || full.includes('facetime') || i === 0) return '💻 Laptop';
    if (full.includes('back') || full.includes('rear') || full.includes('environment')) return '📱 Phone (back)';
    if (full.includes('phone') || full.includes('continuity')) return '📱 Phone';
    return `📷 Cam ${i + 1}`;
  }

  const activeDevice = devices.find(d => d.deviceId === activeId);
  const activeIndex  = devices.findIndex(d => d.deviceId === activeId);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Camera feed"
        style={{
          display: hidden ? 'none' : 'block',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '12px',
          background: '#111',
          transform: 'scaleX(-1)',   // mirror the preview display
        }}
      />

      {/* Camera switcher — only show if more than one camera available */}
      {!hidden && devices.length > 1 && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 5 }}>
          <button
            onClick={() => setShowPicker(p => !p)}
            aria-label="Switch camera"
            title="Switch camera"
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            🔄 {activeDevice ? shortLabel(activeDevice, activeIndex) : 'Camera'}
          </button>

          {showPicker && (
            <div style={{
              position: 'absolute',
              top: '38px',
              right: 0,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              overflow: 'hidden',
              minWidth: '180px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {devices.map((d, i) => (
                <button
                  key={d.deviceId}
                  onClick={() => { setActiveId(d.deviceId); setShowPicker(false); }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: d.deviceId === activeId ? 'var(--brand-dim)' : 'none',
                    border: 'none',
                    borderBottom: i < devices.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    color: d.deviceId === activeId ? 'var(--brand)' : 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: d.deviceId === activeId ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {shortLabel(d, i)}
                  {d.deviceId === activeId && (
                    <span style={{ float: 'right', color: 'var(--brand)' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default CameraFeed;
