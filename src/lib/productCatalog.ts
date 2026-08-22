import { Product, ProductTier } from '../types';
import { cleanFirestoreData } from './utils';
import { asProductList, finiteNumber, sameProductId } from './productList';
import {
  isValidProductSlug,
  normalizeProductSlug,
  optionalBlock,
  optionalText,
  optionalTextList,
  sanitizeProductCondition,
  sanitizeProductFaqs,
  sanitizeProductReviews,
  sanitizeSpecRows,
  uniqueProductSlug,
} from './productSeo';

export { asProductList, sameProductId } from './productList';

export function normalizeTier(tier: Partial<ProductTier> | null | undefined, fallbackPrice = 0): ProductTier {
  const price = finiteNumber(tier?.price, fallbackPrice);
  return {
    quantity: Math.max(1, Math.round(finiteNumber(tier?.quantity, 1))),
    price,
    minPrice: finiteNumber(tier?.minPrice, price),
    label: tier?.label ? String(tier.label) : undefined
  };
}

export function sanitizeProduct(
  prod: Partial<Product> & { id?: string },
  catalog: Product[] = []
): Product {
  const price = finiteNumber(prod.price, 0);
  const tiers = Array.isArray(prod.pricingTiers)
    ? prod.pricingTiers.map(t => normalizeTier(t, price))
    : undefined;
  const productId = String(prod.id || `prod-${Date.now()}`);
  const wantedSlug = normalizeProductSlug(prod.slug);
  const slug = wantedSlug
    ? uniqueProductSlug(catalog, wantedSlug, productId)
    : '';

  const payload: Product = {
    id: productId,
    name: String(prod.name || '').trim(),
    price,
    minPrice: finiteNumber(prod.minPrice, price),
    description: String(prod.description || ''),
    specs: optionalBlock(prod.specs, 4_000),
    stock: finiteNumber(prod.stock, 0),
    category: String(prod.category || 'জেনারেল').trim() || 'জেনারেল',
    images: Array.isArray(prod.images) ? prod.images.filter(Boolean).map(String).slice(0, 12) : [],
    reviewImages: Array.isArray(prod.reviewImages) ? prod.reviewImages.filter(Boolean).map(String).slice(0, 12) : [],
    isAvailable: prod.isAvailable ?? true
  };

  if (tiers && tiers.length > 0) {
    payload.pricingTiers = tiers;
  }

  if (isValidProductSlug(slug)) payload.slug = slug;
  const seoTitle = optionalText(prod.seoTitle, 70);
  if (seoTitle) payload.seoTitle = seoTitle;
  const seoDescription = optionalBlock(prod.seoDescription, 170);
  if (seoDescription) payload.seoDescription = seoDescription;
  const brand = optionalText(prod.brand, 80);
  if (brand) payload.brand = brand;
  const sku = optionalText(prod.sku, 60);
  if (sku) payload.sku = sku;
  const model = optionalText(prod.model, 80);
  if (model) payload.model = model;
  const gtin = optionalText(prod.gtin, 32);
  if (gtin) payload.gtin = gtin;
  const tags = optionalTextList(prod.tags, 16, 40);
  if (tags) payload.tags = tags;
  const highlights = optionalTextList(prod.highlights, 8, 140);
  if (highlights) payload.highlights = highlights;
  const imageAlts = Array.isArray(prod.imageAlts)
    ? prod.imageAlts.slice(0, 12).map(alt => String(alt || '').trim().slice(0, 140))
    : undefined;
  if (imageAlts && imageAlts.some(Boolean)) payload.imageAlts = imageAlts;
  const compareAtPrice = finiteNumber(prod.compareAtPrice, 0);
  if (compareAtPrice > 0) payload.compareAtPrice = compareAtPrice;
  const condition = sanitizeProductCondition(prod.condition);
  if (condition) payload.condition = condition;
  const material = optionalText(prod.material, 80);
  if (material) payload.material = material;
  const color = optionalText(prod.color, 60);
  if (color) payload.color = color;
  const colors = optionalTextList(prod.colors, 16, 40);
  if (colors) payload.colors = colors;
  const sizes = optionalTextList(prod.sizes, 20, 40);
  if (sizes) payload.sizes = sizes;
  const weight = optionalText(prod.weight, 40);
  if (weight) payload.weight = weight;
  const dimensions = optionalText(prod.dimensions, 80);
  if (dimensions) payload.dimensions = dimensions;
  const origin = optionalText(prod.origin, 80);
  if (origin) payload.origin = origin;
  const gender = optionalText(prod.gender, 40);
  if (gender) payload.gender = gender;
  const warranty = optionalBlock(prod.warranty, 1_200);
  if (warranty) payload.warranty = warranty;
  const boxContents = optionalBlock(prod.boxContents, 1_200);
  if (boxContents) payload.boxContents = boxContents;
  const careInstructions = optionalBlock(prod.careInstructions, 1_200);
  if (careInstructions) payload.careInstructions = careInstructions;
  const sizeGuide = optionalBlock(prod.sizeGuide, 2_000);
  if (sizeGuide) payload.sizeGuide = sizeGuide;
  const videoUrl = optionalText(prod.videoUrl, 500);
  if (videoUrl) payload.videoUrl = videoUrl;
  const suitableFor = optionalBlock(prod.suitableFor, 800);
  if (suitableFor) payload.suitableFor = suitableFor;
  const deliveryNote = optionalBlock(prod.deliveryNote, 1_200);
  if (deliveryNote) payload.deliveryNote = deliveryNote;
  const returnPolicy = optionalBlock(prod.returnPolicy, 1_200);
  if (returnPolicy) payload.returnPolicy = returnPolicy;
  const soldCount = Math.max(0, Math.round(finiteNumber(prod.soldCount, 0)));
  if (soldCount > 0) payload.soldCount = soldCount;
  const specRows = sanitizeSpecRows(prod.specRows);
  if (specRows) payload.specRows = specRows;
  const reviews = sanitizeProductReviews(prod.reviews);
  if (reviews) payload.reviews = reviews;
  const faqItems = sanitizeProductFaqs(prod.faqItems);
  if (faqItems) payload.faqItems = faqItems;

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
  const out: Product[] = [];
  for (const product of products) {
    out.push(sanitizeProduct(product, out));
  }
  return cleanFirestoreData(out);
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
