/**
 * GpsLocation — "Where am I?" panel
 *
 * • Uses browser navigator.geolocation (free, no API key)
 * • Reverse geocodes via Nominatim / OpenStreetMap (free, no API key)
 * • Shows an embedded OSM map tile iframe (free, no API key)
 * • Speaks the address in the user's selected language
 */
import { useState, useRef, useCallback } from 'react';
import { speakNow, getVoiceLang } from '../voiceOutput';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const OSM_TILE_URL  = (lat, lng, zoom = 16) =>
  `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;

// Language code → Nominatim accept-language header value
const LANG_MAP = {
  'en-IN': 'en',
  'hi-IN': 'hi',
  'ta-IN': 'ta',
  'te-IN': 'te',
  'kn-IN': 'kn',
  'ml-IN': 'ml',
  'mr-IN': 'mr',
  'bn-IN': 'bn',
  'gu-IN': 'gu',
  'pa-IN': 'pa',
  'ur-IN': 'ur',
};

export default function GpsLocation({ onClose }) {
  const [status, setStatus]     = useState('idle');   // idle | locating | found | error
  const [coords, setCoords]     = useState(null);     // { lat, lng, accuracy }
  const [address, setAddress]   = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showMap, setShowMap]   = useState(true);
  const watchIdRef = useRef(null);

  // ── Reverse geocode via Nominatim ─────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat, lng) => {
    const lang = LANG_MAP[getVoiceLang()] ?? 'en';
    try {
      const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=jsonv2&accept-language=${lang}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': lang, 'User-Agent': 'RetinaMemory/1.0' },
      });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();
      return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }, []);

  // ── Get location ──────────────────────────────────────────────────────────
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMsg('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('locating');
    setAddress('');
    setCoords(null);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        setCoords({ lat, lng, accuracy: acc });
        setStatus('found');

        const addr = await reverseGeocode(lat, lng);
        setAddress(addr);

        // Speak the location
        const spoken = `You are currently at: ${addr}. Accuracy: ${acc} metres.`;
        speakNow(spoken);
      },
      (err) => {
        setStatus('error');
        const msgs = {
          1: 'Location permission denied. Please allow location access.',
          2: 'Location unavailable. Please check your GPS signal.',
          3: 'Location request timed out. Please try again.',
        };
        setErrorMsg(msgs[err.code] ?? `Location error: ${err.message}`);
        speakNow(msgs[err.code] ?? 'Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [reverseGeocode]);

  // ── Copy coords to clipboard ──────────────────────────────────────────────
  function copyCoords() {
    if (!coords) return;
    const text = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  // ── Open in Google Maps ───────────────────────────────────────────────────
  function openGoogleMaps() {
    if (!coords) return;
    window.open(`https://www.google.com/maps?q=${coords.lat},${coords.lng}`, '_blank');
  }

  const isLocating = status === 'locating';

  return (
    <div style={{
      borderRadius: 'var(--r-xl)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📍</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Where Am I?
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              GPS · OpenStreetMap · No API key needed
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close GPS panel"
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

      {/* ── Map iframe ── */}
      {coords && showMap && (
        <div style={{ position: 'relative', width: '100%', height: '220px', background: '#1a1a2e' }}>
          <iframe
            title="Your location on OpenStreetMap"
            src={OSM_TILE_URL(coords.lat, coords.lng)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {/* Map toggle */}
          <button
            onClick={() => setShowMap(false)}
            style={{
              position: 'absolute', top: '8px', right: '8px',
              padding: '4px 8px', borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
              color: '#fff', fontSize: '11px', cursor: 'pointer',
            }}
          >Hide map</button>
        </div>
      )}

      {/* ── Address / status area ── */}
      <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
        {status === 'idle' && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
            Tap "Locate Me" to get your current position.
          </p>
        )}

        {isLocating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand)' }}>
            <span style={{
              width: '14px', height: '14px',
              border: '2px solid var(--brand)', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ fontSize: '13px' }}>Getting your location…</span>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--red)' }}>
            <span>⚠</span>
            <p style={{ fontSize: '13px', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {status === 'found' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Address */}
            {address ? (
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                📍 {address}
              </p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <span style={{
                  width: '10px', height: '10px',
                  border: '2px solid var(--text-muted)', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: '12px' }}>Looking up address…</span>
              </div>
            )}

            {/* Coordinates + accuracy */}
            {coords && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 600,
                  color: coords.accuracy <= 20 ? 'var(--green)' : coords.accuracy <= 100 ? 'var(--orange)' : 'var(--red)',
                }}>
                  ±{coords.accuracy}m accuracy
                </span>
              </div>
            )}

            {/* Show map button if hidden */}
            {!showMap && (
              <button
                onClick={() => setShowMap(true)}
                style={{
                  alignSelf: 'flex-start', padding: '4px 10px',
                  borderRadius: 'var(--r-full)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-overlay)',
                  color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
                }}
              >🗺 Show map</button>
            )}
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* Locate / Refresh */}
        <button
          onClick={locate}
          disabled={isLocating}
          style={{
            flex: 1, minWidth: '100px', height: '40px',
            borderRadius: 'var(--r-full)',
            border: '1px solid var(--brand)',
            background: isLocating ? 'var(--bg-overlay)' : 'var(--brand-dim)',
            color: isLocating ? 'var(--text-muted)' : 'var(--brand)',
            fontSize: '13px', fontWeight: 700,
            cursor: isLocating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          {isLocating ? '⏳ Locating…' : status === 'found' ? '🔄 Refresh' : '📍 Locate Me'}
        </button>

        {/* Speak address */}
        {status === 'found' && address && (
          <button
            onClick={() => speakNow(`You are at: ${address}`)}
            aria-label="Speak address"
            title="Read address aloud"
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

        {/* Copy coordinates */}
        {coords && (
          <button
            onClick={copyCoords}
            title="Copy coordinates"
            style={{
              height: '40px', padding: '0 12px', borderRadius: 'var(--r-full)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >📋 Copy</button>
        )}

        {/* Open in Google Maps */}
        {coords && (
          <button
            onClick={openGoogleMaps}
            title="Open in Google Maps"
            style={{
              height: '40px', padding: '0 12px', borderRadius: 'var(--r-full)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >🗺 Google Maps</button>
        )}
      </div>
    </div>
  );
}
