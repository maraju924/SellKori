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

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Universal Webhook
app.get(['/webhook', '/api/webhook'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  
  const normalizedToken = token?.toLowerCase();
  const isValid = (normalizedToken === 'chatbyraju' || normalizedToken === '1058370033'); 

  if (mode === 'subscribe' && isValid) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  }
  res.status(403).send('Verification failed');
});

// Messenger Webhook Validation
app.get('/api/webhook/:businessId', async (req, res) => {
  const { businessId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const normalizedToken = token?.toLowerCase();
  const universalTokens = ['chatbyraju', '1058370033'];

  if (mode === 'subscribe') {
    try {
      if (universalTokens.includes(normalizedToken)) {
         res.setHeader('Content-Type', 'text/plain');
         return res.status(200).send(challenge);
      }

      if (db) {
        const bizDoc = await getDoc(doc(db, 'businesses', businessId));
        if (bizDoc.exists()) {
          const config = bizDoc.data() as BusinessConfig;
          const expectedTokens = [
            config.messengerVerifyToken?.toLowerCase(),
            config.verifyToken?.toLowerCase()
          ].filter(Boolean);

          if (normalizedToken && expectedTokens.includes(normalizedToken)) {
            res.setHeader('Content-Type', 'text/plain');
            return res.status(200).send(challenge);
          }
        }
      }
    } catch (err) {
      console.error('[Business Webhook] Error:', err);
    }
  }
  res.status(403).send('Forbidden');
});

import { GoogleGenAI } from '@google/genai';

// Initialize AI
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Helper to send Messenger message
async function sendMessengerMessage(recipientId: string, text: string, pageAccessToken: string) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
      recipient: { id: recipientId },
      message: { text }
    });
  } catch (error: any) {
    console.error('[Messenger] Send Error:', error.response?.data || error.message);
  }
}

// Diagnostic route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    aiConfigured: !!ai,
    timestamp: new Date().toISOString()
  });
});

// Helper to log webhook activity
async function logActivity(bizId: string | null, type: string, detail: string, status: 'info' | 'error' | 'success', data?: any) {
  try {
    await addDoc(collection(db, 'system_logs'), {
      businessId: bizId || 'unknown',
      type,
      detail,
      status,
      timestamp: serverTimestamp(),
      data: data ? JSON.stringify(data).substring(0, 500) : null
    });
  } catch (err) {
    console.error('[Logger Error]', err);
  }
}

// Webhook Verification (GET)
app.get(['/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[Webhook GET] businessId=${businessId}, token=${token}`);
  
  // Also log this to the DB for user visibility
  await logActivity(businessId || 'unknown', 'WEBHOOK_VERIFY', `Facebook is verifying webhook with token: ${token}`, 'info');

  if (mode && token) {
    if (mode === 'subscribe') {
      // Find business to verify token
      let authorized = false;
      if (businessId) {
        const bizDoc = await getDoc(doc(db, 'businesses', businessId));
        if (bizDoc.exists()) {
          const data = bizDoc.data();
          if (token === (data.messengerVerifyToken || data.verifyToken || 'chatbyraju')) {
            authorized = true;
          }
        }
      } else if (token === 'sendbyraju') { // Fallback global token
        authorized = true;
      }

      if (authorized) {
        console.log('[Webhook GET] Verified successfully');
        await logActivity(businessId || 'unknown', 'WEBHOOK_VERIFIED', 'Webhook verified and connected successfully!', 'success');
        return res.status(200).send(challenge);
      }
    }
  }
  await logActivity(businessId || 'unknown', 'WEBHOOK_FAILED', 'Verification failed. Token mismatch.', 'error');
  res.sendStatus(403);
});

// Messenger Message Handler
app.post(['/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId } = req.params;
  const body = req.body;

  if (body.object === 'page') {
    // 1. Respond immediately with 200 OK to prevent Facebook timeout
    res.status(200).send('EVENT_RECEIVED');

    // 2. Process in background
    for (const entry of body.entry) {
      const pageId = entry.id;
      const messaging = entry.messaging || entry.standby;
      if (!messaging) continue;

      for (const webhookEvent of messaging) {
        if (!webhookEvent.sender) continue;
        const senderId = webhookEvent.sender.id;

        if (webhookEvent.message && webhookEvent.message.text && !webhookEvent.message.is_echo) {
          const messageText = webhookEvent.message.text;
          
          // Background execution
          (async () => {
            let bizId = businessId || 'unknown';
            try {
              // Find Business
              let businessData: any = null;
              const bizQuery = query(collection(db, 'businesses'), where('facebookPageId', '==', pageId));
              const bizSnap = await getDocs(bizQuery);
              
              if (!bizSnap.empty) {
                businessData = bizSnap.docs[0].data();
                bizId = bizSnap.docs[0].id;
              }

              await logActivity(bizId, 'INCOMING', `Customer: "${messageText}"`, 'info');

              if (!businessData?.pageAccessToken) {
                await logActivity(bizId, 'ERROR', 'Page Access Token missing. Go to Settings and click Verify & Connect.', 'error');
                return;
              }

              if (!ai) {
                await logActivity(bizId, 'ERROR', 'AI Service not configured. Check GEMINI_API_KEY environment variable.', 'error');
                return;
              }

              // Generate AI Reply
              const prompt = `Shop: ${businessData.name}\nDescription: ${businessData.description || ''}\nProducts: ${JSON.stringify(businessData.products || [])}\nQuestion: ${messageText}\n\nAct as the shop assistant. keep it friendly and short.`;
              const aiModel = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
              const result = await aiModel.generateContent(prompt);
              const replyText = result.response.text();

              // Send to Messenger
              await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                recipient: { id: senderId },
                message: { text: replyText }
              });

              await logActivity(bizId, 'REPLY_SENT', `Bot: "${replyText.substring(0, 100)}..."`, 'success');
            } catch (err: any) {
              const errorMsg = err.response?.data?.error?.message || err.message;
              await logActivity(bizId, 'ERROR', `Delivery Failed: ${errorMsg}`, 'error', err.response?.data);
            }
          })();
        }
      }
    }
  } else {
    res.sendStatus(404);
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
