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

// Messenger Message Handler
app.post(['/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId } = req.params;
  const body = req.body;

  console.log(`[Webhook Received] path=${req.path}, businessId=${businessId}, body=${JSON.stringify(body).substring(0, 500)}`);

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const pageId = entry.id;
      const messaging = entry.messaging || entry.standby; // Handle normal and standby messages
      
      if (!messaging) {
        console.log(`[Webhook] No messaging or standby fields in entry for page ${pageId}`);
        continue;
      }

      for (const webhookEvent of messaging) {
        if (!webhookEvent.sender) continue;
        
        const senderId = webhookEvent.sender.id;

        // Skip echo messages or messages from the page itself
        if (webhookEvent.message?.is_echo) {
          console.log(`[Webhook] Skipping echo message for page ${pageId}`);
          continue;
        }

        if (webhookEvent.message && webhookEvent.message.text) {
          const messageText = webhookEvent.message.text;
          console.log(`[Messenger] Content: "${messageText}" from ${senderId} on page ${pageId}`);

          try {
            // 1. Find the business
            let businessData: any = null;
            let bizId = businessId;

            // Priority 1: Use businessId from URL
            if (bizId && bizId.startsWith('biz-')) {
              const bizDoc = await getDoc(doc(db, 'businesses', bizId));
              if (bizDoc.exists()) {
                businessData = bizDoc.data();
                console.log(`[Business Found] Using URL ID: ${bizId}`);
              }
            }

            // Priority 2: Use Page ID lookup if URL ID wasn't enough
            if (!businessData) {
              const bizQuery = query(collection(db, 'businesses'), where('facebookPageId', '==', pageId));
              const bizSnap = await getDocs(bizQuery);
              if (!bizSnap.empty) {
                businessData = bizSnap.docs[0].data();
                bizId = bizSnap.docs[0].id;
                console.log(`[Business Found] Using Page ID Lookup: ${bizId}`);
              }
            }

            if (!businessData) {
              console.error(`[Business Not Found] No business matched pageId=${pageId} or urlId=${businessId}`);
              continue;
            }

            if (!businessData.pageAccessToken) {
              console.error(`[Token Missing] Business ${bizId} has no Page Access Token`);
              continue;
            }

            if (!ai) {
              console.error(`[AI Missing] Gemini API Key not configured in server environment`);
              await sendMessengerMessage(senderId, 'ধন্যবাদ আপনার বার্তার জন্য। আমাদের প্রতিনিধি শীঘ্রই যোগাযোগ করবেন।', businessData.pageAccessToken);
              continue;
            }

            // 2. Generate AI Reply
            console.log(`[AI] Generating reply for ${senderId}...`);
            const prompt = `
              Shop Name: ${businessData.name}
              Description: ${businessData.description || 'N/A'}
              Products: ${JSON.stringify(businessData.products || [])}
              FAQs: ${JSON.stringify(businessData.faqs || [])}
              System Template: ${businessData.customSystemPrompt || 'You are a helpful assistant.'}
              Customer Message: ${messageText}
              Reply as the store assistant. keep it concise and friendly. Respond in the language of the customer.
            `;

            const aiResponse = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
            });

            const replyText = aiResponse.text || 'ধন্যবাদ। কি সাহায্য করতে পারি?';
            console.log(`[AI Output] -> ${replyText.substring(0, 100)}...`);

            // 3. Send back to Messenger
            await sendMessengerMessage(senderId, replyText, businessData.pageAccessToken);
            console.log(`[Messenger Sent] Done.`);
          } catch (err) {
            console.error('[Messenger Bot Error]', err);
          }
        }
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  }
  res.sendStatus(404);
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
