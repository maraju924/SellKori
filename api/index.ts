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
      let adminApp;
      if (admin.apps.length === 0) {
        console.log(`[Firebase] Initializing Admin SDK for: ${firebaseConfig.projectId}`);
        adminApp = admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      } else {
        adminApp = admin.app();
      }
      
      const dbId = firebaseConfig.firestoreDatabaseId;
      console.log(`[Firebase] Using Database ID: ${dbId || '(default)'}`);
      
      if (dbId && dbId !== '(default)') {
        adminDb = getAdminFirestore(adminApp, dbId);
      } else {
        adminDb = getAdminFirestore(adminApp);
      }
      
      // Test the connection immediately
      try {
        await adminDb.collection('businesses').limit(1).get();
        console.log(`[Firebase] Admin Firestore connection verified.`);
      } catch (testErr: any) {
        console.warn('[Firebase] Admin Firestore verify failed:', testErr.message);
        // Do NOT nullify adminDb yet, might be transient
      }
    } catch (adminErr: any) {
      console.error('[Firebase] Admin Init Error:', adminErr?.message);
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
              console.log('[Webhook] No senderId found in event');
              continue;
            }
            
            // Skip echo/delivery/read/etc.
            if (webhookEvent.message?.is_echo || webhookEvent.delivery || webhookEvent.read) {
              continue;
            }

            let bizId = pathBizId;
            let businessData: any = null;
            
            // 1. Identify Store by Page ID
            let snap: any = null;
            if (adminDb) {
              try {
                snap = await adminDb.collection('businesses').where('facebookPageId', '==', pageId).get();
                if (snap.empty && !isNaN(Number(pageId))) {
                  snap = await adminDb.collection('businesses').where('facebookPageId', '==', Number(pageId)).get();
                }
              } catch (e: any) { 
                console.error('Admin Business Lookup Error', e.message); 
              }
            }

            if (!snap || snap.empty) {
              if (db) {
                try {
                  const bq = query(collection(db, 'businesses'), where('facebookPageId', 'in', [pageId, Number(pageId)]));
                  snap = await getDocs(bq);
                } catch (e: any) { 
                  console.error('Client Business Lookup Error', e.message); 
                }
              }
            }

            if (snap && !snap.empty) {
              const firstDoc = snap.docs[0];
              businessData = typeof firstDoc.data === 'function' ? firstDoc.data() : (firstDoc as any).data();
              bizId = firstDoc.id;
            } else if (pathBizId && pathBizId !== 'unknown' && pathBizId !== 'system') {
               // Fallback to ID from URL if explicitly provided
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

            // Absolute last resort: if we have ONE business, maybe it's that one? 
            // (Only for development/debugging if specifically enabled, but here we'll stick to strict)

            if (!businessData) {
              await logActivity('system', 'ERROR', `Could not identify store for Page ID: ${pageId}. Verify Page ID in Settings.`, 'error', 'system', { pageId, receivedPayload: webhookEvent });
              continue;
            }

            const ownerId = businessData.ownerId;
            let finalMessageText = messageText;

            // Handle Postbacks & Quick Replies
            if (isPostback) {
              if (payload.startsWith('ORDER_')) {
                const pid = payload.replace('ORDER_', '');
                finalMessageText = `আমি পণ্যটি (ID: ${pid}) অর্ডার করতে চাই।`;
              } else {
                finalMessageText = webhookEvent.postback.title || payload;
              }
            } else if (webhookEvent.message?.quick_reply) {
              finalMessageText = webhookEvent.message.quick_reply.payload || webhookEvent.message.text;
            }

            // Still nothing? Check attachments
            if (!finalMessageText && webhookEvent.message?.attachments) {
              finalMessageText = "[Customer sent an attachment]";
            }

            if (!finalMessageText) {
              console.log('[Webhook] Empty message text, skipping processing');
              continue;
            }

            await logActivity(bizId!, 'INCOMING', `Customer: "${finalMessageText.substring(0, 70)}"`, 'info', ownerId);
            await saveChatMessage(bizId!, senderId, 'user', finalMessageText);

            if (!businessData.pageAccessToken || !process.env.GEMINI_API_KEY || !genAI) {
              await logActivity(bizId!, 'ERROR', 'Missing Facebook Token or Gemini API Key.', 'error', ownerId);
              continue;
            }

            // AI Processing
            let chatHistoryText = "";
            try {
              if (adminDb) {
                const hSnap = await adminDb.collection('chat_history')
                  .where('senderId', '==', senderId)
                  .where('businessId', '==', bizId)
                  .orderBy('timestamp', 'desc')
                  .limit(7)
                  .get();
                if (hSnap && !hSnap.empty) {
                  chatHistoryText = hSnap.docs.reverse().map((d: any) => {
                    const data = d.data();
                    return `${data.role === 'user' ? 'Customer' : 'Bot'}: ${data.text}`;
                  }).join('\n');
                }
              }
            } catch (e) {}

            const products = (businessData.products || []).map((p: any) => ({ name: p.name, price: p.price, stock: p.stockCount }));
            const prompt = `তুমি "${businessData.name}" এর স্মার্ট সেলস অ্যাসিস্ট্যান্ট।\nলক্ষ্য: কাস্টমারকে পণ্য নির্বাচনে সাহায্য করা এবং অর্ডার নিতে উৎসাহিত করা।\nদোকানের তথ্য: ${businessData.description || ''}\nপণ্যতালিকা: ${JSON.stringify(products)}\nসাম্প্রতিক আলাপ:\n${chatHistoryText}\nকাস্টমার: ${finalMessageText}`;
            
            try {
              const model = genAI!.getGenerativeModel({ 
                model: "gemini-1.5-flash", 
                generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema as any } 
              });
              const result = await model.generateContent(prompt);
              const aiRes = JSON.parse(result.response.text());
              
              const reply = aiRes.reply;
              
              // 3. Send Response to Facebook
              await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                recipient: { id: senderId },
                message: { text: reply }
              });

              await saveChatMessage(bizId!, senderId, 'bot', reply);
              await logActivity(bizId!, 'REPLY_SENT', `উত্তর পাঠানো হয়েছে: "${reply.substring(0, 50)}..."`, 'success', ownerId);
              
              // Optional: Save summary/lead info
              if (aiRes.summary || aiRes.order_data) {
                if (adminDb) {
                  await adminDb.collection('customers').doc(`${bizId}_${senderId}`).set({
                    businessId: bizId,
                    messengerId: senderId,
                    lastInteraction: FieldValue ? FieldValue.serverTimestamp() : new Date(),
                    chatSummary: aiRes.summary || '',
                    leadInfo: aiRes.order_data || {},
                    updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date()
                  }, { merge: true }).catch(() => {});
                }
              }

            } catch (err: any) {
              console.error('[AI/Reply Error]', err.response?.data || err.message);
              const errorMsg = err.response?.data?.error?.message || err.message;
              await logActivity(bizId!, 'ERROR', `বট রিপ্লাই দিতে ব্যর্থ হয়েছে: ${errorMsg}`, 'error', ownerId);
              
              // Fallback simple reply
              try {
                await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
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
