import { AIResponse, BusinessConfig, Product } from '../types';
import { db } from './firebase';
import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import {
  DUPLICATE_ORDER_WINDOW_MS,
  isRecentIdentityDuplicate,
  normalizePhone,
} from './orderIdentity';
import { shouldCreateConfirmedOrder } from './chatRuntime';
import { clampNegotiatedUnitPrice } from './bargaining';
import { isFeatureEnabled } from './featureFlags';

export { extractBdPhone, normalizePhone } from './orderIdentity';

export interface CollectedOrderInfo {
  name?: string;
  phone?: string;
  address?: string;
  quantity?: string;
  product_name?: string;
  negotiated_price?: string;
}

export function mergeOrderData(
  prev: CollectedOrderInfo | undefined,
  next: CollectedOrderInfo | undefined
): CollectedOrderInfo {
  const merged: CollectedOrderInfo = {
    name: (next?.name || prev?.name || '').trim(),
    phone: normalizePhone(next?.phone) || normalizePhone(prev?.phone) || '',
    address: (next?.address || prev?.address || '').trim(),
    quantity: (next?.quantity || prev?.quantity || '').trim() || '1',
    product_name: (next?.product_name || prev?.product_name || '').trim(),
    negotiated_price: (next?.negotiated_price || prev?.negotiated_price || '').trim(),
  };
  return merged;
}

export function hasCompleteOrder(data?: CollectedOrderInfo | null): boolean {
  if (!data) return false;
  const phone = normalizePhone(data.phone);
  const address = (data.address || '').trim();
  const name = (data.name || '').trim();
  const productName = (data.product_name || '').trim();
  return name.length >= 2 && phone.length === 11 && address.length >= 8 && productName.length >= 2;
}

export function shouldPlaceOrder(
  ai: AIResponse,
  collected: CollectedOrderInfo,
  alreadyPlaced: boolean,
  customerMessage = '',
): boolean {
  if (alreadyPlaced) return false;
  const merged = mergeOrderData(collected, {
    ...ai.order_data,
    product_name: ai.order_data?.product_name || ai.product_name,
  });
  if (!hasCompleteOrder(merged)) return false;
  const modelRequested = Boolean(
    ai.should_create_order
    || (ai.conversation_stage === 'order_completed' && !ai.need_more_info)
    || (ai.event_name === 'Purchase' && !ai.need_more_info)
  );
  return shouldCreateConfirmedOrder({
    modelRequested,
    customerMessage,
    hasCompleteOrder: true,
  });
}

export function findMatchingProduct(business: BusinessConfig, productName?: string): Product | undefined {
  const wanted = (productName || '').toLowerCase().trim();
  const products = business.products || [];
  if (!wanted) return products.length === 1 ? products[0] : undefined;
  return (
    products.find(p => p.name?.toLowerCase() === wanted) ||
    products.find(p => p.name?.toLowerCase().includes(wanted) || wanted.includes(p.name?.toLowerCase() || '\0')) ||
    (products.length === 1 ? products[0] : undefined)
  );
}

export function parseUnitPrice(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function buildCustomerContext(collected: CollectedOrderInfo, extra?: string): string {
  const bits: string[] = [];
  if (collected.name) bits.push(`নাম: ${collected.name}`);
  if (collected.phone) bits.push(`মোবাইল: ${collected.phone}`);
  if (collected.address) bits.push(`ঠিকানা: ${collected.address}`);
  if (collected.product_name) bits.push(`আগ্রহী পণ্য: ${collected.product_name}`);
  if (collected.quantity) bits.push(`পরিমাণ: ${collected.quantity}`);
  if (collected.negotiated_price) bits.push(`সম্মত দাম: ${collected.negotiated_price}`);
  const known = bits.length
    ? `কাস্টমারের জানা তথ্য (আগেই দিয়েছে — আবার জিজ্ঞেস করবে না): ${bits.join(' | ')}`
    : 'এই সেশনে এখনো নাম/ফোন/ঠিকানা পাওয়া যায়নি।';
  return extra ? `${known}\n${extra}` : known;
}

export async function fetchClientIp(): Promise<string> {
  try {
    const res = await fetch('/api/client-ip');
    const data = await res.json().catch(() => ({}));
    return String(data?.clientIp || '');
  } catch {
    return '';
  }
}

async function queryOrdersByField(businessId: string, field: string, value: string) {
  if (!businessId || !value) return [] as any[];
  try {
    const snap = await getDocs(
      query(collection(db, 'orders'), where('businessId', '==', businessId), where(field, '==', value))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function hasRecentDuplicateOrder(
  businessId: string,
  identity: { phone?: string; sessionId?: string; passengerId?: string; clientIp?: string },
  windowMs = DUPLICATE_ORDER_WINDOW_MS
): Promise<boolean> {
  if (!businessId) return false;
  const phone = normalizePhone(identity.phone);
  const passengerId = String(identity.passengerId || identity.sessionId || '').trim();
  const clientIp = String(identity.clientIp || '').trim();
  if (!phone && !passengerId && !clientIp) return false;

  const buckets = await Promise.all([
    queryOrdersByField(businessId, 'phone', phone),
    queryOrdersByField(businessId, 'sessionId', passengerId),
    queryOrdersByField(businessId, 'passengerId', passengerId),
    queryOrdersByField(businessId, 'clientIp', clientIp),
  ]);
  const seen = new Map<string, any>();
  for (const row of buckets.flat()) {
    if (row?.id) seen.set(row.id, row);
  }
  return [...seen.values()].some(existing => isRecentIdentityDuplicate(existing, identity, Date.now(), windowMs));
}

export async function saveConfirmedOrder(params: {
  business: BusinessConfig;
  collected: CollectedOrderInfo;
  productName?: string;
  sessionId?: string;
  clientIp?: string;
  source?: string;
  skipDuplicateCheck?: boolean;
}): Promise<{ id: string } | null> {
  const { business, collected, sessionId, source } = params;
  const phone = normalizePhone(collected.phone);
  const productName = params.productName || collected.product_name || '';
  const passengerId = String(sessionId || '').trim();
  const clientIp = String(params.clientIp || '').trim();
  if (!hasCompleteOrder({ ...collected, phone })) return null;

  if (
    !params.skipDuplicateCheck &&
    (await hasRecentDuplicateOrder(business.id, { phone, sessionId: passengerId, passengerId, clientIp }))
  ) {
    return null;
  }

  const matched = findMatchingProduct(business, productName);
  const qty = Math.max(1, parseInt(String(collected.quantity || '1'), 10) || 1);
  const unitPrice = clampNegotiatedUnitPrice({
    product: matched,
    quantity: qty,
    negotiated: collected.negotiated_price,
    sensitivity: business.bargainingSensitivity,
    negotiationEnabled: isFeatureEnabled(business.features, 'negotiationEnabled'),
  });
  const deliveryFee = business.courierConfig?.deliveryChargeInsideDhaka || 70;
  const orderId = `ord-${Date.now()}`;
  const payload: any = {
    id: orderId,
    businessId: business.id,
    merchantId: business.ownerId || '',
    sessionId: passengerId,
    passengerId,
    clientIp,
    customerName: collected.name || 'সম্মানিত গ্রাহক',
    phone,
    address: collected.address || '',
    quantity: qty,
    productId: matched?.id || '',
    productName: matched?.name || productName || 'পণ্য',
    unitPrice,
    deliveryFee,
    totalPrice: unitPrice * qty + deliveryFee,
    status: 'confirmed',
    paymentStatus: 'unpaid',
    paymentMethod: 'cod',
    notes: source || 'AI chat',
    source: source || 'AI chat',
    tags: ['AI confirmed'],
    statusHistory: [{ status: 'confirmed', at: Date.now(), note: source || 'AI chat' }],
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  };

  await setDoc(doc(db, 'orders', orderId), payload);
  return { id: orderId };
}

export async function maybeAutoBookSteadfast(business: BusinessConfig, orderId: string, isTest = false) {
  if (isTest) return;
  if (!orderId || !business?.id) return;
  if (business.courierConfig?.autoBooking === false) return;
  if (!business.courierConfig?.steadfastApiKey) return;
  try {
    await fetch('/api/courier/steadfast/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, businessId: business.id }),
    });
  } catch (err) {
    console.warn('[maybeAutoBookSteadfast]', err);
  }
}
