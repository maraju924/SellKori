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
