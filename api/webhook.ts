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

function normalizeBody(body: unknown): unknown {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) return body;
    try {
      return JSON.parse(trimmed);
    } catch {
      return body;
    }
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return body;
    }
  }
  return body;
}

/** Keep a Vercel-pre-parsed JSON body so Express json() cannot clobber it. */
export function preserveParsedJsonBody(req: { body?: unknown; _body?: boolean }): void {
  const normalized = normalizeBody(req.body);
  req.body = normalized;
  if (normalized && typeof normalized === 'object' && !Buffer.isBuffer(normalized)) {
    req._body = true;
  }
}

export function waitForExpress(app: (req: any, res: any) => unknown, req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (res.writableEnded) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    if (typeof res.once === 'function') {
      res.once('finish', finish);
      res.once('close', finish);
      res.once('error', (err: unknown) => {
        if (settled) return;
        settled = true;
        reject(err);
      });
    }

    try {
      const maybe = app(req, res);
      if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
        (maybe as Promise<unknown>).then(() => {
          if (res.writableEnded || res.headersSent) finish();
        }, reject);
      }
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
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
      preserveParsedJsonBody(req);

      // Lazy import: the full Express/Firebase app boots only for POST events,
      // never at module load, so the verify GET always stays available.
      // On Vercel the compiled file is `index.js`; tsx resolves it to `index.ts` locally.
      const mod = await import('./index.js');
      const app = mod.default;
      if (typeof app === 'function') {
        // Express apps do not return a Promise. Returning `app(req, res)` from
        // this async handler lets Vercel freeze the isolate before the body is
        // processed — Meta then sees no inbox save and no reply.
        await waitForExpress(app, req, res);
        return;
      }
    } catch (err: any) {
      console.error('[webhook] main app unavailable, asking Meta to retry:', err?.message || err);
    }
    if (!res.headersSent && !res.writableEnded) return sendPlain(res, 503, 'WEBHOOK_UNAVAILABLE');
    return;
  }

  res.setHeader('Allow', 'GET, HEAD, POST');
  return sendPlain(res, 405, 'Method Not Allowed');
}
