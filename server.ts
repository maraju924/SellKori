import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';
import { db } from './src/lib/firebase';
import { getAIResponse, generateIssueFollowUp } from './src/lib/gemini';
import { doc, getDoc, collection, addDoc, serverTimestamp, setDoc, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { BusinessConfig, Customer } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Immediate logging for UI feedback
    addDoc(collection(db, 'webhook_logs'), {
      timestamp: serverTimestamp(),
      token: token || 'none',
      mode: mode || 'none',
      success: token === 'chatbyraju',
      source: `GET_${req.path}`,
      userAgent: req.headers['user-agent'] || 'unknown'
    }).catch(() => {});
    
    if (mode === 'subscribe' && token === 'chatbyraju') {
      console.log('Verification Success! Sending challenge...');
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }
    console.log('Verification Failed or not a subscribe request.');
    res.sendStatus(403);
  });

  // SteadFast Courier Booking API
  app.post('/api/steadfast/book', async (req, res) => {
    const { apiKey, secretKey, order } = req.body;
    try {
      // Mock SteadFast API call
      // In production, use: https://portal.steadfast.com.bd/api/v1/create_order
      console.log('SteadFast Booking Request:', { apiKey, order });
      
      // Simulate success
      res.json({
        status: 200,
        tracking_code: `SF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Zinipay Payment API
  app.post('/api/zinipay/create-payment', async (req, res) => {
    const { apiKey, merchantId, orderId, amount } = req.body;
    try {
      // Mock Zinipay API call
      console.log('Zinipay Payment Request:', { apiKey, merchantId, orderId, amount });
      
      res.json({
        status: 'success',
        payment_url: `https://zinipay.com/pay/${orderId}`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for Facebook Conversions API (CAPI)
  app.post('/api/fb-event', async (req, res) => {
    const { 
      pixelId, 
      accessToken, 
      eventName, 
      eventData, 
      userData,
      testEventCode 
    } = req.body;

    if (!pixelId || !accessToken || !eventName) {
      return res.status(400).json({ error: 'Missing required Facebook configuration or event name' });
    }

    try {
      const payload = {
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            action_source: 'website',
            user_data: {
              client_ip_address: req.ip,
              client_user_agent: req.headers['user-agent'],
              ...userData
            },
            custom_data: eventData,
          },
        ],
      };

      if (testEventCode) {
        (payload as any).test_event_code = testEventCode;
      }

      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
        payload
      );

      console.log(`FB CAPI Success [${eventName}]:`, response.data);
      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error(`FB CAPI Error [${eventName}]:`, error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Failed to send Facebook event', 
        details: error.response?.data || error.message 
      });
    }
  });

  // Messenger Webhook Verification
  app.get('/api/webhook/:businessId', async (req, res) => {
    const { businessId } = req.params;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`Webhook Verification Attempt: biz=${businessId}, token=${token}, mode=${mode}`);

    if (mode && token) {
      if (mode === 'subscribe') {
        try {
          // 1. Try direct lookup by businessId
          let business: BusinessConfig | null = null;
          const bizDoc = await getDoc(doc(db, 'businesses', businessId));
          
          if (bizDoc.exists()) {
            business = bizDoc.data() as BusinessConfig;
          } else {
            // 2. Fallback: Search by verify token if ID doesn't match/exist
            console.log(`Business ${businessId} not found, searching for a business with token: ${token}`);
            const q = query(collection(db, 'businesses'), where('messengerVerifyToken', '==', token));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              business = querySnapshot.docs[0].data() as BusinessConfig;
              console.log(`Fallback Match Found: Linked setup to business: ${business.id}`);
            }
          }

          if (business && token === business.messengerVerifyToken) {
            console.log(`WEBHOOK_VERIFIED success for: ${businessId}`);
            return res.status(200).send(challenge);
          } else {
            console.log(`WEBHOOK_VERIFICATION_FAILED: Token mismatch or business not found. Expected match for token: ${token}`);
          }
          res.sendStatus(403);
        } catch (err) {
          console.error('Webhook verification error:', err);
          res.sendStatus(500);
        }
      } else {
        res.sendStatus(403);
      }
    } else {
      res.status(400).send('Missing hub.mode or hub.verify_token');
    }
  });

  // Messenger Webhook Event Handling
  app.post('/api/webhook/:businessId', async (req, res) => {
    const { businessId } = req.params;
    const body = req.body;

    if (body.object === 'page') {
      res.status(200).send('EVENT_RECEIVED'); // Acknowledge quickly

      for (const entry of body.entry) {
        for (const webhookEvent of entry.messaging) {
          const senderId = webhookEvent.sender.id;
          let messageText = '';
          let audioData: any = null;

          if (webhookEvent.message) {
            if (webhookEvent.message.text) {
              messageText = webhookEvent.message.text;
            } else if (webhookEvent.message.attachments) {
              const audioAttachment = webhookEvent.message.attachments.find((a: any) => a.type === 'audio');
              if (audioAttachment) {
                try {
                  const audioUrl = audioAttachment.payload.url;
                  const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });
                  audioData = {
                    inlineData: {
                      data: Buffer.from(audioResponse.data).toString('base64'),
                      mimeType: 'audio/mpeg'
                    }
                  };
                  messageText = '[Voice Message Received]';
                } catch (err) {
                  console.error('Error downloading audio attachment:', err);
                }
              }
            }
          } else if (webhookEvent.postback) {
            messageText = webhookEvent.postback.payload;
          }

          if (messageText || audioData) {
            try {
              // 1. Fetch Business Config
              const bizDoc = await getDoc(doc(db, 'businesses', businessId));
              if (!bizDoc.exists()) {
                console.error(`Business ${businessId} not found for webhook`);
                continue;
              }
              const business = bizDoc.data() as BusinessConfig;

              // 2. Get AI Response
              const systemConfig = await getSystemConfig();
              const aiResponse = await getAIResponse(
                messageText, 
                "", 
                business, 
                undefined, // customerContext helper could go here later
                audioData,
                systemConfig?.geminiApiKey
              );

              // 3. Send Reply to Messenger
              if (business.facebookConfig.accessToken) {
                const identifiedProduct = aiResponse.product_name 
                  ? business.products.find(p => p.name.toLowerCase().includes(aiResponse.product_name.toLowerCase()) || aiResponse.product_name.toLowerCase().includes(p.name.toLowerCase()))
                  : null;

                // Send Image as a direct attachment if available
                if (identifiedProduct && identifiedProduct.image) {
                  try {
                    await axios.post(
                      `https://graph.facebook.com/v18.0/me/messages?access_token=${business.facebookConfig.accessToken}`,
                      {
                        recipient: { id: senderId },
                        message: {
                          attachment: {
                            type: "image",
                            payload: {
                              url: identifiedProduct.image,
                              is_reusable: true
                            }
                          }
                        }
                      }
                    );
                  } catch (imgErr) {
                    console.error("Error sending image attachment:", imgErr);
                  }
                }

                // Always send the text reply
                await axios.post(
                  `https://graph.facebook.com/v18.0/me/messages?access_token=${business.facebookConfig.accessToken}`,
                  {
                    recipient: { id: senderId },
                    message: { text: aiResponse.reply }
                  }
                );
                
                console.log(`Sent Messenger reply to ${senderId}`);
              }

              // 4. Update Customer Profile & Lead Scoring
              const customerRef = doc(db, 'customers', `${businessId}_${senderId}`);
              const customerDoc = await getDoc(customerRef);
              
              let leadScore = aiResponse.confidence * 100;
              if (aiResponse.event_name === 'Purchase') leadScore = 100;
              else if (aiResponse.event_name === 'InitiateCheckout') leadScore = 80;
              else if (aiResponse.event_name === 'AddToCart') leadScore = 60;
              else if (aiResponse.event_name === 'ViewContent') leadScore = 40;

              if (!customerDoc.exists()) {
                await setDoc(customerRef, {
                  businessId,
                  businessOwnerId: business.ownerId,
                  messengerId: senderId,
                  name: aiResponse.order_data.name || 'Messenger User',
                  phone: aiResponse.order_data.phone || '',
                  address: aiResponse.order_data.address || '',
                  totalOrders: 0,
                  totalSpent: 0,
                  leadScore,
                  lastInteraction: serverTimestamp(),
                  createdAt: serverTimestamp()
                });
              } else {
                await updateDoc(customerRef, {
                  businessOwnerId: business.ownerId,
                  leadScore: Math.max(customerDoc.data().leadScore, leadScore),
                  lastInteraction: serverTimestamp(),
                  name: aiResponse.order_data.name || customerDoc.data().name,
                  phone: aiResponse.order_data.phone || customerDoc.data().phone,
                  address: aiResponse.order_data.address || customerDoc.data().address
                });
              }

              // 5. Handle Purchase Event (Save Order)
              if (aiResponse.event_name === 'Purchase' && !aiResponse.need_more_info) {
                const product = business.products.find(p => p.name.toLowerCase().includes(aiResponse.product_name.toLowerCase()));
                const amount = (product?.price || 0) * (Number(aiResponse.order_data.quantity) || 1);

                await addDoc(collection(db, 'orders'), {
                  merchantId: business.ownerId,
                  businessId: business.id,
                  customerName: aiResponse.order_data.name,
                  phone: aiResponse.order_data.phone,
                  address: aiResponse.order_data.address,
                  quantity: Number(aiResponse.order_data.quantity) || 1,
                  productName: aiResponse.product_name,
                  eventName: aiResponse.event_name,
                  status: 'pending',
                  paymentStatus: 'unpaid',
                  paymentMethod: 'cod',
                  createdAt: serverTimestamp(),
                  source: 'messenger',
                  messengerId: senderId
                });

                // Update Customer Stats
                await updateDoc(customerRef, {
                  totalOrders: increment(1),
                  totalSpent: increment(amount)
                });

                console.log(`Saved order from Messenger for business ${businessId}`);
              }

              // 6. Trigger FB CAPI
              if (business.facebookConfig.pixelId && business.facebookConfig.accessToken) {
                const product = business.products.find(p => p.name.toLowerCase().includes(aiResponse.product_name.toLowerCase()));
                
                axios.post(`https://graph.facebook.com/v18.0/${business.facebookConfig.pixelId}/events?access_token=${business.facebookConfig.accessToken}`, {
                  data: [{
                    event_name: aiResponse.event_name,
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: 'chat',
                    user_data: {
                      ph: aiResponse.order_data.phone ? [aiResponse.order_data.phone] : [],
                      fn: aiResponse.order_data.name ? [aiResponse.order_data.name] : [],
                    },
                    custom_data: {
                      value: aiResponse.event_name === 'Purchase' ? (product?.price || 0) : 0,
                      currency: 'BDT',
                      content_name: aiResponse.product_name || 'General Query',
                      conversation_stage: aiResponse.conversation_stage
                    }
                  }]
                }).catch(err => console.error('FB CAPI Error from Webhook:', err.response?.data || err.message));
              }

            } catch (err: any) {
              console.error('Error processing Messenger webhook event:', err.response?.data || err.message);
            }
          }
        }
      }
    } else {
      res.sendStatus(404);
    }
  });

  // SteadFast Courier Webhook (Real-time notifications)
  app.post('/api/steadfast/webhook', async (req, res) => {
    const { tracking_code, status } = req.body;
    
    console.log(`SteadFast Webhook Received: tracking=${tracking_code}, status=${status}`);

    try {
      // Find order with this tracking code
      const q = query(collection(db, 'orders'), where('courierTrackingId', '==', tracking_code));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        const orderRef = doc(db, 'orders', orderDoc.id);
        
        // Map SteadFast status to our local status if needed
        let newStatus = 'processing';
        if (status === 'delivered') newStatus = 'delivered';
        if (status === 'cancelled') newStatus = 'cancelled';
        if (status === 'shipped' || status === 'in_transit') newStatus = 'shipped';

        await updateDoc(orderRef, {
          courierStatus: status,
          status: newStatus as any,
          updatedAt: serverTimestamp()
        });

        // Proactive AI Follow-up for issues
        const issueStatuses = ['unreachable', 'switched_off', 'failed_attempt', 'delayed_by_customer'];
        const data = orderDoc.data();
        
        if (issueStatuses.includes(status) && data.messengerId) {
          console.log(`Issue detected for Order ${orderDoc.id}: ${status}. Triggering AI follow-up...`);
          
          try {
            const bizDoc = await getDoc(doc(db, 'businesses', data.businessId));
            if (bizDoc.exists()) {
              const business = bizDoc.data() as BusinessConfig;
              
              if (business.features?.proactiveNotificationsEnabled === false) {
                console.log(`Proactive follow-up is disabled for ${business.name}. Skipping.`);
                res.status(200).send('OK');
                return;
              }

              const systemConfig = await getSystemConfig();
              
              // 1. Generate the polite message
              const followUpMessage = await generateIssueFollowUp(
                business, 
                data, 
                status, 
                systemConfig?.geminiApiKey
              );

              // 2. Send via Messenger
              if (business.facebookConfig.accessToken) {
                await axios.post(
                  `https://graph.facebook.com/v18.0/me/messages?access_token=${business.facebookConfig.accessToken}`,
                  {
                    recipient: { id: data.messengerId },
                    message: { text: followUpMessage }
                  }
                );
                console.log(`Proactive follow-up sent to Messenger user: ${data.messengerId}`);
              }
            }
          } catch (followUpErr: any) {
            console.error('Proactive follow-up error:', followUpErr.message);
          }
        }
        
        console.log(`Updated Order ${orderDoc.id} via Webhook`);
      } else {
        console.warn(`No order found for tracking code: ${tracking_code}`);
      }

      res.status(200).send('OK');
    } catch (err: any) {
      console.error('Error processing SteadFast webhook:', err.message);
      res.status(500).send('Internal Server Error');
    }
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

export default app;
