/**
 * EdgeAIPanel — self-contained live edge detection panel.
 * Shows real-time COCO-SSD bounding boxes on the camera + live object list.
 * Falls back to OpenRouter API for objects not in COCO-SSD's 80 classes.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEdgeDetector } from '../hooks/useEdgeDetector';
import EdgeOverlay from './EdgeOverlay';
import CameraFeed from './CameraFeed';
import { speak } from '../voiceOutput';

const ANNOUNCE_COOLDOWN = 4000; // ms between voice announcements per object

export default function EdgeAIPanel({ onNewObservations }) {
  const videoRef        = useRef(null); // direct ref to <video> inside CameraFeed
  const cameraRef       = useRef(null); // CameraFeed imperative handle
  const lastAnnounced   = useRef({});   // {className: timestamp}
  const lastDetections  = useRef([]);

  const [liveDetections, setLiveDetections] = useState([]);
  const [videoDims, setVideoDims]           = useState({ w: 640, h: 480 });
  const [isActive, setIsActive]             = useState(false);
  const [savedCount, setSavedCount]         = useState(0);

  const { modelState, detectOnce, startLoop, stopLoop, detectionsToObservations } = useEdgeDetector();

  // Get real video element dimensions once camera starts
  useEffect(() => {
    const iv = setInterval(() => {
      const video = videoRef.current;
      if (video && video.videoWidth > 0) {
        setVideoDims({ w: video.videoWidth, h: video.videoHeight });
        clearInterval(iv);
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Announce new detections via voice (with cooldown per class)
  const announceDetections = useCallback((dets) => {
    const now = Date.now();
    dets.forEach(det => {
      const last = lastAnnounced.current[det.class] ?? 0;
      if (now - last > ANNOUNCE_COOLDOWN && det.score > 0.65) {
        const pos = det.bbox ? (
          det.bbox[0] + det.bbox[2] / 2 < videoDims.w * 0.33 ? 'on your left' :
          det.bbox[0] + det.bbox[2] / 2 > videoDims.w * 0.66 ? 'on your right' :
          'ahead'
        ) : '';
        speak(`${det.class} ${pos}`);
        lastAnnounced.current[det.class] = now;
      }
    });
  }, [videoDims.w]);

  // Save detections to memory
  const saveToMemory = useCallback((dets) => {
    if (!dets.length || !onNewObservations) return;
    const obs = detectionsToObservations(dets, videoDims.w);
    onNewObservations(obs);
    setSavedCount(c => c + obs.length);
  }, [detectionsToObservations, onNewObservations, videoDims.w]);

  function toggle() {
    if (isActive) {
      stopLoop();
      setIsActive(false);
      setLiveDetections([]);
      speak('Edge AI stopped.');
    } else {
      if (modelState !== 'ready') {
        speak('AI model is still loading. Please wait.');
        return;
      }
      setIsActive(true);
      speak('Edge AI active. Detecting objects in real time.');
      // We run the loop on the raw video element, not through CameraFeed's capture
      startLoop(videoRef, (dets) => {
        setLiveDetections(dets);
        announceDetections(dets);
        // Save snapshot every 10 frames (~2.5s) to avoid flooding memory
        lastDetections.current = dets;
      });
    }
  }

  // Periodic save every 5s when active
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => {
      if (lastDetections.current.length > 0) {
        saveToMemory(lastDetections.current);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [isActive, saveToMemory]);

  // Cleanup
  useEffect(() => () => stopLoop(), [stopLoop]);

  const stateColor = {
    idle:    'var(--text-muted)',
    loading: 'var(--orange)',
    ready:   'var(--green-bright)',
    error:   'var(--red)',
  }[modelState];

  const stateLabel = {
    idle:    'Initialising…',
    loading: 'Loading model…',
    ready:   'Model ready',
    error:   'Model failed',
  }[modelState];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-glass)', backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--r-xl)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Model status dot */}
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: stateColor,
            boxShadow: modelState === 'ready' ? `0 0 8px ${stateColor}` : 'none',
            animation: modelState === 'loading' ? 'pulse-scale 1s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }}/>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ Edge AI
              <span style={{
                fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--r-full)',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                color: 'var(--green-bright)', fontWeight: 700, letterSpacing: '0.06em',
              }}>ON-DEVICE</span>
            </div>
            <div style={{ fontSize: '11px', color: stateColor, marginTop: '1px' }}>
              {stateLabel} · COCO-SSD · 80 classes
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {savedCount > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {savedCount} saved
            </span>
          )}
          <button onClick={toggle} disabled={modelState === 'loading' || modelState === 'error'}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r-full)',
              border: 'none', fontSize: '12px', fontWeight: 700,
              background: isActive
                ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))'
                : 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))',
              border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
              color: isActive ? 'var(--red-bright)' : 'var(--green-bright)',
              cursor: modelState === 'loading' ? 'wait' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: isActive ? '0 0 12px rgba(239,68,68,0.2)' : '0 0 12px rgba(16,185,129,0.15)',
            }}>
            {isActive ? '⏹ Stop' : '▶ Start'}
          </button>
        </div>
      </div>

      {/* Camera + overlay */}
      <div style={{
        position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden',
        border: `1px solid ${isActive ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
        boxShadow: isActive ? '0 0 24px rgba(16,185,129,0.15)' : 'none',
        transition: 'all 0.3s',
      }}>
        {/* Inject video ref via a wrapper that intercepts the video element */}
        <VideoCapture videoRef={videoRef} />
        <CameraFeed ref={cameraRef} hidden={false} onError={msg => speak(msg)} />

        {/* Bounding box overlay */}
        {isActive && liveDetections.length > 0 && (
          <EdgeOverlay
            detections={liveDetections}
            videoWidth={videoDims.w}
            videoHeight={videoDims.h}
          />
        )}

        {/* Active pulse border */}
        {isActive && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
            border: '2px solid rgba(16,185,129,0.5)',
            animation: 'border-glow 2s ease-in-out infinite',
          }}/>
        )}

        {/* Loading overlay */}
        {modelState === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
            background: 'rgba(3,6,13,0.7)', backdropFilter: 'blur(4px)',
            borderRadius: 'inherit',
          }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: 'var(--brand-bright)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Loading AI Model</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>~5MB · one-time download</div>
            </div>
          </div>
        )}
      </div>

      {/* Live detection list */}
      {isActive && (
        <div className="fade-up" style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '32px',
        }}>
          {liveDetections.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
              Scanning for objects…
            </span>
          ) : liveDetections.map((d, i) => {
            const conf = Math.round(d.score * 100);
            return (
              <div key={`${d.class}-${i}`} className="fade-up" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: 'var(--r-full)',
                background: 'var(--bg-glass)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-glass)',
                fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)',
                animationDelay: `${i * 0.05}s`,
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: conf > 75 ? 'var(--green-bright)' : conf > 55 ? 'var(--orange)' : 'var(--red)',
                  flexShrink: 0,
                }}/>
                <span style={{ textTransform: 'capitalize' }}>{d.class}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{conf}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      <div style={{
        fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6,
        padding: '10px 14px', borderRadius: 'var(--r-lg)',
        background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
        display: 'flex', gap: '16px',
      }}>
        <div>⚡ <strong style={{ color: 'var(--text-muted)' }}>~50ms</strong> per frame</div>
        <div>📡 <strong style={{ color: 'var(--text-muted)' }}>Offline</strong> capable</div>
        <div>🔒 <strong style={{ color: 'var(--text-muted)' }}>On-device</strong> only</div>
        <div>🎯 <strong style={{ color: 'var(--text-muted)' }}>80</strong> object classes</div>
      </div>
    </div>
  );
}

// Helper to grab the video element ref after CameraFeed mounts
function VideoCapture({ videoRef }) {
  useEffect(() => {
    // Find the video element in the DOM after render
    const iv = setInterval(() => {
      const video = document.querySelector('video[aria-label="Camera feed"]');
      if (video) {
        videoRef.current = video;
        clearInterval(iv);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [videoRef]);
  return null;
}
