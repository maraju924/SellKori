/**
 * Isolated Meta webhook endpoint.
 * No Firebase/Express imports — Verify and Save must succeed even when
 * the main /api function cannot boot.
 */
export const maxDuration = 60;

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (value == null) return '';
  return String(value).trim();
}

export function handleMetaVerifyGet(query: Record<string, unknown> | undefined): { status: number; body: string } {
  const q = query || {};
  const mode = firstQueryValue(q['hub.mode'] || q.mode).toLowerCase();
  const challenge = firstQueryValue(q['hub.challenge'] || q.challenge);
  const token = firstQueryValue(q['hub.verify_token'] || q.verify_token);

  if (mode === 'subscribe' && challenge && token) {
    return { status: 200, body: challenge };
  }
  return { status: 403, body: 'Forbidden' };
}

function sendPlain(res: any, status: number, body: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  if (typeof res.end === 'function') return res.end(body);
  return res.send(body);
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || 'GET').toUpperCase();
  const query = req.query || {};

  if (method === 'GET' || method === 'HEAD') {
    const result = handleMetaVerifyGet(query);
    return sendPlain(res, result.status, result.body);
  }

  if (method === 'POST') {
    try {
      // Lazy import: the full Express/Firebase app boots only for POST events,
      // never at module load, so the verify GET always stays available.
      // On Vercel the compiled file is `index.js`; tsx resolves it to `index.ts` locally.
      const mod = await import('./index.js');
      const app = mod.default;
      if (typeof app === 'function') return app(req, res);
    } catch (err: any) {
      console.error('[webhook] main app unavailable, asking Meta to retry:', err?.message || err);
    }
    if (!res.headersSent) return sendPlain(res, 503, 'WEBHOOK_UNAVAILABLE');
    return;
  }

  res.setHeader('Allow', 'GET, HEAD, POST');
  return sendPlain(res, 405, 'Method Not Allowed');
}
