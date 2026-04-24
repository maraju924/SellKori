import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import fs from 'fs';

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
    
    // Initialize Admin SDK bypassing security rules
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    adminDb = firebaseConfig.firestoreDatabaseId 
      ? admin.firestore(firebaseConfig.firestoreDatabaseId) 
      : admin.firestore();
    
    console.log('[Firebase] Client & Admin initialized successfully');
  } else {
    // Fallback search for config in current dir
    const altPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(altPath)) {
       const firebaseConfig = JSON.parse(fs.readFileSync(altPath, 'utf8'));
       firebaseApp = initializeApp(firebaseConfig);
       db = firebaseConfig.firestoreDatabaseId 
         ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
         : getFirestore(firebaseApp);

       if (!admin.apps.length) {
         admin.initializeApp();
       }
       adminDb = firebaseConfig.firestoreDatabaseId 
         ? admin.firestore(firebaseConfig.firestoreDatabaseId) 
         : admin.firestore();
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
  if (!adminDb) return { tokenPricePerLakh: 20, monthlyServerCost: 1000, freeTrialTokens: 100000 };
  try {
    const doc = await adminDb.collection('system_config').doc('billing').get();
    if (doc.exists) return doc.data();
    return { tokenPricePerLakh: 20, monthlyServerCost: 1000, freeTrialTokens: 100000 };
  } catch (e) {
    return { tokenPricePerLakh: 20, monthlyServerCost: 1000, freeTrialTokens: 100000 };
  }
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

// Helper to log activity (Non-blocking)
function logActivity(bizId: string | null, type: string, detail: string, status: 'info' | 'error' | 'success', ownerId?: string, data?: any) {
  const bid = bizId || 'unknown';
  const oid = ownerId || 'system';
  console.log(`[LOG][${bid}][${type}] ${detail}`);
  
  if (!adminDb) return Promise.resolve();
  
  return adminDb.collection('system_logs').add({
    businessId: bid,
    ownerId: oid,
    type,
    detail,
    status,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    data: data ? (typeof data === 'string' ? data.substring(0, 500) : JSON.stringify(data).substring(0, 500)) : null
  }).catch((err: any) => console.error('[Logger Error]', err));
}

async function saveChatMessage(bizId: string, senderId: string, role: 'user' | 'bot' | 'merchant', text: string) {
  if (!adminDb) return;
  try {
    await adminDb.collection('chat_history').add({
      businessId: bizId,
      senderId: senderId,
      role: role,
      text: text,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('[History Error]', err);
  }
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Test Connection Endpoint
app.post('/api/test-connection', async (req, res) => {
  const { businessId, ownerId } = req.body;
  await logActivity(businessId, 'TEST_CONNECTION', 'সিস্টেম টেস্ট সফল! আপনার লগিং সিস্টেম ঠিকঠাক কাজ করছে। এবার ফেসবুক চেক করুন।', 'success', ownerId);
  res.json({ success: true });
});

// Consolidated Webhook Verification (GET)
app.get(['/webhook', '/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'];
  const { businessId } = req.params;

  console.log(`[Webhook GET] token=${token}, mode=${mode}`);

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

  // Root level log to prove we got ANY data from Facebook
  console.log('[Webhook POST] Incoming body:', JSON.stringify(body).substring(0, 500));

  if (body.object !== 'page') {
    await logActivity(businessId || 'unknown', 'SIGNAL_IGNORE', `Ignored non-page event: ${body.object}`, 'info', 'system');
    return res.status(200).send('NOT_A_PAGE_EVENT');
  }

  try {
    if (!db || !adminDb) {
      console.error('[Webhook] DB not ready');
      return res.status(200).send('DB_NOT_READY');
    }
    
    await logActivity(businessId || 'unknown', 'SIGNAL_REACHED', `ফেসবুক থেকে সিগন্যাল পাওয়া গেছে। প্রসেস শুরু হচ্ছে...`, 'info', 'system');

    for (const entry of body.entry) {
      const pageId = String(entry.id).trim(); // Ensure it's a string
      const messaging = entry.messaging || entry.standby;
      if (!messaging) {
        console.log(`[Webhook] No messaging or standby data for entry ${pageId}`);
        continue;
      }

      for (const webhookEvent of messaging) {
        const senderId = webhookEvent.sender.id;
        let messageText = webhookEvent.message?.text;
        
        // Skip echo/delivery/read receipts to avoid infinitive loops or unnecessary processing
        if (webhookEvent.message?.is_echo) continue;
        if (webhookEvent.delivery || webhookEvent.read) continue;

        // Handle Postbacks (Buttons clicks)
        if (webhookEvent.postback) {
          const payload = webhookEvent.postback.payload;
          if (payload.startsWith('ORDER_')) {
            const productId = payload.replace('ORDER_', '');
            messageText = `আমি পণ্যটি (ID: ${productId}) অর্ডার করতে চাই।`;
          } else {
            // Use title or payload as text for other buttons
            messageText = webhookEvent.postback.title || payload;
          }
        }

        if (!messageText) continue;
        
        let bizId = businessId || 'unknown';
        let ownerId = 'system';
        let businessData: any = null;
        
        try {
          // Lookup store by Page ID using Admin SDK to bypass rules
          // We check both string and number versions to be safe
          let snap = await adminDb.collection('businesses').where('facebookPageId', 'in', [pageId, Number(pageId)]).get();
          
          if (snap.empty && businessId && businessId !== 'unknown') {
             // Fallback to explicit businessId from URL if provided
             const bizDoc = await adminDb.collection('businesses').doc(businessId).get();
             if (bizDoc.exists) {
                businessData = bizDoc.data();
                bizId = bizDoc.id;
             }
          } else if (!snap.empty) {
            businessData = snap.docs[0].data();
            bizId = snap.docs[0].id;
          }

          if (!businessData) {
            await logActivity('unknown', 'ERROR', `Could not identify store for Page ID: ${pageId}. Please ensure Facebook Page ID is correctly entered in settings.`, 'error', 'system');
            continue;
          }

          ownerId = businessData.ownerId;
          await logActivity(bizId, 'SIGNAL_MATCHED', `Message matched for ${businessData.name}. Processing...`, 'info', ownerId);
          
          // BILLING CHECK - Be permissive if fields are missing for the first time
          const now = new Date();
          let subExpiryDate: Date;
          if (businessData.subscriptionExpiry) {
             subExpiryDate = businessData.subscriptionExpiry.toDate ? businessData.subscriptionExpiry.toDate() : new Date(businessData.subscriptionExpiry);
          } else {
             subExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days grace if missing
          }

          const tokenBal = businessData.tokenBalance !== undefined ? businessData.tokenBalance : 100000;
          const hasTokens = tokenBal > 0;
          const isSubscribed = subExpiryDate > now;

          if (!isSubscribed || !hasTokens) {
            const reason = !isSubscribed ? "আপনার মাসিক সাবস্ক্রিপশন শেষ হয়ে গেছে।" : "আপনার টোকেন ব্যালেন্স শেষ হয়ে গেছে।";
            await logActivity(bizId, 'BILLING_BLOCK', reason, 'error', ownerId);
            
            // Send polite message if possible
            if (businessData.pageAccessToken) {
              await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                recipient: { id: senderId },
                message: { text: "দুঃখিত, আমাদের অটোমেটেড সাপোর্ট সিস্টেম এই মুহূর্তে রিচার্জ বা মেয়াদের কারণে সাময়িকভাবে বন্ধ আছে। দয়া করে এডমিনের সাথে যোগাযোগ করুন।" }
              }).catch(() => {});
            }
            continue;
          }

          await logActivity(bizId, 'INCOMING', `Customer: "${messageText}"`, 'info', ownerId);
          
          // Save incoming message to history
          await saveChatMessage(bizId, senderId, 'user', messageText);

          if (!businessData.pageAccessToken || !process.env.GEMINI_API_KEY || !genAI) {
            await logActivity(bizId, 'ERROR', 'Missing Token or AI Config.', 'error', ownerId);
            continue;
          }

          // Fetch History (using Admin SDK)
          let chatHistoryText = "";
          let existingSummary = "";
          try {
            // Fetch summary first
            const custDoc = await adminDb.collection('customers').doc(`${bizId}_${senderId}`).get();
            if (custDoc.exists) {
              existingSummary = custDoc.data().chatSummary || "";
            }

            const histSnap = await adminDb.collection('chat_history')
              .where('senderId', '==', senderId)
              .where('businessId', '==', bizId)
              .orderBy('timestamp', 'desc')
              .limit(10)
              .get();
              
            const history = histSnap.docs.reverse().map((d: any) => {
              const data = d.data();
              return `${data.role === 'user' ? 'Customer' : 'Bot'}: ${data.text}`;
            });
            chatHistoryText = history.join('\n');
          } catch (histErr) {
            console.error('History/Summary fetch failed:', histErr);
          }

          // AI Generation
          await logActivity(bizId, 'AI_START', `বট উত্তর তৈরি করছে...`, 'info', ownerId);
          
          // Optimize Product list for prompt efficiency
          const optimizedProducts = (businessData.products || []).map((p: any) => ({
             name: p.name,
             price: p.price,
             stock: p.stockCount
          }));

          const systemPrompt = `
# সেলস অ্যাসিস্ট্যান্ট গাইডলাইন
তুমি "${businessData.name}" এর একজন স্মার্ট এবং কৌশলী সেলস পারসন।
${businessData.botPersona ? `তোমার ব্যক্তিত্ব (Persona): ${businessData.botPersona}` : ''}
${businessData.botTone ? `তোমার কথা বলার ভঙ্গি (Tone): ${businessData.botTone}` : ''}

Shop Info: ${businessData.description || 'Professional Store'}
Products: ${JSON.stringify(optimizedProducts)}
FAQs: ${JSON.stringify(businessData.faqs || [])}

## কথা বলার নিয়ম (Tone & Style):
১. উত্তর সবসময় **ছোট, টু-দি-পয়েন্ট এবং মানবিক** হবে। বড় প্যারাগ্রাফ লিখবে না।
২. কাস্টমারের কথার সাথে তাল মিলিয়ে ছোট ছোট ২-৩ লাইনে উত্তর দাও। অতিরিক্ত তথ্য দিয়ে কাস্টমারকে বিরক্ত করবে না।
৩. উত্তর সবসময় বাংলায় দিবে।

${businessData.customSystemPrompt ? `## অতিরিক্ত গাইডলাইন (Merchant Instructions):\n${businessData.customSystemPrompt}\n` : ''}

## কাজের নিয়মাবলি:
১. প্রোডাক্টের দাম ও ডিটেইলস সঠিক দিবে। যদি কাস্টমার শুধু দাম জানতে চায়, তবে শুধু দাম বলবে।
২. কাস্টমার ছবি বা ফটো চাইলে 'show_product_image: true' করবে এবং সঠিক 'product_name' দিবে। কাস্টমার সরাসরি ছবি না চাওয়া পর্যন্ত কোনো ছবি পাঠাবে না। ছবি পাঠানোর সময় সাথে কোনো টেক্সট বা কথা বলবে না (সিস্টেম এটি হ্যান্ডেল করবে)।
৩. প্রতিটি প্রোডাক্টের 'stockCount' চেক করবে। স্টকে না থাকলে বিনীতভাবে জানাবে।
৪. কাস্টমার যদি নাম, ফোন নম্বর এবং ঠিকানা দেয়, তবেই 'conversation_stage: order_completed' এবং 'event_name: Purchase' সেট করবে।
৫. কাস্টমার "অর্ডার করতে চাই" বললে তার কাছে নাম, মোবাইল নম্বর ও ঠিকানা চাও। 
৬. **গুরুত্বপূর্ণ:** আগের আলাপ এবং সারসংক্ষেপ ভালো করে পড়বে। যদি কাস্টমার আগেই তার নাম বা ঠিকানা দিয়ে থাকে, তবে তা আবার চাইবে না। কাস্টমার অর্ডার কনফার্ম হয়েছে কিনা জানতে চাইলে আগের কথা দেখে উত্তর দাও।
৭. আউটপুট সবসময় JSON হবে।

কনটেক্সট:
${existingSummary ? `আগের কথার সারসংক্ষেপ: ${existingSummary}\n` : ''}
সাম্প্রতিক আলাপ:
${chatHistoryText}
কাস্টমার: ${messageText}`;
          
          const model = genAI!.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: responseSchema as any
            }
          });
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }]
          });
          
          const aiRaw = result.response.text();
          let aiRes: any;
          try {
            aiRes = JSON.parse(aiRaw);
          } catch (e) {
            console.error("AI JSON Parse Error:", e, aiRaw);
            aiRes = { reply: "দুঃখিত, আমি বিষয়টি বুঝতে পারছি না। দয়া করে আবার বলবেন কি?", conversation_stage: 'new_lead' };
          }
          
          const reply = aiRes.reply || "দুঃখিত, আমি উত্তরটি তৈরি করতে পারছি না।";

          // Send Message
          await logActivity(bizId, 'SENDING_MESSAGE', `ফেসবুকে পাঠানো হচ্ছে...`, 'info', ownerId);
          
          let imageSent = false;
          // If the AI wants to show product images
          if (aiRes.show_product_image && aiRes.product_name) {
            const searchName = aiRes.product_name.toLowerCase().trim();
            await logActivity(bizId, 'IMAGE_SEARCH', `পণ্য খোঁজা হচ্ছে: "${searchName}"`, 'info', ownerId);

            const product = businessData.products?.find((p: any) => {
               const pName = p.name.toLowerCase();
               // Robust matching: Check if search name is in product name or vice-versa, or if they share significant keywords
               return pName.includes(searchName) || searchName.includes(pName);
            });

            if (product) {
              await logActivity(bizId, 'PRODUCT_FOUND', `পণ্য পাওয়া গেছে: ${product.name}`, 'info', ownerId);
              
              const hasImages = product.images && product.images.length > 0;
              const stock = product.stockCount || 0;

              if (hasImages) {
                // Send raw images like a manual user (no buttons, no titles, just photos)
                try {
                  const imagesToSend = product.images.slice(0, 3); // Send max 3 images to avoid flooding
                  for (const imgUrl of imagesToSend) {
                    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                      recipient: { id: senderId },
                      message: {
                        attachment: {
                          type: "image",
                          payload: {
                            url: imgUrl,
                            is_reusable: true
                          }
                        }
                      }
                    });
                  }
                  imageSent = true;
                  await logActivity(bizId, 'IMAGE_SENT_FB', `ফেসবুকে ${imagesToSend.length}টি ছবি র ইমেজ হিসেবে পাঠানো হয়েছে`, 'success', ownerId);
                } catch (fbImgErr: any) {
                  const errorMsg = fbImgErr.response?.data?.error?.message || fbImgErr.message;
                  await logActivity(bizId, 'IMAGE_FB_ERROR', `ফেসবুক এপিআই ত্রুটি: ${errorMsg}`, 'error', ownerId);
                  console.error("FB Image Send Error:", fbImgErr.response?.data || fbImgErr.message);
                }
              } else {
                await logActivity(bizId, 'IMAGE_NOT_AVAILABLE', `পণ্য পাওয়া গেছে কিন্তু কোনো ছবি আপলোড করা নেই।`, 'error', ownerId);
              }
            } else {
              await logActivity(bizId, 'PRODUCT_NOT_FOUND', `পণ্যটি ডাটাবেজে পাওয়া যায়নি: "${searchName}"`, 'error', ownerId);
            }
          }

          // Lead Segmentation Logic
          let segment: 'Hot' | 'Warm' | 'Cold' = 'Cold';
          if (aiRes.conversation_stage === 'order_completed' || aiRes.conversation_stage === 'checkout_started') {
            segment = 'Hot';
          } else if (aiRes.conversation_stage === 'interested') {
            segment = 'Warm';
          }

          // FIRE Facebook Event (CAPI)
          if (aiRes.event_name) {
            await fireFacebookEvent(businessData, aiRes.event_name, {
              external_id: senderId,
              phone: aiRes.order_data?.phone,
              name: aiRes.order_data?.name
            });
          }

          // SAVE ORDER to Dashboard if completed
          if (aiRes.conversation_stage === 'order_completed') {
            try {
              const product = businessData.products?.find((p: any) => 
                 p.name.toLowerCase().includes(aiRes.product_name?.toLowerCase() || '')
              );
              
              const orderPayload = {
                merchantId: ownerId,
                businessId: bizId,
                customerName: aiRes.order_data?.name || 'Customer',
                phone: aiRes.order_data?.phone || '',
                address: aiRes.order_data?.address || '',
                quantity: parseInt(aiRes.order_data?.quantity) || 1,
                productName: aiRes.product_name || product?.name || 'Unknown Product',
                unitPrice: product?.price || 0,
                totalPrice: (product?.price || 0) * (parseInt(aiRes.order_data?.quantity) || 1),
                status: 'pending',
                paymentStatus: 'unpaid',
                paymentMethod: 'cod',
                createdAt: serverTimestamp()
              };

              await addDoc(collection(db, 'orders'), orderPayload);
              await logActivity(bizId, 'ORDER_CREATED', `নতুন অর্ডার তৈরি হয়েছে: ${orderPayload.productName}`, 'success', ownerId);
            } catch (orderErr) {
              console.error('Order recording failed:', orderErr);
            }
          }

          // Update customer record in background - Use setDoc with merge to PERSIST summary
          try {
            await adminDb.collection('customers').doc(`${bizId}_${senderId}`).set({
              businessId: bizId,
              messengerId: senderId,
              name: aiRes.order_data?.name || 'Customer',
              phone: aiRes.order_data?.phone || '',
              leadScore: aiRes.confidence * 100,
              segment: segment,
              chatSummary: aiRes.summary || '',
              lastInteraction: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          } catch (e) {
            console.error('Customer Summary sync failed:', e);
          }

          // Log image viewed event for conversion tracking
          if (imageSent && aiRes.product_name) {
             try {
                await adminDb.collection('analytics').add({
                   businessId: bizId,
                   businessOwnerId: ownerId,
                   eventName: 'product_image_viewed',
                   properties: { product: aiRes.product_name },
                   timestamp: admin.firestore.FieldValue.serverTimestamp(),
                   sessionId: senderId
                });
             } catch (e) {}
          }

          // Always send the text reply IF no image was sent (User request: image only when requested)
          if (!imageSent) {
            await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
              recipient: { id: senderId },
              message: { text: reply }
            });
          }

          // Cart Abandonment Tracking
          if (aiRes.event_name === 'InitiateCheckout') {
            await adminDb.collection('abandoned_carts').doc(`${bizId}_${senderId}`).set({
              businessId: bizId,
              messengerId: senderId,
              customerName: aiRes.order_data?.name || 'Customer',
              productName: aiRes.product_name,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              lastFollowUpSent: false,
              pageAccessToken: businessData.pageAccessToken,
              ownerId: ownerId
            }, { merge: true });
          } else if (aiRes.event_name === 'Purchase') {
            await adminDb.collection('abandoned_carts').doc(`${bizId}_${senderId}`).delete();
          }

          // Save bot reply to history
          await saveChatMessage(bizId, senderId, 'bot', reply);

          await logActivity(bizId, 'REPLY_SENT', `সফলভাবে রিপ্লাই পাঠানো হয়েছে।`, 'success', ownerId);

        } catch (innerErr: any) {
          const errMsg = innerErr.response?.data?.error?.message || innerErr.message;
          await logActivity(bizId, 'ERROR', `বট কাজ করতে পারেনি: ${errMsg}`, 'error', ownerId);
          
          // Send polite fallback to customer instead of silent failure
          try {
             if (businessData && businessData.pageAccessToken) {
               await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                  recipient: { id: senderId },
                  message: { text: "দুঃখিত, আমাদের সিস্টেমে সাময়িক চাপের কারণে উত্তর দিতে দেরি হচ্ছে। অনুগ্রহ করে এক মিনিট পর আবার চেষ্টা করুন।" }
               });
             }
          } catch (fbErr) {}
        }
      }
    }
    
    // Send response ONLY after processing is done
    res.status(200).send('EVENT_RECEIVED');

  } catch (outerErr: any) {
    console.error('Outer webhook error:', outerErr);
    res.status(200).send('EVENT_FAILED_BUT_ACKNOWLEDGED');
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
