export const RESERVED_SHOP_SLUGS = new Set([
  'login',
  'dashboard',
  'admin',
  'chat',
  'shop',
  'store',
  'stores',
  'api',
  'webhook',
  'messenger',
  'assets',
  'favicon',
  'favicon.ico',
  'static',
  'media',
  'billing',
  'pricing',
  'about',
  'help',
  'support',
  'terms',
  'privacy',
  'sitemap',
  'robots',
  'robots.txt',
  'index',
  'null',
  'undefined',
  'well-known',
]);

export const SHOP_SLUG_MIN = 2;
export const SHOP_SLUG_MAX = 48;

export type ShopRef = string | {
  slug?: string | null;
  id?: string | null;
  name?: string | null;
};

export function normalizeShopSlug(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SHOP_SLUG_MAX);
}

/** Compact public path: "My Shop" → "myshop". */
export function slugifyStoreName(name?: string | null): string {
  const compact = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, SHOP_SLUG_MAX);
  return compact;
}

export function isReservedShopSlug(slug?: string | null): boolean {
  const value = normalizeShopSlug(slug);
  return !value || RESERVED_SHOP_SLUGS.has(value);
}

/** Customer storefront/chat — must not flash the SellKori SaaS splash. */
export function isPublicCustomerPath(pathname?: string | null): boolean {
  const first = String(pathname || '').split('/').filter(Boolean)[0] || '';
  if (!first) return false;
  if (first === 'chat' || first === 'shop') return true;
  return !isReservedShopSlug(first);
}

export function isValidShopSlug(slug?: string | null): boolean {
  const value = normalizeShopSlug(slug);
  if (value.length < SHOP_SLUG_MIN || value.length > SHOP_SLUG_MAX) return false;
  if (isReservedShopSlug(value)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function fallbackShopSlug(id?: string | null): string {
  const digits = String(id || '').replace(/\D/g, '').slice(-6);
  const base = `shop${digits || Date.now().toString(36)}`;
  return normalizeShopSlug(base) || 'shop1';
}

export function suggestedShopSlug(input: { name?: string | null; id?: string | null; slug?: string | null }): string {
  const existing = normalizeShopSlug(input.slug);
  if (isValidShopSlug(existing)) return existing;
  const fromName = slugifyStoreName(input.name);
  if (isValidShopSlug(fromName)) return fromName;
  return fallbackShopSlug(input.id);
}

export function nextShopSlugCandidate(base: string, attempt: number): string {
  const clean = normalizeShopSlug(base) || 'shop';
  if (attempt <= 1) return clean;
  const suffix = String(attempt);
  return `${clean.slice(0, SHOP_SLUG_MAX - suffix.length)}${suffix}`;
}

export function publicShopSlug(shop: ShopRef): string {
  if (typeof shop === 'string') {
    const asSlug = normalizeShopSlug(shop);
    return asSlug || slugifyStoreName(shop) || 'shop';
  }
  return suggestedShopSlug(shop);
}

export function shopPublicPath(shop: ShopRef, suffix = ''): string {
  const slug = publicShopSlug(shop);
  const extra = suffix.startsWith('/') ? suffix : suffix ? `/${suffix}` : '';
  return `/${slug}${extra}`;
}

export function shopPublicUrl(origin: string, shop: ShopRef, suffix = ''): string {
  const base = String(origin || '').replace(/\/$/, '');
  return `${base}${shopPublicPath(shop, suffix)}`;
}

export function slugEditDistance(a: string, b: string): number {
  const left = normalizeShopSlug(a);
  const right = normalizeShopSlug(b);
  if (left === right) return 0;
  const rows = left.length + 1;
  const cols = right.length + 1;
  const grid = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) grid[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + cost
      );
    }
  }
  return grid[left.length][right.length];
}

export function shopSlugKeys(input: { slug?: string | null; name?: string | null; id?: string | null }): string[] {
  const keys = new Set<string>();
  const push = (value?: string | null) => {
    const slug = normalizeShopSlug(value || '');
    if (slug) keys.add(slug);
    const compact = slugifyStoreName(value || '');
    if (compact) keys.add(compact);
  };
  push(input.slug);
  push(input.name);
  return [...keys];
}

export function matchRequestedShopSlug(
  businesses: Array<{ id: string; slug?: string | null; name?: string | null }>,
  requested: string
): { id: string; kind: 'exact' | 'alias' | 'close' } | null {
  const want = normalizeShopSlug(requested);
  if (!want) return null;

  const exact: string[] = [];
  const alias: string[] = [];
  const close: string[] = [];

  for (const business of businesses) {
    const keys = shopSlugKeys(business);
    if (normalizeShopSlug(business.slug) === want) {
      exact.push(business.id);
    } else if (keys.includes(want)) {
      alias.push(business.id);
    } else if (keys.some(key => slugEditDistance(key, want) === 1)) {
      close.push(business.id);
    }
  }

  if (exact.length === 1) return { id: exact[0], kind: 'exact' };
  if (alias.length === 1) return { id: alias[0], kind: 'alias' };
  if (close.length === 1) return { id: close[0], kind: 'close' };
  return null;
}
