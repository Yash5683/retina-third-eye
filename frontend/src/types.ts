// Retina Memory - shared TypeScript types

export type Position = 'left' | 'center' | 'right';
export type DetectPosition = Position | 'not_found';
export type Intent = 'memory_lookup' | 'live_vision';
export type AppMode = 'idle' | 'scanning' | 'listening' | 'thinking';

export interface Observation {
  object: string;
  color: string;
  position: Position;
  location: string;
  timestamp: string; // ISO 8601
  confidence?: number;
}

export interface CaptureRequest {
  image: string; // base64-encoded JPEG
}

export interface CaptureResponse {
  observations: Observation[];
  model_used: string;
  processing_time_ms: number;
}

export interface QueryRequest {
  query: string;
  language?: string; // BCP-47 language code, e.g. 'kn-IN', 'hi-IN'
}

export interface QueryResponse {
  intent: Intent;
  response_text: string;
  observation: Observation | null;
}

export interface DetectRequest {
  image: string; // base64-encoded JPEG
  target_object: string;
}

export interface DetectResponse {
  position: DetectPosition;
  confidence: number;
}

export interface RecentMemoryResponse {
  observations: Observation[];
}
