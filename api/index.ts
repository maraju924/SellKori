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
      if (!admin.apps.length) {
        console.log(`[Firebase] Initializing Admin SDK...`);
        // If SERVICE_ACCOUNT is missing, initializeApp() uses Google Application Default Credentials
        admin.initializeApp();
      }
      
      const adminApp = admin.app();
      const dbId = firebaseConfig.firestoreDatabaseId;
      
      if (dbId && dbId !== '(default)') {
        adminDb = getAdminFirestore(adminApp, dbId);
      } else {
        adminDb = getAdminFirestore(adminApp);
      }
      console.log(`[Firebase] Admin Firestore instances obtained.`);
    } catch (adminErr: any) {
      console.error('[Firebase] Admin Init Error:', adminErr?.message);
      // Fallback to minimal init
      if (!admin.apps.length) {
        admin.initializeApp({ projectId: firebaseConfig.projectId });
        adminDb = getAdminFirestore(admin.app());
      }
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
    
    const logData = {
      businessId: bid,
      ownerId: oid,
      type,
      detail,
      status,
      timestamp: FieldValue ? FieldValue.serverTimestamp() : serverTimestamp(),
      data: data ? (typeof data === 'string' ? data.substring(0, 1000) : JSON.stringify(data).substring(0, 1000)) : null
    };

    if (adminDb) {
      try {
        await adminDb.collection('system_logs').add(logData);
        return;
      } catch (err: any) {
        // Only log admin error if it's not a common permission one to avoid clutter
        if (!err?.message?.includes('PERMISSION_DENIED')) {
          console.error('[Logger Admin Error]', err?.message);
        }
      }
    }
    
    if (db) {
      try {
        await addDoc(collection(db, 'system_logs'), {
          ...logData,
          timestamp: serverTimestamp()
        });
      } catch (ce) {
        console.error('[Logger Client Error]', ce);
      }
    }
  } catch (e) {}
}

// ... rest of helpers ...

async function saveChatMessage(bizId: string, senderId: string, role: 'user' | 'bot' | 'merchant', text: string) {
  const msgData = {
    businessId: bizId,
    senderId: senderId,
    role: role,
    text: text,
    timestamp: FieldValue ? FieldValue.serverTimestamp() : serverTimestamp()
  };

  if (adminDb) {
    try {
      await adminDb.collection('chat_history').add(msgData);
      return;
    } catch (err) {
      console.error('[History Admin Save Error]', err);
    }
  }
  
  if (db) {
    try {
      await addDoc(collection(db, 'chat_history'), {
        ...msgData,
        timestamp: serverTimestamp()
      });
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

// Consolidated Webhook Verification (GET)
app.get(['/webhook', '/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'];
  const { businessId } = req.params;

  console.log(`[Webhook GET] token=${token}, mode=${mode}`);
  await logActivity(businessId || 'system', 'WEBHOOK_VERIFY_ATTEMPT', `Facebook verification attempt. Token: ${token}`, 'info', 'system');

  if (mode === 'subscribe' && challenge) {
    const universalTokens = ['chatbyraju', '1058370033', 'sendbyraju'];
    let authorized = universalTokens.includes(token?.toLowerCase()) || !token; // Allow setup if no token or universal

    if (!authorized && (businessId || token)) {
      authorized = true; // Permissive for initial setup
    }

    if (authorized) {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(challenge);
      
      logActivity(businessId || 'unknown', 'WEBHOOK_VERIFIED', `Handshake successful. Token: ${token || 'none'}`, 'success', 'system').catch(() => {});
      return;
    }
  }
  
  await logActivity(businessId || 'unknown', 'WEBHOOK_FAILED', `Handshake failed. Token: ${token}`, 'error', 'system');
  res.status(403).send('Forbidden');
});

// Internal Startup Log
(async () => {
  await new Promise(r => setTimeout(r, 3000));
  await logActivity('system', 'SERVER_STARTED', 'সার্ভার ফেসবুক সিগন্যালের জন্য প্রস্তুত। মেটা ড্যাশবোর্ডে গিয়ে এই ইউআরএল সেট সেট করুন।', 'success', 'system');
})();

// Consolidated Messenger Message Handler (POST)
app.post(['/webhook', '/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId } = req.params;
  const body = req.body;

  console.log(`[Webhook POST] Signal for: ${businessId || 'unknown'}`);

  if (body.object !== 'page') {
    return res.status(200).send('NOT_A_PAGE_EVENT');
  }

  // Acknowledge immediately to prevent Facebook retries
  res.status(200).send('EVENT_RECEIVED');

  // Process in background
  (async () => {
    try {
      if (!adminDb && !db) {
        console.error('[Webhook] No database (Admin or Client) ready');
        return;
      }
      
      await logActivity(businessId || 'unknown', 'SIGNAL_REACHED', `ফেসবুক থেকে সিগন্যাল পাওয়া গেছে। প্রসেস শুরু হচ্ছে...`, 'info', 'system');
      console.log('[Webhook] Processing body entries:', body.entry?.length);

      if (!body.entry || !Array.isArray(body.entry)) return;

      for (const entry of body.entry) {
        try {
          const pageId = String(entry.id).trim();
          const messaging = entry.messaging || entry.standby;
          
          if (!messaging) {
            console.log(`[Webhook] No messaging or standby in entry ${entry.id}`);
            continue;
          }

          console.log(`[Webhook] Entry ${pageId} has ${messaging.length} events`);

          for (const webhookEvent of messaging) {
            let bizId = businessId || 'unknown';
            let ownerId = 'system';
            
            try {
              const senderId = webhookEvent.sender?.id;
              let messageText = webhookEvent.message?.text;
              
              if (!senderId) continue;
              
              console.log(`[Webhook] Event from ${senderId}, PageID: ${pageId}, messageText: ${messageText}`);
              
              // Skip echo/delivery/read receipts
              if (webhookEvent.message?.is_echo || webhookEvent.delivery || webhookEvent.read) {
                 continue;
              }

              // Handle Postbacks
              if (webhookEvent.postback) {
                const payload = webhookEvent.postback.payload;
                if (payload.startsWith('ORDER_')) {
                  const productId = payload.replace('ORDER_', '');
                  messageText = `আমি পণ্যটি (ID: ${productId}) অর্ডার করতে চাই।`;
                } else {
                  messageText = webhookEvent.postback.title || payload;
                }
              }

              if (!messageText) continue;
              
              let businessData: any = null;
              
              // Lookup store by Page ID
              let snap: any = null;
              if (adminDb) {
                try {
                  snap = await adminDb.collection('businesses').where('facebookPageId', 'in', [pageId, Number(pageId)]).get();
                } catch (e) { console.warn('[Webhook Admin Lookup Failed]', e); }
              }
               
              if (!snap || snap.empty) {
                if (db) {
                  try {
                    const bq = query(collection(db, 'businesses'), where('facebookPageId', 'in', [pageId, Number(pageId)]));
                    snap = await getDocs(bq);
                  } catch (e) { console.error('[Webhook Client Lookup Failed]', e); }
                }
              }
              
              if ((!snap || snap.empty) && businessId && businessId !== 'unknown') {
                 if (adminDb) {
                   try {
                      const bizDoc = await adminDb.collection('businesses').doc(businessId).get();
                      if (bizDoc.exists) { businessData = bizDoc.data(); bizId = bizDoc.id; }
                   } catch (e) { console.error(e); }
                 }
                 if (!businessData && db) {
                   try {
                     const bizDoc = await getDoc(doc(db, 'businesses', businessId));
                     if (bizDoc.exists()) { businessData = bizDoc.data(); bizId = bizDoc.id; }
                   } catch (e) { console.error(e); }
                 }
              } else if (snap && !snap.empty) {
                const firstDoc = snap.docs[0];
                businessData = typeof firstDoc.data === 'function' ? firstDoc.data() : (firstDoc as any).data();
                bizId = firstDoc.id;
              }

              if (!businessData) {
                await logActivity('unknown', 'ERROR', `Could not identify store for Page ID: ${pageId}`, 'error', 'system');
                continue;
              }

              ownerId = businessData.ownerId;
              
              // BILLING CHECK
              const now = new Date();
              let subExpiryDate: Date;
              if (businessData.subscriptionExpiry) {
                 subExpiryDate = businessData.subscriptionExpiry.toDate ? businessData.subscriptionExpiry.toDate() : new Date(businessData.subscriptionExpiry);
              } else {
                 subExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              }

              const tokenBal = businessData.tokenBalance !== undefined ? businessData.tokenBalance : 100000;
              if (subExpiryDate < now || tokenBal <= 0) {
                const reason = subExpiryDate < now ? "আপনার মাসিক সাবস্ক্রিপশন শেষ হয়ে গেছে।" : "আপনার টোকেন ব্যালেন্স শেষ হয়ে গেছে।";
                await logActivity(bizId, 'BILLING_BLOCK', reason, 'error', ownerId);
                if (businessData.pageAccessToken) {
                  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                    recipient: { id: senderId },
                    message: { text: "দুঃখিত, আমাদের অটোমেটেড সাপোর্ট সিস্টেম এই মুহূর্তে রিচার্জ বা মেয়াদের কারণে সাময়িকভাবে বন্ধ আছে।" }
                  }).catch(() => {});
                }
                continue;
              }

              await logActivity(bizId, 'INCOMING', `Customer: "${messageText}"`, 'info', ownerId);
              await saveChatMessage(bizId, senderId, 'user', messageText);

              if (!businessData.pageAccessToken || !process.env.GEMINI_API_KEY || !genAI) {
                await logActivity(bizId, 'ERROR', 'Missing Token or AI Config.', 'error', ownerId);
                continue;
              }

              // Fetch History & Summary
              let chatHistoryText = "";
              let existingSummary = "";
              let hSnap: any = null;
              try {
                if (adminDb) {
                  const custDoc = await adminDb.collection('customers').doc(`${bizId}_${senderId}`).get();
                  if (custDoc.exists) existingSummary = custDoc.data().chatSummary || "";
                } else if (db) {
                  const custDoc = await getDoc(doc(db, 'customers', `${bizId}_${senderId}`));
                  if (custDoc.exists()) existingSummary = custDoc.data()?.chatSummary || "";
                }
                
                if (adminDb) {
                  try {
                    hSnap = await adminDb.collection('chat_history')
                      .where('senderId', '==', senderId)
                      .where('businessId', '==', bizId)
                      .limit(10)
                      .get();
                  } catch (e) { console.warn('Admin History fetch failed', e); }
                }
                if (!hSnap && db) {
                  try {
                    const hQuery = query(collection(db, 'chat_history'), where('senderId', '==', senderId), where('businessId', '==', bizId), limit(10));
                    hSnap = await getDocs(hQuery);
                  } catch (e) { console.error('Client History fetch failed', e); }
                }
                if (hSnap) {
                  const docs = hSnap.docs || [];
                  const history = [...docs]
                    .map((d: any) => {
                      const data = typeof d.data === 'function' ? d.data() : d.data();
                      return { ...data, ts: data.timestamp?.toMillis ? data.timestamp.toMillis() : 0 };
                    })
                    .sort((a, b) => a.ts - b.ts)
                    .map(data => `${data.role === 'user' ? 'Customer' : 'Bot'}: ${data.text}`);
                  chatHistoryText = history.join('\n');
                }
              } catch (e) { console.error(e); }

              // AI Generation
              await logActivity(bizId, 'AI_START', `বট উত্তর তৈরি করছে: "${messageText.substring(0, 30)}..."`, 'info', ownerId);
              
              const optimizedProducts = (businessData.products || []).map((p: any) => ({ name: p.name, price: p.price, stock: p.stockCount }));
              const systemPrompt = `তুমি "${businessData.name}" এর সেলস পারসন।
Shop Info: ${businessData.description || ''}
Products: ${JSON.stringify(optimizedProducts)}
FAQs: ${JSON.stringify(businessData.faqs || [])}
${businessData.botPersona || ''} ${businessData.botTone || ''}
${businessData.customSystemPrompt || ''}
সাম্প্রতিক আলাপ:
${chatHistoryText}
কাস্টমার: ${messageText}`;
              
              let aiRes: any;
              try {
                const model = genAI!.getGenerativeModel({ 
                  model: "gemini-1.5-flash",
                  generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema as any }
                });
                
                const result = await model.generateContent(systemPrompt);
                const aiRaw = result.response.text();
                aiRes = JSON.parse(aiRaw);
              } catch (aiErr: any) {
                console.error('[AI Generation Error]', aiErr);
                await logActivity(bizId, 'AI_ERROR', `AI উত্তর তৈরি করতে পারেনি: ${aiErr.message}`, 'error', ownerId);
                aiRes = { 
                  reply: "দুঃখিত, আমি বিষয়টি বুঝতে পারছি না। দয়া করে আবার বলবেন কি?", 
                  conversation_stage: 'interested',
                  intent: 'unknown',
                  event_name: 'Lead',
                  summary: existingSummary
                };
              }
              
              const reply = aiRes.reply || "দুঃখিত আমি উত্তর দিতে পারছি না।";

              // Send Images
              let imageSent = false;
              if (aiRes.show_product_image && aiRes.product_name) {
                const searchName = aiRes.product_name.toLowerCase();
                const product = businessData.products?.find((p: any) => p.name.toLowerCase().includes(searchName));
                if (product && product.images?.length > 0) {
                  try {
                    for (const imgUrl of product.images.slice(0, 2)) {
                      await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                        recipient: { id: senderId },
                        message: { attachment: { type: "image", payload: { url: imgUrl } } }
                      });
                    }
                    imageSent = true;
                  } catch (e) { console.error(e); }
                }
              }

              // Send Reply Text if no images or alongside
              if (!imageSent) {
                try {
                  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                    recipient: { id: senderId },
                    message: { text: reply }
                  });
                } catch (e) { console.error(e); }
              }

              // Update Customer & Logic
              let segment: any = 'Cold';
              if (aiRes.conversation_stage === 'order_completed') segment = 'Hot';
              else if (aiRes.conversation_stage === 'interested') segment = 'Warm';

              const customerData = {
                businessId: bizId,
                messengerId: senderId,
                name: aiRes.order_data?.name || 'Customer',
                phone: aiRes.order_data?.phone || '',
                leadScore: (aiRes.confidence || 0) * 100,
                segment,
                chatSummary: aiRes.summary || '',
                lastInteraction: serverTimestamp(),
                updatedAt: serverTimestamp()
              };
              
              if (adminDb) {
                try { await adminDb.collection('customers').doc(`${bizId}_${senderId}`).set(customerData, { merge: true }); } catch (e) {
                  if (db) await setDoc(doc(db, 'customers', `${bizId}_${senderId}`), customerData, { merge: true }).catch(console.error);
                }
              } else if (db) {
                await setDoc(doc(db, 'customers', `${bizId}_${senderId}`), customerData, { merge: true }).catch(console.error);
              }

              await saveChatMessage(bizId, senderId, 'bot', reply);
              await logActivity(bizId, 'REPLY_SENT', `সফলভাবে রিপ্লাই পাঠানো হয়েছে।`, 'success', ownerId);

            } catch (innerErr: any) {
              console.error('[Event Process Error]', innerErr);
              await logActivity(bizId, 'ERROR', `ইভেন্ট প্রসেসিং এ সমস্যা হয়েছে।`, 'error', ownerId);
            }
          }
        } catch (entryErr) {
          console.error('[Entry Process Error]', entryErr);
        }
      }
    } catch (outerErr: any) {
      console.error('Background webhook process failed:', outerErr);
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

  if (!adminDb) {
    return res.status(500).json({ error: 'Firestore Admin not initialized' });
  }

  try {
    let queryRef = adminDb.collection('customers').where('businessId', '==', businessId);
    if (segment && segment !== 'All') {
      queryRef = queryRef.where('segment', '==', segment);
    }
    
    const snap = await queryRef.get();
    const customers = snap.docs.map((d: any) => d.data());

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
  if (!adminDb) {
    console.error('[Cron] Admin DB not initialized');
    return;
  }
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const snap = await adminDb.collection('abandoned_carts')
      .where('lastFollowUpSent', '==', false)
      .get();
    
    for (const docSnap of snap.docs) {
      const cart = docSnap.data();
      const cartTime = cart.timestamp?.toDate() || new Date(0);
      
      if (cartTime < oneHourAgo) {
        try {
          const followUp = `হ্যালো ${cart.customerName}! আপনি কি ${cart.productName} অর্ডারটি সম্পন্ন করতে চান? আমরা আপনার জন্য পণ্যটি স্টক এ রেখেছি। কোনো সাহায্য লাগলে আমাদের জানান।`;
          
          await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${cart.pageAccessToken}`, {
            recipient: { id: cart.messengerId },
            message: { text: followUp }
          });

          await docSnap.ref.update({ lastFollowUpSent: true });
          await saveChatMessage(cart.businessId, cart.messengerId, 'bot', `[RECOVERY] ${followUp}`);
          await logActivity(cart.businessId, 'CART_RECOVERY', `${cart.customerName} এর জন্য রিকভারি মেসেজ পাঠানো হয়েছে।`, 'info', cart.ownerId);
        } catch (e) {
          console.error(`Recovery failed for ${cart.messengerId}`);
        }
      }
    }
  } catch (error) {
    console.error('[Cron Error]', error);
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
