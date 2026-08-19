/**
 * Isolated Meta webhook endpoint.
 * No Firebase/Express imports — Verify and Save must succeed even when
 * the main /api function cannot boot.
 */
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
      // Keep this specifier dynamic so the verify function does not boot
      // the full Express/Firebase app at module load.
      const specifier = './ind' + 'ex.ts';
      const mod = await import(specifier);
      const app = mod.default;
      if (typeof app === 'function') return app(req, res);
    } catch (err: any) {
      console.error('[webhook] main app unavailable, acking Meta:', err?.message || err);
    }
    if (!res.headersSent) return sendPlain(res, 200, 'EVENT_RECEIVED');
    return;
  }

  res.setHeader('Allow', 'GET, HEAD, POST');
  return sendPlain(res, 405, 'Method Not Allowed');
}
