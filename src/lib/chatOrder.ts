import { AIResponse, BusinessConfig, Product } from '../types';
import { db } from './firebase';
import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore';

export interface CollectedOrderInfo {
  name?: string;
  phone?: string;
  address?: string;
  quantity?: string;
  product_name?: string;
  negotiated_price?: string;
}

const BD_PHONE_RE = /(?:\+?88)?(01[3-9]\d{8})/;

export function extractBdPhone(text?: string | null): string {
  if (!text) return '';
  const m = String(text).replace(/[\s-]/g, '').match(BD_PHONE_RE);
  return m ? m[1] : '';
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  return extractBdPhone(phone);
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
  return name.length >= 2 && phone.length === 11 && address.length >= 8;
}

export function shouldPlaceOrder(
  ai: AIResponse,
  collected: CollectedOrderInfo,
  alreadyPlaced: boolean
): boolean {
  if (alreadyPlaced) return false;
  const merged = mergeOrderData(collected, {
    ...ai.order_data,
    product_name: ai.order_data?.product_name || ai.product_name,
  });
  if (!hasCompleteOrder(merged)) return false;
  if (ai.should_create_order) return true;
  if (ai.conversation_stage === 'order_completed' && !ai.need_more_info) return true;
  if (ai.event_name === 'Purchase' && !ai.need_more_info) return true;
  return false;
}

export function findMatchingProduct(business: BusinessConfig, productName?: string): Product | undefined {
  const wanted = (productName || '').toLowerCase().trim();
  const products = business.products || [];
  if (!wanted) return products[0];
  return (
    products.find(p => p.name?.toLowerCase() === wanted) ||
    products.find(p => p.name?.toLowerCase().includes(wanted) || wanted.includes(p.name?.toLowerCase() || '\0')) ||
    products[0]
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

export async function hasRecentDuplicateOrder(
  businessId: string,
  phone: string,
  productName?: string,
  windowMs = 2 * 60 * 60 * 1000
): Promise<boolean> {
  if (!businessId || !phone) return false;
  try {
    const snap = await getDocs(
      query(collection(db, 'orders'), where('businessId', '==', businessId), where('phone', '==', phone))
    );
    const cutoff = Date.now() - windowMs;
    return snap.docs.some(d => {
      const data = d.data() as any;
      const ts = data.createdAtMs || (data.createdAt?.toMillis?.() ? data.createdAt.toMillis() : Date.parse(data.createdAt || '') || 0);
      const sameProduct = !productName || !data.productName || String(data.productName).toLowerCase() === productName.toLowerCase();
      const notCancelled = data.status !== 'cancelled';
      return ts >= cutoff && sameProduct && notCancelled;
    });
  } catch {
    return false;
  }
}

export async function saveConfirmedOrder(params: {
  business: BusinessConfig;
  collected: CollectedOrderInfo;
  productName?: string;
  sessionId?: string;
  source?: string;
}): Promise<{ id: string } | null> {
  const { business, collected, sessionId, source } = params;
  const phone = normalizePhone(collected.phone);
  const productName = params.productName || collected.product_name || '';
  if (!hasCompleteOrder({ ...collected, phone })) return null;

  if (await hasRecentDuplicateOrder(business.id, phone, productName)) {
    return null;
  }

  const matched = findMatchingProduct(business, productName);
  const qty = Math.max(1, parseInt(String(collected.quantity || '1'), 10) || 1);
  const unitPrice = parseUnitPrice(collected.negotiated_price, matched?.price || 0);
  const deliveryFee = business.courierConfig?.deliveryChargeInsideDhaka || 70;
  const orderId = `ord-${Date.now()}`;
  const payload: any = {
    id: orderId,
    businessId: business.id,
    merchantId: business.ownerId,
    sessionId: sessionId || '',
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
