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
      
      // Verification test
      try {
        await adminDb.collection('businesses').limit(1).get();
        console.log(`[Firebase] Admin SDK Verified on Database: ${dbId || '(default)'}`);
      } catch (testErr: any) {
        if (dbId && dbId !== '(default)') {
          console.log(`[Firebase] Admin DB "${dbId}" access denied. Falling back to (default) database...`);
          try {
            const fallbackDb = getAdminFirestore(adminApp);
            await fallbackDb.collection('businesses').limit(1).get();
            adminDb = fallbackDb;
            console.log('[Firebase] Admin SDK switched to (default) database.');
          } catch (e2) {
            console.warn('[Firebase] Admin SDK unusable on any database. Falling back to Client SDK only.');
            adminDb = null;
          }
        } else {
          console.warn('[Firebase] Admin SDK permission denied on (default) DB. Falling back to Client SDK.');
          adminDb = null;
        }
      }
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
      description: "The reply in Bengali language",
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
app.use(express.json());

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

// Consolidated Webhook Verification (GET)
app.get(['/webhook', '/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'];
  const { businessId } = req.params;

  console.log(`[Webhook GET] token=${token}, mode=${mode}, bizId=${businessId}`);
  
  if (mode === 'subscribe' && challenge) {
    let authorized = false;
    const universalTokens = ['chatbyraju', '1058370033', 'sendbyraju'];
    
    if (universalTokens.includes(token?.toLowerCase())) {
      authorized = true;
    } else if (businessId) {
      // Lookup specific token for this business
      try {
        if (adminDb) {
          const doc = await adminDb.collection('businesses').doc(businessId).get();
          if (doc.exists) {
            const data = doc.data();
            const expected = data.messengerVerifyToken || data.verifyToken;
            if (expected === token) authorized = true;
          }
        }
      } catch (e) { console.error('Verify Token DB lookup failed', e); }
    }

    // fallback for easy setup: if we can't find it or it matches system
    if (!authorized && (!token || token === 'chatbyraju')) authorized = true;
    
    if (authorized) {
      console.log('[Webhook] Handshake success');
      await logActivity(businessId || 'system', 'WEBHOOK_VERIFIED', `Handshake successful. Token: ${token || 'none'}`, 'success', 'system').catch(() => {});
      return res.status(200).send(challenge);
    }
  }
  
  console.warn('[Webhook] Handshake failed');
  await logActivity(businessId || 'system', 'WEBHOOK_FAILED', `Handshake failed. Token: ${token}`, 'error', 'system').catch(() => {});
  res.status(403).send('Forbidden');
});

// Consolidated Messenger Message Handler (POST)
app.post(['/webhook', '/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId: pathBizId } = req.params;
  const body = req.body;

  // Acknowledge immediately to prevent Facebook retries
  res.status(200).send('EVENT_RECEIVED');

  // Process in background
  (async () => {
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

            // Identify Store by Page ID
            let businessData: any = null;
            let bizId: string | null = pathBizId;
            const cleanPageId = String(pageId).trim();

            console.log(`[Webhook] Processing Page ID: ${cleanPageId}`);

            // Attempt 1: Admin SDK (Try string and number)
            if (adminDb) {
              try {
                console.log(`[Webhook] Admin Lookup for: ${cleanPageId}`);
                let snap = await adminDb.collection('businesses').where('facebookPageId', '==', cleanPageId).get();
                if (snap.empty) {
                  snap = await adminDb.collection('businesses').where('pageId', '==', cleanPageId).get();
                }
                if (snap.empty && !isNaN(Number(cleanPageId))) {
                  snap = await adminDb.collection('businesses').where('facebookPageId', '==', Number(cleanPageId)).get();
                  if (snap.empty) {
                    snap = await adminDb.collection('businesses').where('pageId', '==', Number(cleanPageId)).get();
                  }
                }
                if (!snap.empty) {
                  const doc = snap.docs[0];
                  businessData = doc.data();
                  bizId = doc.id;
                  console.log(`[Webhook] Admin Lookup Success: ${bizId}`);
                }
              } catch (e: any) {
                console.warn('[Webhook] Admin Lookup Failed:', e.message);
              }
            }

            // Attempt 2: Client SDK (if Admin failed)
            if (!businessData && db) {
              try {
                console.log(`[Webhook] Client Lookup for: ${cleanPageId}`);
                const q1 = query(collection(db, 'businesses'), where('facebookPageId', 'in', [cleanPageId, Number(cleanPageId)]));
                let snap = await getDocs(q1);
                if (snap.empty) {
                  const q2 = query(collection(db, 'businesses'), where('pageId', 'in', [cleanPageId, Number(cleanPageId)]));
                  snap = await getDocs(q2);
                }
                if (!snap.empty) {
                  const doc = snap.docs[0];
                  businessData = doc.data();
                  bizId = doc.id;
                  console.log(`[Webhook] Client Lookup Success: ${bizId}`);
                }
              } catch (e: any) {
                console.error('[Webhook] Client Lookup Failed:', e.message);
              }
            }

            // Attempt 3: If still not found and we have a bizId in the URL, use that
            if (!businessData && pathBizId && pathBizId !== 'unknown' && pathBizId !== 'system') {
              console.log(`[Webhook] ID Fallback: ${pathBizId}`);
              try {
                if (adminDb) {
                  const d = await adminDb.collection('businesses').doc(pathBizId).get();
                  if (d.exists) { businessData = d.data(); bizId = pathBizId; }
                }
                if (!businessData && db) {
                  const d = await getDoc(doc(db, 'businesses', pathBizId));
                  if (d.exists()) { businessData = d.data(); bizId = pathBizId; }
                }
              } catch (e) {}
            }

            if (!businessData) {
              console.error(`[Webhook] Business not found for Page ID: "${cleanPageId}"`);
              
              // Diagnostic: What was received?
              await logActivity('system', 'ERROR', `বট রিপ্লাই দিতে পারেনি: আপনার ফেসবুক পেজ আইডি (${cleanPageId}) ডাটাবেজের কোনো দোকানের সাথে মেলেনি। দোকানের সেটিংস চেক করুন।`, 'error', 'system', { 
                receivedPageId: cleanPageId,
                pathBizId: pathBizId || 'none'
              });
              continue;
            }

            const ownerId = businessData.ownerId;
            const shopName = businessData.name || "আমাদের স্টোর";

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

            if (!finalMessageText) {
              console.log('[Webhook] Empty message text, skipping processing');
              continue;
            }

            // Retrieve recent chat history for context
            let chatHistoryText = '';
            try {
              if (adminDb) {
                const historySnap = await adminDb.collection('chat_history')
                  .where('businessId', '==', bizId)
                  .where('senderId', '==', senderId)
                  .orderBy('timestamp', 'desc')
                  .limit(6)
                  .get();
                if (!historySnap.empty) {
                  const msgs = historySnap.docs.map((d: any) => d.data()).reverse();
                  chatHistoryText = msgs.map((m: any) => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.text}`).join('\n');
                }
              } else if (db) {
                const qHist = query(
                  collection(db, 'chat_history'),
                  where('businessId', '==', bizId),
                  where('senderId', '==', senderId),
                  orderBy('timestamp', 'desc'),
                  limit(6)
                );
                const snapHist = await getDocs(qHist);
                if (!snapHist.empty) {
                  const msgs = snapHist.docs.map((d: any) => d.data()).reverse();
                  chatHistoryText = msgs.map((m: any) => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.text}`).join('\n');
                }
              }
            } catch (histErr) {
              console.warn('[Webhook] Chat history load notice:', histErr);
            }

            console.log(`[Webhook] Message from ${senderId}: ${finalMessageText}`);
            await logActivity(bizId!, 'INCOMING', `Customer: "${finalMessageText.substring(0, 70)}"`, 'info', ownerId);
            await saveChatMessage(bizId!, senderId, 'user', finalMessageText).catch(e => console.error('Save chat error:', e));

            const pageAccessToken = businessData.pageAccessToken || 
                                   businessData.facebookConfig?.accessToken || 
                                   businessData.accessToken;

            if (!pageAccessToken) {
              console.error(`[Webhook] No access token for biz: ${bizId}. Data:`, JSON.stringify(businessData));
              await logActivity(bizId!, 'ERROR', 'ফেসবুক অ্যাক্সেস টোকেন পাওয়া যায়নি। আপনার সেটিংস থেকে ফেসবুক পেজ কানেক্ট করুন।', 'error', ownerId);
              continue;
            }

            if (!process.env.GEMINI_API_KEY || !genAI) {
              console.error('[Webhook] Gemini AI not configured');
              await logActivity(bizId!, 'ERROR', 'Gemini AI Key কনফিগার করা নেই। অ্যাডমিন প্যানেলে চেক করুন।', 'error', ownerId);
              continue;
            }

            // AI Processing
            console.log(`[Webhook] Starting AI processing...`);
            await logActivity(bizId!, 'AI_START', 'বটের কাছে পাঠানো হচ্ছে...', 'info', ownerId);

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

            const prompt = `তুমি "${businessData.name}" এর জন্য একজন অত্যন্ত দক্ষ, বিনয়ী ও পেশাদার সেলস অ্যাসিস্ট্যান্ট। তোমার কাজ হলো কাস্টমারের সাথে বন্ধুত্বপূর্ণ আচরণ করা, পণ্যের সঠিক তথ্য দেওয়া এবং অর্ডার নেওয়া।

দোকানের বর্ণনা: ${businessData.description || ''}
পণ্যতালিকা ও প্রাইসিং অফার:
${JSON.stringify(products, null, 2)}

সাধারণ স্টোর পলিসি FAQs (ডেলিভারি, পেমেন্ট, রিটার্ন):
${generalFaqs || 'কোনো সাধারণ FAQ নেই।'}

পণ্যভিত্তিক বিশেষ প্রশ্নোত্তর FAQs (সাইজ, মেটেরিয়াল, কোয়ালিটি):
${productFaqs || 'কোনো পণ্যভিত্তিক FAQ নেই।'}

অতিরিক্ত নিয়ম ও ব্যক্তিত্ব: ${businessData.botPersona || ''}

নির্দেশনা:
১. সবসময় নম্র ও মার্জিত বাংলায় কথা বলবে।
২. কাস্টমার দাম জানতে চাইলে একক মূল্যের পাশাপাশি আকর্ষণীয় কোয়ান্টিটি বান্ডেল অফার (যেমন: ১ পিস ৫০০৳, ২ পিস ৮০০৳, ৩ পিস ১০০০৳) তুলে ধরবে যাতে কাস্টমার বেশি কিনতে উৎসাহিত হয়।
৩. কাস্টমার সাধারণ পলিসি (ডেলিভারি, সিওডি, রিটার্ন) নিয়ে প্রশ্ন করলে 'সাধারণ স্টোর পলিসি FAQs' থেকে উত্তর দেবে।
৪. কাস্টমার কোনো বিশেষ প্রোডাক্টের সাইজ, মেটেরিয়াল বা যত্ন নিয়ে প্রশ্ন করলে 'পণ্যভিত্তিক বিশেষ প্রশ্নোত্তর FAQs' থেকে উত্তর দেবে।
৫. কাস্টমার দরদাম (Bargaining) করতে চাইলে সংশ্লিষ্ট কোয়ান্টিটির সর্বনিম্ন দরদাম সীমা (minPrice) বজায় রেখে নেগোসিয়েট করবে। কখনোই minPrice-এর নিচে বিক্রি করতে রাজি হবে না।
৬. কাস্টমার যদি অর্ডার করতে চায়, তবে তাদের নাম, ফোন নম্বর (১১ ডিজিট) এবং সম্পূর্ণ ডেলিভারি ঠিকানা জানতে চাইবে।
৭. কথা সংক্ষেপে কিন্তু কার্যকরভাবে বলবে।

সাম্প্রতিক আলাপ:
${chatHistoryText}

কাস্টমার: ${finalMessageText}`;
              
              try {
                console.log(`[Webhook] Calling Gemini AI for biz: ${bizId}`);
                const aiModelName = businessData.selectedAiModel || "gemini-3.7-flash";
                const model = genAI!.getGenerativeModel({ model: aiModelName === 'gemini-1.5-flash' || aiModelName === 'gemini-2.5-flash' ? 'gemini-3.7-flash' : aiModelName });
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                
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
                  throw new Error("AI generated an empty reply.");
                }

                console.log(`[Webhook] AI Reply: ${reply.substring(0, 30)}...`);
                
                // Send Response to Facebook
                console.log(`[Webhook] Sending response to Facebook: ${senderId}`);
                await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
                  recipient: { id: senderId },
                  message: { text: reply.trim() }
                }, { timeout: 10000 });

                await saveChatMessage(bizId!, senderId, 'bot', reply.trim()).catch(e => console.error('Save chat error:', e));
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
                console.error('[AI/Reply Error]', err.response?.data || err.message);
                const errorMsg = err.response?.data?.error?.message || err.message;
                await logActivity(bizId!, 'ERROR', `বট রিপ্লাই দিতে ব্যর্থ হয়েছে: ${errorMsg}`, 'error', ownerId);
                
                // Fallback messaging
                try {
                  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
                    recipient: { id: senderId },
                    message: { text: "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।" }
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
    }
  })();
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
      if (req.path.startsWith('/api/') || req.path.startsWith('/webhook')) return next();
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
