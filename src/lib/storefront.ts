import type {
  BusinessConfig,
  Order,
  OrderItem,
  OrderStatusEvent,
  Product,
  ProductTier,
} from '../types';
import { normalizePhone } from './orderIdentity';
import { asProductList, finiteNumber, omitUndefined, sameProductId } from './productList';
import { shopPublicPath, type ShopRef } from './storeSlug';
import {
  decodeProductParam,
  isValidProductSlug,
  normalizeProductSlug,
  productPublicKey,
  slugifyProductName,
} from './productSeo';

export type { ShopRef } from './storeSlug';
export { publicShopSlug, shopPublicPath, shopPublicUrl } from './storeSlug';

const DHAKA_RE =
  /ঢাকা|dhaka|মোহাম্মদপুর|ধানমন্ডি|গুলশান|বনানী|উত্তরা|মিরপুর|মতিঝিল|বাড্ডা|রামপুরা|মগবাজার|খিলগাঁও|যাত্রাবাড়ী|কেরানীগঞ্জ|সাভার|dhanmondi|gulshan|uttara|mirpur|banani|mohammadpur/i;

export function addressLooksInsideDhaka(address?: string): boolean {
  return DHAKA_RE.test(address || '');
}

/** Courier zone from district/address. Client cannot pick the fee. */
export function isInsideDhakaDelivery(input: { address?: string; district?: string }): boolean {
  const district = String(input.district || '').trim();
  if (district === 'ঢাকা') return true;
  if (district) return false;
  return addressLooksInsideDhaka(input.address || '');
}

export const SHOP_CART_STORAGE_PREFIX = 'sellkori.shop.cart.';
export const SHOP_PASSENGER_STORAGE_PREFIX = 'sellkori.shop.passenger.';
export const WEBSITE_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
export const MAX_CART_LINES = 30;
export const MAX_LINE_QUANTITY = 50;

export const BD_DISTRICTS = [
  'ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'নরসিংদী', 'মানিকগঞ্জ', 'মুন্সিগঞ্জ', 'টাঙ্গাইল', 'কিশোরগঞ্জ',
  'ফরিদপুর', 'মাদারীপুর', 'শরীয়তপুর', 'রাজবাড়ী', 'গোপালগঞ্জ',
  'চট্টগ্রাম', 'কক্সবাজার', 'কুমিল্লা', 'নোয়াখালী', 'ফেনী', 'লক্ষ্মীপুর', 'চাঁদপুর', 'ব্রাহ্মণবাড়িয়া',
  'রাঙ্গামাটি', 'খাগড়াছড়ি', 'বান্দরবান',
  'সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ',
  'রাজশাহী', 'পাবনা', 'সিরাজগঞ্জ', 'নাটোর', 'নওগাঁ', 'চাঁপাইনবাবগঞ্জ', 'বগুড়া', 'জয়পুরহাট',
  'খুলনা', 'যশোর', 'সাতক্ষীরা', 'কুষ্টিয়া', 'ঝিনাইদহ', 'মাগুরা', 'নড়াইল', 'চুয়াডাঙ্গা', 'মেহেরপুর', 'বাগেরহাট',
  'বরিশাল', 'পটুয়াখালী', 'পিরোজপুর', 'ভোলা', 'ঝালকাঠি', 'বরগুনা',
  'রংপুর', 'দিনাজপুর', 'ঠাকুরগাঁও', 'পঞ্চগড়', 'নীলফামারী', 'লালমনিরহাট', 'কুড়িগ্রাম', 'গাইবান্ধা',
  'ময়মনসিংহ', 'জামালপুর', 'শেরপুর', 'নেত্রকোণা',
] as const;

export interface CartLine {
  productId: string;
  quantity: number;
  variant?: string;
}

export interface ShopCustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  district?: string;
  notes?: string;
  insideDhaka?: boolean;
}

export interface ResolvedCartLine {
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  tier?: ProductTier;
  variant?: string;
}

export interface CartTotals {
  lines: ResolvedCartLine[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  insideDhaka: boolean;
}

export interface CheckoutIssue {
  field: 'name' | 'phone' | 'address' | 'cart' | 'product' | 'stock';
  message: string;
}

export interface BuiltStoreOrder {
  order: Omit<Order, 'createdAt' | 'updatedAt'>;
  inventory: Array<{ productId: string; quantity: number }>;
}

export function shopCartStorageKey(businessId: string): string {
  return `${SHOP_CART_STORAGE_PREFIX}${String(businessId || '').trim()}`;
}

export function shopPassengerStorageKey(businessId: string): string {
  return `${SHOP_PASSENGER_STORAGE_PREFIX}${String(businessId || '').trim()}`;
}

export function shopPath(shop: ShopRef, suffix = ''): string {
  return shopPublicPath(shop, suffix);
}

export function productPath(shop: ShopRef, product: Product | string): string {
  const key = typeof product === 'string' ? product : productPublicKey(product);
  return shopPath(shop, `p/${encodeURIComponent(String(key || '').trim())}`);
}

export function publicProductImage(product?: Product | null): string {
  const images = product?.images || [];
  return images.find(url => typeof url === 'string' && url.trim()) || '';
}

export function shopCategories(products: Product[]): string[] {
  const seen = new Set<string>();
  for (const product of products) {
    const category = String(product.category || '').trim();
    if (category) seen.add(category);
  }
  return [...seen];
}

export function categoryPublicKey(name?: string | null): string {
  const clean = String(name || '').trim();
  if (!clean) return '';
  const latin = slugifyProductName(clean);
  return isValidProductSlug(latin) ? latin : clean;
}

export function categoryPath(shop: ShopRef, name: string): string {
  const key = categoryPublicKey(name);
  return shopPath(shop, `c/${encodeURIComponent(key)}`);
}

export function matchShopCategory(products: Product[], raw?: string | null): string | undefined {
  const decoded = decodeProductParam(raw);
  if (!decoded) return undefined;
  const cats = shopCategories(products);
  const wantSlug = normalizeProductSlug(decoded) || slugifyProductName(decoded);
  return cats.find(cat => {
    if (cat === decoded) return true;
    const key = categoryPublicKey(cat);
    if (key === decoded || key === String(raw || '').trim()) return true;
    const catSlug = normalizeProductSlug(key) || slugifyProductName(cat);
    return Boolean(wantSlug && catSlug && catSlug === wantSlug);
  });
}

export interface ShopCategorySummary {
  name: string;
  count: number;
  image: string;
}

export function shopCategorySummaries(products: Product[]): ShopCategorySummary[] {
  const available = products.filter(isShopProductBuyable);
  const map = new Map<string, ShopCategorySummary>();
  for (const product of available) {
    const name = String(product.category || '').trim();
    if (!name) continue;
    const existing = map.get(name);
    if (existing) {
      existing.count += 1;
      if (!existing.image) existing.image = publicProductImage(product);
    } else {
      map.set(name, {
        name,
        count: 1,
        image: publicProductImage(product),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'bn'));
}

export function findShopProduct(products: Product[], productId?: string | null): Product | undefined {
  const raw = decodeProductParam(productId);
  if (!raw) return undefined;
  const byId = products.find(product => sameProductId(product.id, raw));
  if (byId) return byId;
  const slug = normalizeProductSlug(raw);
  if (!slug) return undefined;
  return products.find(product => normalizeProductSlug(product.slug) === slug);
}

export function isShopProductBuyable(product?: Product | null): boolean {
  if (!product) return false;
  if (product.isAvailable === false) return false;
  return String(product.name || '').trim().length > 0;
}

/** Stock 0 is treated as untracked (same as Messenger). Positive stock caps quantity. */
export function maxBuyableQuantity(product?: Product | null): number {
  if (!isShopProductBuyable(product)) return 0;
  const stock = finiteNumber(product?.stock, 0);
  if (stock > 0) return Math.min(MAX_LINE_QUANTITY, Math.floor(stock));
  return MAX_LINE_QUANTITY;
}

function cartLineKey(productId: string, variant?: string): string {
  const option = String(variant || '').trim();
  return option ? `${productId}::${option}` : productId;
}

export function sanitizeCart(lines: CartLine[] | null | undefined): CartLine[] {
  const merged = new Map<string, CartLine>();
  for (const line of lines || []) {
    const productId = String(line?.productId || '').trim();
    const variant = String(line?.variant || '').trim();
    const quantity = Math.max(0, Math.round(finiteNumber(line?.quantity, 0)));
    if (!productId || quantity < 1) continue;
    const key = cartLineKey(productId, variant);
    const previous = merged.get(key);
    const nextQty = Math.min(MAX_LINE_QUANTITY, (previous?.quantity || 0) + quantity);
    merged.set(key, omitUndefined({
      productId,
      quantity: nextQty,
      variant: variant || undefined,
    }));
  }
  return [...merged.values()].slice(0, MAX_CART_LINES);
}

export function addCartLine(lines: CartLine[], productId: string, quantity = 1, variant?: string): CartLine[] {
  return sanitizeCart([...lines, { productId: String(productId || '').trim(), quantity, variant }]);
}

export function setCartLineQuantity(lines: CartLine[], productId: string, quantity: number, variant?: string): CartLine[] {
  const key = cartLineKey(String(productId || '').trim(), variant);
  return sanitizeCart(
    lines.map(line => (cartLineKey(line.productId, line.variant) === key ? { ...line, quantity } : line))
  );
}

export function removeCartLine(lines: CartLine[], productId: string, variant?: string): CartLine[] {
  const key = cartLineKey(String(productId || '').trim(), variant);
  return sanitizeCart(lines.filter(line => cartLineKey(line.productId, line.variant) !== key));
}

export function cartItemCount(lines: CartLine[]): number {
  return sanitizeCart(lines).reduce((sum, line) => sum + line.quantity, 0);
}

export function parseStoredCart(raw: string | null | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return sanitizeCart(Array.isArray(parsed) ? parsed : parsed?.items);
  } catch {
    return [];
  }
}

export function bestPricingTier(product: Product, quantity: number): ProductTier | undefined {
  const tiers = Array.isArray(product.pricingTiers) ? product.pricingTiers : [];
  if (tiers.length === 0) return undefined;
  const qty = Math.max(1, Math.round(finiteNumber(quantity, 1)));
  const sorted = [...tiers].sort((a, b) => finiteNumber(a.quantity, 1) - finiteNumber(b.quantity, 1));
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (finiteNumber(tier.quantity, 1) <= qty) chosen = tier;
  }
  return chosen;
}

/** Website uses listed price, never minPrice. */
export function unitPriceForQuantity(product: Product, quantity: number): number {
  const tier = bestPricingTier(product, quantity);
  if (tier) {
    const packQty = Math.max(1, finiteNumber(tier.quantity, 1));
    const packPrice = finiteNumber(tier.price, product.price);
    return Math.max(0, packPrice / packQty);
  }
  return Math.max(0, finiteNumber(product.price, 0));
}

export function resolveCartLine(product: Product, quantity: number, variant?: string): ResolvedCartLine {
  const maxQty = maxBuyableQuantity(product);
  const qty = Math.min(maxQty, Math.max(1, Math.round(finiteNumber(quantity, 1))));
  const unitPrice = unitPriceForQuantity(product, qty);
  const option = String(variant || '').trim();
  return omitUndefined({
    product,
    quantity: qty,
    unitPrice,
    lineTotal: Math.round(unitPrice * qty),
    tier: bestPricingTier(product, qty),
    variant: option || undefined,
  });
}

export function resolveCart(
  products: Product[] | unknown,
  lines: CartLine[],
  options?: { address?: string; district?: string; business?: Pick<BusinessConfig, 'courierConfig'> }
): CartTotals {
  const catalog = asProductList(products);
  const resolved: ResolvedCartLine[] = [];
  for (const line of sanitizeCart(lines)) {
    const product = findShopProduct(catalog, line.productId);
    if (!isShopProductBuyable(product) || !product) continue;
    resolved.push(resolveCartLine(product, line.quantity, line.variant));
  }
  const subtotal = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const address = options?.address || '';
  const district = options?.district || '';
  const insideDhaka = isInsideDhakaDelivery({ address, district });
  const deliveryFee = insideDhaka
    ? finiteNumber(options?.business?.courierConfig?.deliveryChargeInsideDhaka, 70)
    : finiteNumber(options?.business?.courierConfig?.deliveryChargeOutsideDhaka, 130);
  const itemCount = resolved.reduce((sum, line) => sum + line.quantity, 0);
  return {
    lines: resolved,
    itemCount,
    subtotal,
    deliveryFee: itemCount > 0 ? deliveryFee : 0,
    total: itemCount > 0 ? subtotal + deliveryFee : 0,
    insideDhaka,
  };
}

export function filterShopProducts(products: Product[], query: string, category?: string): Product[] {
  const available = products.filter(isShopProductBuyable);
  const cat = String(category || '').trim();
  const byCategory = cat && cat !== 'সব'
    ? available.filter(product => String(product.category || '').trim() === cat)
    : available;
  const q = query.trim().toLowerCase();
  if (!q) return byCategory;
  return byCategory.filter(product => {
    const hay = [
      product.name,
      product.description,
      product.specs,
      product.category,
      product.brand,
      product.sku,
      product.slug,
      ...(product.tags || []),
      ...(product.highlights || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function relatedShopProducts(products: Product[], current: Product, limit = 4): Product[] {
  return products
    .filter(product => isShopProductBuyable(product) && !sameProductId(product.id, current.id))
    .sort((a, b) => {
      const sameCat = Number(a.category === current.category) - Number(b.category === current.category);
      return sameCat !== 0 ? -sameCat : 0;
    })
    .slice(0, limit);
}

export function cartSignatureOf(lines: Array<{ productId: string; quantity: number; variant?: string }>): string {
  return [...lines]
    .map(line => {
      const id = String(line.productId || '').trim();
      const qty = Math.max(1, Math.round(finiteNumber(line.quantity, 1)));
      const variant = String(line.variant || '').trim();
      return variant ? `${id}:${qty}:${variant}` : `${id}:${qty}`;
    })
    .filter(part => !part.startsWith(':'))
    .sort()
    .join('|');
}

export function validateShopCheckout(
  products: Product[] | unknown,
  lines: CartLine[],
  customer: ShopCustomerInput
): CheckoutIssue[] {
  const issues: CheckoutIssue[] = [];
  const name = String(customer.name || '').trim();
  const phone = normalizePhone(customer.phone);
  const address = String(customer.address || '').trim();
  const catalog = asProductList(products);
  const cart = sanitizeCart(lines);

  if (name.length < 2) issues.push({ field: 'name', message: 'আপনার নাম লিখুন' });
  if (phone.length !== 11) issues.push({ field: 'phone', message: 'সঠিক ১১ ডিজিটের মোবাইল দিন' });
  if (address.length < 10) issues.push({ field: 'address', message: 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন' });
  if (cart.length === 0) {
    issues.push({ field: 'cart', message: 'কার্ট খালি। আগে পণ্য যোগ করুন' });
    return issues;
  }

  for (const line of cart) {
    const product = findShopProduct(catalog, line.productId);
    if (!isShopProductBuyable(product) || !product) {
      issues.push({ field: 'product', message: 'একটি পণ্য আর কেনা যাচ্ছে না। কার্ট আপডেট করুন' });
      continue;
    }
    const maxQty = maxBuyableQuantity(product);
    if (line.quantity > maxQty) {
      issues.push({
        field: 'stock',
        message: `${product.name}-এর স্টক ${maxQty} পিস। পরিমাণ কমিয়ে আবার চেষ্টা করুন`,
      });
    }
  }
  return issues;
}

export function orderItemsFromCart(totals: CartTotals): OrderItem[] {
  return totals.lines.map(line => ({
    productId: String(line.product.id || ''),
    productName: line.variant ? `${line.product.name} (${line.variant})` : line.product.name,
    quantity: line.quantity,
    unitPrice: Math.round(line.unitPrice),
    lineTotal: line.lineTotal,
    image: publicProductImage(line.product) || '',
  }));
}

export function orderItemsOf(order: Pick<Order, 'items' | 'productId' | 'productName' | 'quantity' | 'unitPrice'>): OrderItem[] {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.filter(item => item && item.productName);
  }
  return [{
    productId: String(order.productId || ''),
    productName: order.productName || 'পণ্য',
    quantity: Math.max(1, finiteNumber(order.quantity, 1)),
    unitPrice: finiteNumber(order.unitPrice, 0),
    lineTotal: finiteNumber(order.unitPrice, 0) * Math.max(1, finiteNumber(order.quantity, 1)),
  }];
}

export function orderProductLabel(order: Pick<Order, 'items' | 'productName' | 'quantity' | 'productId' | 'unitPrice'>): string {
  const items = orderItemsOf(order);
  if (items.length === 1) return `${items[0].productName} × ${items[0].quantity}`;
  return items.map(item => `${item.productName} × ${item.quantity}`).join(', ');
}

export function isRepeatWebsiteCheckout(
  existing: { phone?: string; cartSignature?: string; status?: string; createdAtMs?: number },
  incoming: { phone?: string; cartSignature?: string },
  now = Date.now(),
  windowMs = WEBSITE_DUPLICATE_WINDOW_MS
): boolean {
  if (existing.status === 'cancelled') return false;
  if (!existing.createdAtMs || now - existing.createdAtMs > windowMs) return false;
  const existingPhone = normalizePhone(existing.phone);
  const incomingPhone = normalizePhone(incoming.phone);
  if (!existingPhone || existingPhone !== incomingPhone) return false;
  return Boolean(existing.cartSignature && incoming.cartSignature && existing.cartSignature === incoming.cartSignature);
}

export function buildStoreCheckoutOrder(input: {
  business: Pick<BusinessConfig, 'id' | 'ownerId' | 'courierConfig' | 'products'>;
  lines: CartLine[];
  customer: ShopCustomerInput;
  sessionId?: string;
  clientIp?: string;
  now?: number;
  orderId?: string;
}): { ok: true; value: BuiltStoreOrder } | { ok: false; issues: CheckoutIssue[] } {
  const now = input.now || Date.now();
  const issues = validateShopCheckout(input.business.products, input.lines, input.customer);
  if (issues.length > 0) return { ok: false as const, issues };
  const address = String(input.customer.address || '').trim();
  const district = String(input.customer.district || '').trim();
  const fullAddress = district && !address.includes(district) ? `${address}, ${district}` : address;
  const totals = resolveCart(input.business.products, input.lines, {
    address: fullAddress,
    district,
    business: input.business,
  });
  const insideDhaka = totals.insideDhaka;
  if (totals.lines.length === 0) {
    return { ok: false, issues: [{ field: 'cart', message: 'কার্ট খালি। আগে পণ্য যোগ করুন' }] };
  }

  const items = orderItemsFromCart(totals);
  const first = items[0];
  const phone = normalizePhone(input.customer.phone);
  const sessionId = String(input.sessionId || '').trim();
  const orderId = input.orderId || `ORD-WEB-${now.toString(36).toUpperCase()}`;
  const history: OrderStatusEvent[] = [{ status: 'confirmed', at: now, note: 'Website COD checkout' }];

  const order: Omit<Order, 'createdAt' | 'updatedAt'> = {
    id: orderId,
    businessId: input.business.id,
    merchantId: input.business.ownerId || '',
    sessionId,
    passengerId: sessionId,
    clientIp: String(input.clientIp || '').trim(),
    customerName: String(input.customer.name || '').trim(),
    phone,
    address: fullAddress,
    district,
    quantity: totals.itemCount,
    productId: first.productId,
    productName: items.length === 1 ? first.productName : items.map(item => item.productName).join(', '),
    unitPrice: first.unitPrice,
    totalPrice: totals.total,
    deliveryFee: totals.deliveryFee,
    items,
    cartSignature: cartSignatureOf(items),
    status: 'confirmed',
    paymentStatus: 'unpaid',
    paymentMethod: 'cod',
    notes: String(input.customer.notes || '').trim(),
    source: 'website',
    tags: ['website', 'COD'],
    insideDhaka,
    createdAtMs: now,
    updatedAtMs: now,
    statusHistory: history,
  };

  return {
    ok: true as const,
    value: {
      order: omitUndefined(order),
      inventory: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
    },
  };
}

export function decrementShopStock<T extends { id?: string; stock?: number }>(
  products: T[],
  inventory: Array<{ productId: string; quantity: number }>
): T[] {
  return products.map(product => {
    const hit = inventory.find(item => sameProductId(item.productId, product.id));
    if (!hit) return product;
    const stock = finiteNumber(product.stock, 0);
    if (stock <= 0) return product;
    return { ...product, stock: Math.max(0, stock - hit.quantity) };
  });
}

export function sanitizePublicOrder(order: Order) {
  return {
    id: order.id,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    district: order.district || '',
    items: orderItemsOf(order),
    productName: order.productName,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    deliveryFee: order.deliveryFee || 0,
    totalPrice: order.totalPrice,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod || 'cod',
    courierTrackingId: order.courierTrackingId || '',
    createdAtMs: order.createdAtMs || 0,
    source: order.source || '',
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
  };
}

export function shopPassengerId(businessId: string, random = Math.random): string {
  const key = shopPassengerStorageKey(businessId);
  if (typeof localStorage === 'undefined') {
    return `web-${Date.now().toString(36)}-${random().toString(36).slice(2, 8)}`;
  }
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = `web-${Date.now().toString(36)}-${random().toString(36).slice(2, 8)}`;
  localStorage.setItem(key, created);
  return created;
}
