export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_BROADCAST_RECIPIENTS = 80;
export const BROADCAST_CONCURRENCY = 4;

export type BroadcastAudience = 'all' | 'hot_leads' | 'buyers';

export const DEFAULT_COMMENT_KEYWORDS = [
  'দাম',
  'প্রাইস',
  'price',
  'inbox',
  'ইনবক্স',
  'অর্ডার',
  'order',
  'চাই',
  'নিব',
  'নিবো',
  'details',
  'ডিটেইলস',
  'কত',
  'পাঠান',
  'buy',
  'info',
  'তথ্য',
  'স্টক',
  'stock'
];

export const DEFAULT_COMMENT_INBOX_MESSAGE =
  'আসসালামু আলাইকুম{{name}}! আপনার কমেন্ট পেয়েছি। দাম, স্টক ও অর্ডার — সব এখানে বলে দিব। কোন প্রোডাক্ট নিবেন?';

export const DEFAULT_COMMENT_PUBLIC_REPLY = 'ইনবক্স চেক করুন ✅';

export interface OutreachCustomer {
  messengerId?: string;
  name?: string;
  lastIncomingAtMs?: number;
  lastOrderAtMs?: number;
  lastOrderId?: string;
  leadStage?: string;
  phone?: string;
  pageId?: string;
}

export function coerceMillis(value: any): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  if (typeof value?.toMillis === 'function') {
    const ms = Number(value.toMillis());
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeOutreachCustomer(raw: any): OutreachCustomer {
  return {
    messengerId: String(raw?.messengerId || raw?.passengerId || raw?.senderId || '').trim(),
    name: String(raw?.name || raw?.leadInfo?.name || '').trim(),
    lastIncomingAtMs: coerceMillis(raw?.lastIncomingAtMs) || coerceMillis(raw?.lastInteraction),
    lastOrderAtMs: coerceMillis(raw?.lastOrderAtMs),
    lastOrderId: String(raw?.lastOrderId || '').trim(),
    leadStage: String(raw?.leadStage || '').trim(),
    phone: String(raw?.phone || '').trim(),
    pageId: String(raw?.pageId || raw?.facebookPageId || '').trim()
  };
}

export interface FeedCommentEvent {
  commentId: string;
  postId: string;
  parentId: string;
  pageId: string;
  fromId: string;
  fromName: string;
  message: string;
  verb: string;
  item: string;
  createdTime?: number;
  isTopLevel: boolean;
}

export function parseCommentKeywords(raw?: string | string[] | null): string[] {
  const parts = Array.isArray(raw)
    ? raw
    : String(raw || '')
        .split(/[,|\n]+/)
        .map(s => s.trim())
        .filter(Boolean);
  const unique = [...new Set(parts.map(normalizeMatchText).filter(Boolean))];
  return unique.length > 0 ? unique : [...DEFAULT_COMMENT_KEYWORDS];
}

export function normalizeMatchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[।!?.,;:()[\]{}"'“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function commentMatchesKeywords(comment: string, keywords?: string[] | string | null): boolean {
  const text = normalizeMatchText(comment);
  if (!text) return false;
  const keys = parseCommentKeywords(keywords);
  return keys.some(key => text.includes(key));
}

export function personalizeOutreachMessage(
  template: string,
  vars: { name?: string; shop?: string; product?: string }
): string {
  const name = String(vars.name || '').trim();
  const nameBit = name ? ` ${name}` : '';
  return String(template || DEFAULT_COMMENT_INBOX_MESSAGE)
    .replace(/\{\{\s*name\s*\}\}/gi, nameBit)
    .replace(/\{\{\s*shop\s*\}\}/gi, String(vars.shop || '').trim())
    .replace(/\{\{\s*product\s*\}\}/gi, String(vars.product || '').trim())
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 1900);
}

export function findMentionedProductName(
  comment: string,
  products: Array<{ name?: string } | null | undefined>
): string | undefined {
  const text = normalizeMatchText(comment);
  if (!text) return undefined;
  let best: string | undefined;
  for (const product of products || []) {
    const name = String(product?.name || '').trim();
    if (name.length < 3) continue;
    if (text.includes(normalizeMatchText(name)) && (!best || name.length > best.length)) {
      best = name;
    }
  }
  return best;
}

export function isWithinMessagingWindow(lastIncomingAtMs?: number, now = Date.now()): boolean {
  const ts = Number(lastIncomingAtMs) || 0;
  if (ts <= 0) return false;
  return now - ts < MESSAGING_WINDOW_MS;
}

export function classifyBroadcastAudience(customer: OutreachCustomer): BroadcastAudience | 'none' {
  if (!String(customer.messengerId || '').trim()) return 'none';
  const bought = Boolean(String(customer.lastOrderId || '').trim()) || Number(customer.lastOrderAtMs) > 0;
  if (bought) return 'buyers';
  return 'hot_leads';
}

export function matchesBroadcastAudience(
  customer: OutreachCustomer,
  audience: BroadcastAudience
): boolean {
  const kind = classifyBroadcastAudience(customer);
  if (kind === 'none') return false;
  if (audience === 'all') return true;
  return kind === audience;
}

export function planBroadcastRecipients(
  customers: OutreachCustomer[],
  audience: BroadcastAudience,
  now = Date.now()
): {
  eligible: OutreachCustomer[];
  skippedOutsideWindow: number;
  skippedNoPsid: number;
  truncated: boolean;
} {
  let skippedOutsideWindow = 0;
  let skippedNoPsid = 0;
  const eligible: OutreachCustomer[] = [];
  const seen = new Set<string>();

  for (const customer of customers) {
    const psid = String(customer.messengerId || '').trim();
    if (!psid) {
      skippedNoPsid += 1;
      continue;
    }
    if (seen.has(psid)) continue;
    if (!matchesBroadcastAudience({ ...customer, messengerId: psid }, audience)) continue;
    if (!isWithinMessagingWindow(customer.lastIncomingAtMs, now)) {
      skippedOutsideWindow += 1;
      continue;
    }
    seen.add(psid);
    eligible.push({ ...customer, messengerId: psid });
  }

  const truncated = eligible.length > MAX_BROADCAST_RECIPIENTS;
  return {
    eligible: eligible.slice(0, MAX_BROADCAST_RECIPIENTS),
    skippedOutsideWindow,
    skippedNoPsid,
    truncated
  };
}

export function extractFeedCommentEvents(entry: any): FeedCommentEvent[] {
  const pageId = String(entry?.id || '').trim();
  const changes = Array.isArray(entry?.changes) ? entry.changes : [];
  const events: FeedCommentEvent[] = [];

  for (const change of changes) {
    if (String(change?.field || '') !== 'feed') continue;
    const value = change?.value || {};
    const item = String(value.item || '').toLowerCase();
    const verb = String(value.verb || '').toLowerCase();
    const commentId = String(value.comment_id || value.commentId || '').trim();
    if (item !== 'comment' || verb !== 'add' || !commentId) continue;

    const postId = String(value.post_id || value.postId || '').trim();
    const parentId = String(value.parent_id || value.parentId || postId).trim();
    const fromId = String(value.from?.id || value.sender_id || '').trim();
    events.push({
      commentId,
      postId,
      parentId,
      pageId,
      fromId,
      fromName: String(value.from?.name || '').trim(),
      message: String(value.message || '').trim(),
      verb,
      item,
      createdTime: Number(value.created_time || value.createdTime) || undefined,
      isTopLevel: !parentId || !postId || parentId === postId
    });
  }
  return events;
}

export function shouldPrivateReplyToComment(event: FeedCommentEvent, keywords?: string[] | string | null): boolean {
  if (!event.isTopLevel) return false;
  if (!event.fromId || event.fromId === event.pageId) return false;
  return commentMatchesKeywords(event.message, keywords);
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
