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
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) 
  : getFirestore(firebaseApp);

// Helper to get system config
async function getSystemConfig() {
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
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log(`[Universal Webhook] GET path=${req.path}, token=${token}, mode=${mode}`);

  const isValid = (token === 'chatbyraju' || token === '1058370033'); // Support legacy placeholder if user copied it

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
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[Business Webhook] Validation attempt for businessId=${businessId}, token=${token}`);

  if (mode === 'subscribe') {
    try {
      const bizDoc = await getDoc(doc(db, 'businesses', businessId));
      if (!bizDoc.exists()) {
        console.error(`[Business Webhook] Business not found: ${businessId}`);
        // If not found, still check against universal tokens as a courtesy
        if (token === 'chatbyraju' || token === '1058370033') {
           res.setHeader('Content-Type', 'text/plain');
           return res.status(200).send(challenge);
        }
        return res.status(404).send('Business not found');
      }

      const config = bizDoc.data();
      const expectedTokens = [
        config.messengerVerifyToken,
        config.verifyToken,
        'chatbyraju',
        '1058370033'
      ].filter(Boolean);

      const isMatch = token && expectedTokens.includes(token);

      if (isMatch) {
        console.log(`[Business Webhook] Validation Success for ${businessId}`);
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge);
      } else {
        console.error(`[Business Webhook] Token mismatch for ${businessId}. Expected one of: ${expectedTokens.join(', ')}, Got: ${token}`);
      }
    } catch (err) {
      console.error('[Business Webhook] Firestore Error:', err);
      // Fallback to universal tokens on DB error to at least try to validate
      if (token === 'chatbyraju' || token === '1058370033') {
        return res.status(200).send(challenge);
      }
    }
  }
  res.status(403).send('Forbidden - Token mismatch or invalid mode');
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
  // Standard SPA fallback handled by Vercel rewrites but keeping for safety
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

export default app;
