import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
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

// Messenger Message Handler
app.post(['/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
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
