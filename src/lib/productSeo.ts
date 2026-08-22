import type {
  BusinessConfig,
  Product,
  ProductCondition,
  ProductFaqItem,
  ProductReview,
  ProductSpecRow,
} from '../types';
import { finiteNumber, sameProductId } from './productList';

export const PRODUCT_SLUG_MIN = 2;
export const PRODUCT_SLUG_MAX = 72;

const CONDITION_VALUES: ProductCondition[] = ['new', 'used', 'refurbished'];

export function optionalText(value: unknown, max: number): string | undefined {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

export function optionalBlock(value: unknown, max: number): string | undefined {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

export function optionalTextList(value: unknown, maxItems: number, maxLen: number): string[] | undefined {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,|]/)
      : [];
  const list = source
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .map(item => item.slice(0, maxLen))
    .slice(0, maxItems);
  return list.length ? list : undefined;
}

export function normalizeProductSlug(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, PRODUCT_SLUG_MAX);
}

export function slugifyProductName(name?: string | null): string {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, PRODUCT_SLUG_MAX);
}

export function isValidProductSlug(slug?: string | null): boolean {
  const value = normalizeProductSlug(slug);
  if (value.length < PRODUCT_SLUG_MIN || value.length > PRODUCT_SLUG_MAX) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function uniqueProductSlug(
  products: Array<Pick<Product, 'id' | 'slug'>>,
  wanted: string,
  exceptId?: string
): string {
  const base = normalizeProductSlug(wanted);
  if (!base) return '';
  const taken = (slug: string) =>
    products.some(product => {
      if (exceptId && sameProductId(product.id, exceptId)) return false;
      return normalizeProductSlug(product.slug) === slug;
    });
  if (!taken(base)) return base;
  for (let n = 2; n < 80; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, PRODUCT_SLUG_MAX - suffix.length)}${suffix}`;
    if (!taken(candidate)) return candidate;
  }
  return `${base.slice(0, 54)}-${Date.now().toString(36)}`.slice(0, PRODUCT_SLUG_MAX);
}

export function suggestedProductSlug(name?: string | null, fallbackSlug?: string | null): string {
  const existing = normalizeProductSlug(fallbackSlug);
  if (isValidProductSlug(existing)) return existing;
  const fromName = slugifyProductName(name);
  return isValidProductSlug(fromName) ? fromName : '';
}

export function productPublicKey(product: Pick<Product, 'id' | 'slug'>): string {
  const slug = normalizeProductSlug(product.slug);
  if (isValidProductSlug(slug)) return slug;
  return String(product.id || '').trim();
}

export function decodeProductParam(raw?: string | null): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value;
  }
}

export function sanitizeProductCondition(value: unknown): ProductCondition | undefined {
  const raw = String(value || '').trim().toLowerCase();
  return CONDITION_VALUES.includes(raw as ProductCondition) ? (raw as ProductCondition) : undefined;
}

export function sanitizeSpecRows(value: unknown): ProductSpecRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map(row => ({
      label: optionalText((row as ProductSpecRow)?.label, 60) || '',
      value: optionalText((row as ProductSpecRow)?.value, 160) || '',
    }))
    .filter(row => row.label && row.value)
    .slice(0, 24);
  return rows.length ? rows : undefined;
}

export function sanitizeProductReviews(value: unknown): ProductReview[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const reviews = value
    .map((row, index) => {
      const item = row as ProductReview;
      const author = optionalText(item?.author, 60);
      const text = optionalBlock(item?.text, 700);
      const rating = Math.min(5, Math.max(1, Math.round(finiteNumber(item?.rating, 5))));
      if (!author || !text) return null;
      const review: ProductReview = {
        id: optionalText(item?.id, 80) || `rev-${index + 1}`,
        author,
        rating,
        text,
      };
      const date = optionalText(item?.date, 40);
      if (date) review.date = date;
      if (item?.verified) review.verified = true;
      return review;
    })
    .filter((row): row is ProductReview => Boolean(row))
    .slice(0, 30);
  return reviews.length ? reviews : undefined;
}

export function sanitizeProductFaqs(value: unknown): ProductFaqItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map(row => ({
      question: optionalText((row as ProductFaqItem)?.question, 160) || '',
      answer: optionalBlock((row as ProductFaqItem)?.answer, 700) || '',
    }))
    .filter(row => row.question && row.answer)
    .slice(0, 12);
  return items.length ? items : undefined;
}

export function specRowsFromText(specs?: string | null): ProductSpecRow[] {
  const lines = String(specs || '')
    .split('\n')
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  const rows: ProductSpecRow[] = [];
  for (const line of lines) {
    const match = line.match(/^(.{1,40}?)\s*[:：\-–]\s*(.+)$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (label && value) rows.push({ label: label.slice(0, 60), value: value.slice(0, 160) });
  }
  return rows.slice(0, 24);
}

export function productSpecRows(product: Product): ProductSpecRow[] {
  if (product.specRows && product.specRows.length) return product.specRows;
  return specRowsFromText(product.specs);
}

export function productHighlights(product: Product): string[] {
  if (product.highlights && product.highlights.length) return product.highlights.slice(0, 8);
  const lines = String(product.description || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-•*]/.test(line))
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  return lines.slice(0, 8);
}

export function imageAltFor(product: Product, index: number): string {
  const custom = String(product.imageAlts?.[index] || '').trim();
  if (custom) return custom.slice(0, 140);
  const name = String(product.name || 'পণ্য').trim();
  return index === 0 ? name : `${name} — ${index + 1}`;
}

export function productRatingSummary(product: Product): { average: number; count: number } | null {
  const reviews = product.reviews || [];
  if (reviews.length > 0) {
    const total = reviews.reduce((sum, row) => sum + finiteNumber(row.rating, 0), 0);
    return {
      average: Math.round((total / reviews.length) * 10) / 10,
      count: reviews.length,
    };
  }
  return null;
}

export function youtubeVideoId(url?: string | null): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const match = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i
  );
  return match ? match[1] : null;
}

export function isDirectVideoUrl(url?: string | null): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || '').trim());
}

export function productSeoTitle(product: Product, shopName?: string): string {
  const custom = optionalText(product.seoTitle, 70);
  if (custom) return custom;
  const name = String(product.name || 'পণ্য').trim();
  const shop = String(shopName || '').trim();
  const combined = shop ? `${name} | ${shop}` : name;
  return combined.slice(0, 70);
}

export function productSeoDescription(product: Product, shopName?: string): string {
  const custom = optionalBlock(product.seoDescription, 170);
  if (custom) return custom.replace(/\s+/g, ' ').trim();
  const parts = [
    product.name,
    product.brand,
    product.price ? `৳${Math.round(product.price)}` : '',
    'ক্যাশ অন ডেলিভারি',
    product.highlights?.[0] || String(product.description || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    shopName,
  ].filter(Boolean);
  return parts.join(' · ').slice(0, 170);
}

export function shopSeoTitle(shop: Pick<BusinessConfig, 'name'>): string {
  const name = String(shop.name || 'অনলাইন শপ').trim();
  return `${name} — অনলাইন শপ`.slice(0, 70);
}

export function shopSeoDescription(shop: Pick<BusinessConfig, 'name' | 'description'>): string {
  const description = optionalBlock(shop.description, 170);
  if (description) return description.replace(/\s+/g, ' ').trim();
  return `${shop.name || 'এই দোকান'} থেকে পণ্য দেখুন, কার্টে রাখুন, ক্যাশ অন ডেলিভারিতে অর্ডার করুন।`.slice(0, 170);
}

export function absoluteUrl(origin: string, pathname: string): string {
  const base = String(origin || '').replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

function availabilityUrl(product: Product): string {
  if (product.isAvailable === false) return 'https://schema.org/OutOfStock';
  return 'https://schema.org/InStock';
}

function conditionUrl(product: Product): string {
  if (product.condition === 'used') return 'https://schema.org/UsedCondition';
  if (product.condition === 'refurbished') return 'https://schema.org/RefurbishedCondition';
  return 'https://schema.org/NewCondition';
}

export function productJsonLd(input: {
  product: Product;
  shop: Pick<BusinessConfig, 'name' | 'logoUrl'>;
  url: string;
  image?: string;
  faqs?: Array<{ question: string; answer: string }>;
  crumbs?: Array<{ name: string; url: string }>;
}): unknown[] {
  const { product, shop, url, image, faqs, crumbs } = input;
  const rating = productRatingSummary(product);
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: productSeoDescription(product, shop.name),
    sku: product.sku || product.id,
    url,
    image: image ? [image] : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : { '@type': 'Brand', name: shop.name },
    material: product.material,
    color: product.color || product.colors?.[0],
    itemCondition: conditionUrl(product),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BDT',
      price: Math.max(0, Math.round(finiteNumber(product.price, 0))),
      availability: availabilityUrl(product),
      itemCondition: conditionUrl(product),
    },
  };
  if (product.gtin) payload.gtin = product.gtin;
  if (product.model) payload.model = product.model;
  if (rating) {
    payload.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.average,
      reviewCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    };
    payload.review = (product.reviews || []).slice(0, 10).map(review => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: review.author },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.text,
      datePublished: review.date,
    }));
  }

  const graph: unknown[] = [payload];
  if (crumbs && crumbs.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }
  if (faqs && faqs.length) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }
  return graph;
}
