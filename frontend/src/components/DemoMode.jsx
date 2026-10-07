import { useEffect, useState } from 'react';
import { demoObservations } from '../fixtures/demoObservations';
import { speak } from '../voiceOutput';

/**
 * DemoMode — simulates scanning and queries using fixture data.
 * Activated via ?demo=true query param or the toggle button.
 * @param {object} props
 * @param {boolean} props.active
 * @param {function} props.onObservations - called with Observation[] to update parent state
 * @param {function} props.onToggle - called when demo mode is toggled
 */
export default function DemoMode({ active, onObservations, onToggle }) {
  const [queryInput, setQueryInput] = useState('');
  const [lastResponse, setLastResponse] = useState('');

  useEffect(() => {
    if (active && onObservations) {
      onObservations(demoObservations);
      speak('Demo mode active. Memory loaded with sample objects.');
    }
  }, [active, onObservations]);

  function handleDemoQuery(e) {
    e.preventDefault();
    if (!queryInput.trim()) return;

    const lower = queryInput.toLowerCase();
    const match = demoObservations.find((obs) =>
      lower.includes(obs.object.toLowerCase())
    );

    let response;
    if (match) {
      const diffMin = Math.round((Date.now() - new Date(match.timestamp).getTime()) / 60_000);
      response = `I last saw your ${match.object} ${diffMin} minute${diffMin !== 1 ? 's' : ''} ago, ${match.location}.`;
    } else {
      response = `I couldn't find that object in demo memory. Try asking about: wallet, keys, phone, glasses, or remote.`;
    }

    setLastResponse(response);
    speak(response);
    setQueryInput('');
  }

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: '#1a0a00',
        border: '2px solid #ff9944',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ color: '#ff9944', fontWeight: 700, fontSize: '16px' }}>🧪 Demo Mode</span>
        <button
          onClick={onToggle}
          aria-label="Toggle demo mode"
          style={{
            minHeight: '36px',
            padding: '6px 14px',
            fontSize: '14px',
            borderRadius: '6px',
            border: '1px solid #ff9944',
            background: 'transparent',
            color: '#ff9944',
            cursor: 'pointer',
          }}
        >
          {active ? 'Disable' : 'Enable'}
        </button>
      </div>

      {active && (
        <>
          <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 12px' }}>
            {demoObservations.length} objects loaded. Try: "Where is my wallet?"
          </p>
          <form onSubmit={handleDemoQuery} style={{ display: 'flex', gap: '8px' }}>
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Ask about an object..."
              aria-label="Demo query input"
              style={{
                flex: 1,
                padding: '10px 12px',
                fontSize: '15px',
                borderRadius: '8px',
                border: '1px solid #444',
                background: '#111',
                color: '#fff',
              }}
            />
            <button
              type="submit"
              disabled={!queryInput.trim()}
              aria-label="Submit demo query"
              style={{
                minHeight: '44px',
                padding: '10px 16px',
                fontSize: '15px',
                borderRadius: '8px',
                border: 'none',
                background: '#ff9944',
                color: '#000',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Ask
            </button>
          </form>
          {lastResponse && (
            <p
              role="status"
              aria-live="polite"
              style={{ color: '#fff', fontSize: '15px', marginTop: '12px', padding: '10px', background: '#111', borderRadius: '8px' }}
            >
              {lastResponse}
            </p>
          )}
        </>
      )}
    </div>
  );
}
