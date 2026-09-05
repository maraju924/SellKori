import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs, orderBy, limit, Timestamp, increment } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  buildMessengerCapiPayload,
  capiEventsUrl,
  canonicalizeCapiEvent,
  isCapiHttpSuccess,
  isRetryableCapiError,
  looksLikeMessengerPsid,
  nationalPhoneDigits,
  pickMessengerCapiMatch,
  readCapiCredentials,
  resolveMessengerFunnelEvent,
  utcDay,
} from './capi.js';
import {
  buildFeaturePromptBlock,
  isFeatureEnabled,
  isQuietHoursNow,
  mergeFeatures,
  shouldRunAi
} from '../src/lib/featureFlags.js';
import { buildSalesFallbackReply } from '../src/lib/messengerFallback.js';
import {
  DEFAULT_COMMENT_INBOX_MESSAGE,
  DEFAULT_COMMENT_PUBLIC_REPLY,
  extractFeedCommentEvents,
  findMentionedProductName,
  parseCommentKeywords,
  personalizeOutreachMessage,
  shouldPrivateReplyToComment
} from '../src/lib/outreach.js';
import broadcastHandler from './broadcast.js';
import { parseFirebaseServiceAccount } from '../src/lib/aiPool.js';
import {
  isReservedShopSlug,
  isValidShopSlug,
  matchRequestedShopSlug,
  nextShopSlugCandidate,
  normalizeShopSlug,
  publicShopSlug,
  suggestedShopSlug,
} from './shopSlug.js';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal internal types to avoid cross-dir import issues in Vercel
interface BusinessConfig {
  messengerVerifyToken?: string;
  verifyToken?: string;
  [key: string]: any;
}

function initializeAdminApp(projectId: string) {
  if (admin.apps.length > 0) return admin.app();
  const serviceAccount = parseFirebaseServiceAccount(
    process.env.FIREBASE_SERVICE_ACCOUNT
    || process.env.FIREBASE_ADMIN_CREDENTIALS
    || process.env.GOOGLE_SERVICE_ACCOUNT
  );
  if (serviceAccount) {
    console.log('[Firebase] Initializing Admin SDK with service account');
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
  }
  console.log(`[Firebase] Initializing Admin SDK for Project: ${projectId}`);
  return admin.initializeApp({ projectId });
}

// Load firebase config for server-side use
let db: any;
let defaultClientDb: any;
let firebaseApp: any;
let adminDb: any;
let defaultAdminDb: any;

function clientFirestoreDbs(): any[] {
  return db ? [db] : [];
}

function adminFirestoreDbs(): any[] {
  return adminDb ? [adminDb] : [];
}

function attachDefaultStores(firebaseAppInstance: any, adminApp: any, dbId: string | undefined) {
  defaultClientDb = getFirestore(firebaseAppInstance);
  if (dbId && dbId !== '(default)' && adminApp) {
    try {
      defaultAdminDb = getAdminFirestore(adminApp);
    } catch (err) {
      console.warn('[Firebase] Could not open (default) Admin Firestore:', err);
      defaultAdminDb = null;
    }
  } else {
    defaultAdminDb = adminDb;
  }
}

try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
      : getFirestore(firebaseApp);
    defaultClientDb = getFirestore(firebaseApp);
    
    // Initialize Admin SDK
    try {
      const adminApp = initializeAdminApp(firebaseConfig.projectId);
      const dbId = firebaseConfig.firestoreDatabaseId;
      
      // Try to get Admin Firestore for the specific database ID
      adminDb = getAdminFirestore(adminApp, dbId && dbId !== '(default)' ? dbId : undefined);
      attachDefaultStores(firebaseApp, adminApp, dbId);
      
      // Verification test — IMPORTANT: this must NOT block module load with a
      // top-level `await`. On a Vercel serverless cold start, the exported
      // `app` isn't usable by the runtime until this whole module finishes
      // evaluating; a slow/hanging Firestore call here delayed (or, under
      // Vercel's execution time limit, sometimes killed) the very first
      // request after any idle period — which matches "refresh and it
      // sometimes works" behavior. We fire the check in the background
      // instead and self-correct adminDb once it resolves.
      adminDb.collection('businesses').limit(1).get()
        .then(() => {
          console.log(`[Firebase] Admin SDK Verified on Database: ${dbId || '(default)'}`);
        })
        .catch((testErr: any) => {
          // Do NOT switch to a different Firestore database. The web panels
          // read the configured named DB; writing here to "(default)" made
          // admin/merchant screens look empty even though data existed.
          console.warn(
            `[Firebase] Admin SDK check failed on "${dbId || '(default)'}": ${testErr?.message || testErr}. Keeping this database; client SDK will be used if Admin writes fail.`,
          );
        });
    } catch (adminErr: any) {
      console.error('[Firebase] Admin Setup Error:', adminErr?.message);
      adminDb = null;
    }
    
    logActivity('system', 'SERVER_INIT', `সার্ভার রিস্টার্ট হয়েছে। ভার্সন: 1.1.0.`, 'success', 'system').catch(() => {});
  } else {
    // Fallback search for config in current dir
    const altPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(altPath)) {
       const firebaseConfig = JSON.parse(fs.readFileSync(altPath, 'utf8'));
       firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
       db = firebaseConfig.firestoreDatabaseId 
         ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
         : getFirestore(firebaseApp);
       defaultClientDb = getFirestore(firebaseApp);

    // Initialize Admin SDK (fallback)
    try {
      const adminApp = initializeAdminApp(firebaseConfig.projectId);
      const dbId = firebaseConfig.firestoreDatabaseId;
      
      if (dbId && dbId !== '(default)') {
        adminDb = getAdminFirestore(adminApp, dbId);
      } else {
        adminDb = getAdminFirestore(adminApp);
      }
      attachDefaultStores(firebaseApp, adminApp, dbId);
      console.log(`[Firebase] Admin Firestore ready (fallback)`);
    } catch (e) {
      console.error('[Firebase] Fallback Admin Error:', e);
    }
     
     logActivity('system', 'SERVER_INIT', `সার্ভার (ফালব্যাক) রিস্টার্ট হয়েছে।`, 'info', 'system');
    }
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleGenAI, Type } from '@google/genai';
import {
  DUPLICATE_ORDER_WINDOW_MS,
  extractBdPhone,
  isRecentIdentityDuplicate,
  normalizeClientIp,
  normalizePhone,
  trustedClientIp,
} from '../src/lib/orderIdentity.js';
import { getAIResponse as generateChatResponse } from '../src/lib/gemini.js';
import {
  CHAT_MEMORY_LIMIT,
  shouldCreateConfirmedOrder,
} from '../src/lib/chatRuntime.js';
import {
  buildMerchantCustomInstructionBlock,
  buildReplyStyleBlock,
  pickFacebookProfileName,
  resolveOrderCustomerName,
} from '../src/lib/merchantPrompt.js';
import {
  MAX_PRODUCT_PHOTOS,
  MAX_REVIEW_PHOTOS,
  normalizeImageLink,
  pickProductForImages,
  resolveImageSendFlags,
  uniqueHttpUrls,
} from '../src/lib/imageSend.js';
import {
  aiPoolHasProvider,
  firstEnabledGeminiKey,
  geminiFailoverCandidates,
  parseAiPoolFromSettings,
  resolveSystemGeminiModel,
  type AiPool,
  type PooledGeminiKey,
} from '../src/lib/aiPool.js';

// Initialize AI
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Response Schema for AI
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: {
      type: SchemaType.STRING,
      description: "Intent of the user message: product_query, order, delivery_status, general, unknown",
    },
    show_product_image: {
      type: SchemaType.BOOLEAN,
      description: "Set to true if user asks for pictures.",
    },
    product_name: {
      type: SchemaType.STRING,
      description: "Identified product name if any",
    },
    reply: {
      type: SchemaType.STRING,
      description: "The reply in Bengali language (concise, 1 to 3 sentences maximum)",
    },
    summary: {
      type: SchemaType.STRING,
      description: "Cumulative summary of the conversation",
    },
    order_data: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
        address: { type: SchemaType.STRING },
        quantity: { type: SchemaType.STRING },
        product_name: { type: SchemaType.STRING },
        unit_price: { type: SchemaType.NUMBER },
        has_full_order: { type: SchemaType.BOOLEAN }
      },
    },
    conversation_stage: {
      type: SchemaType.STRING,
      description: "Stage: new_lead, interested, checkout_started, order_completed",
    },
    event_name: {
      type: SchemaType.STRING,
      description: "Facebook Event: Lead, ViewContent, InitiateCheckout, AddToCart, Purchase",
    },
    confidence: {
      type: SchemaType.NUMBER,
    },
  },
  required: ["intent", "reply", "conversation_stage", "event_name", "summary"],
};

// Meta Webhook Message Deduplication Cache (Idempotency Engine)
interface ProcessedMessageState {
  startedAt: number;
  completedAt?: number;
}

const processedMessagesCache = new Map<string, ProcessedMessageState>();
const MESSAGE_PROCESSING_STALE_MS = 15 * 1000;
const MESSAGE_DEDUP_TTL_MS = 10 * 60 * 1000;

function isDuplicateMessage(mid: string): boolean {
  if (!mid) return false;
  const now = Date.now();
  if (processedMessagesCache.size > 2000) {
    for (const [key, state] of processedMessagesCache.entries()) {
      const timestamp = state.completedAt || state.startedAt;
      const ttl = state.completedAt ? MESSAGE_DEDUP_TTL_MS : MESSAGE_PROCESSING_STALE_MS;
      if (now - timestamp > ttl) {
        processedMessagesCache.delete(key);
      }
    }
  }
  const existing = processedMessagesCache.get(mid);
  if (
    existing
    && (
      (existing.completedAt !== undefined && now - existing.completedAt <= MESSAGE_DEDUP_TTL_MS)
      || (existing.completedAt === undefined && now - existing.startedAt <= MESSAGE_PROCESSING_STALE_MS)
    )
  ) {
    console.log(`[Webhook Deduplication] Skipping duplicate message ID: ${mid}`);
    return true;
  }
  processedMessagesCache.set(mid, { startedAt: now });
  return false;
}

function markMessageProcessed(mid: string) {
  if (!mid) return;
  const now = Date.now();
  processedMessagesCache.set(mid, {
    startedAt: processedMessagesCache.get(mid)?.startedAt || now,
    completedAt: now
  });
}

function releaseMessageForRetry(mid: string) {
  if (!mid) return;
  const state = processedMessagesCache.get(mid);
  if (state && !state.completedAt) processedMessagesCache.delete(mid);
}

// Send a product image to Messenger as an image attachment
async function sendImageMessage(pageAccessToken: string, senderId: string, imageUrl: string): Promise<boolean> {
  const cleanToken = String(pageAccessToken).trim();
  const payload = {
    recipient: { id: senderId },
    messaging_type: 'RESPONSE',
    message: {
      attachment: {
        type: 'image',
        payload: { url: imageUrl, is_reusable: true }
      }
    }
  };
  try {
    await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, payload, { timeout: 15000 });
    return true;
  } catch (err: any) {
    console.warn('[Webhook] v21.0 image send failed, trying v18.0 fallback...', err.response?.data || err.message);
    try {
      await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, payload, { timeout: 15000 });
      return true;
    } catch (fallbackErr: any) {
      console.warn('[Webhook] image send failed:', fallbackErr.response?.data || fallbackErr.message);
      return false;
    }
  }
}

async function briefTypingPause(pageAccessToken: string, senderId: string, ms = 320) {
  await sendTypingOn(pageAccessToken, senderId);
  await new Promise((resolve) => setTimeout(resolve, Math.max(120, ms)));
}

type IncomingMediaKind = 'image' | 'audio' | 'video' | 'file' | 'sticker';
interface IncomingMedia {
  kind: IncomingMediaKind;
  url: string;
}
interface DownloadedMedia {
  kind: 'image' | 'audio';
  mimeType: string;
  data: string;
}

const MAX_MEDIA_BYTES = 6 * 1024 * 1024;
const MEDIA_KIND_BN: Record<IncomingMediaKind, string> = {
  image: 'ছবি',
  audio: 'ভয়েস মেসেজ',
  video: 'ভিডিও',
  file: 'ফাইল',
  sticker: 'স্টিকার',
};

function extractMessengerAttachments(webhookEvent: any): IncomingMedia[] {
  const attachments = webhookEvent?.message?.attachments;
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  const media: IncomingMedia[] = [];
  for (const att of attachments) {
    const type = String(att?.type || '').toLowerCase();
    const url = String(att?.payload?.url || '').trim();
    if (!url) continue;
    if (att?.payload?.sticker_id) {
      media.push({ kind: 'sticker', url });
      continue;
    }
    if (type === 'image' || type === 'audio' || type === 'video' || type === 'file') {
      media.push({ kind: type, url });
    }
  }
  return media;
}

function mediaPlaceholderText(media: IncomingMedia[], caption?: string): string {
  const labels = [...new Set(media.map((m) => MEDIA_KIND_BN[m.kind] || 'মিডিয়া'))];
  const note = labels.length === 1
    ? `[কাস্টমার একটি ${labels[0]} পাঠিয়েছেন]`
    : `[কাস্টমার ${labels.join(' ও ')} পাঠিয়েছেন]`;
  const trimmed = (caption || '').trim();
  return trimmed ? `${trimmed}\n${note}` : note;
}

function normalizeGeminiMime(kind: 'image' | 'audio', headerMime: string): string {
  const m = (headerMime || '').toLowerCase().split(';')[0].trim();
  if (kind === 'image') {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'].includes(m)) return m;
    return 'image/jpeg';
  }
  if (m === 'audio/mp3' || m === 'audio/mpeg') return 'audio/mpeg';
  if (m === 'audio/x-m4a' || m === 'audio/m4a' || m === 'audio/mp4' || m === 'audio/aac') return 'audio/mp4';
  if (['audio/wav', 'audio/ogg', 'audio/flac', 'audio/webm'].includes(m)) return m;
  return 'audio/mpeg';
}

async function downloadFacebookMedia(
  url: string,
  pageAccessToken?: string
): Promise<{ data: string; mimeType: string } | null> {
  const tryGet = async (targetUrl: string) => axios.get(targetUrl, {
    responseType: 'arraybuffer',
    timeout: 12000,
    maxContentLength: MAX_MEDIA_BYTES,
    maxBodyLength: MAX_MEDIA_BYTES,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'SellKoriBot/1.0',
      ...(pageAccessToken ? { Authorization: `Bearer ${pageAccessToken}` } : {})
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  try {
    let res;
    try {
      res = await tryGet(url);
    } catch (firstErr: any) {
      if (pageAccessToken && !url.includes('access_token=')) {
        const joiner = url.includes('?') ? '&' : '?';
        res = await tryGet(`${url}${joiner}access_token=${encodeURIComponent(pageAccessToken)}`);
      } else {
        throw firstErr;
      }
    }
    const buf = Buffer.from(res.data);
    if (buf.length < 24) return null;
    const headerMime = String(res.headers['content-type'] || '').split(';')[0].trim();
    return { data: buf.toString('base64'), mimeType: headerMime || 'application/octet-stream' };
  } catch (err: any) {
    console.warn('[Webhook] Media download failed:', err.response?.status || err.message);
    return null;
  }
}

async function downloadIncomingMedia(
  media: IncomingMedia[],
  pageAccessToken?: string
): Promise<DownloadedMedia[]> {
  const downloaded: DownloadedMedia[] = [];
  let imagesTaken = 0;
  let audioTaken = 0;

  for (const item of media) {
    if (item.kind !== 'image' && item.kind !== 'audio') continue;
    if (item.kind === 'image' && imagesTaken >= 3) continue;
    if (item.kind === 'audio' && audioTaken >= 1) continue;

    const file = await downloadFacebookMedia(item.url, pageAccessToken);
    if (!file) continue;

    downloaded.push({
      kind: item.kind,
      mimeType: normalizeGeminiMime(item.kind, file.mimeType),
      data: file.data
    });
    if (item.kind === 'image') imagesTaken += 1;
    else audioTaken += 1;
  }
  return downloaded;
}

async function sendTypingOn(pageAccessToken: string, senderId: string) {
  const cleanToken = String(pageAccessToken).trim();
  try {
    await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, {
      recipient: { id: senderId },
      sender_action: 'typing_on'
    }, { timeout: 5000 });
  } catch (_) {}
}

// Keep the typing bubble visible a bit longer for very fast AI replies so
// responses feel hand-typed rather than instant.
async function humanTypingPause(pageAccessToken: string, senderId: string, replyText: string, alreadyElapsedMs: number) {
  // Never spend several seconds of a webhook's delivery budget on cosmetic
  // delay; reliability and a prompt answer are more important.
  const targetMs = Math.min(1200, 500 + String(replyText || '').length * 5);
  const remaining = targetMs - Math.max(0, alreadyElapsedMs);
  if (remaining < 250) return;
  await sendTypingOn(pageAccessToken, senderId);
  await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function sendPlainText(pageAccessToken: string, senderId: string, text: string) {
  const cleanToken = String(pageAccessToken).trim();
  const body = {
    recipient: { id: senderId },
    messaging_type: 'RESPONSE',
    message: { text: String(text || '').trim().slice(0, 1900) }
  };
  if (!body.message.text) return;
  try {
    await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, body, { timeout: 15000 });
  } catch (_) {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, body, { timeout: 15000 });
  }
}

async function sendMessengerPayload(pageAccessToken: string, payload: Record<string, unknown>) {
  const cleanToken = String(pageAccessToken).trim();
  try {
    return await axios.post(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`,
      payload,
      { timeout: 15000 }
    );
  } catch (err: any) {
    return await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`,
      payload,
      { timeout: 15000 }
    );
  }
}

async function sendCommentPrivateReply(pageAccessToken: string, commentId: string, text: string) {
  const message = String(text || '').trim().slice(0, 1900);
  if (!message || !commentId) return;
  try {
    await sendMessengerPayload(pageAccessToken, {
      recipient: { comment_id: commentId },
      message: { text: message }
    });
    return;
  } catch (_) {}
  const cleanToken = String(pageAccessToken).trim();
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/private_replies?access_token=${encodeURIComponent(cleanToken)}`,
      { message },
      { timeout: 15000 }
    );
  } catch (_) {
    await axios.post(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(commentId)}/private_replies?access_token=${encodeURIComponent(cleanToken)}`,
      { message },
      { timeout: 15000 }
    );
  }
}

async function sendCommentPublicReply(pageAccessToken: string, commentId: string, text: string) {
  const message = String(text || '').trim().slice(0, 500);
  if (!message || !commentId) return;
  const cleanToken = String(pageAccessToken).trim();
  await axios.post(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/comments?access_token=${encodeURIComponent(cleanToken)}`,
    { message },
    { timeout: 15000 }
  );
}

async function fetchMessengerProfileName(pageAccessToken: string, psid: string): Promise<string> {
  const token = String(pageAccessToken || '').trim();
  const id = String(psid || '').trim();
  if (!token || !id) return '';
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/${encodeURIComponent(id)}`, {
      params: { fields: 'name,first_name,last_name', access_token: token },
      timeout: 4000,
    });
    return pickFacebookProfileName(res.data);
  } catch (err: any) {
    console.warn('[Webhook] Facebook profile name fetch failed:', err?.response?.data?.error?.message || err?.message || err);
    return '';
  }
}

async function touchMessengerCustomer(bizId: string, messengerId: string, extra: Record<string, unknown> = {}) {
  const psid = String(messengerId || '').trim();
  if (!bizId || !psid) return;
  const payload: Record<string, unknown> = {
    businessId: bizId,
    messengerId: psid,
    passengerId: psid,
    lastIncomingAtMs: Date.now(),
    lastInteraction: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
    updatedAt: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
    ...extra
  };
  try {
    if (adminDb) {
      await adminDb.collection('customers').doc(`${bizId}_${psid}`).set(payload, { merge: true });
      return;
    }
    if (db) {
      await setDoc(doc(db, 'customers', `${bizId}_${psid}`), payload, { merge: true });
    }
  } catch (err) {
    console.warn('[touchMessengerCustomer]', err);
  }
}

async function loadBusinessCustomers(businessId: string): Promise<any[]> {
  if (adminDb) {
    const snap = await adminDb.collection('customers').where('businessId', '==', businessId).limit(500).get();
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  }
  if (db) {
    const snap = await getDocs(query(collection(db, 'customers'), where('businessId', '==', businessId), limit(500)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return [];
}

async function loadBusinessById(businessId: string): Promise<{ id: string; data: any } | null> {
  if (!businessId) return null;
  for (const store of adminFirestoreDbs()) {
    try {
      const snap = await store.collection('businesses').doc(businessId).get();
      if (snap.exists) return { id: snap.id, data: snap.data() };
    } catch (err) {
      console.warn('[loadBusinessById] admin', err);
    }
  }
  for (const client of clientFirestoreDbs()) {
    try {
      const snap = await getDoc(doc(client, 'businesses', businessId));
      if (snap.exists()) return { id: snap.id, data: snap.data() };
    } catch (err) {
      console.warn('[loadBusinessById] client', err);
    }
  }
  return null;
}

async function queryBusinessBySlug(slug: string): Promise<{ id: string; data: any } | null> {
  const clean = normalizeShopSlug(slug);
  if (!clean) return null;
  for (const store of adminFirestoreDbs()) {
    try {
      const snap = await store.collection('businesses').where('slug', '==', clean).limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    } catch (err) {
      console.warn('[queryBusinessBySlug] admin', err);
    }
  }
  for (const client of clientFirestoreDbs()) {
    try {
      const snap = await getDocs(query(collection(client, 'businesses'), where('slug', '==', clean), limit(1)));
      if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    } catch (err) {
      console.warn('[queryBusinessBySlug] client', err);
    }
  }
  return null;
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
    const stores = adminFirestoreDbs();
    if (stores.length > 0) {
      await Promise.all(stores.map((store) => store.collection('businesses').doc(business.id).set({ slug }, { merge: true }).catch(() => {})));
    } else {
      await Promise.all(clientFirestoreDbs().map((client) => setDoc(doc(client, 'businesses', business.id), { slug }, { merge: true }).catch(() => {})));
    }
    business.data = { ...business.data, slug };
  } catch (err) {
    console.warn('[persistBusinessSlug]', err);
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

async function listBusinessDocs(max = 400): Promise<Array<{ id: string; data: any }>> {
  const merged = new Map<string, { id: string; data: any }>();
  for (const store of adminFirestoreDbs()) {
    try {
      const snap = await store.collection('businesses').limit(max).get();
      for (const d of snap.docs) {
        if (!merged.has(d.id)) merged.set(d.id, { id: d.id, data: d.data() });
      }
    } catch (err) {
      console.warn('[listBusinessDocs] admin', err);
    }
  }
  if (merged.size === 0) {
    for (const client of clientFirestoreDbs()) {
      try {
        const snap = await getDocs(query(collection(client, 'businesses'), limit(max)));
        for (const d of snap.docs) {
          if (!merged.has(d.id)) merged.set(d.id, { id: d.id, data: d.data() });
        }
      } catch (err) {
        console.warn('[listBusinessDocs] client', err);
      }
    }
  }
  return Array.from(merged.values());
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

async function findBusinessByVerifyToken(token: string): Promise<{ id: string; data: any } | null> {
  const clean = String(token || '').trim();
  if (!clean) return null;
  try {
    if (adminDb) {
      let snap = await adminDb.collection('businesses').where('messengerVerifyToken', '==', clean).limit(1).get();
      if (snap.empty) snap = await adminDb.collection('businesses').where('verifyToken', '==', clean).limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    }
    if (db) {
      let snap = await getDocs(query(collection(db, 'businesses'), where('messengerVerifyToken', '==', clean), limit(1)));
      if (snap.empty) snap = await getDocs(query(collection(db, 'businesses'), where('verifyToken', '==', clean), limit(1)));
      if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
    }
  } catch (err) {
    console.warn('[findBusinessByVerifyToken]', err);
  }
  return null;
}

async function subscribePageToMessenger(pageAccessToken: string) {
  const cleanToken = String(pageAccessToken || '').trim();
  const fields = PAGE_SUBSCRIBE_FIELDS.join(',');
  const pageRes = await axios.get('https://graph.facebook.com/v21.0/me', {
    params: { fields: 'id,name,category,link', access_token: cleanToken },
    timeout: 15000
  });

  const pageId = String(pageRes.data?.id || '').trim();
  let subscribed = false;
  let subscribeError = '';
  const attempts: Array<() => Promise<unknown>> = [
    () => axios.post(
      'https://graph.facebook.com/v21.0/me/subscribed_apps',
      { subscribed_fields: fields },
      { params: { access_token: cleanToken }, timeout: 15000 }
    ),
    () => axios.post(
      `https://graph.facebook.com/v21.0/me/subscribed_apps?access_token=${encodeURIComponent(cleanToken)}&subscribed_fields=${encodeURIComponent(fields)}`,
      {},
      { timeout: 15000 }
    )
  ];
  if (pageId) {
    attempts.push(() => axios.post(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/subscribed_apps`,
      { subscribed_fields: fields },
      { params: { access_token: cleanToken }, timeout: 15000 }
    ));
  }

  for (const attempt of attempts) {
    try {
      await attempt();
      subscribed = true;
      break;
    } catch (err: any) {
      subscribeError = err.response?.data?.error?.message || err.message || 'subscribe failed';
    }
  }

  let subscriptions: any = null;
  try {
    const subRes = await axios.get('https://graph.facebook.com/v21.0/me/subscribed_apps', {
      params: { access_token: cleanToken },
      timeout: 10000
    });
    subscriptions = subRes.data;
  } catch (_) {}

  // A page manually subscribed from the App Dashboard shows up here even when
  // POST /subscribed_apps is blocked (no pages_manage_metadata permission).
  if (!subscribed && Array.isArray(subscriptions?.data) && subscriptions.data.length > 0) {
    subscribed = true;
    subscribeError = '';
  }

  // Missing pages_manage_metadata is not a token problem: the bot can still
  // receive (after a one-time manual subscription) and send messages.
  const needsManualSubscribe = !subscribed && /pages_manage_metadata|\(#200\)|\(#10\)|permission/i.test(subscribeError);

  return {
    page: pageRes.data,
    subscribed,
    subscribeError: subscribed ? '' : subscribeError,
    subscriptions,
    needsManualSubscribe
  };
}

const MANUAL_SUBSCRIBE_HINT = 'টোকেন বৈধ! তবে টোকেনে pages_manage_metadata পারমিশন না থাকায় অটো-সাবস্ক্রাইব করা যায়নি। একবার ম্যানুয়ালি করে দিন: developers.facebook.com → আপনার অ্যাপ → Messenger → Messenger API Settings → Webhooks অংশে আপনার পেজের পাশে "Add subscriptions" চেপে messages ও messaging_postbacks টিক দিন। আগে থেকেই করা থাকলে কিছু করার দরকার নেই — বট এমনিতেই সম্পূর্ণ কাজ করবে (মেসেজ পাঠাতে এই পারমিশন লাগে না)।';

// ---------------------------------------------------------------------------
// Multi-page support: one merchant panel can run many Facebook pages.
// Pages live in business.messengerPages [{pageId, pageName, pageAccessToken,
// enabled}] with business.connectedPageIds kept in sync for fast lookups.
// Root-level token fields keep working as a legacy fallback.
// ---------------------------------------------------------------------------
function businessPagesOf(businessData: any): Array<{ pageId: string; pageName: string; pageAccessToken: string; enabled: boolean }> {
  const pages = Array.isArray(businessData?.messengerPages) ? businessData.messengerPages : [];
  return pages
    .map((p: any) => ({
      pageId: String(p?.pageId || '').trim(),
      pageName: String(p?.pageName || '').trim(),
      pageAccessToken: String(p?.pageAccessToken || '').trim(),
      enabled: p?.enabled !== false,
    }))
    .filter((p: any) => p.pageId && p.pageAccessToken);
}

function pageTokenForBusiness(businessData: any, pageId?: string): string {
  const pid = String(pageId || '').trim();
  const pages = businessPagesOf(businessData);
  if (pid) {
    const exact = pages.find((p) => p.enabled && p.pageId === pid);
    if (exact) return exact.pageAccessToken;
  }
  // facebookConfig.accessToken is the Pixel CAPI token — never a page token.
  const rootToken = String(
    businessData?.pageAccessToken || businessData?.accessToken || ''
  ).trim();
  if (rootToken) return rootToken;
  const firstEnabled = pages.find((p) => p.enabled);
  return firstEnabled?.pageAccessToken || '';
}

// ---------------------------------------------------------------------------
// Ad attribution: capture Messenger referral payloads (Click-to-Messenger
// ads, m.me/ref links, post CTAs) so the bot knows which ad brought the
// customer and which product to pitch first.
// ---------------------------------------------------------------------------
interface ReferralInfo {
  ref: string;
  source: string;
  type: string;
  adId: string;
  adTitle: string;
  postId: string;
  productId: string;
  ctwaClid: string;
}

function extractReferralInfo(webhookEvent: any): ReferralInfo | null {
  const r = webhookEvent?.referral || webhookEvent?.postback?.referral || webhookEvent?.optin?.referral || null;
  if (!r) return null;
  const ads = r.ads_context_data || {};
  const info: ReferralInfo = {
    ref: String(r.ref || '').trim(),
    source: String(r.source || '').trim(),
    type: String(r.type || '').trim(),
    adId: String(r.ad_id || ads.ad_id || '').trim(),
    adTitle: String(ads.ad_title || '').trim(),
    postId: String(ads.post_id || '').trim(),
    productId: String(ads.product_id || '').trim(),
    ctwaClid: String(r.ctwa_clid || '').trim(),
  };
  if (!info.ref && !info.adId && !info.adTitle && !info.postId && !info.productId && !info.ctwaClid) return null;
  return info;
}

// Merchant-defined mappings (business.adProductMappings: [{key, productName}])
// win first; then we fuzzy-match the ad title against the catalog.
function matchProductForReferral(businessData: any, referral: Partial<ReferralInfo> | null): string {
  if (!referral) return '';
  const keys = [referral.ref, referral.adId, referral.postId, referral.productId]
    .map((k) => String(k || '').trim().toLowerCase())
    .filter(Boolean);
  const mappings = Array.isArray(businessData?.adProductMappings) ? businessData.adProductMappings : [];
  for (const m of mappings) {
    const mk = String(m?.key || '').trim().toLowerCase();
    if (mk && keys.includes(mk)) return String(m.productName || '').trim();
  }
  const title = String(referral.adTitle || '').toLowerCase();
  if (title) {
    const products = Array.isArray(businessData?.products) ? businessData.products : [];
    const hit = products.find((p: any) => p?.name && title.includes(String(p.name).toLowerCase()));
    if (hit) return String(hit.name);
  }
  return '';
}

async function saveCustomerAcquisition(bizId: string, senderId: string, pageId: string, referral: ReferralInfo, matchedProduct: string) {
  const acquisition = {
    ref: referral.ref,
    source: referral.source || 'ADS',
    type: referral.type,
    adId: referral.adId,
    adTitle: referral.adTitle,
    postId: referral.postId,
    fbProductId: referral.productId,
    ctwaClid: referral.ctwaClid,
    matchedProduct: matchedProduct || '',
    lastAtMs: Date.now(),
  };
  const payload: any = {
    businessId: bizId,
    messengerId: senderId,
    pageId: pageId || '',
    acquisition,
    updatedAt: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
  };
  try {
    if (adminDb) {
      const ref = adminDb.collection('customers').doc(`${bizId}_${senderId}`);
      const snap = await ref.get();
      if (!snap.exists || !snap.data()?.acquisition?.firstAtMs) {
        (payload.acquisition as any).firstAtMs = Date.now();
      }
      await ref.set(payload, { merge: true });
      return;
    }
    if (db) {
      await setDoc(doc(db, 'customers', `${bizId}_${senderId}`), payload, { merge: true });
    }
  } catch (e: any) {
    console.warn('[Webhook] saveCustomerAcquisition notice:', e?.message);
  }
}

async function resolveBusinessForWebhook(cleanPageId: string, pathBizId?: string): Promise<{ businessData: any | null; bizId: string | null }> {
  let businessData: any = null;
  let bizId: string | null = pathBizId || null;

  if (pathBizId && pathBizId !== 'unknown' && pathBizId !== 'system') {
    const loaded = await loadBusinessById(pathBizId);
    if (loaded) return { businessData: loaded.data, bizId: loaded.id };
  }

  if (cleanPageId) {
    const possiblePageIds = [cleanPageId];
    if (!isNaN(Number(cleanPageId))) possiblePageIds.push(Number(cleanPageId) as any);

    if (adminDb) {
      try {
        for (const pid of possiblePageIds) {
          // Multi-page lookup first (connectedPageIds is kept in sync with messengerPages)
          let snap = await adminDb.collection('businesses').where('connectedPageIds', 'array-contains', pid).limit(1).get();
          if (snap.empty) snap = await adminDb.collection('businesses').where('facebookPageId', '==', pid).limit(1).get();
          if (snap.empty) snap = await adminDb.collection('businesses').where('pageId', '==', pid).limit(1).get();
          if (snap.empty) snap = await adminDb.collection('businesses').where('facebookConfig.pageId', '==', pid).limit(1).get();
          if (snap.empty) snap = await adminDb.collection('businesses').where('facebookConfig.facebookPageId', '==', pid).limit(1).get();
          if (!snap.empty) {
            return { businessData: snap.docs[0].data(), bizId: snap.docs[0].id };
          }
        }
      } catch (e: any) {
        console.warn('[Webhook] Admin Lookup Query Notice:', e.message);
      }
    }

    if (db) {
      try {
        for (const pid of possiblePageIds) {
          let snap = await getDocs(query(collection(db, 'businesses'), where('connectedPageIds', 'array-contains', pid), limit(1)));
          if (snap.empty) snap = await getDocs(query(collection(db, 'businesses'), where('facebookPageId', '==', pid), limit(1)));
          if (snap.empty) snap = await getDocs(query(collection(db, 'businesses'), where('pageId', '==', pid), limit(1)));
          if (!snap.empty) {
            return { businessData: snap.docs[0].data(), bizId: snap.docs[0].id };
          }
        }
      } catch (e: any) {
        console.warn('[Webhook] Client Lookup Query Notice:', e.message);
      }
    }
  }

  try {
    let allDocs: any[] = [];
    if (adminDb) {
      const allSnap = await adminDb.collection('businesses').limit(100).get();
      allDocs = allSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } else if (db) {
      const allSnap = await getDocs(query(collection(db, 'businesses'), limit(100)));
      allDocs = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const matched = allDocs.find((b: any) => {
      const multiIds = businessPagesOf(b).map((p) => p.pageId);
      if (multiIds.includes(cleanPageId)) return true;
      const bPageId = String(b.facebookPageId || b.pageId || b.facebookConfig?.pageId || b.facebookConfig?.facebookPageId || '').trim();
      return bPageId && (bPageId === cleanPageId || cleanPageId.includes(bPageId) || bPageId.includes(cleanPageId));
    });

    if (matched) return { businessData: matched, bizId: matched.id };
    if (allDocs.length === 1) return { businessData: allDocs[0], bizId: allDocs[0].id };
  } catch (scanErr) {
    console.error('[Webhook] In-memory scan error:', scanErr);
  }

  return { businessData, bizId };
}

async function handlePageFeedComments(entry: any, pathBizId?: string) {
  const events = extractFeedCommentEvents(entry);
  if (events.length === 0) return;

  const pageId = String(entry?.id || events[0].pageId || '').trim();
  const resolved = await resolveBusinessForWebhook(pageId, pathBizId);
  const businessData = resolved.businessData;
  const bizId = resolved.bizId;
  if (!businessData || !bizId) {
    console.warn(`[Webhook] Comment received but no business matched page ${pageId}`);
    return;
  }

  const features = mergeFeatures(businessData.features);
  if (!isFeatureEnabled(features, 'commentToInboxEnabled') || !isFeatureEnabled(features, 'messengerRepliesEnabled')) {
    await logActivity(bizId, 'COMMENT_SKIPPED', 'কমেন্ট-টু-ইনবক্স সুইচবোর্ডে বন্ধ।', 'info', businessData.ownerId);
    return;
  }

  const pageAccessToken = pageTokenForBusiness(businessData, pageId);
  if (!pageAccessToken) {
    await logActivity(bizId, 'ERROR', 'কমেন্ট-টু-ইনবক্স: পেজ অ্যাক্সেস টোকেন নেই।', 'error', businessData.ownerId);
    return;
  }

  const keywords = parseCommentKeywords(businessData.commentToInboxKeywords);
  const products = Array.isArray(businessData.products) ? businessData.products : [];

  for (const event of events) {
    const dedupKey = `comment:${event.commentId}`;
    if (isDuplicateMessage(dedupKey)) continue;
    if (!shouldPrivateReplyToComment(event, keywords)) {
      markMessageProcessed(dedupKey);
      continue;
    }

    const product = findMentionedProductName(event.message, products);
    const inboxText = personalizeOutreachMessage(
      businessData.commentInboxMessage || DEFAULT_COMMENT_INBOX_MESSAGE,
      { name: event.fromName, shop: businessData.name, product }
    );
    const publicText = String(businessData.commentPublicReply || DEFAULT_COMMENT_PUBLIC_REPLY).trim();

    try {
      await sendCommentPrivateReply(pageAccessToken, event.commentId, inboxText);
      await saveChatMessage(bizId, event.fromId || event.commentId, 'bot', `[COMMENT_INBOX] ${inboxText}`);
      await touchMessengerCustomer(bizId, event.fromId, {
        name: event.fromName || '',
        source: 'comment',
        lastCommentId: event.commentId,
        lastComment: event.message.slice(0, 200)
      });
      if (publicText) {
        try { await sendCommentPublicReply(pageAccessToken, event.commentId, publicText); } catch (pubErr: any) {
          console.warn('[Webhook] Public comment reply failed:', pubErr.response?.data || pubErr.message);
        }
      }
      await logActivity(
        bizId,
        'COMMENT_INBOX',
        `কমেন্ট-টু-ইনবক্স: "${event.message.substring(0, 60)}" → ${event.fromName || event.fromId}`,
        'success',
        businessData.ownerId,
        { commentId: event.commentId, postId: event.postId }
      );
      await saveMessengerLog(bizId, {
        senderId: event.fromId,
        pageId,
        message: event.message,
        reply: inboxText,
        status: 'replied',
        source: 'comment'
      });
      markMessageProcessed(dedupKey);
    } catch (err: any) {
      releaseMessageForRetry(dedupKey);
      const fbError = err.response?.data?.error;
      const errorMsg = fbError?.message || err.message || 'কমেন্ট প্রাইভেট রিপ্লাই ব্যর্থ';
      console.error('[Webhook] Comment-to-inbox failed:', fbError || err.message);
      await logActivity(bizId, 'ERROR', `কমেন্ট-টু-ইনবক্স ব্যর্থ: ${errorMsg}`, 'error', businessData.ownerId, fbError);
      await saveMessengerLog(bizId, {
        senderId: event.fromId,
        pageId,
        message: event.message,
        status: 'error',
        error: errorMsg,
        source: 'comment'
      });
    }
  }
}

// Helper to get effective Gemini Config (Admin DB or Environment)
async function getEffectiveGeminiConfig() {
  const pool = await getAiPool();
  let model = pool.geminiModel;
  let temperature = 0.4;
  let maxTokens = 800;

  try {
    if (adminDb) {
      const sysSnap = await adminDb.collection('system').doc('settings').get();
      if (sysSnap.exists) {
        const d = sysSnap.data();
        if (d.defaultAiModel) model = d.defaultAiModel;
        if (d.aiTemperature) temperature = Number(d.aiTemperature);
        if (d.aiMaxTokens) maxTokens = Number(d.aiMaxTokens);
      }
      const publicSnap = await adminDb.collection('system_config').doc('public').get();
      if (publicSnap.exists) {
        const d = publicSnap.data();
        if (d.defaultAiModel) model = d.defaultAiModel;
        if (d.aiTemperature) temperature = Number(d.aiTemperature);
        if (d.aiMaxTokens) maxTokens = Number(d.aiMaxTokens);
      }
    } else if (db) {
      const sysSnap = await getDoc(doc(db, 'system', 'settings'));
      if (sysSnap.exists()) {
        const d = sysSnap.data();
        if (d.defaultAiModel) model = d.defaultAiModel;
        if (d.aiTemperature) temperature = Number(d.aiTemperature);
        if (d.aiMaxTokens) maxTokens = Number(d.aiMaxTokens);
      }
      const publicSnap = await getDoc(doc(db, 'system_config', 'public'));
      if (publicSnap.exists()) {
        const d = publicSnap.data();
        if (d.defaultAiModel) model = d.defaultAiModel;
        if (d.aiTemperature) temperature = Number(d.aiTemperature);
        if (d.aiMaxTokens) maxTokens = Number(d.aiMaxTokens);
      }
    }
  } catch (e) {
    console.warn('[Gemini Config Load Notice]', e);
  }

  return {
    apiKey: firstEnabledGeminiKey(pool),
    model: resolveSystemGeminiModel(model),
    temperature,
    maxTokens,
    hasProvider: aiPoolHasProvider(pool),
    hasFallbackProvider: Boolean(pool.openRouterKey || pool.openAiKey),
  };
}

// ---------------------------------------------------------------------------
// AI Provider Pool with automatic failover.
// The super admin can register MANY Gemini keys plus one OpenRouter and one
// OpenAI key. When a key hits its quota (429 / RESOURCE_EXHAUSTED) it is put
// on cooldown and the next key takes over automatically — so free-tier keys
// can be chained and a single dead key never stops the bots.
// ---------------------------------------------------------------------------
let aiPoolCache: { pool: AiPool; at: number; firestoreOk: boolean } | null = null;
const AI_POOL_CACHE_MS = 15 * 1000;
const AI_POOL_MISS_CACHE_MS = 3 * 1000;

function clearAiPoolCache() {
  aiPoolCache = null;
}

async function readSystemSettingsDoc(): Promise<{ data: Record<string, unknown> | null; source: 'admin' | 'admin-default' | 'client' | 'none' }> {
  if (adminDb) {
    try {
      const snap = await adminDb.collection('system').doc('settings').get();
      if (snap.exists) return { data: (snap.data() || {}) as Record<string, unknown>, source: 'admin' };
    } catch (err: any) {
      console.warn('[AI Pool] adminDb settings read failed:', err?.message || err);
    }
    try {
      const fallbackDb = getAdminFirestore(admin.app());
      const snap = await fallbackDb.collection('system').doc('settings').get();
      if (snap.exists) {
        adminDb = fallbackDb;
        return { data: (snap.data() || {}) as Record<string, unknown>, source: 'admin-default' };
      }
    } catch (err: any) {
      console.warn('[AI Pool] default-admin settings read failed:', err?.message || err);
    }
  }
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'system', 'settings'));
      if (snap.exists()) return { data: (snap.data() || {}) as Record<string, unknown>, source: 'client' };
    } catch (err: any) {
      console.warn('[AI Pool] client settings read failed:', err?.message || err);
    }
  }
  return { data: null, source: 'none' };
}

async function getAiPool(): Promise<AiPool> {
  const ttl = aiPoolCache?.firestoreOk ? AI_POOL_CACHE_MS : AI_POOL_MISS_CACHE_MS;
  if (aiPoolCache && Date.now() - aiPoolCache.at < ttl) return aiPoolCache.pool;
  const { data, source } = await readSystemSettingsDoc();
  const pool = parseAiPoolFromSettings(data, process.env.GEMINI_API_KEY || '');
  const firestoreOk = source !== 'none';
  aiPoolCache = { pool, at: Date.now(), firestoreOk };
  if (!firestoreOk) {
    console.warn('[AI Pool] could not read system/settings; using ENV key only until Firestore is reachable');
  }
  return pool;
}

// key (or provider key) -> cooldown-until timestamp
const aiKeyCooldownUntil = new Map<string, number>();
const AI_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
const AI_AUTH_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function aiKeyAvailable(key: string): boolean {
  return (aiKeyCooldownUntil.get(key) || 0) < Date.now();
}

function classifyAiError(err: any): 'quota' | 'auth' | 'other' {
  const status = Number(err?.response?.status || err?.status || 0);
  const msg = String(err?.response?.data?.error?.message || err?.message || '').toLowerCase();
  if (status === 429 || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('exceeded')) return 'quota';
  if (status === 401 || status === 403 || msg.includes('api key not valid') || msg.includes('api_key_invalid') || msg.includes('permission')) return 'auth';
  return 'other';
}

function cooldownAiKey(key: string, kind: 'quota' | 'auth', label: string) {
  const ms = kind === 'auth' ? AI_AUTH_COOLDOWN_MS : AI_QUOTA_COOLDOWN_MS;
  aiKeyCooldownUntil.set(key, Date.now() + ms);
  console.warn(`[AI Pool] Key "${label}" on cooldown (${kind}) for ${Math.round(ms / 60000)} min — rotating to next key.`);
}

interface AiGenerateOptions {
  parts: any[];           // Gemini multimodal parts (text + media)
  textPrompt: string;     // text-only version for OpenRouter/OpenAI fallback
  model: string;
  schema?: any;
  temperature?: number;
  maxTokens?: number;
  // Merchant's own Gemini key tried first — usage on it is NOT billed
  preferredKeys?: PooledGeminiKey[];
}

interface AiGenerateResult {
  text: string;
  provider: string;
  keyLabel: string;
  tokensUsed: number;
  merchantKeyUsed: boolean;
}

function estimateTokens(promptText: string, replyText: string): number {
  return Math.max(50, Math.ceil((String(promptText).length + String(replyText).length) / 4));
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function aiGenerate(opts: AiGenerateOptions): Promise<AiGenerateResult> {
  const pool = await getAiPool();
  const modelName = resolveSystemGeminiModel(opts.model || pool.geminiModel);
  const geminiCandidates: PooledGeminiKey[] = geminiFailoverCandidates(pool, opts.preferredKeys);
  const deadlineAt = Date.now() + 15_000;
  const remainingMs = () => Math.max(0, deadlineAt - Date.now());
  let lastErr: any = null;

  for (const gk of geminiCandidates) {
    if (!gk.enabled || !gk.key || !aiKeyAvailable(gk.key)) continue;
    if (remainingMs() < 500) break;
    try {
      const ai = new GoogleGenAI({ apiKey: gk.key });
      const config: any = {
        temperature: opts.temperature ?? 0.6,
        maxOutputTokens: opts.maxTokens ?? 1024,
      };
      if (opts.schema) {
        config.responseMimeType = 'application/json';
        config.responseSchema = opts.schema;
      }
      const r = await withDeadline(
        ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: opts.parts }],
          config,
        }),
        Math.min(10_000, remainingMs()),
        `Gemini ${modelName}`
      );
      const text = r.text?.trim() || '';
      if (text) {
        const usage: any = (r as any).usageMetadata || {};
        const tokensUsed = Number(usage.totalTokenCount) || estimateTokens(opts.textPrompt, text);
        return {
          text,
          provider: 'gemini',
          keyLabel: gk.label,
          tokensUsed,
          merchantKeyUsed: gk.label === 'merchant-own',
        };
      }
    } catch (err: any) {
      lastErr = err;
      const kind = classifyAiError(err);
      if (kind === 'quota' || kind === 'auth') {
        cooldownAiKey(gk.key, kind, gk.label);
        continue;
      }
    }
  }

  // Text-only fallback providers (OpenAI-compatible chat completions)
  const jsonInstruction = opts.schema
    ? '\n\nCRITICAL: Respond with ONLY one valid JSON object using exactly the fields described above. No markdown, no extra text.'
    : '';
  const fallbackProviders = [
    { name: 'openrouter', key: pool.openRouterKey, base: 'https://openrouter.ai/api/v1', model: pool.openRouterModel },
    { name: 'openai', key: pool.openAiKey, base: 'https://api.openai.com/v1', model: pool.openAiModel },
  ];
  for (const p of fallbackProviders) {
    if (remainingMs() < 500) break;
    if (!p.key || !aiKeyAvailable(p.key)) continue;
    try {
      const r = await axios.post(`${p.base}/chat/completions`, {
        model: p.model,
        messages: [{ role: 'user', content: opts.textPrompt + jsonInstruction }],
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 1024,
      }, {
        headers: { Authorization: `Bearer ${p.key}` },
        timeout: Math.min(10_000, remainingMs()),
      });
      const text = String(r.data?.choices?.[0]?.message?.content || '').trim();
      if (text) {
        const tokensUsed = Number(r.data?.usage?.total_tokens) || estimateTokens(opts.textPrompt, text);
        return { text, provider: p.name, keyLabel: p.name, tokensUsed, merchantKeyUsed: false };
      }
    } catch (err: any) {
      lastErr = err;
      const kind = classifyAiError(err);
      if (kind === 'quota' || kind === 'auth') cooldownAiKey(p.key, kind, p.name);
    }
  }

  throw lastErr || new Error('সব AI প্রোভাইডার ব্যর্থ হয়েছে — অ্যাডমিন প্যানেলে API Key যাচাই করুন।');
}

// ---------------------------------------------------------------------------
// Token metering: every AI answer on the central pool is billed against the
// merchant's token wallet. Merchants using their OWN Gemini key are free.
// When the wallet is empty the bot stops answering (silently to customers,
// loudly to the merchant via the activity log).
// ---------------------------------------------------------------------------
function merchantOwnGeminiKey(businessData: any): PooledGeminiKey[] {
  const ownKey = businessData?.useOwnApiKey ? String(businessData?.customGeminiApiKey || '').trim() : '';
  return ownKey ? [{ key: ownKey, label: 'merchant-own', enabled: true }] : [];
}

function hasTokenBalance(businessData: any): boolean {
  if (merchantOwnGeminiKey(businessData).length > 0) return true; // own key = own cost
  const bal = businessData?.tokenBalance;
  // Legacy stores without the field get grace: the first charge materializes
  // the field (negative), after which the gate enforces normally.
  if (bal === undefined || bal === null) return true;
  return Number(bal) > 0;
}

async function chargeAiUsage(bizId: string, result: AiGenerateResult, source: string) {
  if (!bizId || result.merchantKeyUsed) return;
  const tokens = Math.max(1, Math.round(result.tokensUsed));
  try {
    if (adminDb) {
      await adminDb.collection('businesses').doc(bizId).update({
        tokenBalance: admin.firestore.FieldValue.increment(-tokens),
        totalTokensUsed: admin.firestore.FieldValue.increment(tokens),
        aiMessagesCount: admin.firestore.FieldValue.increment(1),
      });
      return;
    }
    if (db) {
      // Unauthenticated fallback — succeeds only if rules permit; usage is
      // still recorded in logs either way.
      await updateDoc(doc(db, 'businesses', bizId), {
        tokenBalance: increment(-tokens),
        totalTokensUsed: increment(tokens),
        aiMessagesCount: increment(1),
      } as any);
    }
  } catch (e: any) {
    console.warn(`[TokenMeter] charge failed for ${bizId} (${source}):`, e?.message);
  }
}

// Notify the merchant at most once per 30 minutes that the wallet is empty
const tokenEmptyNotifiedAt = new Map<string, number>();
async function notifyTokensEmpty(bizId: string, ownerId?: string) {
  const last = tokenEmptyNotifiedAt.get(bizId) || 0;
  if (Date.now() - last < 30 * 60 * 1000) return;
  tokenEmptyNotifiedAt.set(bizId, Date.now());
  await logActivity(bizId, 'TOKEN_EMPTY', 'টোকেন ব্যালেন্স শেষ! বট কাস্টমারদের উত্তর দেওয়া বন্ধ রেখেছে — বিলিং থেকে রিচার্জ করুন।', 'error', ownerId);
}

function sanitizeProductsForPrompt(products: any[] = []) {
  return products.map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    minPrice: p.minPrice || p.price,
    pricingTiers: p.pricingTiers || [{ quantity: 1, price: p.price, minPrice: p.minPrice || p.price }],
    stock: p.stock ?? p.stockCount ?? 10,
    category: p.category || 'General',
    description: String(p.description || '').slice(0, 400),
    hasImages: Array.isArray(p.images) && p.images.length > 0,
    imageCount: Array.isArray(p.images) ? p.images.length : 0,
    hasReviewImages: Array.isArray(p.reviewImages) && p.reviewImages.length > 0,
    reviewImageCount: Array.isArray(p.reviewImages) ? p.reviewImages.length : 0,
  }));
}

// Large catalogs (10-500 products): send full details only for the most
// relevant items and compact name/price stubs for the rest, so the prompt
// stays fast, cheap and accurate no matter the store size.
const PROMPT_FULL_DETAIL_LIMIT = 40;
const PROMPT_STUB_LIMIT = 500;

function selectProductsForPrompt(products: any[] = [], contextText = '') {
  if (!Array.isArray(products)) return [];
  if (products.length <= PROMPT_FULL_DETAIL_LIMIT) return sanitizeProductsForPrompt(products);

  const ctx = String(contextText || '').toLowerCase();
  const tokenSet = new Set(ctx.split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 2));

  const scored = products.map((p: any, i: number) => {
    const name = String(p?.name || '').toLowerCase();
    const category = String(p?.category || '').toLowerCase();
    let score = 0;
    if (name && ctx.includes(name)) score += 100;
    for (const w of name.split(/[^\p{L}\p{N}]+/u)) {
      if (w.length >= 2 && tokenSet.has(w)) score += 10;
    }
    if (category && tokenSet.has(category)) score += 3;
    return { p, i, score };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.i - b.i));

  const detailed = scored.slice(0, PROMPT_FULL_DETAIL_LIMIT).map(s => s.p);
  const rest = scored.slice(PROMPT_FULL_DETAIL_LIMIT, PROMPT_STUB_LIMIT).map(s => s.p);
  return [
    ...sanitizeProductsForPrompt(detailed),
    ...rest.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      minPrice: p.minPrice || p.price,
      stock: p.stock ?? p.stockCount ?? 10,
      category: p.category || 'General',
      summary_only: true,
    })),
  ];
}

function mergeLead(prev: any = {}, next: any = {}, extraText = '') {
  const phone = normalizePhone(next?.phone) || normalizePhone(prev?.phone) || extractBdPhone(extraText) || '';
  return {
    name: String(next?.name || prev?.name || '').trim(),
    phone,
    address: String(next?.address || prev?.address || '').trim(),
    quantity: String(next?.quantity || prev?.quantity || '1').trim() || '1',
    product_name: String(next?.product_name || prev?.product_name || '').trim(),
    negotiated_price: String(next?.negotiated_price || prev?.negotiated_price || '').trim(),
  };
}

function hasCompleteLead(lead: any) {
  const phone = normalizePhone(lead?.phone);
  return Boolean(
    String(lead?.name || '').trim().length >= 2 &&
    phone.length === 11 &&
    String(lead?.address || '').trim().length >= 8 &&
    String(lead?.product_name || '').trim().length >= 2
  );
}

function clientIpFromReq(req: any): string {
  return normalizeClientIp(
    req?.headers?.['x-forwarded-for'] ||
    req?.headers?.['x-real-ip'] ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    ''
  );
}

function publicOriginFromReq(req: any) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (host) {
    const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0];
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return '';
}

async function storeMediaDoc(dataUrl: string, businessId: string, kind = 'product') {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data');
  const mimeType = match[1];
  const base64 = match[2];
  if (base64.length > 900_000) throw new Error('Image too large');
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = { id, businessId: businessId || '', kind, mimeType, base64, createdAt: Date.now() };
  if (adminDb) {
    await adminDb.collection('media').doc(id).set(payload);
  } else if (db) {
    await setDoc(doc(db, 'media', id), payload);
  } else {
    throw new Error('Database not ready');
  }
  return id;
}

async function readMediaDoc(id: string) {
  if (adminDb) {
    const snap = await adminDb.collection('media').doc(id).get();
    return snap.exists ? snap.data() : null;
  }
  if (db) {
    const snap = await getDoc(doc(db, 'media', id));
    return snap.exists() ? snap.data() : null;
  }
  return null;
}

async function ensurePublicImageUrl(image: string, businessId: string, req?: any): Promise<string | null> {
  if (!image) return null;
  const converted = image.startsWith('data:') ? image : (normalizeImageLink(image) || image);
  if (converted.startsWith('https://') || converted.startsWith('http://')) return converted;
  if (!converted.startsWith('data:')) return null;
  try {
    const id = await storeMediaDoc(converted, businessId, 'relay');
    const origin = publicOriginFromReq(req);
    return origin ? `${origin}/api/media/${id}` : `/api/media/${id}`;
  } catch (e) {
    console.warn('[ensurePublicImageUrl] failed', e);
    return null;
  }
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
    const res = await axios.post('https://portal.packzy.com/api/v1/create_order', payload, {
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secret,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
    const consignment = res.data?.consignment || {};
    const trackingCode = consignment.tracking_code || res.data?.tracking_code;
    const consignmentId = consignment.consignment_id || res.data?.consignment_id;
    if (!trackingCode && res.data?.status !== 200) {
      return { success: false, error: res.data?.message || 'Steadfast বুকিং ব্যর্থ', raw: res.data };
    }
    return {
      success: true,
      trackingCode: trackingCode || '',
      consignmentId: consignmentId ? String(consignmentId) : '',
      raw: res.data,
    };
  } catch (err: any) {
    const msg = err.response?.data?.message || err.response?.data?.errors || err.message || 'Steadfast API error';
    return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
  }
}

async function saveOrderDoc(order: any) {
  const payload = omitUndefined({
    ...order,
    createdAtMs: order.createdAtMs || Date.now(),
  });
  // Admin SDK first, but NEVER lose an order: if the admin write fails
  // (e.g. missing service-account credentials on the host), fall back to
  // the client SDK before giving up.
  if (adminDb) {
    try {
      await adminDb.collection('orders').doc(order.id).set({
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    } catch (adminErr: any) {
      console.error('[saveOrderDoc] Admin write failed, falling back to client SDK:', adminErr?.message);
    }
  }
  if (db) {
    await setDoc(doc(db, 'orders', order.id), { ...payload, createdAt: serverTimestamp() }, { merge: true });
    return;
  }
  throw new Error('No Firestore connection available to save order');
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
    console.warn(`[queryOrdersByField] ${field}`, e);
  }
  return [];
}

const recentIdentityLocks = new Map<string, number>();

function identityLockKeys(bizId: string, identity: { phone?: string; passengerId?: string; clientIp?: string }) {
  const keys: string[] = [];
  const phone = normalizePhone(identity.phone);
  const passengerId = String(identity.passengerId || '').trim();
  const ip = trustedClientIp(identity.clientIp);
  if (phone) keys.push(`${bizId}:phone:${phone}`);
  if (passengerId) keys.push(`${bizId}:passenger:${passengerId}`);
  if (ip) keys.push(`${bizId}:ip:${ip}`);
  return keys;
}

function claimOrderIdentity(bizId: string, identity: { phone?: string; passengerId?: string; clientIp?: string }, windowMs = DUPLICATE_ORDER_WINDOW_MS) {
  const now = Date.now();
  const keys = identityLockKeys(bizId, identity);
  if (keys.length === 0) return true;
  for (const [key, ts] of recentIdentityLocks) {
    if (now - ts > windowMs) recentIdentityLocks.delete(key);
  }
  if (keys.some(k => {
    const ts = recentIdentityLocks.get(k);
    return Boolean(ts && now - ts < windowMs);
  })) {
    return false;
  }
  for (const k of keys) recentIdentityLocks.set(k, now);
  return true;
}

function releaseOrderIdentity(bizId: string, identity: { phone?: string; passengerId?: string; clientIp?: string }) {
  for (const key of identityLockKeys(bizId, identity)) {
    recentIdentityLocks.delete(key);
  }
}

async function findRecentDuplicateOrder(
  bizId: string,
  identity: { phone?: string; passengerId?: string; sessionId?: string; clientIp?: string },
  windowMs = DUPLICATE_ORDER_WINDOW_MS
) {
  const phone = normalizePhone(identity.phone);
  const passengerId = String(identity.passengerId || identity.sessionId || '').trim();
  const clientIp = trustedClientIp(identity.clientIp);
  if (!bizId || (!phone && !passengerId && !clientIp)) return null;

  const incoming = { phone, passengerId, sessionId: passengerId, clientIp };
  try {
    const buckets = await Promise.all([
      queryOrdersByField(bizId, 'phone', phone),
      queryOrdersByField(bizId, 'sessionId', passengerId),
      queryOrdersByField(bizId, 'passengerId', passengerId),
      queryOrdersByField(bizId, 'clientIp', clientIp),
    ]);
    const seen = new Map<string, any>();
    for (const row of buckets.flat()) {
      if (row?.id) seen.set(row.id, row);
    }
    const hit = [...seen.values()].find(existing => isRecentIdentityDuplicate(existing, incoming, Date.now(), windowMs));
    return hit || null;
  } catch (e) {
    console.warn('[findRecentDuplicateOrder]', e);
  }
  return null;
}

async function loadRecentOrdersForCustomer(bizId: string, senderId: string, phone?: string) {
  const orders: any[] = [];
  const pushDocs = (docs: any[]) => {
    for (const d of docs) {
      const data = typeof d.data === 'function' ? { id: d.id, ...d.data() } : d;
      orders.push(data);
    }
  };
  try {
    if (adminDb) {
      let snap = await adminDb.collection('orders').where('businessId', '==', bizId).where('sessionId', '==', senderId).limit(8).get();
      pushDocs(snap.docs);
      if (phone && orders.length === 0) {
        snap = await adminDb.collection('orders').where('businessId', '==', bizId).where('phone', '==', phone).limit(8).get();
        pushDocs(snap.docs);
      }
    } else if (db) {
      let snap = await getDocs(query(collection(db, 'orders'), where('businessId', '==', bizId), where('sessionId', '==', senderId), limit(8)));
      pushDocs(snap.docs);
      if (phone && orders.length === 0) {
        snap = await getDocs(query(collection(db, 'orders'), where('businessId', '==', bizId), where('phone', '==', phone), limit(8)));
        pushDocs(snap.docs);
      }
    }
  } catch (e) {
    console.warn('[loadRecentOrdersForCustomer]', e);
  }
  orders.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return orders.slice(0, 5);
}

const webhookResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING },
    show_product_image: { type: Type.BOOLEAN },
    show_review_images: { type: Type.BOOLEAN },
    should_create_order: { type: Type.BOOLEAN },
    product_name: { type: Type.STRING },
    reply: { type: Type.STRING },
    summary: { type: Type.STRING },
    order_data: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        phone: { type: Type.STRING },
        address: { type: Type.STRING },
        quantity: { type: Type.STRING },
        negotiated_price: { type: Type.STRING },
        product_name: { type: Type.STRING },
      },
    },
    conversation_stage: { type: Type.STRING },
    event_name: { type: Type.STRING },
    need_more_info: { type: Type.BOOLEAN },
    confidence: { type: Type.NUMBER },
  },
  required: ['intent', 'reply', 'summary', 'conversation_stage', 'event_name', 'should_create_order', 'need_more_info'],
};

// Helper to save Messenger logs in live collection
async function saveMessengerLog(businessId: string, logData: {
  senderId?: string;
  pageId?: string;
  message?: string;
  reply?: string;
  status?: 'received' | 'replied' | 'error';
  error?: string;
  latencyMs?: number;
  source?: string;
}) {
  const payload = {
    businessId: businessId || 'unknown',
    senderId: logData.senderId || 'FB_User',
    pageId: logData.pageId || '',
    message: logData.message || '',
    reply: logData.reply || '',
    status: logData.status || 'received',
    error: logData.error || null,
    latencyMs: logData.latencyMs || 0,
    source: logData.source || 'messenger'
  };

  if (adminDb) {
    try {
      await adminDb.collection('messenger_logs').add({
        ...payload,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return;
    } catch (e) {
      console.warn('[Messenger Log Admin Error]', e);
    }
  }

  if (db) {
    try {
      await addDoc(collection(db, 'messenger_logs'), {
        ...payload,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.warn('[Messenger Log Client Error]', e);
    }
  }
}

async function sendResilientSalesFallback(input: {
  businessId: string;
  businessData: any;
  ownerId?: string;
  pageId: string;
  pageAccessToken: string;
  senderId: string;
  message: string;
  mediaKinds?: string[];
  reason: string;
}): Promise<string> {
  const reply = buildSalesFallbackReply(
    input.message,
    input.businessData,
    input.mediaKinds || []
  );
  await sendPlainText(input.pageAccessToken, input.senderId, reply);
  await saveChatMessage(input.businessId, input.senderId, 'bot', reply).catch(() => {});
  await saveMessengerLog(input.businessId, {
    senderId: input.senderId,
    pageId: input.pageId,
    message: input.message,
    reply,
    status: 'replied',
    source: `resilient-fallback:${input.reason}`
  });
  await logActivity(
    input.businessId,
    'FALLBACK_REPLY_SENT',
    `AI অনুপলভ্য থাকায় ক্যাটালগ/FAQ থেকে নিরাপদ উত্তর পাঠানো হয়েছে (${input.reason})।`,
    'info',
    input.ownerId
  ).catch(() => {});
  return reply;
}

// Helper to get system settings
async function getSystemSettings() {
  const defaultSettings = { tokenPricePerLakh: 20, monthlyServerCost: 1000, freeTrialTokens: 100000 };
  
  if (adminDb) {
    try {
      const doc = await adminDb.collection('system_config').doc('billing').get();
      if (doc.exists) return doc.data();
    } catch (e) {}
  }
  
  if (db) {
    try {
      const sDoc = await getDoc(doc(db, 'system_config', 'billing'));
      if (sDoc.exists()) return sDoc.data();
    } catch (e) {}
  }
  
  return defaultSettings;
}

// ---------------------------------------------------------------------------
// Meta Conversions API (CAPI) — Messenger / Click-to-Messenger only.
// Website Pixel events are not sent from this path.
// ---------------------------------------------------------------------------
const capiSentCache = new Map<string, number>();

interface CapiEventOptions {
  psid: string;
  pageId?: string;
  phone?: string;
  name?: string;
  ctwaClid?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentIds?: string[];
  quantity?: number;
  itemPrice?: number;
  orderId?: string;
  bizId?: string;
  ownerId?: string;
  allowRepeat?: boolean;
  alreadySentToday?: Record<string, string>;
  includeTestEventCode?: boolean;
  adId?: string;
  adRef?: string;
  adSource?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCapiEvent(businessData: any, eventName: string, opts: CapiEventOptions): Promise<{ ok: boolean; skipped?: string }> {
  const event = canonicalizeCapiEvent(eventName);
  try {
    const creds = readCapiCredentials(businessData);
    if (!creds.enabled) return { ok: false, skipped: 'not_configured' };
    if (!event) return { ok: false, skipped: 'invalid_event' };

    const fbCfg = businessData?.facebookConfig || {};
    const pageId = String(opts.pageId || businessData.facebookPageId || businessData.pageId || fbCfg.pageId || '').trim();
    const psid = String(opts.psid || '').trim();
    if (!psid) return { ok: false, skipped: 'missing_psid' };

    const day = utcDay();
    const dedupKey = `${creds.pixelId}:${psid}:${event}:${opts.orderId || day}`;
    if (!opts.allowRepeat && event !== 'Purchase') {
      if (opts.alreadySentToday?.[event] === day) return { ok: false, skipped: 'duplicate' };
      if (capiSentCache.has(dedupKey)) return { ok: false, skipped: 'duplicate' };
    }

    const built = buildMessengerCapiPayload({
      eventName: event,
      pixelId: creds.pixelId,
      pageId,
      psid,
      phone: opts.phone,
      name: opts.name,
      ctwaClid: opts.ctwaClid,
      value: opts.value,
      currency: opts.currency,
      contentName: opts.contentName,
      contentIds: opts.contentIds,
      quantity: opts.quantity,
      itemPrice: opts.itemPrice,
      orderId: opts.orderId,
      testEventCode: opts.includeTestEventCode ? String(fbCfg.testEventCode || '').trim() : '',
    });

    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fbRes = await axios.post(capiEventsUrl(creds.pixelId, creds.accessToken), built.body, { timeout: 8000 });
        if (!isCapiHttpSuccess(fbRes.status, fbRes.data)) {
          lastError = fbRes.data?.error || fbRes.data;
          break;
        }
        if (capiSentCache.size > 5000) capiSentCache.clear();
        capiSentCache.set(dedupKey, Date.now());
        console.log(`[CAPI] ${event} fired for psid=${psid.slice(-6)} pixel=${creds.pixelId} events_received=${fbRes.data?.events_received ?? 1}`);
        if (opts.bizId) {
          const detail = event === 'Purchase'
            ? `CAPI Purchase ইভেন্ট পাঠানো হয়েছে (৳${opts.value || 0}) — অ্যাড অপটিমাইজেশনে যুক্ত হলো।`
            : `CAPI ${event} ইভেন্ট পিক্সেলে পাঠানো হয়েছে।`;
          logActivity(opts.bizId, 'CAPI_EVENT', detail, 'success', opts.ownerId).catch(() => {});
          recordCapiDashboardEvent(dashboardEventFromOpts(opts, event, built.eventId, 'sent')).catch(() => {});
        }
        return { ok: true };
      } catch (err: any) {
        lastError = err;
        if (attempt < 3 && isRetryableCapiError(err)) {
          await sleep(200 * attempt);
          continue;
        }
        break;
      }
    }
    const errMsg = lastError?.response?.data?.error?.message || lastError?.message || String(lastError || 'unknown');
    console.error('[CAPI Error]', lastError?.response?.data || lastError);
    if (opts.bizId) {
      logActivity(opts.bizId, 'CAPI_EVENT', `CAPI ${event} পাঠানো যায়নি: ${errMsg}`, 'error', opts.ownerId).catch(() => {});
      recordCapiDashboardEvent(dashboardEventFromOpts(opts, event, `${event}_failed_${Date.now()}`, 'failed')).catch(() => {});
    }
    return { ok: false, skipped: 'request_failed' };
  } catch (err: any) {
    console.error('[CAPI Error]', err.response?.data || err.message);
    if (opts.bizId) {
      logActivity(opts.bizId, 'CAPI_EVENT', `CAPI ${event || eventName} পাঠানো যায়নি: ${err.response?.data?.error?.message || err.message}`, 'error', opts.ownerId).catch(() => {});
    }
    return { ok: false, skipped: 'request_failed' };
  }
}

function dashboardEventFromOpts(
  opts: CapiEventOptions,
  eventName: string,
  eventId: string,
  status: 'sent' | 'failed',
) {
  return {
    businessId: String(opts.bizId || ''),
    ownerId: opts.ownerId,
    eventName,
    eventId,
    value: opts.value,
    contentName: opts.contentName,
    contentId: opts.contentIds?.[0],
    orderId: opts.orderId,
    psid: opts.psid,
    pageId: opts.pageId,
    quantity: opts.quantity,
    hasPhone: Boolean(String(opts.phone || '').trim()),
    hasName: Boolean(String(opts.name || '').trim()),
    hasClid: Boolean(String(opts.ctwaClid || '').trim()),
    adId: opts.adId,
    adRef: opts.adRef,
    adSource: opts.adSource,
    status,
  };
}

async function recordCapiDashboardEvent(input: {
  businessId: string;
  ownerId?: string;
  eventName: string;
  eventId?: string;
  value?: number;
  contentName?: string;
  contentId?: string;
  orderId?: string;
  psid?: string;
  pageId?: string;
  quantity?: number;
  hasPhone?: boolean;
  hasName?: boolean;
  hasClid?: boolean;
  adId?: string;
  adRef?: string;
  adSource?: string;
  status: 'sent' | 'failed';
}) {
  const bizId = String(input.businessId || '').trim();
  if (!bizId) return;
  const payload = omitUndefined({
    businessId: bizId,
    ownerId: input.ownerId || '',
    eventName: String(input.eventName || ''),
    eventId: String(input.eventId || ''),
    value: typeof input.value === 'number' && input.value > 0 ? input.value : 0,
    currency: 'BDT',
    contentName: String(input.contentName || '').slice(0, 120),
    contentId: String(input.contentId || ''),
    orderId: String(input.orderId || ''),
    psidTail: String(input.psid || '').slice(-6),
    pageId: String(input.pageId || ''),
    quantity: Number(input.quantity || 0) || 0,
    hasPhone: Boolean(input.hasPhone),
    hasName: Boolean(input.hasName),
    hasClid: Boolean(input.hasClid),
    adId: String(input.adId || ''),
    adRef: String(input.adRef || ''),
    adSource: String(input.adSource || '').slice(0, 120),
    source: 'server',
    channel: 'messenger',
    status: input.status,
    createdAtMs: Date.now(),
  });
  const docId = String(input.eventId || '').replace(/[^\w.-]/g, '').slice(0, 120);
  try {
    if (adminDb) {
      if (docId) {
        await adminDb.collection('capi_events').doc(docId).set({
          ...payload,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        await adminDb.collection('capi_events').add({
          ...payload,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }
    if (db) {
      if (docId) {
        await setDoc(doc(db, 'capi_events', docId), { ...payload, timestamp: serverTimestamp() }, { merge: true });
      } else {
        await addDoc(collection(db, 'capi_events'), { ...payload, timestamp: serverTimestamp() });
      }
    }
  } catch (err: any) {
    console.warn('[CAPI] dashboard event save failed:', err?.message || err);
  }
}

async function markOrderCapiPurchaseSent(orderId: string, psid?: string) {
  const id = String(orderId || '').trim();
  if (!id) return;
  const patch: Record<string, unknown> = {
    capiPurchaseSentAt: Date.now(),
    updatedAtMs: Date.now(),
  };
  if (psid) patch.capiPurchasePsid = String(psid);
  try {
    if (adminDb) {
      await adminDb.collection('orders').doc(id).set(patch, { merge: true });
      return;
    }
    if (db) {
      await setDoc(doc(db, 'orders', id), patch, { merge: true });
    }
  } catch (err: any) {
    console.warn('[CAPI] mark purchase sent failed:', err?.message || err);
  }
}

async function loadCapiMatchCustomers(businessId: string, order: any): Promise<any[]> {
  const rows: any[] = [];
  const seen = new Set<string>();
  const pushRow = (id: string, data: any) => {
    if (!id || !data || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, ...data });
  };
  const phone = nationalPhoneDigits(order?.phone);
  const psidHint = [order?.messengerId, order?.passengerId, order?.sessionId].find((value) => looksLikeMessengerPsid(value));
  const docIds = [
    psidHint ? `${businessId}_${psidHint}` : '',
    phone ? `${businessId}_${phone}` : '',
  ].filter(Boolean);

  try {
    if (adminDb) {
      for (const id of docIds) {
        const snap = await adminDb.collection('customers').doc(id).get();
        if (snap.exists) pushRow(snap.id, snap.data());
      }
      if (phone) {
        const variants = Array.from(new Set([phone, String(order?.phone || '').trim()].filter(Boolean)));
        for (const variant of variants) {
          const snap = await adminDb.collection('customers')
            .where('businessId', '==', businessId)
            .where('phone', '==', variant)
            .limit(10)
            .get();
          for (const docSnap of snap.docs) pushRow(docSnap.id, docSnap.data());
        }
      }
      return rows;
    }
    if (db) {
      for (const id of docIds) {
        const snap = await getDoc(doc(db, 'customers', id));
        if (snap.exists()) pushRow(snap.id, snap.data());
      }
      if (phone) {
        const snap = await getDocs(query(
          collection(db, 'customers'),
          where('businessId', '==', businessId),
          where('phone', '==', phone),
          limit(10),
        ));
        for (const docSnap of snap.docs) pushRow(docSnap.id, docSnap.data());
      }
    }
  } catch (err: any) {
    console.warn('[CAPI] customer lookup notice:', err?.message || err);
    const fallback = await loadBusinessCustomers(businessId);
    return fallback.filter((row) => {
      const psid = row.messengerId || row.passengerId;
      if (psidHint && String(psid) === String(psidHint)) return true;
      return Boolean(phone && nationalPhoneDigits(row.phone) === phone && looksLikeMessengerPsid(psid));
    });
  }
  return rows;
}

async function sendMessengerPurchaseForOrder(
  businessData: any,
  order: any,
  bizId: string,
): Promise<{ ok: boolean; skipped?: string }> {
  if (!order?.id) return { ok: false, skipped: 'missing_order' };
  if (order.capiPurchaseSentAt) return { ok: false, skipped: 'already_sent' };
  const status = String(order.status || '');
  if (status === 'cancelled' || status === 'returned') return { ok: false, skipped: 'not_a_sale' };
  const creds = readCapiCredentials(businessData);
  if (!creds.enabled) return { ok: false, skipped: 'not_configured' };

  const customers = await loadCapiMatchCustomers(bizId, order);
  const match = pickMessengerCapiMatch({ order, customers });
  if (!match) return { ok: false, skipped: 'no_messenger_match' };

  const qty = Math.max(1, Math.round(Number(order.quantity) || 1));
  const sent = await sendCapiEvent(businessData, 'Purchase', {
    psid: match.psid,
    pageId: match.pageId || businessData.facebookPageId || businessData.pageId,
    phone: order.phone,
    name: match.name || order.customerName,
    value: Number(order.totalPrice) || 0,
    orderId: String(order.id),
    contentName: order.productName,
    contentIds: order.productId ? [String(order.productId)] : undefined,
    quantity: qty,
    itemPrice: Number(order.unitPrice) || 0,
    ctwaClid: match.ctwaClid,
    adId: order.adId,
    adRef: order.adRef,
    adSource: order.adSource,
    bizId,
    ownerId: businessData.ownerId,
    allowRepeat: true,
  });
  if (sent.ok) await markOrderCapiPurchaseSent(String(order.id), match.psid);
  return sent;
}

// Helper to log activity (Robust)
async function logActivity(bizId: string | null, type: string, detail: string, status: 'info' | 'error' | 'success', ownerId?: string, data?: any) {
  try {
    const bid = bizId || 'unknown';
    const oid = ownerId || 'system';
    console.log(`[ACTIVITY_LOG][${bid}][${type}] ${detail}`);
    
    // Prepare log data WITHOUT timestamp initially
    const logBase = {
      businessId: bid,
      ownerId: oid,
      type,
      detail,
      status,
      data: data ? (typeof data === 'string' ? data.substring(0, 1000) : JSON.stringify(data).substring(0, 1000)) : null
    };

    if (adminDb) {
      try {
        await adminDb.collection('system_logs').add({
          ...logBase,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      } catch (err: any) {
        if (!err?.message?.includes('PERMISSION_DENIED')) {
          console.error('[Logger Admin Error]', err?.message);
        }
      }
    }
    
    if (db) {
      try {
        await addDoc(collection(db, 'system_logs'), {
          ...logBase,
          timestamp: serverTimestamp()
        });
      } catch (ce) {
        console.error('[Logger Client Error]', ce);
      }
    }
  } catch (e) {
    console.error('[Activity Log Global Error]', e);
  }
}

function chatHistoryTime(row: any): number {
  const ts = row?.timestamp;
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(String(ts));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadChatHistoryFallback(bizId: string, senderId: string, limitCount: number) {
  const normalize = (docs: any[]) => docs
    .map((d: any) => (typeof d.data === 'function' ? d.data() : d))
    .sort((a: any, b: any) => chatHistoryTime(a) - chatHistoryTime(b))
    .slice(-limitCount);

  try {
    if (adminDb) {
      try {
        const ordered = await adminDb.collection('chat_history')
          .where('businessId', '==', bizId)
          .where('senderId', '==', senderId)
          .orderBy('timestamp', 'desc')
          .limit(limitCount)
          .get();
        if (!ordered.empty) return normalize(ordered.docs);
      } catch (orderedErr) {
        console.warn('[Webhook] Ordered chat_history query unavailable, using unordered fallback:', orderedErr);
      }
      const unordered = await adminDb.collection('chat_history')
        .where('businessId', '==', bizId)
        .where('senderId', '==', senderId)
        .limit(limitCount)
        .get();
      return unordered.empty ? [] : normalize(unordered.docs);
    }
    if (db) {
      try {
        const ordered = await getDocs(query(
          collection(db, 'chat_history'),
          where('businessId', '==', bizId),
          where('senderId', '==', senderId),
          orderBy('timestamp', 'desc'),
          limit(limitCount),
        ));
        if (!ordered.empty) return normalize(ordered.docs);
      } catch (orderedErr) {
        console.warn('[Webhook] Ordered chat_history query unavailable, using unordered fallback:', orderedErr);
      }
      const unordered = await getDocs(query(
        collection(db, 'chat_history'),
        where('businessId', '==', bizId),
        where('senderId', '==', senderId),
        limit(limitCount),
      ));
      return unordered.empty ? [] : normalize(unordered.docs);
    }
  } catch (err) {
    console.warn('[Webhook] chat_history fallback failed:', err);
  }
  return [];
}

async function saveChatMessage(bizId: string, senderId: string, role: 'user' | 'bot' | 'merchant', text: string) {
  const logBase = {
    businessId: bizId,
    senderId: senderId,
    role: role,
    text: text
  };

  const newMsg = {
    role,
    text,
    timestamp: new Date().toISOString()
  };

  if (adminDb) {
    try {
      const ts = admin.firestore.FieldValue.serverTimestamp();
      await adminDb.collection('chat_history').add({ ...logBase, timestamp: ts });

      const chatRef = adminDb.collection('chats').doc(`${bizId}_${senderId}`);
      const existing = await chatRef.get();
      const prev = existing.exists && Array.isArray(existing.data()?.messages) ? existing.data().messages : [];
      const messages = [...prev, newMsg].slice(-CHAT_MEMORY_LIMIT);
      const incomingPatch = role === 'user' ? { lastIncomingAtMs: Date.now() } : {};
      await chatRef.set({
        businessId: bizId,
        senderId: senderId,
        lastMessage: text.substring(0, 200),
        timestamp: ts,
        messages,
        ...incomingPatch,
      }, { merge: true });
      return;
    } catch (err) {
      console.error('[History Admin Save Error]', err);
    }
  }
  
  if (db) {
    try {
      const ts = serverTimestamp();
      await addDoc(collection(db, 'chat_history'), { ...logBase, timestamp: ts });
      const chatRef = doc(db, 'chats', `${bizId}_${senderId}`);
      const existing = await getDoc(chatRef);
      const prev = existing.exists() && Array.isArray(existing.data()?.messages) ? existing.data()!.messages : [];
      const messages = [...prev, newMsg].slice(-CHAT_MEMORY_LIMIT);
      const incomingPatch = role === 'user' ? { lastIncomingAtMs: Date.now() } : {};
      await setDoc(chatRef, {
        businessId: bizId,
        senderId: senderId,
        lastMessage: text.substring(0, 200),
        timestamp: ts,
        messages,
        ...incomingPatch,
      }, { merge: true });
    } catch (err) {
      console.error('[History Client Save Error]', err);
    }
  }
}

const PAGE_SUBSCRIBE_FIELDS = ['messages', 'messaging_postbacks', 'messaging_optins', 'messaging_referrals', 'feed'];

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  if (value == null) return '';
  return String(value).trim();
}

function resolveRequestPath(input: { path?: string; originalUrl?: string; url?: string; headers?: any }): string {
  const headers = input.headers || {};
  const fromHeader = firstQueryValue(
    headers['x-forwarded-uri'] ||
    headers['x-invoke-path'] ||
    headers['x-matched-path'] ||
    headers['x-vercel-original-path'] ||
    headers['x-original-uri']
  ).split('?')[0];
  const normalizedHeader = fromHeader.replace(/\/+$/, '') || '/';
  if (fromHeader && !['/api', '/api/index', '/api/index.ts', '/api/index.js'].includes(normalizedHeader)) {
    return fromHeader.startsWith('/') ? fromHeader : `/${fromHeader}`;
  }
  const fallback = String(input.originalUrl || input.url || input.path || '').split('?')[0];
  return fallback.startsWith('/') ? fallback : `/${fallback}`;
}

function extractWebhookBusinessId(pathname: string, params?: Record<string, unknown>): string | undefined {
  const reserved = new Set(['api', 'webhook', 'messenger', 'index', 'index.ts', 'index.js']);
  const fromParams = firstQueryValue(params?.businessId || params?.['0']);
  if (fromParams && !reserved.has(fromParams)) return fromParams;
  const parts = String(pathname || '').split('/').filter(Boolean);
  const webhookIdx = parts.lastIndexOf('webhook');
  if (webhookIdx >= 0 && parts[webhookIdx + 1] && !reserved.has(parts[webhookIdx + 1])) {
    return parts[webhookIdx + 1];
  }
  return undefined;
}

function isMetaWebhookVerification(query: Record<string, unknown> | undefined): boolean {
  const q = query || {};
  return firstQueryValue(q['hub.mode'] || q.mode).toLowerCase() === 'subscribe'
    && Boolean(firstQueryValue(q['hub.challenge'] || q.challenge));
}

function isMetaPageWebhookPayload(body: unknown): boolean {
  return !!body && typeof body === 'object' && (body as any).object === 'page' && Array.isArray((body as any).entry);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); }
    );
  });
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  const resolved = resolveRequestPath({
    path: req.path,
    originalUrl: req.originalUrl,
    url: req.url,
    headers: req.headers as Record<string, unknown>
  });
  (req as any)._resolvedPath = resolved;

  const currentPath = String(req.originalUrl || req.url || req.path || '').split('?')[0];
  if (resolved && resolved !== '/' && resolved !== currentPath) {
    const qsIndex = String(req.url || '').indexOf('?');
    const qs = qsIndex >= 0 ? String(req.url).slice(qsIndex) : '';
    req.url = resolved + qs;
  }
  next();
});

function webhookBusinessIdFromReq(req: express.Request): string | undefined {
  return extractWebhookBusinessId((req as any)._resolvedPath || req.path, {
    businessId: req.params.businessId,
    '0': (req.params as any)['0']
  });
}

const publicChatRateLimit = new Map<string, { count: number; resetAt: number }>();
const PUBLIC_CHAT_WINDOW_MS = 60_000;
const PUBLIC_CHAT_REQUESTS_PER_WINDOW = 15;

function consumePublicChatQuota(key: string) {
  const now = Date.now();
  const current = publicChatRateLimit.get(key);
  if (!current || current.resetAt <= now) {
    publicChatRateLimit.set(key, { count: 1, resetAt: now + PUBLIC_CHAT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= PUBLIC_CHAT_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  if (publicChatRateLimit.size > 5_000) {
    for (const [entryKey, entry] of publicChatRateLimit) {
      if (entry.resetAt <= now) publicChatRateLimit.delete(entryKey);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function asProductList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, any>).filter(Boolean);
  return [];
}

function sanitizePublicBusiness(id: string, data: any) {
  const products = asProductList(data.products);
  const faqs = Array.isArray(data.faqs) ? data.faqs : Object.values(data.faqs || {});
  return {
    id,
    name: String(data.name || 'Store'),
    description: String(data.description || '').slice(0, 1_000),
    phone: String(data.phone || '').slice(0, 30),
    address: String(data.address || '').slice(0, 300),
    logoUrl: String(data.logoUrl || '').slice(0, 2_000),
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
    features: data.features || {},
    courierConfig: {
      deliveryChargeInsideDhaka: Number(data.courierConfig?.deliveryChargeInsideDhaka) || 0,
      deliveryChargeOutsideDhaka: Number(data.courierConfig?.deliveryChargeOutsideDhaka) || 0,
    },
    status: data.status,
    plan: data.plan,
    verificationStatus: data.verificationStatus,
    facebookPixelId: String(data.facebookConfig?.pixelId || '').replace(/[^\w]/g, '').slice(0, 32),
    slug: publicShopSlug({ id, slug: data.slug, name: data.name }),
  };
}

async function handlePublicShopGet(req: any, res: any) {
  const businessId = String(req.params.businessId || '').trim();
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return res.status(400).json({ error: 'Invalid business ID' });
  }
  try {
    const business = await loadBusinessBySlugOrId(businessId);
    if (!business || business.data?.status === 'suspended') {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(sanitizePublicBusiness(business.id, business.data));
  } catch (error: any) {
    console.error('[Public Shop GET]', error?.message || error);
    return res.status(500).json({ error: 'Store unavailable' });
  }
}

app.get('/api/public/shop-slug', async (req, res) => {
  const slug = normalizeShopSlug(String(req.query.slug || ''));
  const except = String(req.query.except || '').trim();
  if (!isValidShopSlug(slug)) {
    return res.json({
      ok: false,
      slug,
      error: isReservedShopSlug(slug) ? 'এই নাম ব্যবহার করা যাবে না' : 'ইংরেজি অক্ষর ও সংখ্যা দিয়ে লিংক নাম লিখুন',
    });
  }
  const taken = await isShopSlugTaken(slug, except);
  return res.json({
    ok: !taken,
    slug,
    error: taken ? 'এই লিংক অন্য স্টোর ব্যবহার করছে' : '',
  });
});

app.get('/api/chat/business/:businessId', handlePublicShopGet);
app.get('/api/shop/:businessId', handlePublicShopGet);

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

app.post('/api/shop/:businessId/checkout', async (req, res) => {
  const businessId = String(req.params.businessId || '').trim();
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return res.status(400).json({ code: 'INVALID_BUSINESS', error: 'সঠিক স্টোর আইডি প্রয়োজন।' });
  }

  const clientIp = trustedClientIp(clientIpFromReq(req)) || '';
  const quota = consumeShopCheckoutQuota(`${businessId}:${clientIp || 'anon'}`);
  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    return res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'খুব দ্রুত অনেক অর্ডারের চেষ্টা হয়েছে। একটু পর আবার চেষ্টা করুন।',
    });
  }

  try {
    const business = await loadBusinessBySlugOrId(businessId);
    if (!business || business.data?.status === 'suspended') {
      return res.status(404).json({ code: 'STORE_NOT_FOUND', error: 'স্টোরটি পাওয়া যায়নি।' });
    }

    const catalog = asProductList(business.data?.products);
    const built = buildStoreCheckoutOrder({
      business: {
        id: business.id,
        ownerId: business.data?.ownerId || '',
        courierConfig: business.data?.courierConfig,
        products: catalog,
      },
      lines: sanitizeCart(req.body?.items),
      customer: req.body?.customer || {},
      sessionId: String(req.body?.sessionId || '').slice(0, 80),
      clientIp,
    });

    if (built.ok === false) {
      return res.status(400).json({
        code: 'INVALID_CHECKOUT',
        error: built.issues[0]?.message || 'অর্ডার তথ্য অসম্পূর্ণ',
        issues: built.issues,
      });
    }

    const phone = built.value.order.phone;
    const recent = await queryOrdersByField(business.id, 'phone', phone);
    const duplicate = recent.find((row: any) => isRepeatWebsiteCheckout(row, built.value.order));
    if (duplicate) {
      return res.json({
        order: sanitizePublicOrder({ ...duplicate, id: duplicate.id }),
        duplicate: true,
      });
    }

    const order = built.value.order;
    await saveOrderDoc(order);

    if (isFeatureEnabled(business.data?.features, 'inventoryEnabled') && adminDb) {
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

    await logActivity(
      business.id,
      'ORDER_WEB_CREATED',
      `ওয়েবসাইট COD অর্ডার: ${order.id} (৳${order.totalPrice})`,
      'success',
      business.data?.ownerId,
      order
    );

    const autoBook = isFeatureEnabled(business.data?.features, 'autoCourierBookingEnabled')
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

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ order: sanitizePublicOrder(order) });
  } catch (error: any) {
    console.error('[Shop Checkout]', error?.message || error);
    return res.status(500).json({ code: 'CHECKOUT_FAILED', error: 'অর্ডার সেভ করা যায়নি। আবার চেষ্টা করুন।' });
  }
});

app.get('/api/shop/:businessId/orders', async (req, res) => {
  const businessId = String(req.params.businessId || '').trim();
  const phone = normalizePhone(String(req.query.phone || ''));
  const orderId = String(req.query.orderId || '').trim();
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return res.status(400).json({ error: 'Invalid business ID' });
  }
  if (phone.length !== 11) {
    return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর দিন' });
  }

  try {
    const business = await loadBusinessBySlugOrId(businessId);
    if (!business || business.data?.status === 'suspended') {
      return res.status(404).json({ error: 'Store not found' });
    }
    const rows = await queryOrdersByField(business.id, 'phone', phone);
    const filtered = rows
      .filter((row: any) => !orderId || String(row.id) === orderId || String(row.id).toLowerCase() === orderId.toLowerCase())
      .sort((a: any, b: any) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
      .slice(0, 10)
      .map((row: any) => sanitizePublicOrder({ ...row, id: row.id }));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ orders: filtered });
  } catch (error: any) {
    console.error('[Shop Track]', error?.message || error);
    return res.status(500).json({ error: 'অর্ডার খোঁজা যায়নি' });
  }
});

app.post('/api/chat/respond', async (req, res) => {
  const businessId = String(req.body?.businessId || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!businessId || businessId.length > 128 || /[\/\u0000-\u001f]/.test(businessId)) {
    return res.status(400).json({ code: 'INVALID_BUSINESS', error: 'সঠিক স্টোর আইডি প্রয়োজন।' });
  }
  if (!message || message.length > 1_000) {
    return res.status(400).json({ code: 'INVALID_MESSAGE', error: '১ থেকে ১০০০ অক্ষরের মেসেজ প্রয়োজন।' });
  }

  const clientIp = trustedClientIp(clientIpFromReq(req)) || 'unknown';
  const quota = consumePublicChatQuota(`${businessId}:${clientIp}`);
  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    return res.status(429).json({
      code: 'RATE_LIMITED',
      error: 'খুব দ্রুত অনেক মেসেজ পাঠানো হয়েছে। একটু পর আবার চেষ্টা করুন।',
    });
  }

  try {
    const business = await loadBusinessById(businessId);
    if (!business || business.data?.status === 'suspended') {
      return res.status(404).json({ code: 'STORE_NOT_FOUND', error: 'স্টোরটি পাওয়া যায়নি।' });
    }

    const aiConfig = await getEffectiveGeminiConfig();
    const hasMerchantKey = Boolean(
      business.data?.useOwnApiKey
      && String(business.data?.customGeminiApiKey || '').trim(),
    );
    if (!hasMerchantKey && !aiConfig.hasProvider) {
      return res.status(503).json({
        code: 'AI_NOT_CONFIGURED',
        error: 'AI সহকারী এখন কনফিগার করা নেই।',
      });
    }

    // Prepaid gate: central-pool usage requires wallet balance
    if (!hasMerchantKey && !hasTokenBalance(business.data)) {
      return res.status(402).json({
        code: 'TOKENS_EXHAUSTED',
        error: 'এই স্টোরের AI ব্যালেন্স শেষ। স্টোর মালিক রিচার্জ করলে আবার চালু হবে।',
      });
    }

    // Default global key first; when it hits its limit the backup pool takes over.
    const pool = await getAiPool();
    const candidateKeys = geminiFailoverCandidates(pool, merchantOwnGeminiKey(business.data))
      .filter((item) => item.enabled && item.key && aiKeyAvailable(item.key))
      .map((item) => item.key);

    let response: any = null;
    for (const candidateKey of candidateKeys) {
      response = await generateChatResponse(
        message,
        String(req.body?.history || '').slice(-120_000),
        { ...business.data, id: business.id },
        String(req.body?.customerContext || '').slice(0, 8_000),
        undefined,
        candidateKey,
        String(req.body?.chatSummary || '').slice(0, 8_000),
      );
      if (!response.errorCode) break;
      cooldownAiKey(candidateKey, 'quota', 'chat-pool');
    }

    if (!response || response.errorCode) {
      return res.status(502).json({
        code: response?.errorCode || 'AI_UNAVAILABLE',
        error: 'AI সহকারী এই মুহূর্তে উত্তর দিতে পারছে না।',
      });
    }

    if (!hasMerchantKey) {
      const usedTokens = estimateTokens(
        `${message}\n${String(req.body?.history || '').slice(-120_000)}`,
        JSON.stringify(response)
      );
      chargeAiUsage(business.id, {
        text: '',
        provider: 'gemini',
        keyLabel: 'chat',
        tokensUsed: usedTokens,
        merchantKeyUsed: false,
      }, 'web-chat').catch(() => {});
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ response });
  } catch (error: any) {
    console.error('[Public Chat API]', error?.message || error);
    return res.status(500).json({
      code: 'CHAT_FAILED',
      error: 'AI উত্তর তৈরি করা যায়নি।',
    });
  }
});

// Test Connection Endpoint
app.post('/api/test-connection', async (req, res) => {
  const { businessId, ownerId } = req.body;
  console.log(`[TestConnection] Request received for biz: ${businessId}`);
  try {
    await logActivity(businessId, 'TEST_CONNECTION', 'সিস্টেম টেস্ট সফল! আপনার লগিং সিস্টেম ঠিকঠাক কাজ করছে। এবার ফেসবুক চেক করুন।', 'success', ownerId);
    res.json({ success: true, message: 'Log sent' });
  } catch (err) {
    console.error('[TestConnection Error]', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), adminDbReady: !!adminDb });
});

import { buildPublicSiteConfig } from '../src/lib/landingContent.js';

app.get('/api/public/config', async (_req, res) => {
  try {
    let publicData: any = {};
    let billingData: any = {};
    if (adminDb) {
      const [publicSnap, billingSnap] = await Promise.all([
        adminDb.collection('system_config').doc('public').get(),
        adminDb.collection('system_config').doc('billing').get(),
      ]);
      if (publicSnap.exists) publicData = publicSnap.data() || {};
      if (billingSnap.exists) billingData = billingSnap.data() || {};
    } else if (db) {
      const [publicSnap, billingSnap] = await Promise.all([
        getDoc(doc(db, 'system_config', 'public')),
        getDoc(doc(db, 'system_config', 'billing')),
      ]);
      if (publicSnap.exists()) publicData = publicSnap.data() || {};
      if (billingSnap.exists()) billingData = billingSnap.data() || {};
    }
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json(buildPublicSiteConfig(publicData, billingData));
  } catch (error: any) {
    console.error('[Public Config]', error?.message || error);
    return res.status(500).json({ error: 'Public configuration unavailable' });
  }
});

app.get('/api/client-ip', (req, res) => {
  const clientIp = trustedClientIp(clientIpFromReq(req));
  res.json({ clientIp });
});

app.get('/api/status', (req, res) => {
  res.json({
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    firebaseConfigured: !!process.env.FIREBASE_PROJECT_ID || !!process.env.FIREBASE_SERVICE_ACCOUNT,
    adminDbReady: !!adminDb,
    serverVersion: '1.4.1',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/ai/pool/reload', (_req, res) => {
  clearAiPoolCache();
  res.json({ ok: true });
});

app.get('/api/ai/pool/status', async (_req, res) => {
  clearAiPoolCache();
  const pool = await getAiPool();
  const enabled = pool.geminiKeys.filter((item) => item.enabled);
  const defaultLabel = pool.defaultGeminiKey ? (pool.defaultGeminiKeyLabel || 'Default Key') : '';
  res.json({
    ok: true,
    geminiModel: pool.geminiModel,
    hasDefaultKey: Boolean(pool.defaultGeminiKey),
    defaultKeyLabel: defaultLabel,
    geminiKeyCount: pool.geminiKeys.length,
    enabledCount: enabled.length + (pool.defaultGeminiKey ? 1 : 0),
    poolEnabledCount: enabled.length,
    hasOpenRouter: Boolean(pool.openRouterKey),
    hasOpenAi: Boolean(pool.openAiKey),
    hasProvider: aiPoolHasProvider(pool),
    adminDbReady: Boolean(adminDb),
    firestoreOk: Boolean(aiPoolCache?.firestoreOk),
    labels: [
      ...(defaultLabel ? [defaultLabel] : []),
      ...enabled.map((item) => item.label),
    ],
  });
});

app.post('/api/media/upload', async (req, res) => {
  const { dataUrl, businessId, kind } = req.body || {};
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ success: false, error: 'Valid image dataUrl required' });
  }
  try {
    const id = await storeMediaDoc(dataUrl, businessId || '', kind || 'product');
    const origin = publicOriginFromReq(req);
    const url = origin ? `${origin}/api/media/${id}` : `/api/media/${id}`;
    return res.json({ success: true, id, url });
  } catch (err: any) {
    console.error('[media upload]', err);
    return res.status(500).json({ success: false, error: err.message || 'Upload failed' });
  }
});

app.get('/api/media/:id', async (req, res) => {
  try {
    const data = await readMediaDoc(String(req.params.id));
    if (!data?.base64) return res.status(404).send('Not found');
    const buf = Buffer.from(data.base64, 'base64');
    res.setHeader('Content-Type', data.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(buf);
  } catch (err: any) {
    return res.status(500).send('Error');
  }
});

app.post('/api/courier/steadfast/book', async (req, res) => {
  const { orderId, businessId } = req.body || {};
  if (!orderId || !businessId) {
    return res.status(400).json({ success: false, error: 'orderId এবং businessId প্রয়োজন' });
  }
  try {
    let order: any = null;
    let businessData: any = null;
    if (adminDb) {
      const oSnap = await adminDb.collection('orders').doc(orderId).get();
      if (oSnap.exists) order = { id: oSnap.id, ...oSnap.data() };
      const bSnap = await adminDb.collection('businesses').doc(businessId).get();
      if (bSnap.exists) businessData = bSnap.data();
    } else if (db) {
      const oSnap = await getDoc(doc(db, 'orders', orderId));
      if (oSnap.exists()) order = { id: oSnap.id, ...oSnap.data() };
      const bSnap = await getDoc(doc(db, 'businesses', businessId));
      if (bSnap.exists()) businessData = bSnap.data();
    }
    if (!order) return res.status(404).json({ success: false, error: 'অর্ডার পাওয়া যায়নি' });
    if (!businessData) return res.status(404).json({ success: false, error: 'দোকান পাওয়া যায়নি' });
    if (order.courierTrackingId) {
      return res.json({ success: true, alreadyBooked: true, trackingCode: order.courierTrackingId, consignmentId: order.courierConsignmentId });
    }

    const booked = await bookSteadfastParcel(order, businessData);
    if (!booked.success) {
      return res.status(400).json({ success: false, error: booked.error });
    }

    const updates = {
      courierStatus: 'in_review',
      courierTrackingId: booked.trackingCode,
      courierConsignmentId: booked.consignmentId || '',
      status: 'shipped',
      updatedAtMs: Date.now(),
    };
    if (adminDb) {
      await adminDb.collection('orders').doc(orderId).update(updates);
    } else if (db) {
      await updateDoc(doc(db, 'orders', orderId), updates);
    }
    await logActivity(businessId, 'STEADFAST_BOOKED', `পার্সেল বুক: ${orderId} / ${booked.trackingCode}`, 'success', businessData.ownerId, booked);
    return res.json({ success: true, trackingCode: booked.trackingCode, consignmentId: booked.consignmentId });
  } catch (err: any) {
    console.error('[steadfast book]', err);
    return res.status(500).json({ success: false, error: err.message || 'Booking failed' });
  }
});

// Dynamic Gemini AI Diagnostic Test
app.post('/api/ai/test', async (req, res) => {
  const { apiKey, model } = req.body;
  const effectiveKey = (apiKey && typeof apiKey === 'string' && apiKey.trim()) || process.env.GEMINI_API_KEY || '';
  const pool = await getAiPool();
  const selectedModel = resolveSystemGeminiModel(model || pool.geminiModel);

  if (!effectiveKey) {
    return res.status(400).json({
      success: false,
      error: 'কোনো Gemini API Key কনফিগার করা নেই। অনুগ্রহ করে অ্যাডমিন বা শপ সেটিংস এ একটি ভ্যালিড API Key প্রদান করুন।'
    });
  }

  const startTime = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: "Hello! Reply with a single short sentence in Bengali: সেলকরি এআই ইঞ্জিন প্রস্তুত ও সক্রিয়।",
    });

    const latencyMs = Date.now() - startTime;
    const responseText = response.text?.trim() || 'সেলকরি এআই ইঞ্জিন প্রস্তুত ও সক্রিয়।';

    return res.json({
      success: true,
      latencyMs,
      responseText,
      model: selectedModel
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    console.error('Server AI Test Failed:', err?.message || err);
    let errorMsg = err?.message || 'সংযোগ ব্যর্থ হয়েছে।';
    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid') || errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('permission')) {
      errorMsg = 'API Key টি সঠিক নয় বা গুগল পারমিশন পাওয়া যায়নি। অনুগ্রহ করে Google AI Studio থেকে একটি ভ্যালিড Gemini API Key প্রদান করুন।';
    } else if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      errorMsg = 'এই API Key এর নির্ধারিত কোটা শেষ হয়েছে (Rate Limit / Quota Exceeded)।';
    } else if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('not found')) {
      errorMsg = `মডেল "${selectedModel}" পাওয়া যায়নি বা এই API Key দিয়ে অ্যাক্সেসযোগ্য নয়।`;
    }

    return res.status(400).json({
      success: false,
      latencyMs,
      error: errorMsg
    });
  }
});

// Webhook Paths configuration — kept as explicit aliases. Meta traffic is
// ALSO intercepted below by query/body (Vercel rewrites often land on
// `/api` or `/api/index.ts` instead of `/api/webhook`).
const webhookPaths = [
  '/webhook',
  '/webhook/:businessId',
  '/webhook/*',
  '/api/webhook',
  '/api/webhook/:businessId',
  '/api/webhook/*',
  '/api/messenger/webhook',
  '/api/messenger/webhook/:businessId',
  '/api/messenger/webhook/*',
  '/messenger/webhook',
  '/messenger/webhook/:businessId',
  '/messenger/webhook/*'
];

async function handleMessengerWebhookGet(req: express.Request, res: express.Response) {
  if ((req as any)._messengerVerifyHandled) return;
  (req as any)._messengerVerifyHandled = true;

  const mode = firstQueryValue((req.query as any)['hub.mode'] || (req.query as any).mode).toLowerCase();
  const token = firstQueryValue((req.query as any)['hub.verify_token'] || (req.query as any).verify_token);
  const challenge = firstQueryValue((req.query as any)['hub.challenge'] || (req.query as any).challenge);

  console.log(`[Webhook GET Handshake] Path=${req.path}, Mode=${mode}, Token=${token ? 'set' : 'empty'}, Challenge=${challenge}`);

  if (mode === 'subscribe' && challenge && token) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).send(challenge);
    logActivity('system', 'WEBHOOK_VERIFIED', 'Handshake successful.', 'success', 'system').catch(() => {});
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(403).send('Forbidden');
}

app.use((req, res, next) => {
  if (req.method === 'GET' && isMetaWebhookVerification(req.query as Record<string, unknown>)) {
    return handleMessengerWebhookGet(req, res);
  }
  if (req.method === 'POST' && isMetaPageWebhookPayload(req.body)) {
    return handleMessengerWebhookPost(req, res);
  }
  next();
});

app.get(webhookPaths, handleMessengerWebhookGet);

// Consolidated Messenger Message Handler (POST)
async function handleMessengerWebhookPost(req: any, res: any) {
  if ((req as any)._messengerWebhookHandled) return;
  (req as any)._messengerWebhookHandled = true;
  const pathBizId = webhookBusinessIdFromReq(req);
  const body = req.body;
  let webhookHadFailure = false;

  // IMPORTANT: We used to ack Facebook immediately with res.send() and then
  // process the message in a detached async IIFE "in the background".
  // On Vercel serverless functions, the runtime is allowed to freeze/kill
  // the function as soon as the HTTP response is flushed — there is no
  // guarantee that code after res.send() keeps running. This was the root
  // cause of the bot "sometimes replying, sometimes not": whether the
  // background work finished before Vercel froze the instance was random.
  // Fix: fully await processing and only respond once it's done. All AI work
  // is deadline-bounded below, and transient failures return 503 so Meta can
  // retry instead of permanently dropping the customer's message.
  try {
      // Diagnostic log
      await logActivity(pathBizId || 'system', 'WEBHOOK_PROCESSED', `Webhook hit. Entries: ${body.entry?.length || 0}`, 'info', 'system', body);

      if (body.object !== 'page') return;
      if (!body.entry || !Array.isArray(body.entry)) return;

      for (const entry of body.entry) {
        const pageId = String(entry.id).trim();
        try {
          await handlePageFeedComments(entry, pathBizId);
        } catch (feedErr: any) {
          console.error('[Webhook] Feed comment handler error:', feedErr?.message || feedErr);
        }
        const messaging = entry.messaging || entry.standby;
        
        if (!messaging) continue;

        for (const webhookEvent of messaging) {
          let claimedMessageMid = '';
          let eventFailed = false;
          try {
            const senderId = String(webhookEvent.sender?.id || '').trim();
            const messageText = webhookEvent.message?.text || '';
            const messageMid = String(webhookEvent.message?.mid || '').trim();
            const isPostback = !!webhookEvent.postback;
            const payload = webhookEvent.postback?.payload || '';
            
            if (!senderId) {
              await logActivity(pathBizId || 'system', 'ERROR', '[Webhook] No senderId found in event payload.', 'error', 'system', webhookEvent);
              continue;
            }
            
            // Skip echo/delivery/read/etc.
            if (webhookEvent.message?.is_echo || webhookEvent.delivery || webhookEvent.read) {
              console.log('[Webhook] Skipping non-message event');
              continue;
            }

            // Deduplication Guard (Idempotency)
            if (messageMid && isDuplicateMessage(messageMid)) {
              console.log(`[Webhook] Duplicate message mid=${messageMid} ignored.`);
              continue;
            }
            claimedMessageMid = messageMid;

            // Identify Store by Page ID (Multi-Strategy Bulletproof Matcher)
            const cleanPageId = String(pageId).trim();

            console.log(`[Webhook] Incoming Event for Page ID: "${cleanPageId}", URL BizId: "${pathBizId || 'none'}"`);

            const resolved = await resolveBusinessForWebhook(cleanPageId, pathBizId);
            const businessData = resolved.businessData;
            const bizId = resolved.bizId;

            if (!businessData) {
              console.error(`[Webhook] Business not found for Page ID: "${cleanPageId}"`);
              await logActivity('system', 'ERROR', `বট রিপ্লাই দিতে পারেনি: আপনার ফেসবুক পেজ আইডি (${cleanPageId}) ডাটাবেজের কোনো দোকানের সাথে মেলেনি। দোকানের সেটিংসে সঠিক Page ID প্রদান করুন।`, 'error', 'system', { 
                receivedPageId: cleanPageId,
                pathBizId: pathBizId || 'none'
              });
              await saveMessengerLog(pathBizId || 'unassigned', {
                senderId,
                pageId: cleanPageId,
                message: messageText || 'Postback / Action',
                status: 'error',
                error: `ফেসবুক পেজ আইডি (${cleanPageId}) ডাটাবেজে পাওয়া যায়নি।`
              });
              continue;
            }

            const ownerId = businessData.ownerId;
            const shopName = businessData.name || "আমাদের স্টোর";
            const capiDay = utcDay();
            let capiFunnelAt: Record<string, string> = {};

            // Ad referral attribution: know which ad/link brought this customer
            // and which product to pitch first.
            const referralInfo = extractReferralInfo(webhookEvent);
            let referralProduct = '';
            if (referralInfo) {
              referralProduct = matchProductForReferral(businessData, referralInfo);
              await saveCustomerAcquisition(bizId!, senderId, cleanPageId, referralInfo, referralProduct);
              const refLabel = referralInfo.adTitle || referralInfo.ref || referralInfo.adId || referralInfo.postId;
              await logActivity(bizId!, 'AD_REFERRAL', `কাস্টমার বিজ্ঞাপন/লিংক থেকে এসেছে${refLabel ? ` (${refLabel})` : ''}${referralProduct ? ` → টার্গেট পণ্য: ${referralProduct}` : ''}`, 'info', ownerId);
              const leadSent = await sendCapiEvent(businessData, 'Lead', {
                psid: senderId,
                pageId: cleanPageId,
                ctwaClid: referralInfo.ctwaClid,
                contentName: referralProduct || referralInfo.adTitle || undefined,
                adId: referralInfo.adId,
                adRef: referralInfo.ref,
                adSource: referralInfo.adTitle || referralInfo.ref || referralInfo.adId,
                bizId: bizId!,
                ownerId,
                alreadySentToday: capiFunnelAt,
              });
              if (leadSent.ok) capiFunnelAt.Lead = capiDay;
            }

            const incomingMedia = isPostback ? [] : extractMessengerAttachments(webhookEvent);

            let finalMessageText = messageText;
            if (isPostback) {
              if (payload.startsWith('ORDER_')) {
                const pid = payload.replace('ORDER_', '');
                finalMessageText = `আমি এই প্রোডাক্টটি (ID: ${pid}) অর্ডার করতে চাই।`;
              } else {
                finalMessageText = webhookEvent.postback?.title || payload || 'শুরু করুন';
              }
            } else if (webhookEvent.message?.quick_reply) {
              finalMessageText = webhookEvent.message.quick_reply.payload || messageText;
            }

            if (!finalMessageText && incomingMedia.length === 0) {
              console.log('[Webhook] Empty message text, skipping processing');
              continue;
            }

            if (incomingMedia.length > 0) {
              finalMessageText = mediaPlaceholderText(incomingMedia, finalMessageText);
            }

            // Retrieve recent chat history for context (Robust multi-source)
            // Two layers of memory:
            //  1. Long-term summary (survives forever, from `customers.chatSummary`) —
            //     so the bot still "remembers" a customer even if they come back
            //     weeks later and the raw message window has scrolled past.
            //  2. Short-term raw transcript (last N messages) for exact wording/context.
            let chatHistoryText = '';
            let longTermSummary = '';
            let savedLead: any = {};
            let savedAcquisition: any = null;
            let lastOrderAtMs = 0;
            let lastOrderId = '';
            let facebookName = '';
            let facebookNameFetchedAtMs = 0;
            const HISTORY_WINDOW = CHAT_MEMORY_LIMIT;

            try {
              if (adminDb) {
                const custSnap = await adminDb.collection('customers').doc(`${bizId}_${senderId}`).get();
                if (custSnap.exists) {
                  const c = custSnap.data() || {};
                  longTermSummary = c.chatSummary || '';
                  savedLead = c.leadInfo || {};
                  savedAcquisition = c.acquisition || null;
                  lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
                  lastOrderId = String(c.lastOrderId || '');
                  facebookName = String(c.facebookName || '').trim();
                  facebookNameFetchedAtMs = Number(c.facebookNameFetchedAtMs) || 0;
                  capiFunnelAt = { ...(c.capiFunnelAt || {}), ...capiFunnelAt };
                }
              } else if (db) {
                const custSnap = await getDoc(doc(db, 'customers', `${bizId}_${senderId}`));
                if (custSnap.exists()) {
                  const c = custSnap.data() || {};
                  longTermSummary = c.chatSummary || '';
                  savedLead = c.leadInfo || {};
                  savedAcquisition = c.acquisition || null;
                  lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
                  lastOrderId = String(c.lastOrderId || '');
                  facebookName = String(c.facebookName || '').trim();
                  facebookNameFetchedAtMs = Number(c.facebookNameFetchedAtMs) || 0;
                  capiFunnelAt = { ...(c.capiFunnelAt || {}), ...capiFunnelAt };
                }
              }
            } catch (sumErr) {
              console.warn('[Webhook] Long-term summary load notice:', sumErr);
            }

            try {
              // 1. Try reading the unified chats doc which has messages array
              let chatDocData: any = null;
              if (adminDb) {
                const cSnap = await adminDb.collection('chats').doc(`${bizId}_${senderId}`).get();
                if (cSnap.exists) chatDocData = cSnap.data();
              } else if (db) {
                const cSnap = await getDoc(doc(db, 'chats', `${bizId}_${senderId}`));
                if (cSnap.exists()) chatDocData = cSnap.data();
              }

              if (chatDocData && Array.isArray(chatDocData.messages) && chatDocData.messages.length > 0) {
                const recentMsgs = chatDocData.messages.slice(-HISTORY_WINDOW);
                chatHistoryText = recentMsgs.map((m: any) => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.text}`).join('\n');
              } else {
                // 2. Fallback to chat_history collection query
                const historyRows = await loadChatHistoryFallback(bizId!, senderId, HISTORY_WINDOW);
                if (historyRows.length > 0) {
                  chatHistoryText = historyRows
                    .map((m: any) => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.text}`)
                    .join('\n');
                }
              }
            } catch (histErr) {
              console.warn('[Webhook] Chat history load notice:', histErr);
            }

            console.log(`[Webhook] Message from ${senderId}: ${finalMessageText}`);
            await logActivity(bizId!, 'INCOMING', `Customer: "${finalMessageText.substring(0, 70)}"`, 'info', ownerId);
            await saveChatMessage(bizId!, senderId, 'user', finalMessageText).catch(e => console.error('Save chat error:', e));
            await touchMessengerCustomer(bizId!, senderId).catch(() => {});
            await saveMessengerLog(bizId!, { senderId, pageId: cleanPageId, message: finalMessageText, status: 'received' });

            const pageAccessToken = pageTokenForBusiness(businessData, cleanPageId);

            if (!pageAccessToken) {
              console.error(`[Webhook] No access token for biz: ${bizId}. Data:`, JSON.stringify(businessData));
              const noTokenMsg = 'ফেসবুক পেজ এক্সেস টোকেন (Page Access Token) পাওয়া যায়নি। সেটিংস থেকে Token দিন।';
              await logActivity(bizId!, 'ERROR', noTokenMsg, 'error', ownerId);
              await saveMessengerLog(bizId!, { senderId, pageId: cleanPageId, message: finalMessageText, status: 'error', error: noTokenMsg });
              continue;
            }

            // Check Live Human Takeover & AI Pause Status
            let isHumanTakeoverActive = false;
            try {
              let chatDocData: any = null;
              if (adminDb) {
                const cSnap = await adminDb.collection('chats').doc(`${bizId}_${senderId}`).get();
                if (cSnap.exists) chatDocData = cSnap.data();
              } else if (db) {
                const cSnap = await getDoc(doc(db, 'chats', `${bizId}_${senderId}`));
                if (cSnap.exists()) chatDocData = cSnap.data();
              }

              if (chatDocData) {
                const now = Date.now();
                if (chatDocData.isPaused === true || (chatDocData.humanTakeoverUntil && chatDocData.humanTakeoverUntil > now)) {
                  isHumanTakeoverActive = true;
                  console.log(`[Webhook] Human Takeover active for customer ${senderId}. Skipping AI response.`);
                  await logActivity(bizId!, 'HUMAN_TAKEOVER', `মার্চেন্ট সরাসরি চ্যাটে যুক্ত রয়েছেন, এআই সাময়িকভাবে নীরব আছে।`, 'info', ownerId);
                  continue;
                }
              }
            } catch (takeoverErr) {
              console.warn('[Webhook] Takeover check notice:', takeoverErr);
            }

            const storeFeatures = mergeFeatures(businessData.features);
            if (!shouldRunAi(storeFeatures)) {
              if (isFeatureEnabled(storeFeatures, 'messengerRepliesEnabled')) {
                const offline = storeFeatures.offlineMessage
                  || (isQuietHoursNow(storeFeatures)
                    ? 'এখন আমাদের অফলাইন সময়। সকালে আমাদের টিম আপনাকে উত্তর দিবে।'
                    : 'ধন্যবাদ! আমাদের সেলস টিম শীঘ্রই আপনার মেসেজের উত্তর দিবে।');
                try {
                  await sendPlainText(pageAccessToken, senderId, offline);
                  await saveChatMessage(bizId!, senderId, 'bot', offline);
                  await logActivity(bizId!, 'AI_PAUSED', isQuietHoursNow(storeFeatures) ? 'নীরব সময় — অফলাইন মেসেজ পাঠানো হয়েছে।' : 'এআই সুইচবোর্ডে বন্ধ — অফলাইন মেসেজ পাঠানো হয়েছে।', 'info', ownerId);
                } catch (offlineErr) {
                  console.warn('[Webhook] Offline reply failed:', offlineErr);
                }
              } else {
                await logActivity(bizId!, 'AI_SILENT', 'এআই ও মেসেঞ্জার রিপ্লাই সুইচবোর্ডে বন্ধ।', 'info', ownerId);
              }
              continue;
            }

            // Check if Customer explicitly requests Human Support / Agent
            const lowerMsg = finalMessageText.toLowerCase();
            const isHumanRequested = /মানুষ|manush|agent|human|representative|মালিক|owner|অভিযোগ|কথা বলতে চাই|সরাসরি কথা|helpdesk|support/i.test(lowerMsg);
            if (isHumanRequested && isFeatureEnabled(storeFeatures, 'humanHandoverEnabled')) {
              const takeoverReply = "অবশ্যই! আমাদের কাস্টমার কেয়ার প্রতিনিধির কাছে আপনার বার্তাটি ফরোয়ার্ড করা হয়েছে। শীঘ্রই আমাদের একজন প্রতিনিধি আপনার সাথে কথা বলবেন।";
              try {
                if (adminDb) {
                  await adminDb.collection('chats').doc(`${bizId}_${senderId}`).set({
                    isPaused: true,
                    humanTakeoverUntil: Date.now() + 60 * 60 * 1000,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  }, { merge: true });
                }
                const cleanToken = String(pageAccessToken).trim();
                await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, {
                  recipient: { id: senderId },
                  messaging_type: 'RESPONSE',
                  message: { text: takeoverReply }
                }, { timeout: 15000 });
                await saveChatMessage(bizId!, senderId, 'bot', takeoverReply);
                await logActivity(bizId!, 'AGENT_HANDOVER', `কাস্টমার মানব এজেন্টের সাহায্য চেয়েছেন। ১ ঘণ্টার জন্য বট পজ করা হয়েছে।`, 'info', ownerId);
                continue;
              } catch (handoverErr) {
                console.error('[Webhook] Handover error:', handoverErr);
              }
            }

            const aiConfig = await getEffectiveGeminiConfig();
            const merchantAiKeys = merchantOwnGeminiKey(businessData);
            if (!aiConfig.hasProvider && merchantAiKeys.length === 0) {
              console.error('[Webhook] Gemini AI API key not configured in system');
              const noAiMsg = 'সেন্ট্রাল জেমিনি এপিআই কি কনফিগার করা নেই। অ্যাডমিন প্যানেলে API Key প্রদান করুন।';
              await logActivity(bizId!, 'ERROR', noAiMsg, 'error', ownerId);
              await saveMessengerLog(bizId!, { senderId, pageId: cleanPageId, message: finalMessageText, status: 'error', error: noAiMsg });
              if (isFeatureEnabled(storeFeatures, 'messengerRepliesEnabled')) {
                await sendResilientSalesFallback({
                  businessId: bizId!,
                  businessData,
                  ownerId,
                  pageId: cleanPageId,
                  pageAccessToken,
                  senderId,
                  message: finalMessageText,
                  mediaKinds: incomingMedia.map((item) => item.kind),
                  reason: 'ai-not-configured'
                });
              }
              continue;
            }

            // Token wallet gate: central-pool AI is prepaid. Empty wallet =
            // use the no-cost catalog/FAQ fallback so the storefront stays
            // responsive without bypassing paid AI usage.
            if (!hasTokenBalance(businessData)) {
              await notifyTokensEmpty(bizId!, ownerId);
              await saveMessengerLog(bizId!, {
                senderId,
                pageId: cleanPageId,
                message: finalMessageText,
                status: 'error',
                error: 'টোকেন ব্যালেন্স শেষ — AI ব্যবহার হয়নি; নিরাপদ fallback উত্তর পাঠানো হয়েছে।'
              });
              if (isFeatureEnabled(storeFeatures, 'messengerRepliesEnabled')) {
                await sendResilientSalesFallback({
                  businessId: bizId!,
                  businessData,
                  ownerId,
                  pageId: cleanPageId,
                  pageAccessToken,
                  senderId,
                  message: finalMessageText,
                  mediaKinds: incomingMedia.map((item) => item.kind),
                  reason: 'token-balance-empty'
                });
              }
              continue;
            }

            let downloadedMedia: DownloadedMedia[] = [];
            if (incomingMedia.length > 0) {
              try {
                downloadedMedia = await withDeadline(
                  downloadIncomingMedia(incomingMedia, pageAccessToken),
                  10_000,
                  'Messenger media download'
                );
              } catch (mediaErr: any) {
                console.warn('[Webhook] Media download deadline reached; continuing with text context:', mediaErr?.message);
                downloadedMedia = [];
              }
              if (!isFeatureEnabled(storeFeatures, 'photoReplyEnabled')) {
                downloadedMedia = downloadedMedia.filter((m) => m.kind !== 'image');
              }
              if (!isFeatureEnabled(storeFeatures, 'voiceReplyEnabled')) {
                downloadedMedia = downloadedMedia.filter((m) => m.kind !== 'audio');
              }
              console.log(`[Webhook] Media attachments: ${incomingMedia.length} incoming, ${downloadedMedia.length} downloaded`);
            }

            await sendTypingOn(pageAccessToken, senderId);

            if (!facebookName && Date.now() - facebookNameFetchedAtMs > 24 * 60 * 60 * 1000) {
              facebookName = await fetchMessengerProfileName(pageAccessToken, senderId);
              const profileUpdate: Record<string, unknown> = { facebookNameFetchedAtMs: Date.now() };
              if (facebookName) {
                profileUpdate.facebookName = facebookName;
                profileUpdate.name = facebookName;
              }
              await touchMessengerCustomer(bizId!, senderId, profileUpdate).catch(() => {});
            }

            // AI Processing
            console.log(`[Webhook] Starting AI processing with model: ${aiConfig.model}`);
            await logActivity(bizId!, 'AI_START', `বটের কাছে পাঠানো হচ্ছে (${aiConfig.model})...`, 'info', ownerId);

            const products = selectProductsForPrompt(
              businessData.products || [],
              `${referralProduct} ${savedAcquisition?.matchedProduct || ''} ${finalMessageText}\n${chatHistoryText}`
            );
            const rawProducts = businessData.products || [];

            const allFaqs = isFeatureEnabled(storeFeatures, 'faqEnabled') ? (businessData.faqs || []) : [];
            const generalFaqs = allFaqs
              .filter((f: any) => (f.type || (f.productId ? 'product' : 'general')) === 'general')
              .map((f: any) => `[${f.category || 'General'}] Q: ${f.question} -> A: ${f.answer}`)
              .join('\n');

            const productFaqs = allFaqs
              .filter((f: any) => (f.type || (f.productId ? 'product' : 'general')) === 'product')
              .map((f: any) => `[Product: ${f.productName || f.productId}] Q: ${f.question} -> A: ${f.answer}`)
              .join('\n');

            const knownLead = mergeLead(
              savedLead,
              facebookName ? { name: String(savedLead?.name || '').trim() || facebookName } : {},
              `${finalMessageText}\n${chatHistoryText}`
            );

            // Which ad brought this customer -> which product to pitch first
            const acqForPrompt = referralInfo
              ? { adTitle: referralInfo.adTitle, ref: referralInfo.ref, adId: referralInfo.adId, matchedProduct: referralProduct }
              : savedAcquisition;
            const acqLabel = String(acqForPrompt?.adTitle || acqForPrompt?.ref || acqForPrompt?.adId || '').trim();
            const acqProduct = String(acqForPrompt?.matchedProduct || matchProductForReferral(businessData, acqForPrompt || null) || '').trim();
            const adSourceBlock = (acqLabel || acqProduct)
              ? `\nঅ্যাড সোর্স (গুরুত্বপূর্ণ): কাস্টমার ফেসবুক বিজ্ঞাপন${acqLabel ? ` "${acqLabel}"` : ''} থেকে এসেছে।${acqProduct ? ` টার্গেট পণ্য: "${acqProduct}" — কাস্টমার ভিন্ন কিছু না চাইলে প্রথমে এই পণ্যটি নিয়েই কথা বলবে এবং এর দাম ও অফার জানাবে। ছবি তখনই পাঠাবে যখন কাস্টমার নিজে ছবি চাইবে।` : ' কাস্টমার কোন পণ্যের অ্যাড দেখে এসেছে বুঝে সেই পণ্য নিয়ে কথা বলবে।'}\n`
              : '';
            const recentOrders = isFeatureEnabled(storeFeatures, 'orderTrackingEnabled')
              ? await loadRecentOrdersForCustomer(bizId!, senderId, knownLead.phone)
              : [];
            const recentOrderText = recentOrders.length
              ? recentOrders.map((o: any) => `- ${o.id}: ${o.productName} x${o.quantity}, স্ট্যাটাস ${o.status}, ফোন ${o.phone}, ${o.createdAtMs ? Math.round((Date.now() - o.createdAtMs) / 60000) + ' মিনিট আগে' : ''}`).join('\n')
              : 'কোনো সাম্প্রতিক অর্ডার নেই';

            const merchantCustomBlock = buildMerchantCustomInstructionBlock(
              businessData.customSystemPrompt || businessData.botPersona || ''
            );
            const replyStyleBlock = buildReplyStyleBlock(
              businessData.customSystemPrompt || businessData.botPersona || ''
            );

            const prompt = `তুমি "${businessData.name}" পেজের ইনবক্সে রিপ্লাই দেওয়া একজন বাস্তব মানুষ বিক্রয়কর্মী — স্মার্ট, সংক্ষিপ্ত ও টু-দ্য-পয়েন্ট। JSON স্কিমা অনুযায়ী উত্তর দাও (JSON শুধু সিস্টেমের জন্য; reply ফিল্ডের লেখাটা হবে সম্পূর্ণ মানুষের মতো)।

# কঠোর নির্দেশাবলী:
১. ডিফল্টে সংক্ষিপ্ত ও নির্দিষ্ট উত্তর (১-৩ বাক্য)। অপ্রয়োজনীয় ভূমিকা বা জোর করে পণ্য তালিকা দেবে না। মার্চেন্টের অতিরিক্ত নির্দেশনায় ইমোজি, সাজানো সামারি বা নির্দিষ্ট ফরম্যাট থাকলে সেটাই প্রাধান্য পাবে।
২. জানা তথ্য (নাম/ফোন/ঠিকানা) আর কখনো জিজ্ঞেস করবে না — order_data-তে প্রতিবার কপি করবে। কাস্টমার নিজে নাম না দিলে ফেসবুক প্রোফাইল নাম order_data.name-এ বসাবে।
৩. সাম্প্রতিক অর্ডার থাকলে আবার অর্ডার করতে বলবে না; স্ট্যাটাস জানাবে।
৪. রিভিউ/প্রুফ/কাস্টমার ফটো চাইলেই শুধু show_review_images=true। সাধারণ ছবি চাইলে show_product_image=true, রিভিউ মিশাবে না। দাম জানতে চাইলে ছবি পাঠাবে না। ছবি পাঠালে reply-তে "ইমেজ অ্যাটাচ" বা "কাস্টমার রিভিউ" লিখবে না — সাধারণ মানুষের মতো ছোট করে বলবে যেমন "এই দেখেন"।
৫. নাম+১১ ডিজিট ফোন+পূর্ণ ঠিকানা+পণ্য জানা এবং কাস্টমার কনফার্ম করলে should_create_order=true, conversation_stage=order_completed, event_name=Purchase, need_more_info=false। নাম না থাকলে ফেসবুক প্রোফাইল নাম যথেষ্ট।
৬. minPrice-এর নিচে দাম দিবে না।
৭. ফটো/ছবি রিপ্লাই: কাস্টমার ছবি পাঠালে অবশ্যই ছবিটি দেখে উত্তর দাও — নীরব থাকবে না।
   - পণ্য/ক্যাটালগ স্ক্রিনশট: ক্যাটালগের সাথে মিলিয়ে নাম, দাম ও স্টক বলো; অর্ডার করতে চান কিনা জিজ্ঞেস করো। কাস্টমার নিজে ছবি না চাইলে show_product_image true করবে না।
   - পেমেন্ট/বিকাশ/নগদ/রকেট স্ক্রিনশট: "স্ক্রিনশট পেয়েছি, আমাদের টিম ভেরিফাই করে আপনাকে জানাবে" — নিজে থেকে পেমেন্ট কনফার্মড বলবে না।
   - নাম/ঠিকানা/ফোন লেখা ছবি: পড়ে নিশ্চিত করে নাও।
   - ক্ষতি/কমপ্লেইন/ডেলিভারি সমস্যা: সহানুভূতি দেখিয়ে সমাধানের কথা বলো।
   - স্পষ্ট না হলে: "ছবিটি পেয়েছি — এটা কোন পণ্য বা বিষয় সম্পর্কে জানতে চান?"
৮. ভয়েস মেসেজ রিপ্লাই: অডিও শুনে কাস্টমার যা বলেছে তা বুঝে ঠিক টেক্সট মেসেজের মতো সেলস উত্তর দাও। উত্তরের প্রথম বাক্যে সংক্ষেপে নিশ্চিত করো তুমি কী শুনেছ। অডিও বোঝা না গেলে নম্রভাবে লিখে পাঠাতে বলো।
৯. তথ্যের সত্যতার অগ্রাধিকার: পণ্যতালিকা → FAQ → সাম্প্রতিক অর্ডার/জানা তথ্য। কোনো দাম, স্টক, অফার, পলিসি বা অর্ডার স্ট্যাটাস অনুমান করবে না। তথ্য না থাকলে সংক্ষেপে বলবে যে নিশ্চিত তথ্য পাওয়া যাচ্ছে না।
১০. কাস্টমারের বর্তমান বার্তা আগের কথার বিরোধী হলে অনুমান না করে ছোট একটি পরিষ্কার প্রশ্ন করবে।

দোকানের তথ্য: ${businessData.description || ''}
পণ্যতালিকা:
${JSON.stringify(products, null, 2)}

সাধারণ FAQ:
${generalFaqs || 'নেই'}

পণ্য FAQ:
${productFaqs || 'নেই'}

# পরিচয় (কোনো অবস্থাতেই ভাঙবে না):
- তুমি এই দোকানের সেলস টিমের একজন বাস্তব মানুষ। কখনোই বলবে না বা কোনোভাবে বুঝতে দেবে না যে তুমি এআই, বট, রোবট, ভার্চুয়াল অ্যাসিস্ট্যান্ট, অটোমেটেড সিস্টেম বা কম্পিউটার প্রোগ্রাম।
- কেউ সরাসরি জিজ্ঞেস করলে ("আপনি কি রোবট/বট/এআই?") স্বাভাবিকভাবে হালকা করে এড়িয়ে কাজের কথায় ফিরবে। যেমন: "হাহা, আমি পেজ থেকেই রিপ্লাই দিচ্ছি। বলেন, কোনটা নিতে চাচ্ছিলেন?"
- প্রতিবার একই বাক্য বা একই ঢঙে শুরু করবে না। আগের মেসেজের সাথে স্বাভাবিক ধারাবাহিকতা রাখবে, যেন একজন মানুষই টানা কথা বলছে।
- ইচ্ছাকৃত টাইপো করবে না।
- অর্ডার নিশ্চিত/কনফার্ম হয়েছে এমন কথা তখনই বলবে যখন এবারের উত্তরে should_create_order=true দিচ্ছ। ফোন/ঠিকানা অসম্পূর্ণ থাকলে "অর্ডার কনফার্ম" বলবে না — আগে বাকি তথ্যটা স্বাভাবিকভাবে চেয়ে নেবে।

${replyStyleBlock}

${buildFeaturePromptBlock(storeFeatures)}
${adSourceBlock}
কাস্টমারের জানা তথ্য (আবার চাইবে না):
নাম: ${knownLead.name || facebookName || 'অজানা'} | ফেসবুক প্রোফাইল নাম: ${facebookName || 'পাওয়া যায়নি'} | ফোন: ${knownLead.phone || 'অজানা'} | ঠিকানা: ${knownLead.address || 'অজানা'} | পণ্য: ${knownLead.product_name || 'অজানা'}
কাস্টমার নিজে নাম না দিলে অর্ডারের নাম হিসেবে ফেসবুক প্রোফাইল নাম ব্যবহার করবে।

সাম্প্রতিক অর্ডার:
${recentOrderText}

দীর্ঘমেয়াদী সামারি:
${isFeatureEnabled(storeFeatures, 'chatSummaryEnabled') ? (longTermSummary || 'নেই') : 'মেমোরি বন্ধ'}
${downloadedMedia.length > 0 ? `\nকাস্টমারের সাথে পাঠানো মিডিয়া এই রিকোয়েস্টে সংযুক্ত আছে (${downloadedMedia.map((m) => m.kind === 'audio' ? 'ভয়েস' : 'ছবি').join(', ')})। মিডিয়া দেখে/শুনে উত্তর দাও।` : ''}

পূর্ববর্তী কথোপকথন:
${chatHistoryText || 'নতুন আলাপ'}

কাস্টমারের বর্তমান বার্তা: "${finalMessageText}"

${merchantCustomBlock}`;
              
              const startTime = Date.now();
              const geminiParts: any[] = [{ text: prompt }];
              for (const media of downloadedMedia) {
                geminiParts.push({ inlineData: { mimeType: media.mimeType, data: media.data } });
              }
              let primaryReplySent = false;

              try {
                console.log(`[Webhook] Calling AI pool for biz: ${bizId}${downloadedMedia.length ? ` with ${downloadedMedia.length} media part(s)` : ''}`);
                let responseText = '';

                // Multi-key pool with automatic failover: every enabled Gemini
                // key is tried (quota-hit keys rotate out), then OpenRouter,
                // then OpenAI as text-only fallbacks.
                const aiResult = await aiGenerate({
                  parts: geminiParts,
                  textPrompt: prompt,
                  model: aiConfig.model,
                  schema: webhookResponseSchema,
                  temperature: Math.min(0.45, Math.max(0, Number(businessData.aiTemperature ?? aiConfig.temperature ?? 0.35))),
                  maxTokens: aiConfig.maxTokens,
                  preferredKeys: merchantAiKeys,
                });
                responseText = aiResult.text;
                if (aiResult.provider !== 'gemini') {
                  console.log(`[Webhook] Reply served by fallback provider: ${aiResult.provider}`);
                }
                // Bill the merchant's wallet with the REAL token usage
                chargeAiUsage(bizId!, aiResult, 'messenger').catch(() => {});

                const latencyMs = Date.now() - startTime;
                
                let reply = "";
                let aiRes: any = null;
                try {
                  if (responseText.includes('{')) {
                    const cleaned = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
                    aiRes = JSON.parse(cleaned);
                    reply = aiRes.reply || aiRes.message || responseText;
                  } else {
                    reply = responseText;
                  }
                } catch (e) {
                  reply = responseText;
                }

                if (!reply || reply.trim().length === 0) {
                  const hasAudio = incomingMedia.some((m) => m.kind === 'audio');
                  const hasImage = incomingMedia.some((m) => m.kind === 'image');
                  if (hasAudio) {
                    reply = 'আপনার ভয়েস মেসেজটি পেয়েছি। অনুগ্রহ করে একটু লিখে জানান আপনি কোন পণ্য বা বিষয় নিয়ে সাহায্য চান?';
                  } else if (hasImage) {
                    reply = 'আপনার ছবিটি পেয়েছি। এটা কোন পণ্য বা বিষয় সম্পর্কে জানতে চান?';
                  } else {
                    reply = 'ধন্যবাদ! আপনার মেসেজটি আমরা পেয়েছি। আমাদের সেলস টিম শীঘ্রই আপনার সাথে যোগাযোগ করবে।';
                  }
                }

                if (aiRes) {
                  const imageFlags = resolveImageSendFlags(finalMessageText, aiRes);
                  aiRes.show_product_image = imageFlags.show_product_image;
                  aiRes.show_review_images = imageFlags.show_review_images;
                  if (!isFeatureEnabled(storeFeatures, 'imageDisplayEnabled')) aiRes.show_product_image = false;
                  if (!isFeatureEnabled(storeFeatures, 'reviewImagesEnabled')) aiRes.show_review_images = false;
                  if (!isFeatureEnabled(storeFeatures, 'autoOrderEnabled')) aiRes.should_create_order = false;
                  if (!isFeatureEnabled(storeFeatures, 'chatSummaryEnabled')) aiRes.summary = '';
                }

                const nextLead = mergeLead(knownLead, {
                  ...(aiRes?.order_data || {}),
                  product_name:
                    aiRes?.order_data?.product_name
                    || aiRes?.product_name
                    || knownLead.product_name
                    || acqProduct
                    || (rawProducts.length === 1 ? rawProducts[0]?.name : ''),
                }, `${finalMessageText}\n${chatHistoryText}`);
                if (!String(nextLead.name || '').trim() && facebookName) {
                  nextLead.name = facebookName;
                }

                const modelRequestedOrder = Boolean(
                  aiRes?.should_create_order ||
                  (aiRes?.conversation_stage === 'order_completed' && aiRes?.need_more_info === false) ||
                  (aiRes?.event_name === 'Purchase' && aiRes?.need_more_info === false)
                );
                const wantsOrder = shouldCreateConfirmedOrder({
                  modelRequested: modelRequestedOrder,
                  customerMessage: finalMessageText,
                  hasCompleteOrder: hasCompleteLead(nextLead),
                });

                // Messenger funnel: stage is the source of truth; AI may
                // advance one step. Purchase is sent only after an order save.
                const funnelEvent = resolveMessengerFunnelEvent({
                  conversationStage: String(aiRes?.conversation_stage || ''),
                  eventName: String(aiRes?.event_name || ''),
                  alreadySentToday: capiFunnelAt,
                  day: capiDay,
                });
                if (funnelEvent) {
                  const funnelSent = await sendCapiEvent(businessData, funnelEvent, {
                    psid: senderId,
                    pageId: cleanPageId,
                    phone: nextLead.phone,
                    name: nextLead.name || facebookName,
                    ctwaClid: savedAcquisition?.ctwaClid || referralInfo?.ctwaClid,
                    contentName: aiRes?.product_name || nextLead.product_name || acqProduct || undefined,
                    adId: String(acqForPrompt?.adId || ''),
                    adRef: String(acqForPrompt?.ref || ''),
                    adSource: acqLabel || '',
                    bizId: bizId!,
                    ownerId,
                    alreadySentToday: capiFunnelAt,
                  });
                  if (funnelSent.ok) capiFunnelAt[funnelEvent] = capiDay;
                }

                if (modelRequestedOrder && !hasCompleteLead(nextLead) && isFeatureEnabled(storeFeatures, 'autoOrderEnabled')) {
                  const missing = [
                    !String(nextLead.name || '').trim() ? 'নাম' : '',
                    !normalizePhone(nextLead.phone) ? 'ফোন' : '',
                    !String(nextLead.address || '').trim() ? 'ঠিকানা' : '',
                    !String(nextLead.product_name || '').trim() ? 'পণ্য' : '',
                  ].filter(Boolean).join(', ');
                  await logActivity(bizId!, 'ORDER_INCOMPLETE', `অর্ডারের ইচ্ছা শনাক্ত হয়েছে কিন্তু তথ্য অসম্পূর্ণ (${missing || 'অজানা'}) — অর্ডার তৈরি হয়নি, বট তথ্য চাইবে।`, 'info', ownerId);
                }

                if (wantsOrder && isFeatureEnabled(storeFeatures, 'autoOrderEnabled') && hasCompleteLead(nextLead)) {
                  try {
                    const productName = nextLead.product_name || aiRes?.product_name || '';
                    const identity = {
                      phone: nextLead.phone,
                      passengerId: senderId,
                      sessionId: senderId,
                    };
                    const recentCustomerOrder = lastOrderAtMs && Date.now() - lastOrderAtMs < DUPLICATE_ORDER_WINDOW_MS
                      ? { id: lastOrderId || 'recent-customer-order' }
                      : null;
                    const duplicate = recentCustomerOrder || await findRecentDuplicateOrder(bizId!, identity);
                    if (duplicate || !claimOrderIdentity(bizId!, identity)) {
                      console.log(`[Webhook] Duplicate order skipped for passenger ${senderId} / ${nextLead.phone}, existing ${duplicate?.id || 'in-memory lock'}`);
                      await logActivity(bizId!, 'ORDER_DUPLICATE_SKIP', `ডুপ্লিকেট অর্ডার স্কিপ হয়েছে (আগের অর্ডার: ${duplicate?.id || 'সাম্প্রতিক'}) — একই কাস্টমার/ফোন থেকে কিছুক্ষণ আগেই অর্ডার আছে।`, 'info', ownerId);
                      reply = duplicate?.id
                        ? `আপনার অর্ডারটি আগেই কনফার্ম হয়েছে। অর্ডার আইডি: ${duplicate.id}`
                        : 'আপনার অর্ডারটি আগেই কনফার্ম হয়েছে।';
                    } else {
                    const isInsideDhaka = /ঢাকা|dhaka|মিরপুর|ধানমন্ডি|উত্তরা|গুলশান|বনানী|মোহাম্মদপুর|মতিঝিল|যাত্রাবাড়ী|বাড্ডা|মগবাজার|খিলগাঁও|বাসাবো|তেজগাঁও|বারিধারা|রামপুরা|লালবাগ/i.test(nextLead.address);
                    const deliveryCharge = isInsideDhaka 
                      ? (businessData.courierConfig?.deliveryChargeInsideDhaka || 60)
                      : (businessData.courierConfig?.deliveryChargeOutsideDhaka || 120);

                    const matchedProduct = rawProducts.find((p: any) => {
                      const n = String(p.name || '').toLowerCase();
                      const w = productName.toLowerCase();
                      return n && w && (n === w || n.includes(w) || w.includes(n));
                    }) || (rawProducts.length === 1 ? rawProducts[0] : undefined);
                    if (!matchedProduct && !productName) {
                      throw new Error('Product not identified for confirmed order');
                    }

                    const qty = Math.max(1, parseInt(String(nextLead.quantity || '1'), 10) || 1);
                    const unitPrice = Number(String(nextLead.negotiated_price || '').replace(/[^0-9.]/g, '')) || matchedProduct?.price || 0;
                    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${String(senderId).slice(-4)}`;
                    const totalAmount = unitPrice * qty + deliveryCharge;

                    const newOrder = {
                      id: orderId,
                      businessId: bizId,
                      merchantId: ownerId || '',
                      sessionId: senderId,
                      passengerId: senderId,
                      clientIp: '',
                      customerName: resolveOrderCustomerName({
                        leadName: nextLead.name,
                        facebookName,
                        senderId,
                      }),
                      phone: normalizePhone(nextLead.phone),
                      address: nextLead.address,
                      productId: matchedProduct?.id || '',
                      productName: matchedProduct?.name || productName || 'অর্ডারকৃত পণ্য',
                      quantity: qty,
                      unitPrice,
                      deliveryFee: deliveryCharge,
                      deliveryCharge,
                      totalPrice: totalAmount,
                      status: 'confirmed',
                      paymentStatus: 'unpaid',
                      paymentMethod: 'cod',
                      notes: `Messenger AI (Customer: ${senderId})`,
                      source: 'messenger',
                      tags: ['Messenger', 'AI confirmed'],
                      statusHistory: [{ status: 'confirmed', at: Date.now(), note: 'Messenger checkout confirmed' }],
                      pageId: cleanPageId,
                      adSource: acqLabel || '',
                      adId: String(acqForPrompt?.adId || ''),
                      adRef: String(acqForPrompt?.ref || ''),
                      createdAtMs: Date.now(),
                    };

                    await saveOrderDoc(newOrder);
                    lastOrderId = orderId;
                    lastOrderAtMs = newOrder.createdAtMs;
                    reply = /অর্ডার.{0,20}(?:কনফার্ম|নিশ্চিত)/i.test(reply)
                      ? `${reply.trim()}\nঅর্ডার আইডি: ${orderId}`
                      : `জি, আপনার অর্ডারটি কনফার্ম হয়েছে। অর্ডার আইডি: ${orderId}`;

                    // Purchase event with real value -> the ad account can
                    // optimize for actual revenue, not just conversations.
                    const purchaseSent = await sendCapiEvent(businessData, 'Purchase', {
                      psid: senderId,
                      pageId: cleanPageId,
                      phone: newOrder.phone,
                      name: newOrder.customerName,
                      value: totalAmount,
                      orderId,
                      contentName: newOrder.productName,
                      contentIds: newOrder.productId ? [String(newOrder.productId)] : undefined,
                      quantity: qty,
                      itemPrice: unitPrice,
                      ctwaClid: savedAcquisition?.ctwaClid || referralInfo?.ctwaClid,
                      adId: String(acqForPrompt?.adId || ''),
                      adRef: String(acqForPrompt?.ref || ''),
                      adSource: acqLabel || '',
                      bizId: bizId!,
                      ownerId,
                      allowRepeat: true,
                    });
                    if (purchaseSent.ok) {
                      await markOrderCapiPurchaseSent(orderId, senderId);
                    }

                    if (isFeatureEnabled(storeFeatures, 'inventoryEnabled') && matchedProduct && (matchedProduct.stock || matchedProduct.stockCount) > 0 && adminDb) {
                      const updatedProducts = (businessData.products || []).map((p: any) => {
                        if (p.id === matchedProduct.id) {
                          return { ...p, stock: Math.max(0, (p.stock || p.stockCount || 10) - qty) };
                        }
                        return p;
                      });
                      await adminDb.collection('businesses').doc(bizId!).update({ products: updatedProducts }).catch(() => {});
                    }

                    await logActivity(bizId!, 'ORDER_AUTO_CREATED', `নতুন অর্ডার তৈরি হয়েছে: ${orderId} (৳${totalAmount})`, 'success', ownerId, newOrder);
                    console.log(`[Webhook] Auto-created order: ${orderId} for customer ${nextLead.phone}`);

                    const autoBook = isFeatureEnabled(storeFeatures, 'autoCourierBookingEnabled')
                      && businessData.courierConfig?.autoBooking !== false
                      && businessData.courierConfig?.steadfastApiKey;
                    if (autoBook) {
                      const booked = await bookSteadfastParcel(newOrder, businessData);
                      if (booked.success) {
                        const courierUpdates = {
                          courierStatus: 'in_review',
                          courierTrackingId: booked.trackingCode,
                          courierConsignmentId: booked.consignmentId || '',
                          status: 'shipped',
                        };
                        if (adminDb) {
                          await adminDb.collection('orders').doc(orderId).update(courierUpdates).catch(() => {});
                        } else if (db) {
                          await updateDoc(doc(db, 'orders', orderId), courierUpdates).catch(() => {});
                        }
                        reply = `${reply.trim()}\n\nঅর্ডার কনফার্ম হয়েছে। কুরিয়ার ট্র্যাকিং: ${booked.trackingCode}`;
                        await logActivity(bizId!, 'STEADFAST_AUTO', `অটো পার্সেল বুক: ${orderId} / ${booked.trackingCode}`, 'success', ownerId);
                      } else {
                        console.warn('[Webhook] Auto Steadfast booking failed:', booked.error);
                      }
                    }
                    }
                  } catch (orderErr: any) {
                    console.warn('[Webhook] Auto order placement notice:', orderErr);
                    releaseOrderIdentity(bizId!, {
                      phone: nextLead.phone,
                      passengerId: senderId,
                    });
                    reply = 'আপনার তথ্যগুলো পেয়েছি, তবে অর্ডারটি এখনো সেভ হয়নি। একটু পর আবার “কনফার্ম” লিখে পাঠাবেন, অথবা আমাদের প্রতিনিধির সহায়তা নিন।';
                    await logActivity(
                      bizId!,
                      'ORDER_SAVE_FAILED',
                      `Messenger অর্ডার সেভ হয়নি: ${orderErr?.message || String(orderErr)}`,
                      'error',
                      ownerId,
                    );
                  }
                }

                console.log(`[Webhook] AI Reply: ${reply.substring(0, 30)}...`);
                
                if (isFeatureEnabled(storeFeatures, 'messengerRepliesEnabled')) {
                console.log(`[Webhook] Sending response to Facebook sender: ${senderId}`);
                await humanTypingPause(pageAccessToken, senderId, reply, Date.now() - startTime);
                const cleanToken = String(pageAccessToken).trim();
                const fbUrl = `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`;
                
                try {
                  await axios.post(fbUrl, {
                    recipient: { id: senderId },
                    messaging_type: 'RESPONSE',
                    message: { text: reply.trim() }
                  }, { timeout: 15000 });
                } catch (fbSendErr: any) {
                  console.warn('[Webhook] v21.0 send failed, trying v18.0 fallback...', fbSendErr.response?.data || fbSendErr.message);
                  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, {
                    recipient: { id: senderId },
                    messaging_type: 'RESPONSE',
                    message: { text: reply.trim() }
                  }, { timeout: 15000 });
                }
                primaryReplySent = true;

                const imageFlags = resolveImageSendFlags(finalMessageText, aiRes);
                const wantsProductImg = isFeatureEnabled(storeFeatures, 'imageDisplayEnabled') && imageFlags.show_product_image;
                const wantsReviewImg = isFeatureEnabled(storeFeatures, 'reviewImagesEnabled') && imageFlags.show_review_images;
                if (wantsProductImg || wantsReviewImg) {
                  try {
                    const imageProduct = pickProductForImages(
                      rawProducts,
                      aiRes?.product_name || nextLead.product_name || acqProduct,
                      `${finalMessageText}\n${chatHistoryText}`,
                    );
                    const productUrls = wantsProductImg
                      ? uniqueHttpUrls(imageProduct?.images || [], MAX_PRODUCT_PHOTOS)
                      : [];
                    const reviewUrls = wantsReviewImg
                      ? uniqueHttpUrls(imageProduct?.reviewImages || [], MAX_REVIEW_PHOTOS)
                      : [];

                    for (const rawUrl of productUrls) {
                      const publicUrl = await ensurePublicImageUrl(rawUrl, bizId!, req);
                      if (publicUrl && publicUrl.startsWith('http')) {
                        await briefTypingPause(pageAccessToken, senderId, 280);
                        await sendImageMessage(pageAccessToken, senderId, publicUrl);
                      }
                    }
                    for (const rawUrl of reviewUrls) {
                      const publicUrl = await ensurePublicImageUrl(rawUrl, bizId!, req);
                      if (publicUrl && publicUrl.startsWith('http')) {
                        await briefTypingPause(pageAccessToken, senderId, 340);
                        await sendImageMessage(pageAccessToken, senderId, publicUrl);
                      }
                    }
                  } catch (imgErr: any) {
                    console.warn('[Webhook] Product/review image send failed:', imgErr.response?.data || imgErr.message);
                  }
                }
                }

                await saveChatMessage(bizId!, senderId, 'bot', reply.trim()).catch(e => console.error('Save chat error:', e));
                await saveMessengerLog(bizId!, {
                  senderId,
                  pageId: cleanPageId,
                  message: finalMessageText,
                  reply: reply.trim(),
                  status: 'replied',
                  latencyMs
                });

                // (Token wallet already charged with real usage right after
                // the AI call — see chargeAiUsage above.)

                console.log('[Webhook] Reply sequence finished successfully');
                await logActivity(bizId!, 'REPLY_SENT', `উত্তর পাঠানো হয়েছে: "${reply.substring(0, 50)}..."`, 'success', ownerId);

                const customerPayload: any = {
                  businessId: bizId,
                  messengerId: senderId,
                  passengerId: senderId,
                  pageId: cleanPageId,
                  name: nextLead.name || '',
                  phone: nextLead.phone || '',
                  address: nextLead.address || '',
                  lastIncomingAtMs: Date.now(),
                  lastInteraction: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
                  chatSummary: isFeatureEnabled(storeFeatures, 'chatSummaryEnabled') ? (aiRes?.summary || longTermSummary || '') : (longTermSummary || ''),
                  leadInfo: nextLead,
                  updatedAt: adminDb ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
                };
                if (lastOrderId) customerPayload.lastOrderId = lastOrderId;
                if (lastOrderAtMs) customerPayload.lastOrderAtMs = lastOrderAtMs;
                if (Object.keys(capiFunnelAt).length) customerPayload.capiFunnelAt = capiFunnelAt;
                if (adminDb) {
                  await adminDb.collection('customers').doc(`${bizId}_${senderId}`).set(customerPayload, { merge: true }).catch(() => {});
                } else if (db) {
                  await setDoc(doc(db, 'customers', `${bizId}_${senderId}`), customerPayload, { merge: true }).catch(() => {});
                }
              } catch (err: any) {
                const latencyMs = Date.now() - startTime;
                const fbErrorObj = err.response?.data?.error;
                const errorMsg = fbErrorObj?.message || err.message || 'ফেসবুক মেসেজ পাঠানো যায়নি';
                const errorCode = fbErrorObj?.code ? ` [Code: ${fbErrorObj.code}]` : '';
                console.error('[AI/Reply Error]', fbErrorObj || err.message);
                await logActivity(bizId!, 'ERROR', `বট রিপ্লাই দিতে ব্যর্থ হয়েছে: ${errorMsg}${errorCode}`, 'error', ownerId, fbErrorObj);
                await saveMessengerLog(bizId!, {
                  senderId,
                  pageId: cleanPageId,
                  message: finalMessageText,
                  status: 'error',
                  error: `${errorMsg}${errorCode}`,
                  latencyMs
                });
                
                // If AI/provider processing failed before a real reply reached
                // Facebook, answer from catalog/FAQ data instead of sending a
                // dead-end "an assistant will join" acknowledgement.
                if (!primaryReplySent && isFeatureEnabled(storeFeatures, 'messengerRepliesEnabled')) {
                  try {
                    await sendResilientSalesFallback({
                      businessId: bizId!,
                      businessData,
                      ownerId,
                      pageId: cleanPageId,
                      pageAccessToken,
                      senderId,
                      message: finalMessageText,
                      mediaKinds: incomingMedia.map((item) => item.kind),
                      reason: 'ai-or-send-error'
                    });
                  } catch (fallbackErr: any) {
                    console.error('[Webhook] Resilient fallback send failed:', fallbackErr.response?.data || fallbackErr.message);
                    throw fallbackErr;
                  }
                }
              }

          } catch (e: any) {
            eventFailed = true;
            webhookHadFailure = true;
            console.error('[Event Loop Error]', e.message);
          } finally {
            if (claimedMessageMid) {
              if (eventFailed) releaseMessageForRetry(claimedMessageMid);
              else markMessageProcessed(claimedMessageMid);
            }
          }
        }
      }
    } catch (e) {
      webhookHadFailure = true;
      console.error('Webhook Process error', e);
    } finally {
      // 503 is intentional for transient failures: Meta retries delivery.
      // Successfully handled message IDs remain deduplicated; failed IDs are
      // released above so the retry can complete them.
      try {
        res.status(webhookHadFailure ? 503 : 200).send(
          webhookHadFailure ? 'RETRY_EVENT' : 'EVENT_RECEIVED'
        );
      } catch (_) {}
    }
}

app.post(webhookPaths, handleMessengerWebhookPost);

app.get(['/api/messenger/health', '/api/webhook/health'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    webhook: true,
    adminDbReady: !!adminDb,
    clientDbReady: !!db,
    subscribeFields: PAGE_SUBSCRIBE_FIELDS,
    serverVersion: '1.4.0',
    timestamp: new Date().toISOString()
  });
});

// Meta Graph API Token Health Test + page subscription
// ---------------------------------------------------------------------------
// ZiniPay billing — the gateway API key belongs to the SUPER ADMIN only
// (system/settings.zinipayApiKey). Merchants recharge their token wallet
// through these endpoints and never see the gateway credentials.
// ---------------------------------------------------------------------------
const ZINIPAY_BASE = 'https://api.zinipay.com';

function zinipayErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as unknown;
    if (typeof data === 'string' && data.trim()) return data.trim().slice(0, 400);
    if (data && typeof data === 'object') {
      const o = data as Record<string, unknown>;
      const msg = o.message || o.error || o.msg;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    }
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

function zinipayDomainHint(message: string): string {
  return /domain|redirect|brand|website/i.test(message)
    ? ' — ZiniPay ড্যাশবোর্ড → Brands-এ Website URL এই সাইটের ডোমেইনের সাথে হুবহু মিলতে হবে (যেমন https://sell-kori.vercel.app)।'
    : '';
}

async function getBillingSettings() {
  let zinipayApiKey = '';
  let tokenRatePerLakh = 20;
  try {
    let d: any = null;
    if (adminDb) {
      const s = await adminDb.collection('system').doc('settings').get();
      if (s.exists) d = s.data();
    } else if (db) {
      const s = await getDoc(doc(db, 'system', 'settings'));
      if (s.exists()) d = s.data();
    }
    if (d) {
      zinipayApiKey = String(d.zinipayApiKey || '').trim();
      if (d.tokenRatePerLakh) tokenRatePerLakh = Number(d.tokenRatePerLakh) || 20;
    }
  } catch (e: any) {
    console.warn('[Billing] settings load notice:', e?.message);
  }
  return { zinipayApiKey, tokenRatePerLakh };
}

async function savePaymentDoc(payment: any) {
  if (adminDb) {
    try {
      await adminDb.collection('payments').doc(payment.id).set({
        ...payment,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    } catch (e: any) {
      console.error('[Billing] admin payment write failed, client fallback:', e?.message);
    }
  }
  if (db) {
    await setDoc(doc(db, 'payments', payment.id), { ...payment, createdAt: serverTimestamp() }, { merge: true });
    return;
  }
  throw new Error('No Firestore connection to save payment');
}

async function loadPaymentDoc(valId: string): Promise<any | null> {
  try {
    if (adminDb) {
      const s = await adminDb.collection('payments').doc(valId).get();
      if (s.exists) return { id: s.id, ...s.data() };
    }
  } catch (_) {}
  try {
    if (db) {
      const s = await getDoc(doc(db, 'payments', valId));
      if (s.exists()) return { id: s.id, ...s.data() };
    }
  } catch (_) {}
  return null;
}

// ZiniPay's webhook sends THEIR invoice_id (from the payment_url), so we also
// need to find our payment record by that id.
async function findPaymentByInvoiceId(invoiceId: string): Promise<any | null> {
  if (!invoiceId) return null;
  try {
    if (adminDb) {
      const snap = await adminDb.collection('payments').where('invoiceId', '==', invoiceId).limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
  } catch (_) {}
  try {
    if (db) {
      const snap = await getDocs(query(collection(db, 'payments'), where('invoiceId', '==', invoiceId), limit(1)));
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
  } catch (_) {}
  return null;
}

// Credits the merchant's token wallet server-side (Admin SDK only — client
// SDK from the server is unauthenticated and rules would deny it). Returns
// true when credited so the caller can mark the payment as settled.
async function creditPaymentTokens(payment: any): Promise<boolean> {
  if (!payment?.businessId || !payment?.tokens) return false;
  if (adminDb) {
    try {
      await adminDb.collection('businesses').doc(payment.businessId).update({
        tokenBalance: admin.firestore.FieldValue.increment(Number(payment.tokens) || 0),
      });
      return true;
    } catch (e: any) {
      console.warn('[Billing] admin credit failed (client will settle):', e?.message);
    }
  }
  return false;
}

async function settleZinipayPayment(lookupId: string): Promise<{ paid: boolean; credited: boolean; payment: any | null; status?: string }> {
  // lookupId can be our own valId (payments doc id, used in redirect_url)
  // or ZiniPay's invoice_id (used in their webhook callback).
  let payment = await loadPaymentDoc(lookupId);
  if (!payment) payment = await findPaymentByInvoiceId(lookupId);
  if (!payment) return { paid: false, credited: false, payment: null, status: 'not_found' };
  if (payment.status === 'paid') {
    return { paid: true, credited: payment.credited === true, payment };
  }
  const { zinipayApiKey } = await getBillingSettings();
  if (!zinipayApiKey) return { paid: false, credited: false, payment, status: 'gateway_not_configured' };

  // Verify against ZiniPay's own invoice id (parsed from payment_url at
  // create time); fall back to the lookup id.
  const invoiceId = String(payment.invoiceId || lookupId).trim();
  const verifyRes = await axios.post(`${ZINIPAY_BASE}/v1/payment/verify`, { invoice_id: invoiceId }, {
    headers: { 'Content-Type': 'application/json', 'zini-api-key': zinipayApiKey },
    timeout: 20000,
  });
  const v = verifyRes.data || {};
  const completed = String(v.status || '').toUpperCase() === 'COMPLETED';
  if (!completed) return { paid: false, credited: false, payment, status: String(v.status || 'PENDING') };

  // Defense: the paid amount must cover what this payment record promised
  if (Number(v.amount) > 0 && Number(v.amount) < Number(payment.amount)) {
    console.warn(`[Billing] amount mismatch for ${payment.id}: expected ${payment.amount}, got ${v.amount}`);
    return { paid: false, credited: false, payment, status: 'AMOUNT_MISMATCH' };
  }

  const credited = await creditPaymentTokens(payment);
  await savePaymentDoc({
    ...payment,
    status: 'paid',
    credited,
    transactionId: String(v.transaction_id || ''),
    paymentMethod: String(v.payment_method || ''),
    paidAtMs: Date.now(),
  });
  await logActivity(payment.businessId, 'PAYMENT_RECEIVED', `৳${payment.amount} পেমেন্ট সফল (${v.payment_method || 'zinipay'}) — ${Number(payment.tokens).toLocaleString()} টোকেন${credited ? ' যুক্ত হয়েছে' : ' যুক্ত হবে ড্যাশবোর্ড খুললেই'}।`, 'success', payment.ownerId);
  return { paid: true, credited, payment: { ...payment, credited } };
}

// Admin one-click gateway test: creates a tiny hosted invoice (nothing is
// charged unless someone actually pays it) and surfaces ZiniPay's exact
// error when the key or brand domain is wrong.
app.post('/api/billing/test-gateway', async (req, res) => {
  const testKey = String(req.body?.apiKey || '').trim();
  const { zinipayApiKey } = await getBillingSettings();
  const effectiveKey = testKey || zinipayApiKey;
  if (!effectiveKey) {
    return res.status(400).json({ success: false, error: 'ZiniPay API Key দিন বা আগে সেভ করুন' });
  }
  try {
    const origin = publicOriginFromReq(req);
    if (!origin) {
      return res.status(500).json({ success: false, error: 'অ্যাপের পাবলিক URL নির্ধারণ করা যায়নি (PUBLIC_APP_URL সেট করুন)' });
    }
    const r = await axios.post(`${ZINIPAY_BASE}/v1/payment/create`, {
      cus_name: 'Gateway Test',
      cus_email: 'test@sellkori.app',
      amount: 10,
      metadata: { test: true },
      redirect_url: `${origin}/admin`,
      cancel_url: `${origin}/admin`,
      webhook_url: `${origin}/api/billing/zinipay-webhook`,
    }, {
      headers: { 'Content-Type': 'application/json', 'zini-api-key': effectiveKey },
      timeout: 20000,
    });
    if (r.data?.status === true && r.data?.payment_url) {
      return res.json({ success: true, paymentUrl: r.data.payment_url, message: 'গেটওয়ে সচল! টেস্ট ইনভয়েস তৈরি হয়েছে।' });
    }
    return res.status(502).json({ success: false, error: r.data?.message || 'ইনভয়েস তৈরি হয়নি', raw: r.data });
  } catch (err: unknown) {
    const msg = zinipayErrorMessage(err, 'গেটওয়ে টেস্ট ব্যর্থ');
    return res.status(502).json({ success: false, error: `${msg}${zinipayDomainHint(msg)}` });
  }
});

app.post('/api/billing/create-payment', async (req, res) => {
  const businessId = String(req.body?.businessId || '').trim();
  const amount = Math.round(Number(req.body?.amount) || 0);
  if (!businessId || amount < 10 || amount > 200000) {
    return res.status(400).json({ success: false, error: 'সঠিক স্টোর আইডি ও পরিমাণ দিন (১০-২০০০০০ টাকা)' });
  }
  try {
    const loaded = await loadBusinessById(businessId);
    if (!loaded) return res.status(404).json({ success: false, error: 'স্টোর পাওয়া যায়নি' });

    const { zinipayApiKey, tokenRatePerLakh } = await getBillingSettings();
    if (!zinipayApiKey) {
      return res.status(400).json({ success: false, error: 'পেমেন্ট গেটওয়ে এখনো চালু হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।' });
    }

    const tokens = Math.round((amount / Math.max(1, tokenRatePerLakh)) * 100000);
    const valId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const origin = publicOriginFromReq(req);
    if (!origin) {
      return res.status(500).json({ success: false, error: 'অ্যাপের পাবলিক URL নির্ধারণ করা যায়নি (PUBLIC_APP_URL সেট করুন)' });
    }

    const createRes = await axios.post(`${ZINIPAY_BASE}/v1/payment/create`, {
      cus_name: String(loaded.data?.name || 'SellKori Merchant').slice(0, 80),
      cus_email: String(req.body?.email || 'merchant@sellkori.app').slice(0, 120),
      amount,
      metadata: { businessId, valId, tokens },
      redirect_url: `${origin}/dashboard?payment=verify&valId=${encodeURIComponent(valId)}`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      webhook_url: `${origin}/api/billing/zinipay-webhook`,
    }, {
      headers: { 'Content-Type': 'application/json', 'zini-api-key': zinipayApiKey },
      timeout: 20000,
    });

    const paymentUrl = String(createRes.data?.payment_url || '');
    if (createRes.data?.status !== true || !paymentUrl) {
      return res.status(502).json({ success: false, error: createRes.data?.message || 'পেমেন্ট লিংক তৈরি করা যায়নি' });
    }

    // ZiniPay generates the invoice id — it is the last segment of
    // payment_url (https://secure.zinipay.com/payment/INVOICE_ID) and it is
    // what verify/webhook use.
    const invoiceId = String(createRes.data?.invoice_id || '').trim()
      || (paymentUrl.split('?')[0].split('/').filter(Boolean).pop() || '');

    await savePaymentDoc({
      id: valId,
      invoiceId,
      businessId,
      ownerId: loaded.data?.ownerId || '',
      amount,
      tokens,
      status: 'pending',
      credited: false,
      paymentUrl,
      createdAtMs: Date.now(),
    });

    return res.json({ success: true, paymentUrl, valId, tokens, amount });
  } catch (err: unknown) {
    const fbMsg = zinipayErrorMessage(err, 'পেমেন্ট তৈরি ব্যর্থ');
    console.error('[Billing] create-payment error:', axios.isAxiosError(err) ? err.response?.data : err);
    return res.status(502).json({ success: false, error: `${fbMsg}${zinipayDomainHint(fbMsg)}` });
  }
});

app.post('/api/billing/verify', async (req, res) => {
  const valId = String(req.body?.valId || req.body?.invoice_id || '').trim();
  if (!valId) return res.status(400).json({ success: false, error: 'Payment ID দিন' });
  try {
    const result = await settleZinipayPayment(valId);
    if (!result.payment) return res.status(404).json({ success: false, error: 'পেমেন্ট রেকর্ড পাওয়া যায়নি' });
    return res.json({
      success: true,
      paid: result.paid,
      credited: result.credited,
      status: result.status || (result.paid ? 'COMPLETED' : 'PENDING'),
      tokens: result.payment.tokens,
      amount: result.payment.amount,
      businessId: result.payment.businessId,
    });
  } catch (err: unknown) {
    const msg = zinipayErrorMessage(err, 'ভেরিফিকেশন ব্যর্থ');
    return res.status(500).json({ success: false, error: msg });
  }
});

// ZiniPay server-to-server callback — arrives as JSON body OR query params
// ({invoice_id, status} / ?invoice_id=...&status=true), GET or POST.
async function handleZinipayWebhook(req: any, res: any) {
  const src = { ...(req.query || {}), ...(req.body || {}) };
  const lookupId = String(src.invoice_id || src.val_id || src.metadata?.valId || '').trim();
  if (lookupId) {
    try {
      await settleZinipayPayment(lookupId);
    } catch (e: any) {
      console.error('[Billing] webhook settle error:', e?.message);
    }
  }
  return res.status(200).json({ received: true });
}
app.post('/api/billing/zinipay-webhook', handleZinipayWebhook);
app.get('/api/billing/zinipay-webhook', handleZinipayWebhook);

// Fire a CAPI test event so the merchant can verify Pixel + token in one click.
// test_event_code is used HERE only — live Messenger inbox events never include it.
app.post('/api/capi/test', async (req, res) => {
  const pixelId = String(req.body?.pixelId || '').trim();
  const accessToken = String(req.body?.accessToken || '').trim();
  const testEventCode = String(req.body?.testEventCode || '').trim();
  if (!pixelId || !accessToken) {
    return res.status(400).json({ success: false, error: 'Pixel ID এবং Access Token প্রয়োজন' });
  }
  try {
    const testPsid = `test_${Date.now()}`;
    const built = buildMessengerCapiPayload({
      eventName: 'Lead',
      pixelId,
      psid: testPsid,
      contentName: 'SellKori CAPI Connection Test',
      testEventCode,
    });
    const fbRes = await axios.post(
      capiEventsUrl(pixelId, accessToken),
      built.body,
      { timeout: 10000 }
    );
    if (!isCapiHttpSuccess(fbRes.status, fbRes.data)) {
      return res.status(400).json({
        success: false,
        error: fbRes.data?.error?.message || 'ফেসবুক ইভেন্ট গ্রহণ করেনি',
      });
    }
    return res.json({ success: true, eventsReceived: fbRes.data?.events_received ?? 1, fbtraceId: fbRes.data?.fbtrace_id });
  } catch (err: any) {
    const fbErr = err.response?.data?.error;
    return res.status(400).json({
      success: false,
      error: fbErr?.message ? `ফেসবুক এরর: ${fbErr.message}` : (err.message || 'CAPI টেস্ট ব্যর্থ')
    });
  }
});

app.post('/api/capi/purchase', async (req, res) => {
  const businessId = String(req.body?.businessId || '').trim();
  const orderId = String(req.body?.orderId || '').trim();
  if (!businessId || !orderId) {
    return res.status(400).json({ success: false, error: 'businessId এবং orderId প্রয়োজন' });
  }
  try {
    let order: any = null;
    let businessData: any = null;
    if (adminDb) {
      const oSnap = await adminDb.collection('orders').doc(orderId).get();
      if (oSnap.exists) order = { id: oSnap.id, ...oSnap.data() };
      const bSnap = await adminDb.collection('businesses').doc(businessId).get();
      if (bSnap.exists) businessData = { id: bSnap.id, ...bSnap.data() };
    } else if (db) {
      const oSnap = await getDoc(doc(db, 'orders', orderId));
      if (oSnap.exists()) order = { id: oSnap.id, ...oSnap.data() };
      const bSnap = await getDoc(doc(db, 'businesses', businessId));
      if (bSnap.exists()) businessData = { id: bSnap.id, ...bSnap.data() };
    }
    if (!order) return res.status(404).json({ success: false, error: 'অর্ডার পাওয়া যায়নি' });
    if (!businessData) return res.status(404).json({ success: false, error: 'দোকান পাওয়া যায়নি' });
    if (String(order.businessId || '') !== businessId) {
      return res.status(403).json({ success: false, error: 'এই অর্ডার এই স্টোরের নয়' });
    }
    const result = await sendMessengerPurchaseForOrder(businessData, order, businessId);
    if (result.ok) return res.json({ success: true, sent: true });
    if (result.skipped) return res.json({ success: true, skipped: result.skipped });
    return res.status(400).json({ success: false, error: 'CAPI Purchase পাঠানো যায়নি' });
  } catch (err: any) {
    console.error('[CAPI purchase]', err);
    return res.status(500).json({ success: false, error: err.message || 'CAPI Purchase ব্যর্থ' });
  }
});

app.post('/api/messenger/test-token', async (req, res) => {
  const { pageAccessToken } = req.body;
  if (!pageAccessToken || typeof pageAccessToken !== 'string') {
    return res.status(400).json({ success: false, error: 'Page Access Token প্রদান করুন।' });
  }

  try {
    const result = await subscribePageToMessenger(pageAccessToken.trim());
    return res.json({
      success: true,
      page: result.page,
      subscribed: result.subscribed,
      subscribeError: result.subscribeError || undefined,
      subscriptions: result.subscriptions,
      subscribeFields: PAGE_SUBSCRIBE_FIELDS,
      needsManualSubscribe: result.needsManualSubscribe || undefined,
      manualSubscribeHint: result.needsManualSubscribe ? MANUAL_SUBSCRIBE_HINT : undefined
    });
  } catch (err: any) {
    const errorData = err.response?.data?.error;
    const msg = errorData?.message || err.message || 'ফেসবুক টোকেন যাচাই ব্যর্থ হয়েছে';
    return res.status(400).json({
      success: false,
      error: `ফেসবুক এরর: ${msg}`
    });
  }
});

app.post('/api/messenger/subscribe-page', async (req, res) => {
  const { pageAccessToken } = req.body || {};
  if (!pageAccessToken || typeof pageAccessToken !== 'string') {
    return res.status(400).json({ success: false, error: 'Page Access Token প্রদান করুন।' });
  }
  try {
    const result = await subscribePageToMessenger(pageAccessToken.trim());
    return res.json({
      success: true,
      page: result.page,
      subscribed: result.subscribed,
      subscribeError: result.subscribeError || undefined,
      subscriptions: result.subscriptions,
      subscribeFields: PAGE_SUBSCRIBE_FIELDS,
      needsManualSubscribe: result.needsManualSubscribe || undefined,
      manualSubscribeHint: result.needsManualSubscribe ? MANUAL_SUBSCRIBE_HINT : undefined
    });
  } catch (err: any) {
    const errorData = err.response?.data?.error;
    return res.status(400).json({
      success: false,
      error: errorData?.message || err.message || 'পেজ সাবস্ক্রাইব ব্যর্থ'
    });
  }
});

// Full-Pipeline Simulated Test Message (Simulates an incoming customer message to test the AI live)
app.post('/api/messenger/simulate-message', async (req, res) => {
  const { businessId, message, senderId } = req.body;
  if (!businessId || !message) {
    return res.status(400).json({ success: false, error: 'Business ID এবং Message প্রয়োজন' });
  }

  let businessData: any = null;
  if (adminDb) {
    const d = await adminDb.collection('businesses').doc(businessId).get();
    if (d.exists) businessData = d.data();
  }
  if (!businessData && db) {
    const d = await getDoc(doc(db, 'businesses', businessId));
    if (d.exists()) businessData = d.data();
  }

  if (!businessData) {
    return res.status(404).json({ success: false, error: 'দোকান পাওয়া যায়নি।' });
  }

  const aiConfig = await getEffectiveGeminiConfig();
  if (!aiConfig.hasProvider) {
    return res.status(400).json({ success: false, error: 'সেন্ট্রাল জেমিনি এপিআই কি কনফিগার করা নেই। অ্যাডমিন প্যানেল থেকে দিন।' });
  }

  if (!hasTokenBalance(businessData)) {
    return res.status(402).json({ success: false, error: 'টোকেন ব্যালেন্স শেষ! বিলিং ট্যাব থেকে রিচার্জ করুন — তারপর বট আবার চলবে।' });
  }

  const startTime = Date.now();
  try {
    const products = (businessData.products || []).map((p: any) => ({
      name: p.name,
      price: p.price,
      minPrice: p.minPrice || p.price,
      category: p.category || 'General'
    }));

    // Fetch simulated user chat history if any
    let simHistory = '';
    try {
      if (adminDb) {
        const cSnap = await adminDb.collection('chats').doc(`${businessId}_${senderId}`).get();
        if (cSnap.exists && Array.isArray(cSnap.data()?.messages)) {
          simHistory = cSnap.data()?.messages.slice(-CHAT_MEMORY_LIMIT).map((m: any) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.text}`).join('\n');
        }
      }
    } catch (e) {}

    const prompt = `তুমি "${businessData.name || 'আমাদের স্টোর'}" এর একজন বাস্তব মানুষ বিক্রয়কর্মী। কখনো বুঝতে দেবে না যে তুমি এআই বা বট; কেউ জিজ্ঞেস করলে স্বাভাবিকভাবে এড়িয়ে কাজের কথায় ফিরবে।

# কঠোর নিয়মাবলী:
১. **সংক্ষিপ্ত ও নির্দিষ্ট উত্তর:** কাস্টমার যা জানতে চেয়েছে ঠিক ততটুকুরই সুনির্দিষ্ট, প্রাসঙ্গিক উত্তর দাও। মার্চেন্টের অতিরিক্ত নির্দেশনায় ইমোজি/সামারি ফরম্যাট/রিপ্লাই দৈর্ঘ্য থাকলে সেটাই প্রাধান্য পাবে।
২. **অতিরিক্ত কথা না বলা:** কোনো অপ্রয়োজনীয় বড় ভূমিকা, সালাম-স্বাগত ভাষণ বা না চাওয়া তথ্য দেবে না।
৩. **প্রসঙ্গ স্মরণ:** পূর্বের চ্যাট হিস্ট্রি দেখে প্রাসঙ্গিক উত্তর দাও।
৪. **সঠিকতা:** শুধু পণ্যতালিকা ও চ্যাটে নিশ্চিত তথ্য ব্যবহার করো। দাম, স্টক বা অফার বানিয়ে বলবে না।
৫. minPrice-এর নিচে দাম দিবে না। নিজেকে এআই/বট বলে স্বীকার করবে না।

${buildReplyStyleBlock(businessData.customSystemPrompt || businessData.botPersona || '')}

পণ্যতালিকা:
${JSON.stringify(products, null, 2)}

পূর্ববর্তী চ্যাট হিস্ট্রি:
${simHistory || 'নতুন আলাপ'}

কাস্টমার: "${message}"

${buildMerchantCustomInstructionBlock(businessData.customSystemPrompt || businessData.botPersona || '')}

টু-দ্য-পয়েন্ট উত্তর:`;

    const aiResult = await aiGenerate({
      parts: [{ text: prompt }],
      textPrompt: prompt,
      model: aiConfig.model,
      temperature: Math.min(0.45, Math.max(0, Number(businessData.aiTemperature ?? aiConfig.temperature ?? 0.35))),
      maxTokens: aiConfig.maxTokens,
      preferredKeys: merchantOwnGeminiKey(businessData),
    });
    const response = { text: aiResult.text } as { text?: string };
    chargeAiUsage(businessId, aiResult, 'simulator').catch(() => {});

    const reply = response.text?.trim() || 'ধন্যবাদ! আপনার মেসেজ পেয়েছি।';
    const latencyMs = Date.now() - startTime;

    await saveMessengerLog(businessId, {
      senderId: senderId || 'Simulated_Tester',
      pageId: businessData.pageId || businessData.facebookPageId || 'TEST_PAGE',
      message: message,
      reply: reply,
      status: 'replied',
      latencyMs
    });

    return res.json({
      success: true,
      reply,
      latencyMs,
      model: aiConfig.model
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await saveMessengerLog(businessId, {
      senderId: senderId || 'Simulated_Tester',
      message: message,
      status: 'error',
      error: err.message,
      latencyMs
    });
    return res.status(500).json({
      success: false,
      error: err.message,
      latencyMs
    });
  }
});

// Manual message sending from Dashboard (Live Chat)
app.post('/api/send-message', async (req, res) => {
  const { pageAccessToken, recipientId, text, businessId, ownerId } = req.body;
  
  if (!pageAccessToken || !recipientId || !text) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
      recipient: { id: recipientId },
      message: { text }
    });

    // Save to history
    await saveChatMessage(businessId, recipientId, 'merchant', text);
    await logActivity(businessId, 'MERCHANT_REPLY', `Merchant manually replied: ${text.substring(0, 30)}...`, 'info', ownerId);

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Send Message Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Get chat history for a customer
app.get('/api/chat-history', async (req, res) => {
  const { businessId, customerId } = req.query;

  if (!businessId || !customerId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const q = query(
      collection(db, 'chats'),
      where('businessId', '==', businessId),
      where('senderId', 'in', [customerId, 'bot', 'merchant']), // Note: senderId for bot/merchant is tricky in this schema, checking sub-session
      orderBy('timestamp', 'asc'),
      limit(100)
    );
    // Actually our saveChatMessage uses {businessId}_{senderId} as path or similar? 
    // Let's re-verify saveChatMessage.
    // In previous turns it was: doc(db, 'chats', `${businessId}_${senderId}`)
    // Wait, let me check saveChatMessage definition.
    const docRef = doc(db, 'chats', `${businessId}_${customerId}`);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      res.json({ success: true, messages: snap.data().messages || [] });
    } else {
      res.json({ success: true, messages: [] });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/broadcast/preview', (req, res) => {
  void broadcastHandler(req, res);
});
app.post('/api/broadcast', (req, res) => {
  void broadcastHandler(req, res);
});

// Abandoned Cart Recovery Cron — skip on Vercel serverless (no persistent process)
if (!process.env.VERCEL) {
cron.schedule('*/15 * * * *', async () => {
  console.log('[Cron] Checking for abandoned carts...');
  
  try {
    let carts: any[] = [];
    
    // Attempt Admin SDK query first
    if (adminDb) {
      try {
        const snap = await adminDb.collection('abandoned_carts')
          .where('lastFollowUpSent', '==', false)
          .get();
        carts = snap.docs.map((d: any) => ({ id: d.id, ref: d.ref, ...d.data() }));
      } catch (adminErr: any) {
        console.warn('[Cron] Admin fetch failed, falling back to Client SDK:', adminErr.message);
      }
    }
    
    // Fallback to Client SDK if Admin failed or was unavailable
    if (carts.length === 0 && db) {
      try {
        const q = query(collection(db, 'abandoned_carts'), where('lastFollowUpSent', '==', false));
        const snap = await getDocs(q);
        carts = snap.docs.map((d: any) => ({ id: d.id, ...d.data(), isClientRef: true }));
      } catch (clientErr: any) {
        // Only log if it's not a common "no collection" error
        console.error('[Cron] Client fetch failed:', clientErr.message);
      }
    }

    if (carts.length === 0) {
      return;
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const cart of carts) {
      if (!cart.pageAccessToken || !cart.messengerId) continue;

      const cartTime = cart.timestamp?.toDate ? cart.timestamp.toDate() : new Date(cart.timestamp || 0);
      
      if (cartTime < oneHourAgo) {
        try {
          let recoveryFeatures: any = {};
          try {
            if (adminDb && cart.businessId) {
              const bSnap = await adminDb.collection('businesses').doc(cart.businessId).get();
              recoveryFeatures = bSnap.exists ? (bSnap.data()?.features || {}) : {};
            }
          } catch (_) {}
          if (!isFeatureEnabled(recoveryFeatures, 'proactiveNotificationsEnabled') || !isFeatureEnabled(recoveryFeatures, 'messengerRepliesEnabled') || isQuietHoursNow(recoveryFeatures) || !shouldRunAi(recoveryFeatures)) {
            continue;
          }
          const followUp = `হ্যালো ${cart.customerName || 'কাস্টমার'}! আপনি কি "${cart.productName}" অর্ডারটি সম্পন্ন করতে চান? আমরা আপনার জন্য এটি বুকড করে রেখেছি। কোনো সাহায্য লাগলে আমাদের মেসেজ দিন।`;
          
          await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${cart.pageAccessToken}`, {
            recipient: { id: cart.messengerId },
            message: { text: followUp }
          });

          // Update record
          if (cart.ref) {
            await cart.ref.update({ 
               lastFollowUpSent: true,
               updatedAt: FieldValue.serverTimestamp()
            });
          } else if (cart.isClientRef && db) {
             await updateDoc(doc(db, 'abandoned_carts', cart.id), {
               lastFollowUpSent: true,
               updatedAt: serverTimestamp()
             });
          }

          await saveChatMessage(cart.businessId, cart.messengerId, 'bot', `[RECOVERY] ${followUp}`);
          await logActivity(cart.businessId, 'CART_RECOVERY', `${cart.customerName} এর জন্য রিকভারি মেসেজ পাঠানো হয়েছে।`, 'info', cart.ownerId);
        } catch (e: any) {
          console.error(`[Cron] Recovery failed for ${cart.messengerId}:`, e.message);
        }
      }
    }
  } catch (error: any) {
    console.error('[Cron Critical Error]', error.message);
  }
});
}

// Initialize server
async function init() {
  if (process.env.VERCEL) return;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Vite initialization failed:', e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path.startsWith('/messenger')) return next();
      // Try to send index.html if it exists
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

init().catch(console.error);

export default app;
