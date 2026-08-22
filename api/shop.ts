/**
 * Isolated public shop API.
 * Boots without the Express/Gemini monolith so /myshop keeps working
 * even when api/index.ts fails to load.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  isReservedShopSlug,
  isValidShopSlug,
  matchRequestedShopSlug,
  nextShopSlugCandidate,
  normalizeShopSlug,
  publicShopSlug,
  suggestedShopSlug,
} from './shopSlug.js';
import { parseShopRequest, readJsonBody } from './shopRoute.js';
import {
  buildStoreCheckoutOrder,
  decrementShopStock,
  isRepeatWebsiteCheckout,
  omitUndefined,
  sanitizeCart,
  sanitizePublicOrder,
} from './shopCheckout.js';
import { sanitizePublicProduct } from './shopPublicProduct.js';

export const maxDuration = 60;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
let adminDb: any;
let bootError = '';

function parseFirebaseServiceAccount(raw: string | undefined | null): Record<string, string> | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const candidates = [value];
  try {
    candidates.push(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    // ignore invalid base64
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && parsed.private_key && parsed.client_email) {
        return parsed;
      }
    } catch {
      // try next
    }
  }
  return null;
}

function initializeAdminApp(projectId: string) {
  if (admin.apps.length > 0) return admin.app();
  const serviceAccount = parseFirebaseServiceAccount(
    process.env.FIREBASE_SERVICE_ACCOUNT
    || process.env.FIREBASE_ADMIN_CREDENTIALS
    || process.env.GOOGLE_SERVICE_ACCOUNT
  );
  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  }
  return admin.initializeApp({ projectId });
}

function loadFirebaseConfig(): any | null {
  const paths = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(__dirname, '..', 'firebase-applet-config.json'),
    path.join(__dirname, 'firebase-applet-config.json'),
  ];
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch {
      // try next
    }
  }
  return null;
}

try {
  const firebaseConfig = loadFirebaseConfig();
  if (!firebaseConfig?.projectId) {
    bootError = 'firebase_config_missing';
  } else {
    const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = firebaseConfig.firestoreDatabaseId
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(firebaseApp);
    try {
      const adminApp = initializeAdminApp(firebaseConfig.projectId);
      const dbId = firebaseConfig.firestoreDatabaseId;
      adminDb = getAdminFirestore(adminApp, dbId && dbId !== '(default)' ? dbId : undefined);
    } catch (adminErr: any) {
      console.error('[shop] Admin setup failed:', adminErr?.message || adminErr);
      adminDb = null;
    }
  }
} catch (error: any) {
  bootError = error?.message || 'firebase_init_failed';
  console.error('[shop] Firebase init failed:', bootError);
}

function asProductList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, any>).filter(Boolean);
  return [];
}

function featureOn(features: any, key: string): boolean {
  if (!features || typeof features !== 'object' || features[key] === undefined) return true;
  return features[key] !== false;
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  const match = String(phone).replace(/[\s-]/g, '').match(/(?:\+?88)?(01[3-9]\d{8})/);
  return match ? match[1] : '';
}

function normalizeClientIp(ip?: string | null): string {
  if (!ip) return '';
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '');
}

function isUntrustedCustomerIp(ip?: string | null): boolean {
  const value = normalizeClientIp(ip);
  if (!value) return true;
  if (value === '127.0.0.1' || value === '::1' || value === 'localhost') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.') || value.startsWith('127.')) return true;
  const parts = value.split('.').map(Number);
  return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function trustedClientIp(ip?: string | null): string {
  const value = normalizeClientIp(ip);
  return isUntrustedCustomerIp(value) ? '' : value;
}

function clientIpFromReq(req: any): string {
  return normalizeClientIp(
    req?.headers?.['x-forwarded-for']
    || req?.headers?.['x-real-ip']
    || req?.ip
    || req?.socket?.remoteAddress
    || ''
  );
}

function sendJson(res: any, status: number, body: Record<string, unknown>, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  const payload = JSON.stringify(body);
  if (typeof res.end === 'function') return res.end(payload);
  return res.send(payload);
}

async function loadBusinessById(businessId: string): Promise<{ id: string; data: any } | null> {
  if (!businessId) return null;
  try {
    if (adminDb) {
      const snap = await adminDb.collection('businesses').doc(businessId).get();
      if (snap.exists) return { id: snap.id, data: snap.data() };
    } else if (db) {
      const snap = await getDoc(doc(db, 'businesses', businessId));
      if (snap.exists()) return { id: snap.id, data: snap.data() };
    }
  } catch (err) {
    console.warn('[shop] loadBusinessById', err);
  }
  return null;
}

async function queryBusinessBySlug(slug: string): Promise<{ id: string; data: any } | null> {
  const clean = normalizeShopSlug(slug);
  if (!clean) return null;
  try {
    if (adminDb) {
      const snap = await adminDb.collection('businesses').where('slug', '==', clean).limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    } else if (db) {
      const snap = await getDocs(query(collection(db, 'businesses'), where('slug', '==', clean), limit(1)));
      if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    }
  } catch (err) {
    console.warn('[shop] queryBusinessBySlug', err);
  }
  return null;
}

async function listBusinessDocs(max = 400): Promise<Array<{ id: string; data: any }>> {
  try {
    if (adminDb) {
      const snap = await adminDb.collection('businesses').limit(max).get();
      return snap.docs.map((d: any) => ({ id: d.id, data: d.data() }));
    }
    if (db) {
      const snap = await getDocs(query(collection(db, 'businesses'), limit(max)));
      return snap.docs.map(d => ({ id: d.id, data: d.data() }));
    }
  } catch (err) {
    console.warn('[shop] listBusinessDocs', err);
  }
  return [];
}

async function isShopSlugTaken(slug: string, exceptBusinessId = ''): Promise<boolean> {
  const found = await queryBusinessBySlug(slug);
  if (!found) return false;
  return found.id !== exceptBusinessId;
}

async function persistBusinessSlug(business: { id: string; data: any }, slug: string) {
  const current = normalizeShopSlug(business.data?.slug);
  if (current === slug) return;
  try {
    if (adminDb) {
      await adminDb.collection('businesses').doc(business.id).set({ slug }, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'businesses', business.id), { slug }, { merge: true });
    }
    business.data = { ...business.data, slug };
  } catch (err) {
    console.warn('[shop] persistBusinessSlug', err);
  }
}

async function ensureBusinessSlug(business: { id: string; data: any }): Promise<string> {
  const existing = normalizeShopSlug(business.data?.slug);
  if (isValidShopSlug(existing) && !(await isShopSlugTaken(existing, business.id))) {
    return existing;
  }
  const base = suggestedShopSlug({
    slug: business.data?.slug,
    name: business.data?.name,
    id: business.id,
  });
  let attempt = 1;
  let candidate = nextShopSlugCandidate(base, attempt);
  while (isReservedShopSlug(candidate) || await isShopSlugTaken(candidate, business.id)) {
    attempt += 1;
    candidate = nextShopSlugCandidate(base, attempt);
    if (attempt > 40) {
      candidate = nextShopSlugCandidate(`shop${business.id.replace(/[^a-z0-9]/gi, '').slice(-8)}`, 1);
      break;
    }
  }
  await persistBusinessSlug(business, candidate);
  return candidate;
}

async function loadBusinessBySlugOrId(slugOrId: string): Promise<{ id: string; data: any } | null> {
  const raw = String(slugOrId || '').trim();
  if (!raw) return null;
  const byId = await loadBusinessById(raw);
  if (byId) {
    await ensureBusinessSlug(byId);
    return byId;
  }
  const bySlug = await queryBusinessBySlug(raw);
  if (bySlug) {
    await ensureBusinessSlug(bySlug);
    return bySlug;
  }

  const all = await listBusinessDocs();
  const match = matchRequestedShopSlug(
    all.map(row => ({ id: row.id, slug: row.data?.slug, name: row.data?.name })),
    raw
  );
  if (!match) return null;
  const found = all.find(row => row.id === match.id);
  if (!found) return null;

  const requested = normalizeShopSlug(raw);
  const existing = normalizeShopSlug(found.data?.slug);
  if (!existing && isValidShopSlug(requested) && !(await isShopSlugTaken(requested, found.id))) {
    await persistBusinessSlug(found, requested);
  } else {
    await ensureBusinessSlug(found);
  }
  return found;
}

function sanitizePublicBusiness(id: string, data: any) {
  const products = asProductList(data?.products);
  const faqs = Array.isArray(data?.faqs) ? data.faqs : [];
  return {
    id,
    name: String(data?.name || '').slice(0, 200),
    description: String(data?.description || data?.tagline || data?.bio || '').slice(0, 1_000),
    tagline: String(data?.tagline || data?.bio || '').slice(0, 300),
    phone: String(data?.phone || '').slice(0, 30),
    address: String(data?.address || '').slice(0, 300),
    logoUrl: String(data?.logoUrl || '').slice(0, 2_000),
    products: products
      .filter((product: any) => product?.isAvailable !== false)
      .slice(0, 100)
      .map((product: any) => sanitizePublicProduct(product)),
    faqs: faqs
      .filter((faq: any) => faq?.isActive !== false)
      .slice(0, 100)
      .map((faq: any) => ({
        id: String(faq.id || ''),
        type: faq.type === 'product' ? 'product' : 'general',
        question: String(faq.question || '').slice(0, 500),
        answer: String(faq.answer || '').slice(0, 1_500),
        category: String(faq.category || '').slice(0, 100),
        productId: String(faq.productId || ''),
        productName: String(faq.productName || '').slice(0, 200),
        isActive: faq.isActive !== false,
      })),
    features: data?.features || {},
    courierConfig: {
      deliveryChargeInsideDhaka: Number(data?.courierConfig?.deliveryChargeInsideDhaka) || 0,
      deliveryChargeOutsideDhaka: Number(data?.courierConfig?.deliveryChargeOutsideDhaka) || 0,
    },
    status: data?.status,
    plan: data?.plan,
    verificationStatus: data?.verificationStatus,
    facebookPixelId: String(data?.facebookConfig?.pixelId || '').replace(/[^\w]/g, '').slice(0, 32),
    slug: publicShopSlug({ id, slug: data?.slug, name: data?.name }),
  };
}

async function queryOrdersByField(bizId: string, field: string, value: string) {
  if (!bizId || !value) return [] as any[];
  try {
    if (adminDb) {
      const snap = await adminDb.collection('orders').where('businessId', '==', bizId).where(field, '==', value).limit(15).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    }
    if (db) {
      const snap = await getDocs(query(collection(db, 'orders'), where('businessId', '==', bizId), where(field, '==', value), limit(15)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    console.warn('[shop] queryOrdersByField', e);
  }
  return [];
}

async function saveOrderDoc(order: any) {
  const payload = omitUndefined({
    ...order,
    createdAtMs: order.createdAtMs || Date.now(),
  });
  if (adminDb) {
    try {
      await adminDb.collection('orders').doc(order.id).set({
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    } catch (adminErr: any) {
      console.error('[shop] Admin order write failed:', adminErr?.message);
    }
  }
  if (db) {
    await setDoc(doc(db, 'orders', order.id), { ...payload, createdAt: serverTimestamp() }, { merge: true });
    return;
  }
  throw new Error('No Firestore connection available to save order');
}

async function bookSteadfastParcel(order: any, businessData: any) {
  const apiKey = String(businessData?.courierConfig?.steadfastApiKey || '').trim();
  const secret = String(businessData?.courierConfig?.steadfastSecretKey || '').trim();
  if (!apiKey || !secret) {
    return { success: false, error: 'Steadfast API Key/Secret কনফিগার করা নেই' };
  }

  let phone = String(order.phone || '').replace(/\D/g, '');
  if (phone.length === 13 && phone.startsWith('880')) phone = phone.slice(2);
  if (phone.length !== 11) {
    return { success: false, error: 'কুরিয়ার বুকিংয়ের জন্য ১১ ডিজিটের মোবাইল নম্বর প্রয়োজন' };
  }

  const invoice = String(order.id || `ORD${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const payload = {
    invoice,
    recipient_name: String(order.customerName || 'Customer').slice(0, 100),
    recipient_phone: phone,
    recipient_address: String(order.address || '').slice(0, 250),
    cod_amount: Number(order.totalPrice || 0),
    note: String(order.notes || order.productName || '').slice(0, 200),
    item_description: String(order.productName || '').slice(0, 200),
    total_lot: Number(order.quantity || 1) || 1,
  };

  try {
    const res = await fetch('https://portal.packzy.com/api/v1/create_order', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const data: any = await res.json().catch(() => ({}));
    const consignment = data?.consignment || {};
    const trackingCode = consignment.tracking_code || data?.tracking_code;
    const consignmentId = consignment.consignment_id || data?.consignment_id;
    if (!trackingCode && data?.status !== 200) {
      return { success: false, error: data?.message || 'Steadfast বুকিং ব্যর্থ', raw: data };
    }
    return {
      success: true,
      trackingCode: trackingCode || '',
      consignmentId: consignmentId ? String(consignmentId) : '',
      raw: data,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Steadfast API error' };
  }
}

const shopCheckoutRateLimit = new Map<string, { count: number; resetAt: number }>();

function consumeShopCheckoutQuota(key: string) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const current = shopCheckoutRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    shopCheckoutRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= 8) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

async function handleSlugCheck(req: any, res: any, parsed: ReturnType<typeof parseShopRequest>) {
  const slug = normalizeShopSlug(parsed.query.slug);
  const except = String(parsed.query.except || '').trim();
  if (!isValidShopSlug(slug)) {
    return sendJson(res, 200, {
      ok: false,
      slug,
      error: isReservedShopSlug(slug) ? 'এই নাম ব্যবহার করা যাবে না' : 'ইংরেজি অক্ষর ও সংখ্যা দিয়ে লিংক নাম লিখুন',
    });
  }
  const taken = await isShopSlugTaken(slug, except);
  return sendJson(res, 200, {
    ok: !taken,
    slug,
    error: taken ? 'এই লিংক অন্য স্টোর ব্যবহার করছে' : '',
  });
}

async function handleShopGet(res: any, businessId: string) {
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return sendJson(res, 400, { error: 'Invalid business ID' });
  }
  const business = await loadBusinessBySlugOrId(businessId);
  if (!business || business.data?.status === 'suspended') {
    return sendJson(res, 404, { error: 'Store not found' });
  }
  return sendJson(
    res,
    200,
    sanitizePublicBusiness(business.id, business.data),
    'public, max-age=60, stale-while-revalidate=300'
  );
}

async function handleCheckout(req: any, res: any, businessId: string) {
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return sendJson(res, 400, { code: 'INVALID_BUSINESS', error: 'সঠিক স্টোর আইডি প্রয়োজন।' });
  }

  const clientIp = trustedClientIp(clientIpFromReq(req)) || '';
  const quota = consumeShopCheckoutQuota(`${businessId}:${clientIp || 'anon'}`);
  if (!quota.allowed) {
    res.setHeader?.('Retry-After', String(quota.retryAfterSeconds));
    return sendJson(res, 429, {
      code: 'RATE_LIMITED',
      error: 'খুব দ্রুত অনেক অর্ডারের চেষ্টা হয়েছে। একটু পর আবার চেষ্টা করুন।',
    });
  }

  const business = await loadBusinessBySlugOrId(businessId);
  if (!business || business.data?.status === 'suspended') {
    return sendJson(res, 404, { code: 'STORE_NOT_FOUND', error: 'স্টোরটি পাওয়া যায়নি।' });
  }

  const body = readJsonBody(req);
  const catalog = asProductList(business.data?.products);
  const built = buildStoreCheckoutOrder({
    business: {
      id: business.id,
      ownerId: business.data?.ownerId || '',
      courierConfig: business.data?.courierConfig,
      products: catalog,
    },
    lines: sanitizeCart(body?.items),
    customer: body?.customer || {},
    sessionId: String(body?.sessionId || '').slice(0, 80),
    clientIp,
  });

  if (built.ok === false) {
    return sendJson(res, 400, {
      code: 'INVALID_CHECKOUT',
      error: built.issues[0]?.message || 'অর্ডার তথ্য অসম্পূর্ণ',
      issues: built.issues,
    });
  }

  const phone = built.value.order.phone;
  const recent = await queryOrdersByField(business.id, 'phone', phone);
  const duplicate = recent.find((row: any) => isRepeatWebsiteCheckout(row, built.value.order));
  if (duplicate) {
    return sendJson(res, 200, {
      order: sanitizePublicOrder({ ...duplicate, id: duplicate.id }),
      duplicate: true,
    });
  }

  const order = built.value.order;
  await saveOrderDoc(order);

  if (featureOn(business.data?.features, 'inventoryEnabled') && adminDb) {
    const nextProducts = decrementShopStock(catalog, built.value.inventory);
    await adminDb.collection('businesses').doc(business.id).update({ products: nextProducts }).catch(() => {});
  }

  if (adminDb || db) {
    const customerId = `${business.id}_${phone}`;
    const customerPayload = {
      id: customerId,
      businessId: business.id,
      name: order.customerName,
      phone,
      address: order.address,
      lastOrderDate: Date.now(),
      lastOrderId: order.id,
      source: 'website',
      leadStage: 'buyer',
    };
    if (adminDb) {
      await adminDb.collection('customers').doc(customerId).set(customerPayload, { merge: true }).catch(() => {});
    } else if (db) {
      await setDoc(doc(db, 'customers', customerId), customerPayload, { merge: true }).catch(() => {});
    }
  }

  const autoBook = featureOn(business.data?.features, 'autoCourierBookingEnabled')
    && business.data?.courierConfig?.autoBooking !== false
    && business.data?.courierConfig?.steadfastApiKey;
  if (autoBook) {
    const booked = await bookSteadfastParcel(order, { ...business.data, id: business.id });
    if (booked.success) {
      const courierUpdates = {
        courierStatus: 'in_review',
        courierTrackingId: booked.trackingCode,
        courierConsignmentId: booked.consignmentId || '',
        status: 'shipped',
      };
      if (adminDb) {
        await adminDb.collection('orders').doc(order.id).update(courierUpdates).catch(() => {});
      } else if (db) {
        await updateDoc(doc(db, 'orders', order.id), courierUpdates).catch(() => {});
      }
      order.courierTrackingId = booked.trackingCode;
      order.status = 'shipped';
    }
  }

  return sendJson(res, 201, { order: sanitizePublicOrder(order) });
}

async function handleTrack(res: any, businessId: string, phoneRaw: string, orderId: string) {
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return sendJson(res, 400, { error: 'Invalid business ID' });
  }
  const phone = normalizePhone(phoneRaw);
  if (phone.length !== 11) {
    return sendJson(res, 400, { error: 'সঠিক মোবাইল নম্বর দিন' });
  }
  const business = await loadBusinessBySlugOrId(businessId);
  if (!business || business.data?.status === 'suspended') {
    return sendJson(res, 404, { error: 'Store not found' });
  }
  const rows = await queryOrdersByField(business.id, 'phone', phone);
  const filtered = rows
    .filter((row: any) => !orderId || String(row.id) === orderId || String(row.id).toLowerCase() === orderId.toLowerCase())
    .sort((a: any, b: any) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    .slice(0, 10)
    .map((row: any) => sanitizePublicOrder({ ...row, id: row.id }));
  return sendJson(res, 200, { orders: filtered });
}

export default async function handler(req: any, res: any) {
  const parsed = parseShopRequest(req);
  try {
    if (parsed.op === 'unknown') {
      return sendJson(res, 400, { error: 'Invalid shop request' });
    }
    if (parsed.op === 'slug') {
      if (parsed.method !== 'GET' && parsed.method !== 'HEAD') {
        res.setHeader?.('Allow', 'GET, HEAD');
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }
      if (bootError && !adminDb && !db) {
        return sendJson(res, 500, { ok: false, error: 'Shop API unavailable', detail: bootError });
      }
      return await handleSlugCheck(req, res, parsed);
    }
    if (parsed.op === 'get') {
      if (parsed.method !== 'GET' && parsed.method !== 'HEAD') {
        res.setHeader?.('Allow', 'GET, HEAD');
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }
      if (bootError && !adminDb && !db) {
        return sendJson(res, 500, { error: 'Store unavailable', detail: bootError });
      }
      return await handleShopGet(res, parsed.businessId);
    }
    if (parsed.op === 'checkout') {
      if (parsed.method !== 'POST') {
        res.setHeader?.('Allow', 'POST');
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }
      if (bootError && !adminDb && !db) {
        return sendJson(res, 500, { code: 'CHECKOUT_FAILED', error: 'অর্ডার সেভ করা যায়নি। আবার চেষ্টা করুন।', detail: bootError });
      }
      return await handleCheckout(req, res, parsed.businessId);
    }
    if (parsed.op === 'orders') {
      if (parsed.method !== 'GET' && parsed.method !== 'HEAD') {
        res.setHeader?.('Allow', 'GET, HEAD');
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }
      if (bootError && !adminDb && !db) {
        return sendJson(res, 500, { error: 'অর্ডার খোঁজা যায়নি', detail: bootError });
      }
      return await handleTrack(res, parsed.businessId, parsed.query.phone, parsed.query.orderId);
    }
    return sendJson(res, 404, { error: 'Not found' });
  } catch (error: any) {
    console.error('[shop]', error?.message || error);
    if (res.headersSent) return;
    if (parsed.op === 'checkout') {
      return sendJson(res, 500, { code: 'CHECKOUT_FAILED', error: 'অর্ডার সেভ করা যায়নি। আবার চেষ্টা করুন।' });
    }
    if (parsed.op === 'orders') {
      return sendJson(res, 500, { error: 'অর্ডার খোঁজা যায়নি' });
    }
    return sendJson(res, 500, { error: 'Store unavailable' });
  }
}
