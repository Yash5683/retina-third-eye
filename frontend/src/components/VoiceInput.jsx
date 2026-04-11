import { useState, useRef, useEffect } from 'react';
import { unlockSpeech, getVoiceLang } from '../voiceOutput';

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function VoiceInput({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [hasSpeech, setHasSpeech] = useState(!!SpeechRecognition);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function startListening() {
    unlockSpeech(); // unlock TTS on this user gesture
    if (!SpeechRecognition) return;
    const r = new SpeechRecognition();
    r.lang = getVoiceLang();
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => onTranscript?.(e.results[0][0].transcript);
    r.onend = () => setIsListening(false);
    r.onerror = (e) => { setIsListening(false); if (e.error === 'not-allowed') setHasSpeech(false); };
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    unlockSpeech();
    if (textInput.trim()) { onTranscript?.(textInput.trim()); setTextInput(''); }
  }

  if (!hasSpeech) {
    return (
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <input
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="Ask about an object…"
          aria-label="Voice input"
          disabled={disabled}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
          style={{
            flex: 1, padding: '12px 16px', fontSize: '15px',
            borderRadius: 'var(--r-full)', border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          }}
        />
        <button
          type="submit"
          disabled={disabled || !textInput.trim()}
          style={{
            padding: '0 20px', height: '48px', borderRadius: 'var(--r-full)',
            border: 'none', background: 'var(--brand)', color: '#fff',
            fontSize: '14px', fontWeight: 600,
          }}
        >
          Ask
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={isListening ? stopListening : startListening}
      disabled={disabled}
      aria-label={isListening ? 'Stop listening' : 'Ask a question'}
      aria-pressed={isListening}
      style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        border: `2px solid ${isListening ? 'var(--red)' : 'var(--border-default)'}`,
        background: isListening ? 'var(--red-dim)' : 'var(--bg-elevated)',
        color: isListening ? 'var(--red)' : 'var(--text-secondary)',
        fontSize: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        animation: isListening ? 'pulse-ring 1.5s ease-out infinite' : 'none',
        flexShrink: 0,
      }}
    >
      {isListening ? '⏹' : '🎤'}
    </button>
  );
}
