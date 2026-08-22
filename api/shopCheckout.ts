/**
 * Checkout helpers that live inside /api so Vercel always bundles them.
 * Do not import src/lib here — that graph has crashed the shop function.
 */

export const WEBSITE_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
export const MAX_CART_LINES = 30;
export const MAX_LINE_QUANTITY = 50;

const DHAKA_RE =
  /ঢাকা|dhaka|মোহাম্মদপুর|ধানমন্ডি|গুলশান|বনানী|উত্তরা|মিরপুর|মতিঝিল|বাড্ডা|রামপুরা|মগবাজার|খিলগাঁও|যাত্রাবাড়ী|কেরানীগঞ্জ|সাভার|dhanmondi|gulshan|uttara|mirpur|banani|mohammadpur/i;

export function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => omitUndefined(item)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      out[key] = omitUndefined(nested);
    }
    return out as T;
  }
  return value;
}

export function asProductList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, any>).filter(Boolean);
  return [];
}

export function sameProductId(a?: string | number | null, b?: string | number | null): boolean {
  if (a == null || b == null) return false;
  const left = String(a).trim();
  const right = String(b).trim();
  return left.length > 0 && left === right;
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  const match = String(phone).replace(/[\s-]/g, '').match(/(?:\+?88)?(01[3-9]\d{8})/);
  return match ? match[1] : '';
}

export function addressLooksInsideDhaka(address?: string): boolean {
  return DHAKA_RE.test(address || '');
}

export function isInsideDhakaDelivery(input: { address?: string; district?: string }): boolean {
  const district = String(input.district || '').trim();
  if (district === 'ঢাকা') return true;
  if (district) return false;
  return addressLooksInsideDhaka(input.address || '');
}

export function sanitizeCart(lines: Array<{ productId?: string; quantity?: number }> | null | undefined) {
  const merged = new Map<string, number>();
  for (const line of lines || []) {
    const productId = String(line?.productId || '').trim();
    const quantity = Math.max(0, Math.round(finiteNumber(line?.quantity, 0)));
    if (!productId || quantity < 1) continue;
    merged.set(productId, Math.min(MAX_LINE_QUANTITY, (merged.get(productId) || 0) + quantity));
  }
  return [...merged.entries()]
    .slice(0, MAX_CART_LINES)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

function findProduct(products: any[], productId?: string) {
  return products.find(product => sameProductId(product?.id, productId));
}

function isBuyable(product: any): boolean {
  if (!product || product.isAvailable === false) return false;
  return String(product.name || '').trim().length > 0;
}

function maxBuyableQuantity(product: any): number {
  if (!isBuyable(product)) return 0;
  const stock = finiteNumber(product?.stock, 0);
  if (stock > 0) return Math.min(MAX_LINE_QUANTITY, Math.floor(stock));
  return MAX_LINE_QUANTITY;
}

function unitPriceForQuantity(product: any, quantity: number): number {
  const tiers = Array.isArray(product?.pricingTiers) ? product.pricingTiers : [];
  if (tiers.length === 0) return Math.max(0, finiteNumber(product?.price, 0));
  const qty = Math.max(1, Math.round(finiteNumber(quantity, 1)));
  const sorted = [...tiers].sort((a: any, b: any) => finiteNumber(a.quantity, 1) - finiteNumber(b.quantity, 1));
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (finiteNumber(tier.quantity, 1) <= qty) chosen = tier;
  }
  const packQty = Math.max(1, finiteNumber(chosen?.quantity, 1));
  const packPrice = finiteNumber(chosen?.price, product?.price);
  return Math.max(0, packPrice / packQty);
}

export function resolveCart(
  products: unknown,
  lines: Array<{ productId?: string; quantity?: number }>,
  options?: { address?: string; district?: string; business?: { courierConfig?: any } }
) {
  const catalog = asProductList(products);
  const resolved: any[] = [];
  for (const line of sanitizeCart(lines)) {
    const product = findProduct(catalog, line.productId);
    if (!isBuyable(product) || !product) continue;
    const maxQty = maxBuyableQuantity(product);
    const qty = Math.min(maxQty, Math.max(1, Math.round(finiteNumber(line.quantity, 1))));
    const unitPrice = unitPriceForQuantity(product, qty);
    resolved.push({
      product,
      quantity: qty,
      unitPrice,
      lineTotal: Math.round(unitPrice * qty),
    });
  }
  const subtotal = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const insideDhaka = isInsideDhakaDelivery({
    address: options?.address || '',
    district: options?.district || '',
  });
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

export function validateShopCheckout(
  products: unknown,
  lines: Array<{ productId?: string; quantity?: number }>,
  customer: { name?: string; phone?: string; address?: string }
) {
  const issues: Array<{ field: string; message: string }> = [];
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
    const product = findProduct(catalog, line.productId);
    if (!isBuyable(product) || !product) {
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

export function cartSignatureOf(lines: Array<{ productId?: string; quantity?: number }>): string {
  return [...lines]
    .map(line => `${String(line.productId || '').trim()}:${Math.max(1, Math.round(finiteNumber(line.quantity, 1)))}`)
    .filter(part => !part.startsWith(':'))
    .sort()
    .join('|');
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
  business: { id: string; ownerId?: string; courierConfig?: any; products?: unknown };
  lines: Array<{ productId?: string; quantity?: number }>;
  customer: { name?: string; phone?: string; address?: string; district?: string; notes?: string; insideDhaka?: boolean };
  sessionId?: string;
  clientIp?: string;
  now?: number;
  orderId?: string;
}) {
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
  if (totals.lines.length === 0) {
    return { ok: false as const, issues: [{ field: 'cart', message: 'কার্ট খালি। আগে পণ্য যোগ করুন' }] };
  }

  const items = totals.lines.map(line => ({
    productId: String(line.product.id || ''),
    productName: String(line.product.name || ''),
    quantity: line.quantity,
    unitPrice: Math.round(line.unitPrice),
    lineTotal: line.lineTotal,
    image: String(line.product.images?.find((url: unknown) => typeof url === 'string' && String(url).trim()) || ''),
  }));
  const first = items[0];
  const phone = normalizePhone(input.customer.phone);
  const sessionId = String(input.sessionId || '').trim();
  const orderId = input.orderId || `ORD-WEB-${now.toString(36).toUpperCase()}`;

  const order: any = omitUndefined({
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
    insideDhaka: totals.insideDhaka,
    createdAtMs: now,
    updatedAtMs: now,
    statusHistory: [{ status: 'confirmed', at: now, note: 'Website COD checkout' }],
  });

  return {
    ok: true as const,
    value: {
      order,
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

export function orderItemsOf(order: any) {
  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items.filter((item: any) => item && item.productName);
  }
  const quantity = Math.max(1, finiteNumber(order?.quantity, 1));
  const unitPrice = finiteNumber(order?.unitPrice, 0);
  return [{
    productId: String(order?.productId || ''),
    productName: order?.productName || 'পণ্য',
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
  }];
}

export function sanitizePublicOrder(order: any) {
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
