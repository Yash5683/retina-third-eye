import { useState, useRef } from 'react';
import { unlockSpeech, getVoiceLang } from '../voiceOutput';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function VoiceInput({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [hasSpeech, setHasSpeech] = useState(!!SpeechRecognition);
  const recognitionRef = useRef(null);

  function startListening() {
    unlockSpeech();
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
      <form onSubmit={handleSubmit} style={{ display:'flex', gap:'8px', width:'100%' }}>
        <input value={textInput} onChange={e => setTextInput(e.target.value)}
          placeholder="Ask about an object…" aria-label="Voice input" disabled={disabled}
          style={{
            flex:1, padding:'0 16px', height:'48px', fontSize:'14px',
            borderRadius:'var(--r-full)', border:'1px solid var(--border-default)',
            background:'var(--bg-glass)', backdropFilter:'blur(12px)',
            color:'var(--text-primary)', outline:'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--brand-bright)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
        />
        <button type="submit" disabled={disabled || !textInput.trim()} style={{
          height:'48px', padding:'0 18px', borderRadius:'var(--r-full)',
          border:'none', background:'var(--brand-gradient)', color:'#fff',
          fontSize:'13px', fontWeight:700,
        }}>Ask</button>
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
        width:'48px', height:'48px', borderRadius:'50%', flexShrink:0,
        border:`2px solid ${isListening ? 'var(--red)' : 'rgba(59,130,246,0.3)'}`,
        background: isListening
          ? 'radial-gradient(circle, rgba(239,68,68,0.2), rgba(239,68,68,0.05))'
          : 'radial-gradient(circle, rgba(37,99,235,0.15), rgba(37,99,235,0.05))',
        color: isListening ? 'var(--red-bright)' : 'var(--brand-bright)',
        fontSize:'18px',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all 0.2s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: isListening ? '0 0 20px rgba(239,68,68,0.3)' : '0 0 12px rgba(59,130,246,0.2)',
        animation: isListening ? 'pulse-glow 1.2s ease-in-out infinite' : 'none',
      }}
    >
      {isListening ? (
        <div style={{ display:'flex', gap:'2px', alignItems:'flex-end', height:'18px' }}>
          {[4,8,12,8,4].map((h,i) => (
            <div key={i} className="voice-bar" style={{ height:`${h}px` }}/>
          ))}
        </div>
      ) : '🎤'}
    </button>
  );
}
