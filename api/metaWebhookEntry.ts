/**
 * Lightweight Meta webhook entry. GET verification is answered here without
 * loading Firebase so "Verify and Save" cannot time out on a cold start.
 * POST (and anything else) is forwarded to the main Express app.
 */
export default async function metaWebhookEntry(req: any, res: any) {
  const query = req.query || {};
  const first = (value: unknown) => {
    if (Array.isArray(value)) return String(value[0] ?? '').trim();
    if (value == null) return '';
    return String(value).trim();
  };

  const mode = first(query['hub.mode'] || query.mode).toLowerCase();
  const challenge = first(query['hub.challenge'] || query.challenge);
  const token = first(query['hub.verify_token'] || query.verify_token);

  if (req.method === 'GET' && mode === 'subscribe' && challenge) {
    if (!token) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.end('Forbidden');
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    return res.end(challenge);
  }

  const { default: app } = await import('./index.ts');
  return app(req, res);
}
