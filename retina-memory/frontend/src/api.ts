// Retina Memory - API client
import type {
  CaptureRequest,
  CaptureResponse,
  DetectRequest,
  DetectResponse,
  QueryRequest,
  QueryResponse,
  RecentMemoryResponse,
} from './types';
import { getVoiceLang } from './voiceOutput';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new APIError(response.status, detail);
  }
  return response.json() as Promise<TRes>;
}

async function get<TRes>(path: string): Promise<TRes> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new APIError(response.status, detail);
  }
  return response.json() as Promise<TRes>;
}

async function del<TRes>(path: string): Promise<TRes> {
  const response = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new APIError(response.status, detail);
  }
  return response.json() as Promise<TRes>;
}

export function captureFrame(imageBase64: string): Promise<CaptureResponse> {
  const req: CaptureRequest = { image: imageBase64 };
  return post<CaptureRequest, CaptureResponse>('/api/capture', req);
}

export function queryMemory(query: string): Promise<QueryResponse> {
  const req: QueryRequest = { query, language: getVoiceLang() };
  return post<QueryRequest, QueryResponse>('/api/query', req);
}

export function detectObject(
  imageBase64: string,
  targetObject: string,
): Promise<DetectResponse> {
  const req: DetectRequest = { image: imageBase64, target_object: targetObject };
  return post<DetectRequest, DetectResponse>('/api/detect', req);
}

export function getRecentMemory(limit = 20): Promise<RecentMemoryResponse> {
  return get<RecentMemoryResponse>(`/api/memory/recent?limit=${limit}`);
}

export function clearMemory(): Promise<{ status: string; message: string }> {
  return del<{ status: string; message: string }>('/api/memory');
}

export { APIError };
