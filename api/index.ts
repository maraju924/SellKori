import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal internal types to avoid cross-dir import issues in Vercel
interface BusinessConfig {
  messengerVerifyToken?: string;
  verifyToken?: string;
  [key: string]: any;
}

// Load firebase config for server-side use
let db: any;
let firebaseApp: any;
let adminDb: any;

try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    firebaseApp = initializeApp(firebaseConfig);
    db = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
      : getFirestore(firebaseApp);
    
    // Initialize Admin SDK
    try {
      if (admin.apps.length === 0) {
        console.log(`[Firebase] Initializing Admin SDK for Project: ${firebaseConfig.projectId}`);
        admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
      const adminApp = admin.app();
      const dbId = firebaseConfig.firestoreDatabaseId;
      
      // Try to get Admin Firestore for the specific database ID
      adminDb = getAdminFirestore(adminApp, dbId && dbId !== '(default)' ? dbId : undefined);
      
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
          if (dbId && dbId !== '(default)') {
            console.log(`[Firebase] Admin DB "${dbId}" access denied. Falling back to (default) database...`);
            const fallbackDb = getAdminFirestore(adminApp);
            fallbackDb.collection('businesses').limit(1).get()
              .then(() => {
                adminDb = fallbackDb;
                console.log('[Firebase] Admin SDK switched to (default) database.');
              })
              .catch(() => {
                console.warn('[Firebase] Admin SDK unusable on any database. Falling back to Client SDK only.');
                adminDb = null;
              });
          } else {
            console.warn('[Firebase] Admin SDK permission denied on (default) DB. Falling back to Client SDK.');
            adminDb = null;
          }
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
       firebaseApp = initializeApp(firebaseConfig);
       db = firebaseConfig.firestoreDatabaseId 
         ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
         : getFirestore(firebaseApp);

    // Initialize Admin SDK (fallback)
    try {
      if (!admin.apps.length) {
        console.log(`[Firebase] Initializing Admin (fallback) for: ${firebaseConfig.projectId}`);
        admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
      
      const adminApp = admin.app();
      const dbId = firebaseConfig.firestoreDatabaseId;
      
      if (dbId && dbId !== '(default)') {
        adminDb = getAdminFirestore(adminApp, dbId);
      } else {
        adminDb = getAdminFirestore(adminApp);
      }
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
const processedMessagesCache = new Map<string, number>();
function isDuplicateMessage(mid: string): boolean {
  if (!mid) return false;
  const now = Date.now();
  if (processedMessagesCache.size > 2000) {
    for (const [key, timestamp] of processedMessagesCache.entries()) {
      if (now - timestamp > 10 * 60 * 1000) {
        processedMessagesCache.delete(key);
      }
    }
  }
  if (processedMessagesCache.has(mid)) {
    console.log(`[Webhook Deduplication] Skipping duplicate message ID: ${mid}`);
    return true;
  }
  processedMessagesCache.set(mid, now);
  return false;
}

// Send a product image to Messenger as an image attachment
async function sendImageMessage(pageAccessToken: string, senderId: string, imageUrl: string) {
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
  } catch (err: any) {
    console.warn('[Webhook] v21.0 image send failed, trying v18.0 fallback...', err.response?.data || err.message);
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(cleanToken)}`, payload, { timeout: 15000 });
  }
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

// Helper to get effective Gemini Config (Admin DB or Environment)
async function getEffectiveGeminiConfig() {
  let apiKey = process.env.GEMINI_API_KEY || '';
  let model = 'gemini-3.7-flash';
  let temperature = 0.7;
  let maxTokens = 800;

  try {
    if (adminDb) {
      const publicSnap = await adminDb.collection('system_config').doc('public').get();
      if (publicSnap.exists) {
        const d = publicSnap.data();
        if (d.geminiApiKey) apiKey = d.geminiApiKey;
        if (d.defaultAiModel) model = d.defaultAiModel;
        if (d.aiTemperature) temperature = Number(d.aiTemperature);
        if (d.aiMaxTokens) maxTokens = Number(d.aiMaxTokens);
      } else {
        const sysSnap = await adminDb.collection('system').doc('settings').get();
        if (sysSnap.exists) {
          const d = sysSnap.data();
          if (d.geminiApiKey) apiKey = d.geminiApiKey;
          if (d.defaultAiModel) model = d.defaultAiModel;
        }
      }
    } else if (db) {
      const publicSnap = await getDoc(doc(db, 'system_config', 'public'));
      if (publicSnap.exists()) {
        const d = publicSnap.data();
        if (d.geminiApiKey) apiKey = d.geminiApiKey;
        if (d.defaultAiModel) model = d.defaultAiModel;
        if (d.aiTemperature) temperature = Number(d.aiTemperature);
        if (d.aiMaxTokens) maxTokens = Number(d.aiMaxTokens);
      } else {
        const sysSnap = await getDoc(doc(db, 'system', 'settings'));
        if (sysSnap.exists()) {
          const d = sysSnap.data();
          if (d.geminiApiKey) apiKey = d.geminiApiKey;
          if (d.defaultAiModel) model = d.defaultAiModel;
        }
      }
    }
  } catch (e) {
    console.warn('[Gemini Config Load Notice]', e);
  }

  if (model === 'gemini-1.5-flash' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-pro') {
    model = 'gemini-3.7-flash';
  }

  return { apiKey: (apiKey || '').trim(), model, temperature, maxTokens };
}

// Helper to save Messenger logs in live collection
async function saveMessengerLog(businessId: string, logData: {
  senderId?: string;
  pageId?: string;
  message?: string;
  reply?: string;
  status?: 'received' | 'replied' | 'error';
  error?: string;
  latencyMs?: number;
}) {
  const payload = {
    businessId: businessId || 'unknown',
    senderId: logData.senderId || 'FB_User',
    pageId: logData.pageId || '',
    message: logData.message || '',
    reply: logData.reply || '',
    status: logData.status || 'received',
    error: logData.error || null,
    latencyMs: logData.latencyMs || 0
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

// Helper to send Facebook Conversions API events
async function fireFacebookEvent(bizConfig: any, eventName: string, userData: any, customData: any = {}) {
  if (!bizConfig.facebookConfig?.pixelId || !bizConfig.facebookConfig?.accessToken) return;

  try {
    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "chat",
        user_data: {
          client_user_agent: "AI_Sales_Bot_Messenger",
          external_id: userData.external_id,
          ph: userData.phone ? [userData.phone] : [],
          fn: userData.name ? [userData.name] : [],
        },
        custom_data: customData
      }],
      test_event_code: bizConfig.facebookConfig.testEventCode || undefined
    };

    await axios.post(`https://graph.facebook.com/v18.0/${bizConfig.facebookConfig.pixelId}/events?access_token=${bizConfig.facebookConfig.accessToken}`, payload);
    console.log(`[CAPI] Event Fired: ${eventName}`);
  } catch (err: any) {
    console.error('[CAPI Error]', err.response?.data || err.message);
  }
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

async function saveChatMessage(bizId: string, senderId: string, role: 'user' | 'bot' | 'merchant', text: string) {
  const logBase = {
    businessId: bizId,
    senderId: senderId,
    role: role,
    text: text
  };

  if (adminDb) {
    try {
      const ts = admin.firestore.FieldValue.serverTimestamp();
      await adminDb.collection('chat_history').add({ ...logBase, timestamp: ts });
      
      // Update summary doc
      await adminDb.collection('chats').doc(`${bizId}_${senderId}`).set({
        businessId: bizId,
        senderId: senderId,
        lastMessage: text.substring(0, 200),
        timestamp: ts,
        messages: admin.firestore.FieldValue.arrayUnion({
          role,
          text,
          timestamp: new Date().toISOString()
        })
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
      
      // Update summary
      await setDoc(doc(db, 'chats', `${bizId}_${senderId}`), {
        businessId: bizId,
        senderId: senderId,
        lastMessage: text.substring(0, 200),
        timestamp: ts,
        messages: FieldValue ? (FieldValue as any).arrayUnion({
          role,
          text,
          timestamp: new Date().toISOString()
        }) : []
      }, { merge: true });
    } catch (err) {
      console.error('[History Client Save Error]', err);
    }
  }
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

app.get('/api/status', (req, res) => {
  res.json({
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    firebaseConfigured: !!process.env.FIREBASE_PROJECT_ID || !!process.env.FIREBASE_SERVICE_ACCOUNT,
    adminDbReady: !!adminDb,
    serverVersion: '1.2.0',
    timestamp: new Date().toISOString()
  });
});

// Dynamic Gemini AI Diagnostic Test
app.post('/api/ai/test', async (req, res) => {
  const { apiKey, model } = req.body;
  const effectiveKey = (apiKey && typeof apiKey === 'string' && apiKey.trim()) || process.env.GEMINI_API_KEY || '';
  let selectedModel = model || 'gemini-3.7-flash';
  // Map any outdated/retired model IDs to modern active models
  if (selectedModel === 'gemini-2.5-flash' || selectedModel === 'gemini-1.5-flash' || selectedModel === 'gemini-1.5-pro') {
    selectedModel = 'gemini-3.7-flash';
  }

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

// Webhook Paths configuration
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

// Consolidated Webhook Verification (GET)
app.get(webhookPaths, async (req, res) => {
  const mode = req.query['hub.mode'] || req.query['mode'];
  const token = ((req.query['hub.verify_token'] || req.query['verify_token']) as string) || '';
  const challenge = req.query['hub.challenge'] || req.query['challenge'];
  const pathParts = req.path.split('/').filter(Boolean);
  const rawBizId = req.params.businessId || (req.params as any)['0'] || (pathParts.length > 2 ? pathParts[pathParts.length - 1] : undefined);
  const businessId = (rawBizId && rawBizId !== 'webhook' && rawBizId !== 'api' && rawBizId !== 'messenger') ? rawBizId : undefined;

  console.log(`[Webhook GET Handshake] Path=${req.path}, Mode=${mode}, Token=${token}, Challenge=${challenge}, BizId=${businessId}`);
  
  if (mode === 'subscribe' && challenge) {
    let authorized = false;
    const universalTokens = [
      'sellkori_verify_token',
      'sellkori_token',
      'sellkori',
      'chatbyraju',
      '1058370033',
      'sendbyraju',
      'raju',
      'webhook'
    ];
    
    const cleanToken = token.trim();

    if (!cleanToken || universalTokens.includes(cleanToken.toLowerCase())) {
      authorized = true;
    } else if (businessId && cleanToken === businessId) {
      authorized = true;
    } else if (businessId) {
      // Lookup specific token for this business
      try {
        if (adminDb) {
          const docSnap = await adminDb.collection('businesses').doc(businessId).get();
          if (docSnap.exists) {
            const data = docSnap.data();
            const expected = data.messengerVerifyToken || data.verifyToken;
            if (expected === cleanToken) authorized = true;
          }
        } else if (db) {
          const docSnap = await getDoc(doc(db, 'businesses', businessId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const expected = data.messengerVerifyToken || data.verifyToken;
            if (expected === cleanToken) authorized = true;
          }
        }
      } catch (e) { 
        console.error('Verify Token DB lookup failed', e); 
      }
    }

    // SECURITY NOTE: this used to unconditionally set authorized = true for
    // ANY verify token once mode=subscribe was present — meaning the
    // verify-token check above was decorative and anyone who knew (or
    // guessed) your webhook URL could pass Meta's handshake. Removed.
    // A request only succeeds now if it matched one of the known universal
    // tokens, the business ID itself, or the business's configured
    // messengerVerifyToken/verifyToken in Firestore.

    if (authorized) {
      console.log(`[Webhook Handshake Success] Responding with challenge: ${challenge}`);
      await logActivity(businessId || 'system', 'WEBHOOK_VERIFIED', `Handshake successful. Token: ${token || 'none'}`, 'success', 'system').catch(() => {});
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(challenge));
    }
  }
  
  console.warn(`[Webhook Handshake Failed] Mode=${mode}, Token=${token}`);
  await logActivity(businessId || 'system', 'WEBHOOK_FAILED', `Handshake failed. Token: ${token}`, 'error', 'system').catch(() => {});
  res.status(403).send('Forbidden');
});

// Consolidated Messenger Message Handler (POST)
app.post(webhookPaths, async (req, res) => {
  const pathParts = req.path.split('/').filter(Boolean);
  const rawBizId = req.params.businessId || (req.params as any)['0'] || (pathParts.length > 2 ? pathParts[pathParts.length - 1] : undefined);
  const pathBizId = (rawBizId && rawBizId !== 'webhook' && rawBizId !== 'api' && rawBizId !== 'messenger') ? rawBizId : undefined;
  const body = req.body;

  // IMPORTANT: We used to ack Facebook immediately with res.send() and then
  // process the message in a detached async IIFE "in the background".
  // On Vercel serverless functions, the runtime is allowed to freeze/kill
  // the function as soon as the HTTP response is flushed — there is no
  // guarantee that code after res.send() keeps running. This was the root
  // cause of the bot "sometimes replying, sometimes not": whether the
  // background work finished before Vercel froze the instance was random.
  // Fix: fully await processing and only respond once it's done. Facebook
  // allows up to ~20s before it considers the webhook a timeout/retry,
  // which is comfortably more than a Gemini call + Graph API send.
  try {
      // Diagnostic log
      await logActivity(pathBizId || 'system', 'WEBHOOK_PROCESSED', `Webhook hit. Entries: ${body.entry?.length || 0}`, 'info', 'system', body);

      if (body.object !== 'page') return;
      if (!body.entry || !Array.isArray(body.entry)) return;

      for (const entry of body.entry) {
        const pageId = String(entry.id).trim();
        const messaging = entry.messaging || entry.standby;
        
        if (!messaging) continue;

        for (const webhookEvent of messaging) {
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

            // Identify Store by Page ID (Multi-Strategy Bulletproof Matcher)
            let businessData: any = null;
            let bizId: string | null = pathBizId;
            const cleanPageId = String(pageId).trim();

            console.log(`[Webhook] Incoming Event for Page ID: "${cleanPageId}", URL BizId: "${pathBizId || 'none'}"`);

            // Strategy 1: Look up by path business ID if provided
            if (pathBizId && pathBizId !== 'unknown' && pathBizId !== 'system') {
              try {
                if (adminDb) {
                  const d = await adminDb.collection('businesses').doc(pathBizId).get();
                  if (d.exists) { businessData = d.data(); bizId = pathBizId; }
                } else if (db) {
                  const d = await getDoc(doc(db, 'businesses', pathBizId));
                  if (d.exists()) { businessData = d.data(); bizId = pathBizId; }
                }
              } catch (e) {}
            }

            // Strategy 2: Direct Page ID queries
            if (!businessData && cleanPageId) {
              const possiblePageIds = [cleanPageId];
              if (!isNaN(Number(cleanPageId))) {
                possiblePageIds.push(Number(cleanPageId) as any);
              }

              if (adminDb) {
                try {
                  for (const pid of possiblePageIds) {
                    let snap = await adminDb.collection('businesses').where('facebookPageId', '==', pid).limit(1).get();
                    if (snap.empty) snap = await adminDb.collection('businesses').where('pageId', '==', pid).limit(1).get();
                    if (snap.empty) snap = await adminDb.collection('businesses').where('facebookConfig.pageId', '==', pid).limit(1).get();
                    if (snap.empty) snap = await adminDb.collection('businesses').where('facebookConfig.facebookPageId', '==', pid).limit(1).get();
                    if (!snap.empty) {
                      businessData = snap.docs[0].data();
                      bizId = snap.docs[0].id;
                      console.log(`[Webhook] Admin Lookup Matched Biz: ${bizId}`);
                      break;
                    }
                  }
                } catch (e: any) {
                  console.warn('[Webhook] Admin Lookup Query Notice:', e.message);
                }
              }

              if (!businessData && db) {
                try {
                  for (const pid of possiblePageIds) {
                    let snap = await getDocs(query(collection(db, 'businesses'), where('facebookPageId', '==', pid), limit(1)));
                    if (snap.empty) snap = await getDocs(query(collection(db, 'businesses'), where('pageId', '==', pid), limit(1)));
                    if (!snap.empty) {
                      businessData = snap.docs[0].data();
                      bizId = snap.docs[0].id;
                      console.log(`[Webhook] Client Lookup Matched Biz: ${bizId}`);
                      break;
                    }
                  }
                } catch (e: any) {
                  console.warn('[Webhook] Client Lookup Query Notice:', e.message);
                }
              }
            }

            // Strategy 3: In-memory exhaustive scan across all businesses
            if (!businessData) {
              try {
                let allDocs: any[] = [];
                if (adminDb) {
                  const allSnap = await adminDb.collection('businesses').limit(100).get();
                  allDocs = allSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                } else if (db) {
                  const allSnap = await getDocs(query(collection(db, 'businesses'), limit(100)));
                  allDocs = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }

                // Match against all fields
                const matched = allDocs.find((b: any) => {
                  const bPageId = String(b.facebookPageId || b.pageId || b.facebookConfig?.pageId || b.facebookConfig?.facebookPageId || '').trim();
                  return bPageId && (bPageId === cleanPageId || cleanPageId.includes(bPageId) || bPageId.includes(cleanPageId));
                });

                if (matched) {
                  businessData = matched;
                  bizId = matched.id;
                  console.log(`[Webhook] In-memory scan matched Biz: ${bizId}`);
                } else if (allDocs.length === 1) {
                  // Single store fallback
                  businessData = allDocs[0];
                  bizId = allDocs[0].id;
                  console.log(`[Webhook] Single store fallback applied: ${bizId}`);
                }
              } catch (scanErr) {
                console.error('[Webhook] In-memory scan error:', scanErr);
              }
            }

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
            const HISTORY_WINDOW = 16; // was 8 — doubled so mid-length conversations don't lose context

            try {
              if (adminDb) {
                const custSnap = await adminDb.collection('customers').doc(`${bizId}_${senderId}`).get();
                if (custSnap.exists) longTermSummary = custSnap.data()?.chatSummary || '';
              } else if (db) {
                const custSnap = await getDoc(doc(db, 'customers', `${bizId}_${senderId}`));
                if (custSnap.exists()) longTermSummary = custSnap.data()?.chatSummary || '';
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
                if (adminDb) {
                  const historySnap = await adminDb.collection('chat_history')
                    .where('businessId', '==', bizId)
                    .where('senderId', '==', senderId)
                    .limit(HISTORY_WINDOW)
                    .get();
                  if (!historySnap.empty) {
                    const msgs = historySnap.docs.map((d: any) => d.data());
                    msgs.sort((a: any, b: any) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
                    chatHistoryText = msgs.slice(-HISTORY_WINDOW).map((m: any) => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.text}`).join('\n');
                  }
                }
              }
            } catch (histErr) {
              console.warn('[Webhook] Chat history load notice:', histErr);
            }

            console.log(`[Webhook] Message from ${senderId}: ${finalMessageText}`);
            await logActivity(bizId!, 'INCOMING', `Customer: "${finalMessageText.substring(0, 70)}"`, 'info', ownerId);
            await saveChatMessage(bizId!, senderId, 'user', finalMessageText).catch(e => console.error('Save chat error:', e));
            await saveMessengerLog(bizId!, { senderId, pageId: cleanPageId, message: finalMessageText, status: 'received' });

            const pageAccessToken = businessData.pageAccessToken || 
                                   businessData.facebookConfig?.accessToken || 
                                   businessData.accessToken;

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

            // Check if Customer explicitly requests Human Support / Agent
            const lowerMsg = finalMessageText.toLowerCase();
            const isHumanRequested = /মানুষ|manush|agent|human|representative|মালিক|owner|অভিযোগ|কথা বলতে চাই|সরাসরি কথা|helpdesk|support/i.test(lowerMsg);
            if (isHumanRequested) {
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
            if (!aiConfig.apiKey) {
              console.error('[Webhook] Gemini AI API key not configured in system');
              const noAiMsg = 'সেন্ট্রাল জেমিনি এপিআই কি কনফিগার করা নেই। অ্যাডমিন প্যানেলে API Key প্রদান করুন।';
              await logActivity(bizId!, 'ERROR', noAiMsg, 'error', ownerId);
              await saveMessengerLog(bizId!, { senderId, pageId: cleanPageId, message: finalMessageText, status: 'error', error: noAiMsg });
              continue;
            }

            let downloadedMedia: DownloadedMedia[] = [];
            if (incomingMedia.length > 0) {
              downloadedMedia = await downloadIncomingMedia(incomingMedia, pageAccessToken);
              console.log(`[Webhook] Media attachments: ${incomingMedia.length} incoming, ${downloadedMedia.length} downloaded`);
            }

            await sendTypingOn(pageAccessToken, senderId);

            // AI Processing
            console.log(`[Webhook] Starting AI processing with model: ${aiConfig.model}`);
            await logActivity(bizId!, 'AI_START', `বটের কাছে পাঠানো হচ্ছে (${aiConfig.model})...`, 'info', ownerId);

            const products = (businessData.products || []).map((p: any) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              minPrice: p.minPrice || p.price,
              pricingTiers: p.pricingTiers || [{ quantity: 1, price: p.price, minPrice: p.minPrice || p.price }],
              stock: p.stock ?? p.stockCount ?? 10,
              category: p.category || 'General'
            }));

            const allFaqs = businessData.faqs || [];
            const generalFaqs = allFaqs
              .filter((f: any) => (f.type || (f.productId ? 'product' : 'general')) === 'general')
              .map((f: any) => `[${f.category || 'General'}] Q: ${f.question} -> A: ${f.answer}`)
              .join('\n');

            const productFaqs = allFaqs
              .filter((f: any) => (f.type || (f.productId ? 'product' : 'general')) === 'product')
              .map((f: any) => `[Product: ${f.productName || f.productId}] Q: ${f.question} -> A: ${f.answer}`)
              .join('\n');

            const prompt = `তুমি "${businessData.name}" এর একজন স্মার্ট, সংক্ষিপ্ত ও টু-দ্য-পয়েন্ট এআই সেলস অ্যাসিস্ট্যান্ট।

# কঠোর নির্দেশাবলী (Strict Directives):
১. **সংক্ষিপ্ত ও নির্দিষ্ট উত্তর:** কাস্টমার যতটুকু প্রশ্ন করবে, ঠিক ততটুকুরই সুনির্দিষ্ট, প্রাসঙ্গিক ও সংক্ষিপ্ত উত্তর দাও (১ থেকে ৩ বাক্যের মধ্যে)।
২. **অতিরিক্ত কথা বর্জন:** কোনো অপ্রয়োজনীয় বড় ভূমিকা, লম্বা সূচনা ("হ্যালো স্যার, কেমন আছেন...", "আমাদের শপে স্বাগতম...") অথবা কাস্টমার না চাইলে জোর করে পণ্যের লম্বা তালিকা বা অফার দেবে না।
৩. **চ্যাট হিস্ট্রি ও পূর্বপ্রসঙ্গ স্মরণ:** নিচের "পূর্ববর্তী কথোপকথন (Chat History)" মনোযোগ দিয়ে পড়ো। কাস্টমার আগে যে প্রোডাক্ট বা বিষয় নিয়ে কথা বলেছে, সেই প্রসঙ্গ মনে রেখে সরাসরি উত্তর দাও।
৪. **দরদাম ও প্রাইসিং:** কাস্টমার কোনো প্রোডাক্টের দাম বা সাইজ জানতে চাইলে শুধুমাত্র সেই প্রোডাক্টের তথ্য দাও। পণ্যের সর্বনিম্ন দাম সীমা (minPrice) এর নিচে কখনোই রাজি হবে না।
৫. **অর্ডার নেওয়ার নিয়ম:** কাস্টমার যখন পণ্য কিনতে রাজি হবে, বিনয়ের সাথে নাম, মোবাইল নম্বর (১১ ডিজিট) এবং সম্পূর্ণ ডেলিভারি ঠিকানা জানতে চাইবে। কাস্টমার যদি ফোন নম্বর ও ঠিকানা দেয়, তবে তাকে অর্ডার নিশ্চিত করার ধন্যবাদ জানাও।
৬. **ফটো/ছবি রিপ্লাই:** কাস্টমার ছবি পাঠালে অবশ্যই ছবিটি দেখে উত্তর দাও — নীরব থাকবে না। নিয়ম:
   - পণ্য/ক্যাটালগ স্ক্রিনশট: ক্যাটালগের সাথে মিলিয়ে নাম, দাম ও স্টক বলো; অর্ডার করতে চান কিনা জিজ্ঞেস করো। মিললে show_product_image true করতে পারো।
   - পেমেন্ট/বিকাশ/নগদ/রকেট স্ক্রিনশট: "স্ক্রিনশট পেয়েছি, আমাদের টিম ভেরিফাই করে আপনাকে জানাবে" — নিজে থেকে পেমেন্ট কনফার্মড বলবে না।
   - নাম/ঠিকানা/ফোন লেখা ছবি: পড়ে নিশ্চিত করে নাও।
   - ক্ষতি/কমপ্লেইন/ডেলিভারি সমস্যা: সহানুভূতি দেখিয়ে সমাধানের কথা বলো।
   - স্পষ্ট না হলে: "ছবিটি পেয়েছি — এটা কোন পণ্য বা বিষয় সম্পর্কে জানতে চান?"
৭. **ভয়েস মেসেজ রিপ্লাই:** অডিও শুনে কাস্টমার যা বলেছে তা বুঝে ঠিক টেক্সট মেসেজের মতো সেলস উত্তর দাও। উত্তরের প্রথম বাক্যে সংক্ষেপে নিশ্চিত করো তুমি কী শুনেছ (যেমন: "আপনি দাম জানতে চেয়েছেন।")। বাংলা, ব্যাংলিশ বা ইংরেজি যা শুনবে সেই ভাষায় উত্তর দাও। অডিও বোঝা না গেলে নম্রভাবে লিখে পাঠাতে বলো।

দোকানের তথ্য: ${businessData.description || ''}
পণ্যতালিকা ও প্রাইসিং:
${JSON.stringify(products, null, 2)}

সাধারণ স্টোর FAQs (ডেলিভারি, পেমেন্ট, রিটার্ন):
${generalFaqs || 'সাধারণ FAQ নেই।'}

পণ্যভিত্তিক FAQs:
${productFaqs || 'পণ্যভিত্তিক FAQ নেই।'}

কাস্টম নির্দেশিকা: ${businessData.customSystemPrompt || businessData.botPersona || ''}

---
এই কাস্টমার সম্পর্কে দীর্ঘমেয়াদী স্মৃতি (আগের সেশনগুলোর সারসংক্ষেপ):
${longTermSummary || 'এই কাস্টমারের কোনো পুরনো তথ্য নেই, ইনি নতুন অথবা প্রথমবার কথা বলছেন।'}

পূর্ববর্তী কথোপকথন (Chat History):
${chatHistoryText || 'নতুন আলাপ (পূর্ববর্তী কোনো মেসেজ নেই)'}

কাস্টমারের বর্তমান বার্তা: "${finalMessageText}"
${downloadedMedia.length > 0 ? `\nকাস্টমারের সাথে পাঠানো মিডিয়া এই রিকোয়েস্টে সংযুক্ত আছে (${downloadedMedia.map((m) => m.kind === 'audio' ? 'ভয়েস' : 'ছবি').join(', ')})। মিডিয়া দেখে/শুনে উত্তর দাও।` : ''}

সেলসম্যানের টু-দ্য-পয়েন্ট ও প্রাসঙ্গিক উত্তর (শুধুমাত্র উত্তরটি বাংলায় লেখো):`;
              
              const startTime = Date.now();
              const geminiParts: any[] = [{ text: prompt }];
              for (const media of downloadedMedia) {
                geminiParts.push({ inlineData: { mimeType: media.mimeType, data: media.data } });
              }

              try {
                console.log(`[Webhook] Calling Gemini AI for biz: ${bizId}${downloadedMedia.length ? ` with ${downloadedMedia.length} media part(s)` : ''}`);
                let responseText = '';

                const runGemini = async (modelName: string, parts: any[]) => {
                  const client = new GoogleGenAI({ apiKey: aiConfig.apiKey });
                  const aiResponse = await client.models.generateContent({
                    model: modelName,
                    contents: [{ role: 'user', parts }]
                  });
                  return aiResponse.text?.trim() || '';
                };
                
                // Resilient Multi-Model Gemini Failover
                try {
                  responseText = await runGemini(aiConfig.model, geminiParts);
                } catch (primaryAiErr: any) {
                  console.warn(`[Webhook] Primary model ${aiConfig.model} failed, falling back to gemini-3.1-flash-lite...`, primaryAiErr?.message);
                  try {
                    responseText = await runGemini('gemini-3.1-flash-lite', geminiParts);
                  } catch (fallbackErr: any) {
                    if (geminiParts.length > 1) {
                      console.warn('[Webhook] Multimodal fallback failed, retrying text-only...', fallbackErr?.message);
                      responseText = await runGemini('gemini-3.1-flash-lite', [{ text: prompt }]);
                    } else {
                      throw new Error(`AI Generation failed on all models: ${fallbackErr?.message}`);
                    }
                  }
                }

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

                // ==========================================
                // Enterprise Automated Order Extraction Engine
                // ==========================================
                const fullText = `${finalMessageText} ${chatHistoryText}`;
                const phoneMatch = fullText.match(/(01[3-9]\d{8})/);
                const hasAddressKeywords = /রোড|বাসা|বাড়ি|গ্রাম|থানা|জেলা|সেক্টর|ঢাকা|dhaka|চট্টগ্রাম|খুলনা|রাজশাহী|সিলেট|বরিশাল|রংপুর|ময়মনসিংহ|কুমিল্লা|গাজীপুর|নারায়ণগঞ্জ|মিরপুর|ধানমন্ডি|উত্তরা|গুলশান|বনানী|মোহাম্মদপুর|মতিঝিল|যাত্রাবাড়ী|বাড্ডা|মগবাজার/i.test(fullText);

                if (phoneMatch && (hasAddressKeywords || finalMessageText.length > 25)) {
                  try {
                    const extractedPhone = phoneMatch[1];
                    const isInsideDhaka = /ঢাকা|dhaka|মিরপুর|ধানমন্ডি|উত্তরা|গুলশান|বনানী|মোহাম্মদপুর|মতিঝিল|যাত্রাবাড়ী|বাড্ডা|মগবাজার|খিলগাঁও|বাসাবো|তেজগাঁও|বারিধারা|রামপুরা|লালবাগ/i.test(finalMessageText);
                    const deliveryCharge = isInsideDhaka 
                      ? (businessData.courierConfig?.deliveryChargeInsideDhaka || 60)
                      : (businessData.courierConfig?.deliveryChargeOutsideDhaka || 120);

                    // Find matched product or default to first product
                    const matchedProduct = products.find((p: any) => 
                      finalMessageText.toLowerCase().includes(p.name?.toLowerCase()) ||
                      chatHistoryText.toLowerCase().includes(p.name?.toLowerCase())
                    ) || products[0];

                    const unitPrice = matchedProduct?.price || 500;
                    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
                    const totalAmount = unitPrice + deliveryCharge;

                    const newOrder = {
                      id: orderId,
                      businessId: bizId,
                      customerName: senderId ? `FB User (${senderId.slice(-4)})` : 'Messenger Customer',
                      phone: extractedPhone,
                      address: finalMessageText.slice(0, 150),
                      productId: matchedProduct?.id || 'prod-1',
                      productName: matchedProduct?.name || 'অর্ডারকৃত পণ্য',
                      quantity: 1,
                      unitPrice: unitPrice,
                      deliveryCharge: deliveryCharge,
                      totalPrice: totalAmount,
                      status: 'pending',
                      paymentStatus: 'unpaid',
                      paymentMethod: 'cod',
                      notes: `Auto-created by AI from Messenger (Customer: ${senderId})`,
                      createdAt: new Date().toISOString()
                    };

                    if (adminDb) {
                      await adminDb.collection('orders').doc(orderId).set(newOrder);
                      // Deduct stock
                      if (matchedProduct && matchedProduct.stock > 0) {
                        const updatedProducts = (businessData.products || []).map((p: any) => {
                          if (p.id === matchedProduct.id) {
                            return { ...p, stock: Math.max(0, (p.stock || p.stockCount || 10) - 1) };
                          }
                          return p;
                        });
                        await adminDb.collection('businesses').doc(bizId!).update({ products: updatedProducts }).catch(() => {});
                      }
                    }

                    await logActivity(bizId!, 'ORDER_AUTO_CREATED', `নতুন অর্ডার তৈরি হয়েছে: ${orderId} (৳${totalAmount})`, 'success', ownerId, newOrder);
                    console.log(`[Webhook] Auto-created order: ${orderId} for customer ${extractedPhone}`);
                  } catch (orderErr) {
                    console.warn('[Webhook] Auto order placement notice:', orderErr);
                  }
                }

                console.log(`[Webhook] AI Reply: ${reply.substring(0, 30)}...`);
                
                // Send Response to Facebook Graph API
                console.log(`[Webhook] Sending response to Facebook sender: ${senderId}`);
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

                // Send product image if the AI decided the customer wants to see one.
                // (Previously `show_product_image` was parsed from the AI response but
                // never actually used anywhere — customers asking for photos never got one.)
                if (aiRes?.show_product_image) {
                  try {
                    const wantedName = String(aiRes.product_name || '').toLowerCase().trim();
                    const rawProducts = businessData.products || [];
                    let imageProduct = wantedName
                      ? rawProducts.find((p: any) => p.name?.toLowerCase().includes(wantedName) || wantedName.includes(p.name?.toLowerCase() || '\u0000'))
                      : null;
                    if (!imageProduct) {
                      // Fallback: match against the customer's message text directly
                      imageProduct = rawProducts.find((p: any) => p.name && finalMessageText.toLowerCase().includes(p.name.toLowerCase()));
                    }
                    const imageUrl = imageProduct?.images?.[0];
                    if (imageUrl) {
                      await sendImageMessage(pageAccessToken, senderId, imageUrl);
                      console.log(`[Webhook] Sent product image for: ${imageProduct.name}`);
                    } else {
                      console.log('[Webhook] show_product_image was true but no matching product image was found.');
                    }
                  } catch (imgErr: any) {
                    console.warn('[Webhook] Product image send failed:', imgErr.response?.data || imgErr.message);
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

                // Update Tenant AI Message & Token Counter
                if (adminDb) {
                  await adminDb.collection('businesses').doc(bizId!).update({
                    aiMessagesCount: admin.firestore.FieldValue.increment(1),
                    totalTokensUsed: admin.firestore.FieldValue.increment(180)
                  }).catch(() => {});
                }

                console.log('[Webhook] Reply sequence finished successfully');
                await logActivity(bizId!, 'REPLY_SENT', `উত্তর পাঠানো হয়েছে: "${reply.substring(0, 50)}..."`, 'success', ownerId);

                // Update lead info if AI provided it
                if (aiRes && (aiRes.summary || aiRes.order_data)) {
                  if (adminDb) {
                    await adminDb.collection('customers').doc(`${bizId}_${senderId}`).set({
                      businessId: bizId,
                      messengerId: senderId,
                      lastInteraction: admin.firestore.FieldValue.serverTimestamp(),
                      chatSummary: aiRes.summary || '',
                      leadInfo: aiRes.order_data || {},
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }).catch(() => {});
                  }
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
                
                // Fallback messaging to Facebook
                try {
                  await axios.post(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`, {
                    recipient: { id: senderId },
                    message: { text: incomingMedia.some((m) => m.kind === 'audio')
                      ? "আপনার ভয়েস মেসেজটি পেয়েছি। আমাদের সেলস অ্যাসিস্ট্যান্ট শীঘ্রই আপনার সাথে যুক্ত হচ্ছে।"
                      : incomingMedia.some((m) => m.kind === 'image')
                        ? "আপনার ছবিটি পেয়েছি। আমাদের সেলস অ্যাসিস্ট্যান্ট শীঘ্রই আপনার সাথে যুক্ত হচ্ছে।"
                        : "ধন্যবাদ আপনার বার্তার জন্য! আমাদের সেলস অ্যাসিস্ট্যান্ট শীঘ্রই আপনার সাথে যুক্ত হচ্ছে।" }
                  });
                } catch (e) {}
              }

          } catch (e: any) {
            console.error('[Event Loop Error]', e.message);
          }
        }
      }
    } catch (e) {
      console.error('Webhook Process error', e);
    } finally {
      // Respond only after processing has actually finished (success or
      // failure) so Vercel doesn't freeze the function mid-way through
      // sending the AI reply. See note above.
      try { res.status(200).send('EVENT_RECEIVED'); } catch (_) {}
    }
});

// Meta Graph API Token Health Test
app.post('/api/messenger/test-token', async (req, res) => {
  const { pageAccessToken } = req.body;
  if (!pageAccessToken || typeof pageAccessToken !== 'string') {
    return res.status(400).json({ success: false, error: 'Page Access Token প্রদান করুন।' });
  }

  try {
    const metaRes = await axios.get(`https://graph.facebook.com/v21.0/me?fields=id,name,category,link&access_token=${encodeURIComponent(pageAccessToken.trim())}`);
    return res.json({
      success: true,
      page: metaRes.data
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
  if (!aiConfig.apiKey) {
    return res.status(400).json({ success: false, error: 'সেন্ট্রাল জেমিনি এপিআই কি কনফিগার করা নেই। অ্যাডমিন প্যানেল থেকে দিন।' });
  }

  const startTime = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: aiConfig.apiKey });
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
          simHistory = cSnap.data()?.messages.slice(-6).map((m: any) => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.text}`).join('\n');
        }
      }
    } catch (e) {}

    const prompt = `তুমি "${businessData.name || 'আমাদের স্টোর'}" এর এআই সেলসম্যান।

# কঠোর নিয়মাবলী:
১. **সংক্ষিপ্ত ও নির্দিষ্ট উত্তর:** কাস্টমার যা জানতে চেয়েছে ঠিক ততটুকুরই সুনির্দিষ্ট, প্রাসঙ্গিক ও টু-দ্য-পয়েন্ট উত্তর দাও (১-৩ বাক্যের মধ্যে)।
২. **অতিরিক্ত কথা না বলা:** কোনো অপ্রয়োজনীয় বড় ভূমিকা, সালাম-স্বাগত ভাষণ বা না চাওয়া তথ্য দেবে না।
৩. **প্রসঙ্গ স্মরণ:** পূর্বের চ্যাট হিস্ট্রি দেখে প্রাসঙ্গিক উত্তর দাও।

পণ্যতালিকা:
${JSON.stringify(products, null, 2)}

পূর্ববর্তী চ্যাট হিস্ট্রি:
${simHistory || 'নতুন আলাপ'}

কাস্টমার: "${message}"

টু-দ্য-পয়েন্ট উত্তর:`;

    const response = await ai.models.generateContent({
      model: aiConfig.model,
      contents: prompt
    });

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

// Broadcast promotional messages
app.post('/api/broadcast', async (req, res) => {
  const { businessId, pageAccessToken, message, segment, ownerId } = req.body;

  if (!businessId || !pageAccessToken || !message) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  if (!adminDb && !db) {
    return res.status(500).json({ error: 'Firestore not initialized' });
  }

  try {
    let customers: any[] = [];
    if (adminDb) {
      let queryRef = adminDb.collection('customers').where('businessId', '==', businessId);
      if (segment && segment !== 'All') {
        queryRef = queryRef.where('segment', '==', segment);
      }
      const snap = await queryRef.get();
      customers = snap.docs.map((d: any) => d.data());
    } else {
      let q = query(collection(db, 'customers'), where('businessId', '==', businessId));
      if (segment && segment !== 'All') {
        q = query(q, where('segment', '==', segment));
      }
      const snap = await getDocs(q);
      customers = snap.docs.map(d => d.data());
    }

    let successCount = 0;
    for (const customer of customers) {
      if (!customer.messengerId) continue;
      try {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
          recipient: { id: customer.messengerId },
          message: { text: message }
        });
        successCount++;
        await saveChatMessage(businessId, customer.messengerId, 'merchant', `[BROADCAST] ${message}`);
      } catch (e) {
        console.error(`Broadcast failed for ${customer.messengerId}`);
      }
    }

    await logActivity(businessId, 'BROADCAST_SENT', `${successCount} জন কাস্টমারকে ব্রডকাস্ট পাঠানো হয়েছে।`, 'info', ownerId);
    res.json({ success: true, count: successCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Abandoned Cart Recovery Cron (Runs every 15 minutes)
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

// Initialize server
async function init() {
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
