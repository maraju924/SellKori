/**
 * Meta Conversions API helpers for Click-to-Messenger ads.
 * Website/Pixel browser events are intentionally out of scope.
 */
import { createHash } from 'crypto';

export const CAPI_GRAPH_VERSION = 'v21.0';

export const CAPI_FUNNEL_EVENTS = ['Lead', 'ViewContent', 'AddToCart', 'InitiateCheckout'] as const;
export const CAPI_ALLOWED_EVENTS = new Set([
  ...CAPI_FUNNEL_EVENTS,
  'Purchase',
  'Contact',
  'CompleteRegistration',
]);

export const FUNNEL_RANK: Record<string, number> = {
  Lead: 1,
  ViewContent: 2,
  AddToCart: 3,
  InitiateCheckout: 4,
  Purchase: 5,
};

const STAGE_TO_EVENT: Record<string, string> = {
  new_lead: 'Lead',
  interested: 'ViewContent',
  checkout_started: 'InitiateCheckout',
};

const EVENT_ALIASES: Record<string, string> = {
  lead: 'Lead',
  viewcontent: 'ViewContent',
  view_content: 'ViewContent',
  addtocart: 'AddToCart',
  add_to_cart: 'AddToCart',
  initiatecheckout: 'InitiateCheckout',
  initiate_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  contact: 'Contact',
  completeregistration: 'CompleteRegistration',
  complete_registration: 'CompleteRegistration',
};

export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function sha256Lower(value: string): string {
  return createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

export function canonicalizeCapiEvent(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (CAPI_ALLOWED_EVENTS.has(raw)) return raw;
  return EVENT_ALIASES[raw.toLowerCase().replace(/\s+/g, '_')] || '';
}

/** Meta wants E.164 digits: BD 01XXXXXXXXX → 8801XXXXXXXXX (same as +880 1XXXXXXXXX). */
export function normalizedPhoneForCapi(phone: string): string {
  let p = String(phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('880') && p.length === 13) return p;
  if (p.startsWith('01') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  return p;
}

export function splitPersonName(name: string): { fn: string; ln: string } {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { fn: '', ln: '' };
  if (parts.length === 1) return { fn: parts[0], ln: '' };
  return { fn: parts[0], ln: parts.slice(1).join(' ') };
}

export function capiEventId(eventName: string, psid: string, orderId?: string, day = utcDay()): string {
  if (eventName === 'Purchase' && orderId) return `Purchase_${psid}_${orderId}`;
  return `${eventName}_${psid}_${orderId || day}`;
}

export function capiEventsUrl(pixelId: string, accessToken: string): string {
  return `https://graph.facebook.com/${CAPI_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;
}

export function isCapiHttpSuccess(status: number, body: any): boolean {
  if (status < 200 || status >= 300) return false;
  if (body && typeof body.events_received === 'number') return body.events_received > 0;
  return !body?.error;
}

export function isRetryableCapiError(err: any): boolean {
  const status = Number(err?.response?.status || 0);
  if (status === 429 || status >= 500) return true;
  const code = String(err?.code || '');
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ENOTFOUND';
}

/**
 * Pick the next Messenger funnel event for this message.
 * Purchase is never chosen here — it fires only after a real order save.
 * AI may advance at most one stage past conversation_stage so a hallucinated
 * "InitiateCheckout" on a brand-new lead is not sent.
 */
export function resolveMessengerFunnelEvent(input: {
  conversationStage?: string;
  eventName?: string;
  alreadySentToday?: Record<string, string>;
  day?: string;
}): string | null {
  const day = input.day || utcDay();
  const fromStage = STAGE_TO_EVENT[String(input.conversationStage || '').trim()] || '';
  const fromAi = canonicalizeCapiEvent(input.eventName);
  const aiFunnel = fromAi && FUNNEL_RANK[fromAi] && fromAi !== 'Purchase' ? fromAi : '';

  let chosen = '';
  if (fromStage && aiFunnel) {
    const aiRank = FUNNEL_RANK[aiFunnel];
    const stageRank = FUNNEL_RANK[fromStage];
    if (aiRank > stageRank + 1) chosen = fromStage;
    else chosen = aiRank > stageRank ? aiFunnel : fromStage;
  } else {
    chosen = fromStage || aiFunnel;
  }
  if (!chosen || chosen === 'Purchase' || !FUNNEL_RANK[chosen]) return null;

  const sentToday = new Set(
    Object.entries(input.alreadySentToday || {})
      .filter(([, at]) => at === day)
      .map(([name]) => name)
  );
  if (sentToday.has(chosen)) return null;

  const maxSent = Math.max(0, ...[...sentToday].map((name) => FUNNEL_RANK[name] || 0));
  if (FUNNEL_RANK[chosen] <= maxSent) return null;
  return chosen;
}

export interface MessengerCapiBuildInput {
  eventName: string;
  pixelId: string;
  pageId?: string;
  psid: string;
  phone?: string;
  name?: string;
  ctwaClid?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentIds?: string[];
  quantity?: number;
  itemPrice?: number;
  orderId?: string;
  eventTime?: number;
  day?: string;
  testEventCode?: string;
}

export function buildMessengerCapiUserData(input: {
  pageId?: string;
  psid: string;
  phone?: string;
  name?: string;
  ctwaClid?: string;
}): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    page_scoped_user_id: String(input.psid || '').trim(),
    external_id: [sha256Lower(String(input.psid || '').trim())],
    country: [sha256Lower('bd')],
  };
  const pageId = String(input.pageId || '').trim();
  if (pageId) userData.page_id = pageId;
  const clid = String(input.ctwaClid || '').trim();
  if (clid) userData.ctwa_clid = clid;
  const phone = normalizedPhoneForCapi(input.phone || '');
  if (phone.length >= 12) userData.ph = [sha256Lower(phone)];
  const { fn, ln } = splitPersonName(input.name || '');
  if (fn) userData.fn = [sha256Lower(fn)];
  if (ln) userData.ln = [sha256Lower(ln)];
  return userData;
}

export function buildMessengerCapiCustomData(input: {
  eventName: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentIds?: string[];
  quantity?: number;
  itemPrice?: number;
  orderId?: string;
}): Record<string, unknown> {
  const custom: Record<string, unknown> = {
    currency: input.currency || 'BDT',
  };
  if (typeof input.value === 'number' && Number.isFinite(input.value) && input.value > 0) {
    custom.value = Math.round(input.value * 100) / 100;
  }
  const contentName = String(input.contentName || '').trim().slice(0, 100);
  if (contentName) {
    custom.content_name = contentName;
    custom.content_type = 'product';
  }
  const contentIds = (input.contentIds || []).map((id) => String(id || '').trim()).filter(Boolean).slice(0, 10);
  if (contentIds.length) custom.content_ids = contentIds;
  const quantity = Math.max(0, Math.round(Number(input.quantity) || 0));
  if (quantity > 0) custom.num_items = quantity;
  const itemPrice = Number(input.itemPrice);
  const contentId = contentIds[0] || contentName;
  if (contentId && (quantity > 0 || (Number.isFinite(itemPrice) && itemPrice > 0))) {
    const row: Record<string, unknown> = { id: String(contentId).slice(0, 100), quantity: Math.max(1, quantity || 1) };
    if (Number.isFinite(itemPrice) && itemPrice > 0) row.item_price = Math.round(itemPrice * 100) / 100;
    custom.contents = [row];
    if (!custom.content_type) custom.content_type = 'product';
  }
  if (input.orderId) custom.order_id = String(input.orderId);
  return custom;
}

export function buildMessengerCapiPayload(input: MessengerCapiBuildInput): {
  pixelId: string;
  eventName: string;
  eventId: string;
  body: {
    data: Array<Record<string, unknown>>;
    test_event_code?: string;
  };
} {
  const eventName = canonicalizeCapiEvent(input.eventName);
  const pixelId = String(input.pixelId || '').trim();
  const psid = String(input.psid || '').trim();
  const day = input.day || utcDay();
  const eventId = capiEventId(eventName, psid, input.orderId, day);
  const body: { data: Array<Record<string, unknown>>; test_event_code?: string } = {
    data: [{
      event_name: eventName,
      event_time: input.eventTime || Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'business_messaging',
      messaging_channel: 'messenger',
      user_data: buildMessengerCapiUserData(input),
      custom_data: buildMessengerCapiCustomData({ ...input, eventName }),
    }],
  };
  const testCode = String(input.testEventCode || '').trim();
  if (testCode) body.test_event_code = testCode;
  return { pixelId, eventName, eventId, body };
}

export function readCapiCredentials(businessData: any): { pixelId: string; accessToken: string; enabled: boolean } {
  const fbCfg = businessData?.facebookConfig || {};
  const pixelId = String(fbCfg.pixelId || '').trim();
  const accessToken = String(fbCfg.accessToken || '').trim();
  const enabled = Boolean(pixelId && accessToken) && fbCfg.capiEnabled !== false;
  return { pixelId, accessToken, enabled };
}
