import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp, setDoc, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { BusinessConfig } from '../src/types';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.error('Firebase config file not found at:', firebaseConfigPath);
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

// Helper to get system config
async function getSystemConfig() {
  if (!db) return null;
  try {
    const configDoc = await getDoc(doc(db, 'system_config', 'config'));
    if (configDoc.exists()) {
      return configDoc.data() as any;
    }
  } catch (error) {
    console.error('Error fetching system config:', error);
  }
  return null;
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Universal Webhook - Handles BOTH /webhook and /api/webhook
app.get(['/webhook', '/api/webhook'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  
  console.log(`[Universal Webhook] GET path=${req.path}, token=${token}, mode=${mode}`);

  const normalizedToken = token?.toLowerCase();
  const isValid = (normalizedToken === 'chatbyraju' || normalizedToken === '1058370033'); 

  if (mode === 'subscribe' && isValid) {
    console.log(`[Universal Webhook] Validation Success`);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  }
  
  console.error(`[Universal Webhook] Validation Failed. Expected chatbyraju, got ${token}`);
  res.status(403).send('Verification failed');
});

// SteadFast Courier Booking API
app.post('/api/steadfast/book', async (req, res) => {
  const { apiKey, order } = req.body;
  try {
    console.log('SteadFast Booking Request:', { apiKey, order });
    res.json({
      status: 200,
      tracking_code: `SF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// FB Event Route
app.post('/api/fb-event', async (req, res) => {
  const { pixelId, accessToken, eventName, eventData, userData, testEventCode } = req.body;
  if (!pixelId || !accessToken || !eventName) return res.status(400).json({ error: 'Missing required configuration' });
  try {
    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: { client_ip_address: req.ip, client_user_agent: req.headers['user-agent'], ...userData },
        custom_data: eventData,
      }],
      ...(testEventCode && { test_event_code: testEventCode })
    };
    const response = await axios.post(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`, payload);
    res.json({ success: true, data: response.data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Messenger Webhook Validation
app.get('/api/webhook/:businessId', async (req, res) => {
  const { businessId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log(`[Business Webhook] Validation attempt for businessId=${businessId}, token=${token}`);

  const normalizedToken = token?.toLowerCase();
  const universalTokens = ['chatbyraju', '1058370033'];

  if (mode === 'subscribe') {
    try {
      if (universalTokens.includes(normalizedToken)) {
         console.log(`[Business Webhook] Success (Universal Token)`);
         res.setHeader('Content-Type', 'text/plain');
         return res.status(200).send(challenge);
      }

      if (!db) {
        console.error('[Business Webhook] DB not initialized');
        return res.status(500).send('Database connection error');
      }

      const bizDoc = await getDoc(doc(db, 'businesses', businessId));
      if (!bizDoc.exists()) {
        console.error(`[Business Webhook] Business not found: ${businessId}`);
        return res.status(404).send('Business not found');
      }

      const config = bizDoc.data();
      const expectedTokens = [
        config.messengerVerifyToken?.toLowerCase(),
        config.verifyToken?.toLowerCase()
      ].filter(Boolean);

      if (normalizedToken && expectedTokens.includes(normalizedToken)) {
        console.log(`[Business Webhook] Validation Success (Business Token)`);
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge);
      } else {
        console.error(`[Business Webhook] Token mismatch for ${businessId}. Expected one of: ${expectedTokens.join(', ')}, Got: ${token}`);
      }
    } catch (err) {
      console.error('[Business Webhook] Error:', err);
      // Even on error, if token matches universal, let it through
      if (universalTokens.includes(normalizedToken)) {
         return res.status(200).send(challenge);
      }
    }
  }
  res.status(403).send('Forbidden');
});

// Messenger Message Handler
app.post(['/api/webhook', '/api/webhook/:businessId'], async (req, res) => {
  const { businessId } = req.params;
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry: any) => {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;
      
      if (webhookEvent.message && webhookEvent.message.text) {
        const messageText = webhookEvent.message.text;
        console.log(`[Messenger] New message from ${senderId}: ${messageText}`);
        
        // Find business by ID or Page ID
        // Note: businessId might be empty if hitting /api/webhook directly
        // In that case we'd need to lookup by entry.id (Page ID)
      }
    });

    return res.status(200).send('EVENT_RECEIVED');
  }
  res.sendStatus(404);
});

// Initialize server
async function init() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Standard SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/webhook')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
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
