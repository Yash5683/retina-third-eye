/**
 * PhoneCameraModal — shows a QR code so the user can open the app
 * on their phone and use the phone's camera instead of the laptop webcam.
 * Fetches the real network IP from the backend so it works regardless
 * of whether the frontend is accessed via localhost or network IP.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function PhoneCameraModal({ onClose }) {
  const canvasRef = useRef(null);
  const [networkUrl, setNetworkUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchNetworkUrl() {
      try {
        const res = await fetch('/api/network-info');
        const data = await res.json();
        setNetworkUrl(data.frontend_url);
      } catch {
        // Fallback: use current hostname if backend call fails
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (isLocal) {
          setError('Could not detect network IP. Make sure the backend is running.');
          setNetworkUrl(`https://${host}:5173`);
        } else {
          setNetworkUrl(`https://${host}:5173`);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchNetworkUrl();
  }, []);

  // Render QR once we have the URL
  useEffect(() => {
    if (!networkUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, networkUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [networkUrl]);

  const isLocalhost = networkUrl.includes('localhost') || networkUrl.includes('127.0.0.1');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Use phone camera"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '20px',
        padding: '28px 24px',
        maxWidth: '320px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '14px', right: '14px',
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: '20px',
            cursor: 'pointer', lineHeight: 1,
          }}
        >×</button>

        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📱</div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          Use Phone Camera
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Scan this QR code with your phone.<br />
          Make sure your phone is on the <strong>same WiFi</strong> as this laptop.
        </p>

        {/* QR Code */}
        <div style={{
          display: 'inline-flex',
          padding: '12px',
          background: '#fff',
          borderRadius: '12px',
          marginBottom: '16px',
          minWidth: '244px',
          minHeight: '244px',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {loading ? (
            <div style={{ color: '#999', fontSize: '13px' }}>Loading…</div>
          ) : (
            <canvas ref={canvasRef} style={{ borderRadius: '4px', display: 'block' }} />
          )}
        </div>

        {/* URL */}
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-elevated)',
          borderRadius: '8px',
          marginBottom: '16px',
          wordBreak: 'break-all',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 2px' }}>Open on your phone:</p>
          <p style={{ fontSize: '13px', color: 'var(--brand)', margin: 0, fontWeight: 600 }}>
            {loading ? 'Detecting…' : networkUrl}
          </p>
        </div>

        {/* Error / warning */}
        {(error || isLocalhost) && !loading && (
          <div style={{
            padding: '10px 12px',
            background: 'var(--red-dim)',
            border: '1px solid var(--red)',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'left',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--red)', margin: '0 0 4px', fontWeight: 700 }}>
              ⚠ Phone may not reach this URL
            </p>
            <p style={{ fontSize: '12px', color: 'var(--red)', margin: 0, lineHeight: 1.5 }}>
              {error || 'Make sure both devices are on the same WiFi network.'}
            </p>
          </div>
        )}

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          On your phone, accept the security warning → Advanced → Proceed.<br />
          Then tap <strong>Scan Now</strong> to use your phone's camera.
        </p>
      </div>
    </div>
  );
}
