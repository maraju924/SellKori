import { Product, ProductTier } from '../types';
import { cleanFirestoreData, finiteNumber } from './utils';

export function sameProductId(a?: string | number | null, b?: string | number | null): boolean {
  if (a == null || b == null) return false;
  const left = String(a).trim();
  const right = String(b).trim();
  return left.length > 0 && left === right;
}

/** Firestore sometimes stores `products` as a map instead of an array. */
export function asProductList(raw: unknown): Product[] {
  if (Array.isArray(raw)) {
    return raw.filter(Boolean) as Product[];
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, Product>).filter(Boolean);
  }
  return [];
}

export function normalizeTier(tier: Partial<ProductTier> | null | undefined, fallbackPrice = 0): ProductTier {
  const price = finiteNumber(tier?.price, fallbackPrice);
  return {
    quantity: Math.max(1, Math.round(finiteNumber(tier?.quantity, 1))),
    price,
    minPrice: finiteNumber(tier?.minPrice, price),
    label: tier?.label ? String(tier.label) : undefined
  };
}

export function sanitizeProduct(prod: Partial<Product> & { id?: string }): Product {
  const price = finiteNumber(prod.price, 0);
  const tiers = Array.isArray(prod.pricingTiers)
    ? prod.pricingTiers.map(t => normalizeTier(t, price))
    : undefined;

  const payload: Product = {
    id: String(prod.id || `prod-${Date.now()}`),
    name: String(prod.name || '').trim(),
    price,
    minPrice: finiteNumber(prod.minPrice, price),
    description: String(prod.description || ''),
    specs: prod.specs ? String(prod.specs) : undefined,
    stock: finiteNumber(prod.stock, 0),
    category: String(prod.category || 'জেনারেল').trim() || 'জেনারেল',
    images: Array.isArray(prod.images) ? prod.images.filter(Boolean).map(String) : [],
    reviewImages: Array.isArray(prod.reviewImages) ? prod.reviewImages.filter(Boolean).map(String) : [],
    isAvailable: prod.isAvailable ?? true
  };

  if (tiers && tiers.length > 0) {
    payload.pricingTiers = tiers;
  }

  return payload;
}

export function replaceEditedProduct(
  list: Product[],
  payload: Product,
  editing: Product,
  editingIndex: number | null
): { products: Product[]; matched: 'id' | 'index' | 'name' | 'append' } {
  const byId = list.findIndex(p => sameProductId(p.id, editing.id) || sameProductId(p.id, payload.id));
  if (byId >= 0) {
    return {
      products: list.map((p, i) => (i === byId ? payload : p)),
      matched: 'id'
    };
  }

  if (editingIndex != null && editingIndex >= 0 && editingIndex < list.length) {
    return {
      products: list.map((p, i) => (i === editingIndex ? payload : p)),
      matched: 'index'
    };
  }

  const editingName = (editing.name || '').trim();
  const byName = editingName
    ? list.filter(p => (p.name || '').trim() === editingName)
    : [];
  if (byName.length === 1) {
    const idx = list.findIndex(p => (p.name || '').trim() === editingName);
    return {
      products: list.map((p, i) => (i === idx ? payload : p)),
      matched: 'name'
    };
  }

  return {
    products: [...list, payload],
    matched: 'append'
  };
}

export function isInlineDataUrl(url?: string | null): boolean {
  return typeof url === 'string' && url.startsWith('data:');
}

/** Drop oversized inline images so a product update is not rejected for the 1MB cap. */
export function stripInlineDataUrls(products: Product[]): Product[] {
  return products.map(prod => ({
    ...prod,
    images: (prod.images || []).filter(url => !isInlineDataUrl(url)),
    reviewImages: (prod.reviewImages || []).filter(url => !isInlineDataUrl(url))
  }));
}

export function prepareProductsForWrite(products: Product[]): Product[] {
  return cleanFirestoreData(products.map(sanitizeProduct));
}

export function findSavedProduct(list: Product[], payload: Product): Product | undefined {
  return list.find(p => sameProductId(p.id, payload.id))
    || list.find(p => (p.name || '').trim() === payload.name);
}

export function productLooksUpdated(saved: Product | undefined, payload: Product): boolean {
  if (!saved) return false;
  return saved.name === payload.name
    && finiteNumber(saved.price, NaN) === payload.price
    && finiteNumber(saved.stock, NaN) === payload.stock
    && String(saved.description || '') === String(payload.description || '');
}

export function readInputValue(e: unknown): string {
  if (typeof e === 'string' || typeof e === 'number') return String(e);
  if (e && typeof e === 'object') {
    const anyE = e as { target?: { value?: unknown }; currentTarget?: { value?: unknown } };
    const value = anyE.target?.value ?? anyE.currentTarget?.value;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}
