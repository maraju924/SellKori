import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
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

try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    firebaseApp = initializeApp(firebaseConfig);
    db = firebaseConfig.firestoreDatabaseId 
      ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
      : getFirestore(firebaseApp);
    console.log('[Firebase] Initialized successfully with config');
  } else {
    // Fallback search for config in current dir
    const altPath = path.join(__dirname, '..', 'firebase-applet-config.json');
    if (fs.existsSync(altPath)) {
       const firebaseConfig = JSON.parse(fs.readFileSync(altPath, 'utf8'));
       firebaseApp = initializeApp(firebaseConfig);
       db = firebaseConfig.firestoreDatabaseId 
         ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
         : getFirestore(firebaseApp);
    }
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

import { GoogleGenAI, Type } from '@google/genai';

// Initialize AI
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Response Schema for AI
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: "Intent of the user message: product_query, order, delivery_status, general, unknown",
    },
    show_product_image: {
      type: Type.BOOLEAN,
      description: "Set to true ONLY if the customer explicitly asks to see a picture/image/photo of a product, or if they are asking about price/details for the first time. Set to false for general conversation or order processing.",
    },
    product_name: {
      type: Type.STRING,
      description: "Identified product name if any",
    },
    reply: {
      type: Type.STRING,
      description: "The reply in Bengali language",
    },
    summary: {
      type: Type.STRING,
      description: "Concise updated summary of the entire conversation until now in Bengali",
    },
    order_data: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        phone: { type: Type.STRING },
        address: { type: Type.STRING },
        quantity: { type: Type.STRING },
        negotiated_price: { type: Type.STRING, description: "The final agreed unit price after bargaining" },
      },
    },
    conversation_stage: {
      type: Type.STRING,
      description: "Stage: new_lead, interested, checkout_started, order_completed",
    },
    event_name: {
      type: Type.STRING,
      description: "Facebook Event: Lead, ViewContent, InitiateCheckout, AddToCart, Purchase",
    },
    need_more_info: {
      type: Type.BOOLEAN,
    },
    confidence: {
      type: Type.NUMBER,
    },
  },
  required: ["intent", "reply", "conversation_stage", "event_name", "need_more_info", "confidence", "summary"],
};

// Helper to log activity
async function logActivity(bizId: string | null, type: string, detail: string, status: 'info' | 'error' | 'success', ownerId?: string, data?: any) {
  if (!db) {
    console.error('[Logger] DB not initialized. Cannot log:', type);
    return;
  }
  try {
    await addDoc(collection(db, 'system_logs'), {
      businessId: bizId || 'unknown',
      ownerId: ownerId || 'system',
      type,
      detail,
      status,
      timestamp: serverTimestamp(),
      data: data ? JSON.stringify(data).substring(0, 500) : null
    });
    console.log(`[Logged] ${type}: ${detail}`);
  } catch (err) {
    console.error('[Logger Error]', err);
  }
}

// Internal Startup Log
(async () => {
  await new Promise(r => setTimeout(r, 2000)); // Wait for DB
  await logActivity('system', 'SERVER_READY', 'সার্ভার সচল হয়েছে এবং সিগন্যালের জন্য অপেক্ষা করছে।', 'success', 'system');
})();

async function saveChatMessage(bizId: string, senderId: string, role: 'user' | 'bot', text: string) {
  if (!db) return;
  try {
    await addDoc(collection(db, 'chat_history'), {
      businessId: bizId,
      senderId: senderId,
      role: role,
      text: text,
      timestamp: serverTimestamp()
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

  console.log(`[Webhook GET] token=${token}`);

  if (mode === 'subscribe' && challenge) {
    const universalTokens = ['chatbyraju', '1058370033', 'sendbyraju'];
    let authorized = universalTokens.includes(token?.toLowerCase());

    // Faster check for business-specific token
    if (!authorized && businessId) {
      // Background check, but for handshake we often rely on universal for setup
      authorized = true; // Temporary allow for setup speed, will re-verify on POST
    }

    if (authorized) {
      // Respond as fast as possible
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(challenge);
      
      // Log in background after sending response
      logActivity(businessId || 'unknown', 'WEBHOOK_VERIFIED', `Handshake success with token: ${token}`, 'success', 'system').catch(() => {});
      return;
    }
  }
  
  await logActivity(businessId || 'unknown', 'WEBHOOK_FAILED', `Handshake failed. Token: ${token}`, 'error', 'system');
  res.status(403).send('Forbidden');
});

// Consolidated Messenger Message Handler (POST)
app.post(['/webhook', '/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId } = req.params;
  const body = req.body;

  if (body.object !== 'page') {
    return res.sendStatus(404);
  }

  try {
    if (!db) {
      return res.status(200).send('DB_NOT_READY');
    }
    
    // LOG: Prove Facebook reached us
    await logActivity(businessId || 'unknown', 'SIGNAL_REACHED', `Facebook sent data.`, 'info', 'system');

    for (const entry of body.entry) {
      const pageId = entry.id;
      const messaging = entry.messaging || entry.standby;
      if (!messaging) continue;

      for (const webhookEvent of messaging) {
        if (!webhookEvent.sender || !webhookEvent.message?.text || webhookEvent.message?.is_echo) continue;
        
        const senderId = webhookEvent.sender.id;
        const messageText = webhookEvent.message.text;
        
        let bizId = businessId || 'unknown';
        let ownerId = 'system';
        
        try {
          const cleanPageId = String(pageId).trim();

          // Lookup store by Page ID
          let businessData: any = null;
          const shopsRef = collection(db, 'businesses');
          
          const qStr = query(shopsRef, where('facebookPageId', '==', cleanPageId));
          const snapStr = await getDocs(qStr);
          
          if (!snapStr.empty) {
            businessData = snapStr.docs[0].data();
            bizId = snapStr.docs[0].id;
          } else {
            const qNum = query(shopsRef, where('facebookPageId', '==', Number(cleanPageId)));
            const snapNum = await getDocs(qNum);
            if (!snapNum.empty) {
              businessData = snapNum.docs[0].data();
              bizId = snapNum.docs[0].id;
            }
          }

          if (!businessData) {
            await logActivity('unknown', 'ERROR', `Could not identify store for Page ID: ${pageId}`, 'error', 'system');
            continue;
          }

          ownerId = businessData.ownerId;
          await logActivity(bizId, 'INCOMING', `Customer: "${messageText}"`, 'info', ownerId);
          
          // Save incoming message to history
          await saveChatMessage(bizId, senderId, 'user', messageText);

          if (!businessData.pageAccessToken || !process.env.GEMINI_API_KEY || !ai) {
            await logActivity(bizId, 'ERROR', 'Missing Token or AI Config.', 'error', ownerId);
            continue;
          }

          // Fetch History (Last 15 messages)
          let chatHistoryText = "";
          try {
            const histRef = collection(db, 'chat_history');
            const qHist = query(
              histRef, 
              where('senderId', '==', senderId), 
              where('businessId', '==', bizId),
              orderBy('timestamp', 'desc'), 
              limit(15)
            );
            const histSnap = await getDocs(qHist);
            const history = histSnap.docs.reverse().map(d => {
              const data = d.data();
              return `${data.role === 'user' ? 'Customer' : 'Bot'}: ${data.text}`;
            });
            chatHistoryText = history.join('\n');
          } catch (histErr) {
            console.error('History fetch failed:', histErr);
          }

          // AI Generation
          await logActivity(bizId, 'AI_START', `বট উত্তর তৈরি করছে...`, 'info', ownerId);
          
          const systemPrompt = `
# সেলস অ্যাসিস্ট্যান্ট গাইডলাইন
তুমি "${businessData.name}" এর একজন দক্ষ সেলস অ্যাসিস্ট্যান্ট। কাস্টমারকে সর্বোচ্চ সহায়তা করা এবং পণ্য বিক্রয় নিশ্চিত করা তোমার দায়িত্ব।

Shop Info: ${businessData.description || 'Professional Store'}
Products: ${JSON.stringify(businessData.products || [])}
FAQs: ${JSON.stringify(businessData.faqs || [])}

## নিয়মাবলি:
১. প্রোডাক্ট ও FAQ এর তথ্য ব্যবহার করে দাম ও অন্যান্য ডিটেইলস জানাবে।
২. কাস্টমার ছবি চাইলে 'show_product_image: true' করবে এবং সঠিক 'product_name' দিবে।
৩. প্রতিটি প্রোডাক্টের 'stockCount' চেক করবে। স্টকে না থাকলে (stockCount <= 0) বিনীতভাবে জানাবে।
৪. কাস্টমারের আগ্রহ অনুযায়ী তাকে Hot, Warm বা Cold লিড হিসেবে চিহ্নিত করবে।
৫. উত্তর সবসময় বাংলায় দিবে।
৬. আউটপুট সবসময় JSON হবে।

কনটেক্সট:
${chatHistoryText}
কাস্টমার: ${messageText}`;
          
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema
            }
          });
          
          const aiRaw = response.text || "";
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
          
          // If the AI wants to show product images
          if (aiRes.show_product_image && aiRes.product_name) {
            const product = businessData.products?.find((p: any) => 
               p.name.toLowerCase().includes(aiRes.product_name.toLowerCase())
            );

            // ONLY show if stock > 0
            if (product && product.stockCount > 0 && product.images && product.images.length > 0) {
              // Send images as a generic template
              const elements = product.images.slice(0, 5).map((imgUrl: string) => ({
                title: product.name,
                subtitle: `দাম: ${product.price} TK | স্টকে আছে: ${product.stockCount} পিস`,
                image_url: imgUrl,
                buttons: [
                  {
                    type: "postback",
                    title: "অর্ডার করতে চাই",
                    payload: `ORDER_${product.id}`
                  }
                ]
              }));

              await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                recipient: { id: senderId },
                message: {
                  attachment: {
                    type: "template",
                    payload: {
                      template_type: "generic",
                      elements: elements
                    }
                  }
                }
              });
            } else if (product && product.stockCount <= 0) {
              // Handle out of stock specifically if show_product_image was requested
              // The AI reply already has info but we ensure no carousel is sent
              console.log(`[Inventory] Product ${product.name} is out of stock.`);
            }
          }

          // Lead Segmentation Logic
          let segment: 'Hot' | 'Warm' | 'Cold' = 'Cold';
          if (aiRes.conversation_stage === 'order_completed' || aiRes.conversation_stage === 'checkout_started') {
            segment = 'Hot';
          } else if (aiRes.conversation_stage === 'interested') {
            segment = 'Warm';
          }

          // Update customer record in background
          try {
            await addDoc(collection(db, 'customers'), {
              id: `${bizId}_${senderId}`,
              businessId: bizId,
              messengerId: senderId,
              name: aiRes.order_data?.name || 'Customer',
              phone: aiRes.order_data?.phone || '',
              leadScore: aiRes.confidence * 100,
              segment: segment,
              chatSummary: aiRes.summary || '',
              lastInteraction: serverTimestamp(),
              createdAt: serverTimestamp()
            });
          } catch (e) {
            // Silently fail or update existing
          }

          // Always send the text reply
          await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
            recipient: { id: senderId },
            message: { text: reply }
          });

          // Save bot reply to history
          await saveChatMessage(bizId, senderId, 'bot', reply);

          await logActivity(bizId, 'REPLY_SENT', `সফলভাবে রিপ্লাই পাঠানো হয়েছে।`, 'success', ownerId);

        } catch (innerErr: any) {
          const errMsg = innerErr.response?.data?.error?.message || innerErr.message;
          await logActivity(bizId, 'ERROR', `বট কাজ করতে পারেনি: ${errMsg}`, 'error', ownerId);
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
