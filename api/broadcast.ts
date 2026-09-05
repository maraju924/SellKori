/**
 * Isolated Messenger broadcast API.
 * Boots without the Express/Gemini monolith so /api/broadcast keeps working
 * even when api/index.ts fails to load on Vercel.
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
  addDoc,
  setDoc,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  BROADCAST_CONCURRENCY,
  mapPool,
  normalizeOutreachCustomer,
  personalizeOutreachMessage,
  planBroadcastRecipients,
} from '../src/lib/outreach.js';
import {
  broadcastFeaturesAllowed,
  clipBroadcastMessage,
  clipBroadcastTitle,
  normalizeBroadcastAudience,
  pageTokenForBusiness,
} from './broadcastCore.js';
import { parseBroadcastRequest, readJsonBody } from './broadcastRoute.js';

export const maxDuration = 60;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHAT_MEMORY_LIMIT = 100;

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
      console.error('[broadcast] Admin setup failed:', adminErr?.message || adminErr);
      adminDb = null;
    }
  }
} catch (error: any) {
  bootError = error?.message || 'firebase_init_failed';
  console.error('[broadcast] Firebase init failed:', bootError);
}

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const payload = JSON.stringify(body);
  if (typeof res.end === 'function') return res.end(payload);
  return res.send(payload);
}

function adminStores(): any[] {
  return adminDb ? [adminDb] : [];
}

function clientStores(): any[] {
  return db ? [db] : [];
}

async function loadBusinessById(businessId: string): Promise<{ id: string; data: any } | null> {
  if (!businessId) return null;
  for (const store of adminStores()) {
    try {
      const snap = await store.collection('businesses').doc(businessId).get();
      if (snap.exists) return { id: snap.id, data: snap.data() };
    } catch (err) {
      console.warn('[broadcast] loadBusinessById admin', err);
    }
  }
  for (const client of clientStores()) {
    try {
      const snap = await getDoc(doc(client, 'businesses', businessId));
      if (snap.exists()) return { id: snap.id, data: snap.data() };
    } catch (err) {
      console.warn('[broadcast] loadBusinessById client', err);
    }
  }
  return null;
}

async function loadBusinessCustomers(businessId: string): Promise<any[]> {
  for (const store of adminStores()) {
    try {
      const snap = await store.collection('customers').where('businessId', '==', businessId).limit(500).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[broadcast] loadBusinessCustomers admin', err);
    }
  }
  for (const client of clientStores()) {
    try {
      const snap = await getDocs(query(collection(client, 'customers'), where('businessId', '==', businessId), limit(500)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[broadcast] loadBusinessCustomers client', err);
    }
  }
  return [];
}

async function buildBroadcastPlan(businessId: string, audience: ReturnType<typeof normalizeBroadcastAudience>) {
  const rows = await loadBusinessCustomers(businessId);
  const customers = rows.map(normalizeOutreachCustomer);
  return {
    totalCustomers: customers.length,
    ...planBroadcastRecipients(customers, audience),
  };
}

function planPayload(audience: string, plan: Awaited<ReturnType<typeof buildBroadcastPlan>>) {
  return {
    audience,
    eligibleCount: plan.eligible.length,
    skippedOutsideWindow: plan.skippedOutsideWindow,
    skippedNoPsid: plan.skippedNoPsid,
    truncated: plan.truncated,
    totalCustomers: plan.totalCustomers,
  };
}

async function graphPost(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `Facebook HTTP ${res.status}`);
    err.response = { data };
    throw err;
  }
  return data;
}

async function sendBroadcastText(pageAccessToken: string, recipientId: string, text: string) {
  const message = String(text || '').trim().slice(0, 1900);
  const token = String(pageAccessToken || '').trim();
  const psid = String(recipientId || '').trim();
  if (!message || !token || !psid) return;
  const body = {
    recipient: { id: psid },
    messaging_type: 'UPDATE',
    message: { text: message },
  };
  const encoded = encodeURIComponent(token);
  try {
    await graphPost(`https://graph.facebook.com/v21.0/me/messages?access_token=${encoded}`, body);
  } catch {
    await graphPost(`https://graph.facebook.com/v18.0/me/messages?access_token=${encoded}`, body);
  }
}

async function saveChatMessage(bizId: string, senderId: string, text: string) {
  const logBase = { businessId: bizId, senderId, role: 'merchant', text };
  const newMsg = { role: 'merchant', text, timestamp: new Date().toISOString() };
  try {
    if (adminDb) {
      const ts = admin.firestore.FieldValue.serverTimestamp();
      await adminDb.collection('chat_history').add({ ...logBase, timestamp: ts });
      const chatRef = adminDb.collection('chats').doc(`${bizId}_${senderId}`);
      const existing = await chatRef.get();
      const prev = existing.exists && Array.isArray(existing.data()?.messages) ? existing.data().messages : [];
      await chatRef.set({
        businessId: bizId,
        senderId,
        lastMessage: text.substring(0, 200),
        timestamp: ts,
        messages: [...prev, newMsg].slice(-CHAT_MEMORY_LIMIT),
      }, { merge: true });
      return;
    }
    if (db) {
      await addDoc(collection(db, 'chat_history'), { ...logBase, timestamp: serverTimestamp() });
      const chatRef = doc(db, 'chats', `${bizId}_${senderId}`);
      const existing = await getDoc(chatRef);
      const prev = existing.exists() && Array.isArray(existing.data()?.messages) ? existing.data()!.messages : [];
      await setDoc(chatRef, {
        businessId: bizId,
        senderId,
        lastMessage: text.substring(0, 200),
        timestamp: serverTimestamp(),
        messages: [...prev, newMsg].slice(-CHAT_MEMORY_LIMIT),
      }, { merge: true });
    }
  } catch (err) {
    console.warn('[broadcast] saveChatMessage', err);
  }
}

async function logActivity(bizId: string, detail: string, status: 'info' | 'success', ownerId?: string) {
  const logBase = {
    businessId: bizId || 'unknown',
    ownerId: ownerId || 'system',
    type: 'BROADCAST_SENT',
    detail,
    status,
    data: null,
  };
  try {
    if (adminDb) {
      await adminDb.collection('system_logs').add({
        ...logBase,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }
    if (db) {
      await addDoc(collection(db, 'system_logs'), { ...logBase, timestamp: serverTimestamp() });
    }
  } catch (err) {
    console.warn('[broadcast] logActivity', err);
  }
}

async function persistCampaign(campaignId: string, payload: Record<string, unknown>, merge = false) {
  try {
    if (adminDb) {
      await adminDb.collection('broadcasts').doc(campaignId).set(payload, { merge });
      return;
    }
    if (db) {
      await setDoc(doc(db, 'broadcasts', campaignId), payload, { merge });
    }
  } catch (err) {
    console.warn('[broadcast] persistCampaign', err);
  }
}

async function handlePreview(req: any, res: any) {
  const body = readJsonBody(req);
  const businessId = String(body.businessId || '').trim();
  const audience = normalizeBroadcastAudience(body.targetAudience || body.segment);
  if (!businessId) {
    return sendJson(res, 400, { success: false, error: 'businessId প্রয়োজন' });
  }
  const loaded = await loadBusinessById(businessId);
  if (!loaded) return sendJson(res, 404, { success: false, error: 'স্টোর পাওয়া যায়নি' });
  if (!broadcastFeaturesAllowed(loaded.data?.features)) {
    return sendJson(res, 403, { success: false, error: 'ব্রডকাস্টিং সুইচবোর্ডে বন্ধ আছে' });
  }
  const plan = await buildBroadcastPlan(businessId, audience);
  return sendJson(res, 200, { success: true, ...planPayload(audience, plan) });
}

async function handleSend(req: any, res: any) {
  const body = readJsonBody(req);
  const businessId = String(body.businessId || '').trim();
  const title = clipBroadcastTitle(body.title);
  const message = clipBroadcastMessage(body.message);
  const audience = normalizeBroadcastAudience(body.targetAudience || body.segment);
  const dryRun = body.dryRun === true;
  const ownerId = body.ownerId;

  if (!businessId || !message) {
    return sendJson(res, 400, { success: false, error: 'ক্যাম্পেইন মেসেজ ও স্টোর আইডি দিন' });
  }
  if (!adminDb && !db) {
    return sendJson(res, 500, { success: false, error: 'Firestore not initialized' });
  }

  const loaded = await loadBusinessById(businessId);
  if (!loaded) return sendJson(res, 404, { success: false, error: 'স্টোর পাওয়া যায়নি' });
  const businessData = loaded.data;
  if (!broadcastFeaturesAllowed(businessData?.features)) {
    return sendJson(res, 403, { success: false, error: 'ব্রডকাস্টিং সুইচবোর্ডে বন্ধ আছে' });
  }

  const pageAccessToken = String(
    pageTokenForBusiness(businessData) || body.pageAccessToken || ''
  ).trim();
  if (!pageAccessToken && !dryRun) {
    return sendJson(res, 400, { success: false, error: 'পেজ অ্যাক্সেস টোকেন নেই। মেসেঞ্জার সেটাপে টোকেন দিন।' });
  }

  const plan = await buildBroadcastPlan(businessId, audience);
  if (dryRun) {
    return sendJson(res, 200, { success: true, dryRun: true, ...planPayload(audience, plan) });
  }

  const campaignId = `bc-${Date.now()}`;
  await persistCampaign(campaignId, {
    id: campaignId,
    businessId,
    title,
    message,
    targetAudience: audience,
    status: 'sending',
    eligibleCount: plan.eligible.length,
    skippedCount: plan.skippedOutsideWindow + plan.skippedNoPsid,
    sentCount: 0,
    failedCount: 0,
    truncated: plan.truncated,
    createdAtMs: Date.now(),
    createdAt: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
  });

  const results = await mapPool(plan.eligible, BROADCAST_CONCURRENCY, async (customer) => {
    const psid = String(customer.messengerId || '');
    const text = personalizeOutreachMessage(message, {
      name: customer.name,
      shop: businessData.name,
    });
    try {
      const perPageToken = pageTokenForBusiness(businessData, customer.pageId) || pageAccessToken;
      await sendBroadcastText(perPageToken, psid, text);
      await saveChatMessage(businessId, psid, `[BROADCAST] ${text}`);
      return { ok: true as const, psid };
    } catch (err: any) {
      const fbError = err.response?.data?.error;
      return { ok: false as const, psid, error: fbError?.message || err.message || 'send failed' };
    }
  });

  const sentCount = results.filter((r) => r.ok).length;
  const failedCount = results.filter((r) => !r.ok).length;
  const failedSample = results.filter((r) => !r.ok).slice(0, 5).map((r) => r.error);

  await persistCampaign(campaignId, {
    status: 'completed',
    sentCount,
    failedCount,
    finishedAtMs: Date.now(),
  }, true);

  await logActivity(
    businessId,
    `${sentCount} জনের ইনবক্সে ব্রডকাস্ট গেছে (${failedCount} ব্যর্থ, ${plan.skippedOutsideWindow} জন ২৪ ঘণ্টার বাইরে)।`,
    sentCount > 0 ? 'success' : 'info',
    ownerId || businessData.ownerId
  );

  return sendJson(res, 200, {
    success: true,
    campaignId,
    sentCount,
    failedCount,
    failedSample,
    ...planPayload(audience, plan),
  });
}

export default async function handler(req: any, res: any) {
  const parsed = parseBroadcastRequest(req);
  try {
    if (parsed.op === 'unknown') {
      return sendJson(res, 404, { success: false, error: 'ব্রডকাস্ট রুট পাওয়া যায়নি' });
    }
    if (parsed.method !== 'POST') {
      res.setHeader?.('Allow', 'POST');
      return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
    }
    if (bootError && !adminDb && !db) {
      return sendJson(res, 500, { success: false, error: 'Broadcast API unavailable', detail: bootError });
    }
    if (parsed.op === 'preview') return await handlePreview(req, res);
    return await handleSend(req, res);
  } catch (error: any) {
    console.error('[broadcast]', error?.message || error);
    if (res.headersSent) return;
    return sendJson(res, 500, {
      success: false,
      error: error?.message || 'ব্রডকাস্ট ব্যর্থ হয়েছে',
    });
  }
}
