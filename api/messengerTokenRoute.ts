import { readJsonBody, requestPathname } from './shopRoute.js';

export type MessengerTokenOp = 'test-token' | 'subscribe-page' | 'unknown';

export interface ParsedMessengerTokenRequest {
  method: string;
  op: MessengerTokenOp;
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (value == null) return '';
  return String(value).trim();
}

export function parseMessengerTokenRequest(req: {
  method?: string;
  url?: string;
  originalUrl?: string;
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): ParsedMessengerTokenRequest {
  const method = String(req.method || 'GET').toUpperCase();
  const q = req.query || {};
  const search = new URLSearchParams(String(req.url || '').split('?')[1] || '');
  const op = (firstQueryValue(q.op) || search.get('op') || '').toLowerCase();
  const path = requestPathname(req);

  if (/\/api\/messenger\/test-token(?:\/|$)/i.test(path) || op === 'test-token') {
    return { method, op: 'test-token' };
  }
  if (/\/api\/messenger\/subscribe-page(?:\/|$)/i.test(path) || op === 'subscribe-page') {
    return { method, op: 'subscribe-page' };
  }
  return { method, op: 'unknown' };
}

export { readJsonBody };
