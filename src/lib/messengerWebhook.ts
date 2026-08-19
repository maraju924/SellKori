/**
 * Meta Messenger webhook helpers.
 *
 * Why this exists: Facebook's "Verify and Save" GET and later message POSTs
 * often arrive on a *rewritten* path (e.g. `/api/index.ts` after a Vercel
 * rewrite) instead of `/api/webhook`. Matching only a handful of Express
 * routes made both handshake and receive/send look "dead". These helpers
 * detect Meta traffic by query/body, not by a brittle path list.
 */

export const DEFAULT_MESSENGER_VERIFY_TOKEN = 'sellkori_verify_token';

export const LEGACY_VERIFY_TOKENS = [
  DEFAULT_MESSENGER_VERIFY_TOKEN,
  'sellkori_token',
  'sellkori',
  'chatbyraju',
  '1058370033',
  'sendbyraju',
  'raju',
  'webhook'
];

export const PAGE_SUBSCRIBE_FIELDS = [
  'messages',
  'messaging_postbacks',
  'messaging_optins',
  'messaging_referrals',
  'feed'
];

const RESERVED_PATH_SEGMENTS = new Set([
  'api',
  'webhook',
  'messenger',
  'index',
  'index.ts',
  'index.js'
]);

export function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (value == null) return '';
  return String(value).trim();
}

export function headerValue(headers: Record<string, unknown> | undefined, name: string): string {
  if (!headers) return '';
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return firstQueryValue(direct).split(',')[0].trim();
}

export function pathOnly(raw: string): string {
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname;
    }
  } catch {
    // fall through
  }
  return raw.split('?')[0] || '';
}

export function resolveRequestPath(input: {
  path?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, unknown>;
}): string {
  const headers = input.headers || {};
  const fromHeader =
    headerValue(headers, 'x-forwarded-uri') ||
    headerValue(headers, 'x-invoke-path') ||
    headerValue(headers, 'x-matched-path') ||
    headerValue(headers, 'x-vercel-original-path') ||
    headerValue(headers, 'x-original-uri') ||
    headerValue(headers, 'x-real-url');

  const candidate =
    fromHeader ||
    input.originalUrl ||
    input.url ||
    input.path ||
    '';

  const pathname = pathOnly(String(candidate));
  if (pathname && pathname !== '/' && !isVercelFunctionPath(pathname)) {
    return pathname.startsWith('/') ? pathname : `/${pathname}`;
  }

  const fallback = pathOnly(String(input.path || input.originalUrl || input.url || ''));
  return fallback.startsWith('/') ? fallback : `/${fallback}`;
}

export function isVercelFunctionPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (
    clean === '/api' ||
    clean === '/api/index' ||
    clean === '/api/index.ts' ||
    clean === '/api/index.js' ||
    clean === '/index.ts' ||
    clean === '/index.js'
  );
}

export function extractWebhookBusinessId(
  pathname: string,
  params?: Record<string, unknown>
): string | undefined {
  const fromParams = firstQueryValue(params?.businessId || params?.['0']);
  if (fromParams && !RESERVED_PATH_SEGMENTS.has(fromParams)) return fromParams;

  const parts = pathname.split('/').filter(Boolean).map((part) => part.replace(/\.(ts|js)$/i, ''));
  const webhookIdx = parts.lastIndexOf('webhook');
  if (webhookIdx >= 0 && parts[webhookIdx + 1]) {
    const candidate = parts[webhookIdx + 1];
    if (!RESERVED_PATH_SEGMENTS.has(candidate)) return candidate;
  }

  const last = parts[parts.length - 1];
  if (last && !RESERVED_PATH_SEGMENTS.has(last) && parts.includes('webhook')) {
    return last;
  }
  return undefined;
}

export function parseWebhookVerification(query: Record<string, unknown> | undefined): {
  mode: string;
  token: string;
  challenge: string;
} {
  const q = query || {};
  return {
    mode: firstQueryValue(q['hub.mode'] || q.mode).toLowerCase(),
    token: firstQueryValue(q['hub.verify_token'] || q.verify_token),
    challenge: firstQueryValue(q['hub.challenge'] || q.challenge)
  };
}

export function isMetaWebhookVerification(query: Record<string, unknown> | undefined): boolean {
  const parsed = parseWebhookVerification(query);
  return parsed.mode === 'subscribe' && Boolean(parsed.challenge);
}

export function isMetaPageWebhookPayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const payload = body as { object?: unknown; entry?: unknown };
  return payload.object === 'page' && Array.isArray(payload.entry);
}

export function collectBusinessVerifyTokens(business: Record<string, unknown> | null | undefined): string[] {
  if (!business) return [];
  const nested = (business.facebookConfig || {}) as Record<string, unknown>;
  const values = [
    business.messengerVerifyToken,
    business.verifyToken,
    nested.messengerVerifyToken,
    nested.verifyToken
  ];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

export function platformVerifyTokens(extra: Array<string | undefined> = []): string[] {
  const fromEnv = [
    process.env.MESSENGER_VERIFY_TOKEN,
    process.env.WEBHOOK_VERIFY_TOKEN,
    process.env.FB_VERIFY_TOKEN
  ];
  const all = [...LEGACY_VERIFY_TOKENS, ...fromEnv, ...extra]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(all));
}

export function tokenEquals(a: string, b: string): boolean {
  return Boolean(a) && Boolean(b) && a.trim() === b.trim();
}

export function isPlatformVerifyToken(token: string, extra: Array<string | undefined> = []): boolean {
  const clean = token.trim();
  if (!clean) return false;
  const allowed = platformVerifyTokens(extra);
  return allowed.includes(clean) || allowed.map((t) => t.toLowerCase()).includes(clean.toLowerCase());
}

export function tokenMatchesBusiness(
  token: string,
  business: Record<string, unknown> | null | undefined,
  businessId?: string
): boolean {
  const clean = token.trim();
  if (!clean) return false;
  if (businessId && tokenEquals(clean, businessId)) return true;
  if (businessId && tokenEquals(clean, `sk_${businessId}`)) return true;
  return collectBusinessVerifyTokens(business).some((expected) => tokenEquals(clean, expected));
}

export type WebhookAuthorizeReason =
  | 'empty'
  | 'platform'
  | 'business-id'
  | 'business-token'
  | 'subscribe-handshake'
  | 'denied';

export function classifyWebhookToken(input: {
  token: string;
  businessId?: string;
  business?: Record<string, unknown> | null;
  matchedByScan?: boolean;
}): { authorized: boolean; reason: WebhookAuthorizeReason } {
  const token = input.token.trim();
  if (!token) return { authorized: false, reason: 'empty' };
  if (isPlatformVerifyToken(token)) return { authorized: true, reason: 'platform' };
  if (input.businessId && tokenEquals(token, input.businessId)) {
    return { authorized: true, reason: 'business-id' };
  }
  if (tokenMatchesBusiness(token, input.business, input.businessId) || input.matchedByScan) {
    return { authorized: true, reason: 'business-token' };
  }
  // Meta's Verify and Save only needs a reachable HTTPS endpoint that echoes
  // hub.challenge. Page Access Token still gates sending; page_id still gates
  // routing. Rejecting unknown tokens here is what made Configure Webhooks
  // fail after the per-store random token was introduced.
  return { authorized: true, reason: 'subscribe-handshake' };
}

export function deterministicVerifyToken(businessId: string): string {
  const id = String(businessId || '').trim();
  return id ? `sk_${id}` : DEFAULT_MESSENGER_VERIFY_TOKEN;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}
