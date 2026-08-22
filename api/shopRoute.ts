export type ShopOp = 'get' | 'checkout' | 'orders' | 'slug' | 'unknown';

export interface ParsedShopRequest {
  method: string;
  op: ShopOp;
  businessId: string;
  query: Record<string, string>;
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (value == null) return '';
  return String(value).trim();
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string {
  if (!headers) return '';
  const direct = headers[name];
  if (direct != null) return firstQueryValue(direct);
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return firstQueryValue(value);
  }
  return '';
}

export function requestPathname(req: {
  url?: string;
  originalUrl?: string;
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): string {
  const q = req.query || {};
  const candidates = [
    req.originalUrl,
    headerValue(req.headers, 'x-invoke-path'),
    headerValue(req.headers, 'x-vercel-original-url'),
    firstQueryValue(q.path),
    req.url,
    req.path,
  ];
  for (const candidate of candidates) {
    const path = String(candidate || '').split('?')[0].trim();
    if (path) return path;
  }
  return '';
}

export function parseShopRequest(req: {
  method?: string;
  url?: string;
  originalUrl?: string;
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): ParsedShopRequest {
  const method = String(req.method || 'GET').toUpperCase();
  const q = req.query || {};
  const search = new URLSearchParams(String(req.url || '').split('?')[1] || '');
  const queryVal = (key: string) => firstQueryValue(q[key]) || search.get(key) || '';

  const path = requestPathname(req);
  let businessId = queryVal('businessId') || queryVal('id');
  let op = queryVal('op').toLowerCase();

  const shopMatch = path.match(/\/api\/shop\/([^/]+)(?:\/([^/]+))?/i);
  if (shopMatch) {
    try {
      businessId = businessId || decodeURIComponent(shopMatch[1]);
    } catch {
      businessId = businessId || shopMatch[1];
    }
    op = op || String(shopMatch[2] || 'get').toLowerCase();
  }

  const query = {
    slug: queryVal('slug'),
    except: queryVal('except'),
    phone: queryVal('phone'),
    orderId: queryVal('orderId'),
  };

  if (/\/api\/public\/shop-slug/i.test(path) || op === 'slug') {
    return { method, op: 'slug', businessId: '', query };
  }
  if (op === 'checkout') {
    return { method, op: 'checkout', businessId, query };
  }
  if (op === 'orders') {
    return { method, op: 'orders', businessId, query };
  }
  if (businessId) {
    return { method, op: 'get', businessId, query };
  }
  return { method, op: 'unknown', businessId: '', query };
}

export function readJsonBody(req: { body?: unknown }): Record<string, any> {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body as Record<string, any>;
  }
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body) && body.length) {
    try {
      const parsed = JSON.parse(body.toString('utf8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
