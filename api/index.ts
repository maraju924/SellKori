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
app.get(['/webhook', '/api/webhook', '/api/webhook/debug'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log(`Webhook HIT: path=${req.path}, token=${token}, mode=${mode}`);

  addDoc(collection(db, 'webhook_logs'), {
    timestamp: serverTimestamp(),
    token: token || 'none',
    mode: mode || 'none',
    success: token === 'chatbyraju',
    source: `GET_${req.path}`,
    userAgent: req.headers['user-agent'] || 'unknown'
  }).catch(() => {});
  
  if (mode === 'subscribe' && token === 'chatbyraju') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
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

// Messenger Webhook
app.get('/api/webhook/:businessId', async (req, res) => {
  const { businessId } = req.params;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe') {
    const bizDoc = await getDoc(doc(db, 'businesses', businessId));
    if (bizDoc.exists() && token === bizDoc.data().messengerVerifyToken) {
      return res.status(200).send(challenge);
    }
  }
  res.sendStatus(403);
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
