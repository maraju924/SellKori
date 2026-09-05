import { readJsonBody, requestPathname } from './shopRoute.js';

export type BroadcastOp = 'preview' | 'send' | 'unknown';

export interface ParsedBroadcastRequest {
  method: string;
  op: BroadcastOp;
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (value == null) return '';
  return String(value).trim();
}

export function parseBroadcastRequest(req: {
  method?: string;
  url?: string;
  originalUrl?: string;
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): ParsedBroadcastRequest {
  const method = String(req.method || 'GET').toUpperCase();
  const q = req.query || {};
  const search = new URLSearchParams(String(req.url || '').split('?')[1] || '');
  const op = (
    firstQueryValue(q.op) ||
    search.get('op') ||
    ''
  ).toLowerCase();
  const path = requestPathname(req);

  if (/\/api\/broadcast\/preview(?:\/|$)/i.test(path) || op === 'preview') {
    return { method, op: 'preview' };
  }
  if (/\/api\/broadcast(?:\/|$)/i.test(path) || op === 'send') {
    return { method, op: 'send' };
  }
  return { method, op: 'unknown' };
}

export { readJsonBody };
