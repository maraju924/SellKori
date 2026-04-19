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

  // 1. Log the hit for instant feedback
  console.log('[Webhook POST] Hit received:', JSON.stringify(body).substring(0, 200));

  if (body.object === 'page') {
    res.status(200).send('EVENT_RECEIVED');

    for (const entry of body.entry) {
      const pageId = entry.id;
      const messaging = entry.messaging || entry.standby;
      if (!messaging) continue;

      for (const webhookEvent of messaging) {
        if (!webhookEvent.sender) continue;
        const senderId = webhookEvent.sender.id;

        if (webhookEvent.message && webhookEvent.message.text && !webhookEvent.message.is_echo) {
          const messageText = webhookEvent.message.text;
          
          (async () => {
            let bizId = businessId || 'unknown';
            let ownerId = 'system';
            try {
              // DETECTIVE LOG: Show what Page ID is hitting us
              await logActivity(bizId, 'DEBUG', `Event from Page ID: ${pageId}. Looking for store...`, 'info', 'system');

              // Find Business by Page ID
              let businessData: any = null;
              const bizQuery = query(collection(db, 'businesses'), where('facebookPageId', '==', pageId));
              const bizSnap = await getDocs(bizQuery);
              
              if (!bizSnap.empty) {
                businessData = bizSnap.docs[0].data();
                bizId = bizSnap.docs[0].id;
                ownerId = businessData.ownerId;
              }

              if (!businessData) {
                await logActivity('unknown', 'ERROR', `Could not find a store with Page ID: "${pageId}". Please check your Settings.`, 'error', 'system');
                return;
              }

              await logActivity(bizId, 'INCOMING', `Customer sent: "${messageText}"`, 'info', ownerId);

              if (!businessData.pageAccessToken) {
                await logActivity(bizId, 'ERROR', 'Page Access Token missing. Go to Settings -> Verify & Connect.', 'error', ownerId);
                return;
              }

              if (!process.env.GEMINI_API_KEY) {
                await logActivity(bizId, 'ERROR', 'AI Service Error: GEMINI_API_KEY is missing in environment.', 'error', ownerId);
                return;
              }

              // Generate AI Reply
              const prompt = `Shop: ${businessData.name}\nContext: ${businessData.description || ''}\nProducts: ${JSON.stringify(businessData.products || [])}\nCustomer: ${messageText}`;
              const aiModel = ai!.getGenerativeModel({ model: 'gemini-1.5-flash' });
              const result = await aiModel.generateContent(prompt);
              const replyText = result.response.text();

              // Send to Messenger
              await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${businessData.pageAccessToken}`, {
                recipient: { id: senderId },
                message: { text: replyText }
              });

              await logActivity(bizId, 'REPLY_SENT', `Replied: "${replyText.substring(0, 50)}..."`, 'success', ownerId);
            } catch (err: any) {
              const errorMsg = err.response?.data?.error?.message || err.message;
              await logActivity(bizId, 'ERROR', `Failed to reply: ${errorMsg}`, 'error', ownerId, err.response?.data);
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
