// Retina Memory - Voice Output (TTS) utility

let _speechRate = 1.0;
let _isSpeaking = false;
const _queue: string[] = [];
let _unlocked = false;

const LANG_STORAGE_KEY   = 'retina_voice_lang';
const GENDER_STORAGE_KEY = 'retina_voice_gender';

let _voiceLang:   string = localStorage.getItem(LANG_STORAGE_KEY)   ?? 'en-IN';
let _voiceGender: string = localStorage.getItem(GENDER_STORAGE_KEY) ?? 'female';
let _selectedVoice: SpeechSynthesisVoice | null = null;

// ── Voice names known to be female / male across platforms ──────────────────
// These are checked against voice.name.toLowerCase()
const FEMALE_NAME_HINTS = [
  'female', 'woman', 'girl',
  // Google TTS voices
  'google hindi female', 'google uk english female',
  // macOS / iOS
  'veena',     // en-IN female
  'lekha',     // hi-IN female
  'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona',
  'allison', 'ava', 'susan', 'zoe', 'kate', 'siri',
  // Windows SAPI
  'zira', 'hazel', 'heera',
];

const MALE_NAME_HINTS = [
  'male', 'man', 'boy',
  'google uk english male',
  // macOS / iOS
  'rishi',     // en-IN male on macOS
  'daniel', 'alex', 'fred', 'tom', 'oliver', 'lee',
  'david', 'mark', 'richard', 'james',
  // Windows
  'george', 'stefan',
];

// Pitch values that make gender clearly audible regardless of voice name
const FEMALE_PITCH = 1.35;
const MALE_PITCH   = 0.75;

/**
 * Pick the best available voice for the current lang + gender preference.
 * Falls back gracefully: same-lang opposite-gender → any lang matching gender → first available.
 */
function _pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return null;

  const lang    = _voiceLang.toLowerCase();
  const gender  = _voiceGender;
  const hints   = gender === 'female' ? FEMALE_NAME_HINTS : MALE_NAME_HINTS;
  const antiHints = gender === 'female' ? MALE_NAME_HINTS : FEMALE_NAME_HINTS;

  function matchesGender(v: SpeechSynthesisVoice): boolean {
    const name = v.name.toLowerCase();
    if (antiHints.some(h => name.includes(h))) return false;
    return hints.some(h => name.includes(h));
  }

  // 1. Exact lang + correct gender
  const exactGender = voices.filter(v => v.lang.toLowerCase().startsWith(lang.slice(0, 5)) && matchesGender(v));
  if (exactGender.length > 0) return exactGender[0];

  // 2. Exact lang, any voice (no strong gender signal — take first)
  const exactLang = voices.filter(v => v.lang.toLowerCase().startsWith(lang.slice(0, 5)));
  if (exactLang.length > 0) return exactLang[0];

  // 3. Broader language family (e.g. 'en' for 'en-IN') + correct gender
  const baseLang = lang.slice(0, 2);
  const broadGender = voices.filter(v => v.lang.toLowerCase().startsWith(baseLang) && matchesGender(v));
  if (broadGender.length > 0) return broadGender[0];

  // 4. Any voice matching gender
  const anyGender = voices.filter(v => matchesGender(v));
  if (anyGender.length > 0) return anyGender[0];

  // 5. Absolute fallback
  return voices[0] ?? null;
}

/** Returns the pitch value for the current gender setting — ensures audible difference. */
function _genderPitch(): number {
  return _voiceGender === 'female' ? FEMALE_PITCH : MALE_PITCH;
}

function _applyVoice(utterance: SpeechSynthesisUtterance): void {
  if (!_selectedVoice) _selectedVoice = _pickVoice();
  if (_selectedVoice) utterance.voice = _selectedVoice;
}

// Re-pick voice whenever voices list loads asynchronously (Chrome fires this event)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    _selectedVoice = _pickVoice();
  });
}

export function setVoiceLang(lang: string): void {
  _voiceLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  _selectedVoice = _pickVoice(); // re-pick for new language
}

export function getVoiceLang(): string {
  return _voiceLang;
}

export function setVoiceGender(gender: 'male' | 'female'): void {
  _voiceGender = gender;
  localStorage.setItem(GENDER_STORAGE_KEY, gender);
  _selectedVoice = _pickVoice();
}

export function getVoiceGender(): 'male' | 'female' {
  return _voiceGender as 'male' | 'female';
}

/** Returns list of available voices for the current language (for debug / display). */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

/**
 * Call this once from a user gesture (click/tap) to unlock speechSynthesis.
 * Browsers block TTS until a user interaction has occurred.
 */
export function unlockSpeech(): void {
  if (_unlocked || !window.speechSynthesis) return;
  const silent = new SpeechSynthesisUtterance('');
  silent.volume = 0;
  silent.rate = 1;
  window.speechSynthesis.speak(silent);
  _unlocked = true;
  // Trigger voice pick now that audio context is unlocked
  _selectedVoice = _pickVoice();
}

function _processQueue(): void {
  if (_isSpeaking || _queue.length === 0) return;
  if (!window.speechSynthesis) return;

  const text = _queue.shift()!;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = _speechRate;
  utterance.lang = _voiceLang;
  utterance.volume = 1.0;
  utterance.pitch = _genderPitch();
  _applyVoice(utterance);

  utterance.onstart = () => { _isSpeaking = true; };
  utterance.onend   = () => { _isSpeaking = false; _processQueue(); };
  utterance.onerror = (e) => {
    console.warn('[VoiceOutput] TTS error:', e.error, '| text:', text.slice(0, 60));
    _isSpeaking = false;
    _processQueue();
  };

  // Chrome bug: speechSynthesis can get stuck — cancel before speaking
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/**
 * Speak a text string via the Web Speech API.
 * Queued — new utterances don't interrupt one in progress.
 * Falls back to console.warn when speechSynthesis is unavailable.
 */
export function speak(text: string, rate?: number): void {
  if (!text || !text.trim()) return;

  if (rate !== undefined) {
    _speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  if (!window.speechSynthesis) {
    console.warn('[VoiceOutput] speechSynthesis not available:', text);
    return;
  }

  _unlocked = true; // assume unlocked if speak is called from a user gesture chain
  _queue.push(text);
  _processQueue();
}

/**
 * Speak immediately, cancelling any current speech.
 * Use for urgent responses where interruption is acceptable.
 */
export function speakNow(text: string, rate?: number): void {
  if (!text || !text.trim()) return;
  if (!window.speechSynthesis) return;

  if (rate !== undefined) {
    _speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  _queue.length = 0;
  _isSpeaking = false;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = _speechRate;
  utterance.lang = _voiceLang;
  utterance.volume = 1.0;
  utterance.pitch = _genderPitch();
  _applyVoice(utterance);
  utterance.onstart = () => { _isSpeaking = true; };
  utterance.onend   = () => { _isSpeaking = false; };
  utterance.onerror = () => { _isSpeaking = false; };

  window.speechSynthesis.speak(utterance);
}

export function cancelAll(): void {
  _queue.length = 0;
  _isSpeaking = false;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export function setSpeechRate(rate: number): void {
  _speechRate = Math.max(0.5, Math.min(2.0, rate));
}

export function isSpeaking(): boolean {
  return _isSpeaking;
}
