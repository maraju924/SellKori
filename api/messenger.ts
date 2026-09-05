/**
 * Isolated Messenger page-token API.
 * Boots without the Express/Gemini monolith so token test / subscribe
 * keep working even when api/index.ts fails to load on Vercel.
 */
import {
  facebookErrorMessage,
  subscribePageToMessenger,
  tokenSuccessPayload,
} from './_lib/messengerTokenCore.js';
import { parseMessengerTokenRequest, readJsonBody } from './_lib/messengerTokenRoute.js';

export const maxDuration = 30;

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const payload = JSON.stringify(body);
  if (typeof res.end === 'function') return res.end(payload);
  return res.send(payload);
}

async function handleToken(req: any, res: any, fallbackError: string) {
  const body = readJsonBody(req);
  const pageAccessToken = String(body.pageAccessToken || '').trim();
  if (!pageAccessToken) {
    return sendJson(res, 400, { success: false, error: 'Page Access Token প্রদান করুন।' });
  }
  try {
    const result = await subscribePageToMessenger(pageAccessToken);
    return sendJson(res, 200, tokenSuccessPayload(result));
  } catch (err: any) {
    const msg = facebookErrorMessage(err, fallbackError);
    return sendJson(res, 400, { success: false, error: `ফেসবুক এরর: ${msg}` });
  }
}

export default async function handler(req: any, res: any) {
  const parsed = parseMessengerTokenRequest(req);
  try {
    if (parsed.op === 'unknown') {
      return sendJson(res, 404, { success: false, error: 'মেসেঞ্জার টোকেন রুট পাওয়া যায়নি' });
    }
    if (parsed.method !== 'POST') {
      res.setHeader?.('Allow', 'POST');
      return sendJson(res, 405, { success: false, error: 'Method Not Allowed' });
    }
    if (parsed.op === 'subscribe-page') {
      return await handleToken(req, res, 'পেজ সাবস্ক্রাইব ব্যর্থ');
    }
    return await handleToken(req, res, 'ফেসবুক টোকেন যাচাই ব্যর্থ হয়েছে');
  } catch (error: any) {
    console.error('[messenger-token]', error?.message || error);
    if (res.headersSent) return;
    return sendJson(res, 500, {
      success: false,
      error: error?.message || 'টোকেন যাচাই ব্যর্থ হয়েছে',
    });
  }
}
