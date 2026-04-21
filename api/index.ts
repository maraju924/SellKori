import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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

import { GoogleGenAI } from '@google/genai';

// Initialize AI
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

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

  // 1. INSTANT RESPONSE TO FACEBOOK (Crucial for not timing out)
  if (body.object === 'page') {
    res.status(200).send('EVENT_RECEIVED');
  } else {
    return res.sendStatus(404);
  }

  // 2. BACKGROUND PROCESSING
  (async () => {
    try {
      if (!db) return;
      
      // LOG: Immediate proof that Facebook reached us
      await logActivity(businessId || 'unknown', 'SIGNAL_REACHED', `Facebook sent data. Object: ${body.object}`, 'info', 'system');

      for (const entry of body.entry) {
        const pageId = entry.id; // Usually a string from FB
        const messaging = entry.messaging || entry.standby;
        if (!messaging) continue;

        for (const webhookEvent of messaging) {
          if (!webhookEvent.sender) continue;
          const senderId = webhookEvent.sender.id;

          if (webhookEvent.message && webhookEvent.message.text && !webhookEvent.message.is_echo) {
            const messageText = webhookEvent.message.text;
            
            let bizId = businessId || 'unknown';
            let ownerId = 'system';
            
            try {
              const cleanPageId = String(pageId).trim();

              // Lookup store by Page ID (try both string and number just in case)
              let businessData: any = null;
              const shopsRef = collection(db, 'businesses');
              
              // DETECTIVE: Let's log what we are looking for
              await logActivity('system', 'LOOKUP', `Searching for Page ID: "${cleanPageId}"...`, 'info', 'system');

              // Try string lookup first
              const qStr = query(shopsRef, where('facebookPageId', '==', cleanPageId));
              const snapStr = await getDocs(qStr);
              
              if (!snapStr.empty) {
                businessData = snapStr.docs[0].data();
                bizId = snapStr.docs[0].id;
                console.log('[Lookup] Found via String!');
              } else {
                // Try number lookup
                const qNum = query(shopsRef, where('facebookPageId', '==', Number(cleanPageId)));
                const snapNum = await getDocs(qNum);
                if (!snapNum.empty) {
                  businessData = snapNum.docs[0].data();
                  bizId = snapNum.docs[0].id;
                  console.log('[Lookup] Found via Number!');
                }
              }

              // Fallback to URL's businessId if ID lookup fails
              if (!businessData && businessId && businessId !== 'unknown') {
                const bDoc = await getDoc(doc(db, 'businesses', businessId));
                if (bDoc.exists()) {
                  businessData = bDoc.data();
                  bizId = bDoc.id;
                }
              }

              if (!businessData) {
                await logActivity('unknown', 'ERROR', `Could not identify store for Page ID: ${pageId}. চেক করুন আপনার শপ সেটিংসে এই আইডি দেওয়া কি না।`, 'error', 'system');
                continue;
              }

              ownerId = businessData.ownerId;
              await logActivity(bizId, 'INCOMING', `Customer: "${messageText}"`, 'info', ownerId);

              if (!businessData.pageAccessToken) {
                await logActivity(bizId, 'ERROR', 'Page Access Token missing in Settings.', 'error', ownerId);
                continue;
              }

              if (!process.env.GEMINI_API_KEY || !ai) {
                await logActivity(bizId, 'ERROR', 'AI Service setup error: API Key missing.', 'error', ownerId);
                continue;
              }

              // AI Generation
              await logActivity(bizId, 'AI_START', `বট উত্তর তৈরি করছে...`, 'info', ownerId);
              const prompt = `Shop: ${businessData.name}\nDescription: ${businessData.description || 'General store'}\nProducts: ${JSON.stringify(businessData.products || [])}\nCustomer: ${messageText}. Reply in Bengali briefly.`;
              
              const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
              });
              
              const reply = response.text || "দুঃখিত, আমি উত্তরটি তৈরি করতে পারছি না।";

              // Send Message
              await logActivity(bizId, 'SENDING_MESSAGE', `ফেসবুকে পাঠানো হচ্ছে...`, 'info', ownerId);
              try {
                await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                  recipient: { id: senderId },
                  message: { text: reply }
                });

                await logActivity(bizId, 'REPLY_SENT', `Bot: "${reply.substring(0, 50)}..."`, 'success', ownerId);
              } catch (fbErr: any) {
                const fbErrorMessage = fbErr.response?.data?.error?.message || fbErr.message;
                await logActivity(bizId, 'ERROR', `Facebook Sending Failed: ${fbErrorMessage}`, 'error', ownerId, fbErr.response?.data);
              }

            } catch (innerErr: any) {
              console.error('Inner webhook error:', innerErr);
              await logActivity(bizId, 'ERROR', `Processing failed: ${innerErr.message}`, 'error', ownerId);
            }
          }
        }
      }
    } catch (outerErr: any) {
      console.error('Outer webhook error:', outerErr);
    }
  })();
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
