/**
 * Isolated health endpoint. Must boot even when api/index.ts cannot.
 */
export const maxDuration = 10;

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (typeof res.end === 'function') return res.end(JSON.stringify(body));
  return res.send(body);
}

export default function handler(req: any, res: any) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }
  return sendJson(res, 200, {
    ok: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    isolated: true,
  });
}
