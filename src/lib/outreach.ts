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
    phone: String(raw?.phone || '').trim()
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

export const COMMENT_PUBLIC_REPLY_MAX = 400;
export const COMMENT_INBOX_REPLY_MAX = 1900;

export function facebookObjectIdsMatch(a?: string, b?: string): boolean {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const tail = (id: string) => {
    const idx = id.lastIndexOf('_');
    return idx >= 0 ? id.slice(idx + 1) : id;
  };
  return tail(left) === tail(right);
}

export function extractFeedCommentEvents(entry: any): FeedCommentEvent[] {
  const pageId = String(entry?.id || '').trim();
  const changes = Array.isArray(entry?.changes) ? entry.changes : [];
  const events: FeedCommentEvent[] = [];

  for (const change of changes) {
    const field = String(change?.field || '').toLowerCase();
    if (field !== 'feed' && field !== 'comments') continue;
    const value = change?.value || {};
    const item = String(value.item || '').toLowerCase();
    const verb = String(value.verb || '').toLowerCase();
    const commentId = String(value.comment_id || value.commentId || '').trim();
    const looksLikeComment = item === 'comment' || (!item && Boolean(commentId));
    if (!looksLikeComment || verb !== 'add' || !commentId) continue;

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
      item: item || 'comment',
      createdTime: Number(value.created_time || value.createdTime) || undefined,
      isTopLevel: !parentId || !postId || facebookObjectIdsMatch(parentId, postId)
    });
  }
  return events;
}

export function shouldReplyToComment(event: FeedCommentEvent): boolean {
  if (!event?.commentId) return false;
  if (event.fromId && event.pageId && event.fromId === event.pageId) return false;
  return true;
}

export function shouldPrivateReplyToComment(event: FeedCommentEvent, _keywords?: string[] | string | null): boolean {
  return shouldReplyToComment(event);
}

export function clipCommentReply(text: string, max: number): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildCommentReplyPrompt(input: {
  shopName?: string;
  shopDescription?: string;
  customerName?: string;
  comment: string;
  products?: unknown;
  faqsText?: string;
  merchantCustomBlock?: string;
  replyStyleBlock?: string;
}): string {
  const shop = String(input.shopName || 'এই পেজ').trim() || 'এই পেজ';
  const comment = String(input.comment || '').trim() || '(কাস্টমার স্টিকার বা খালি কমেন্ট করেছে)';
  const name = String(input.customerName || '').trim();
  return `তুমি "${shop}" পেজের সেলসকর্মী। কাস্টমার ফেসবুক পোস্টে কমেন্ট করেছে। সেই কমেন্টের সরাসরি উত্তর দাও — কিওয়ার্ড ম্যাচের অপেক্ষা নয়।

JSON ছাড়া কিছু লিখবে না:
{
  "publicReply": "পোস্টে দেখা ছোট উত্তর, ১-২ বাক্য, কমেন্টের আসল জবাব",
  "inboxMessage": "ইনবক্সে পাঠানো পূর্ণ উত্তর, ২-৫ বাক্য"
}

নিয়ম:
- কাস্টমার যা জিজ্ঞেস/লিখেছে তার উত্তরই দিবে।
- দাম/স্টক/অফার শুধু পণ্যতালিকা বা FAQ থেকে। না জানলে অনুমান করবে না।
- নিজেকে এআই/বট বলবে না।
- পাবলিক রিপ্লাই সংক্ষিপ্ত রাখবে (সর্বোচ্চ ${COMMENT_PUBLIC_REPLY_MAX} অক্ষর)।
- ইনবক্স মেসেজে একই উত্তর একটু বিস্তারিত দিতে পারো (সর্বোচ্চ ${COMMENT_INBOX_REPLY_MAX} অক্ষর)।
- খালি/স্টিকার কমেন্ট হলে নম্রভাবে জিজ্ঞেস করবে কোন পণ্য লাগবে।

দোকানের তথ্য: ${String(input.shopDescription || '').trim() || 'নেই'}
কাস্টমারের নাম: ${name || 'অজানা'}
কমেন্ট: "${comment}"

পণ্যতালিকা:
${JSON.stringify(input.products || [], null, 2)}

FAQ:
${String(input.faqsText || '').trim() || 'নেই'}

${input.replyStyleBlock || ''}

${input.merchantCustomBlock || ''}`.trim();
}

export function parseCommentAiReplyJson(raw: string): { publicReply: string; inboxMessage: string } {
  const text = String(raw || '').trim();
  let publicReply = '';
  let inboxMessage = '';
  try {
    if (text.includes('{')) {
      const cleaned = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(cleaned);
      publicReply = clipCommentReply(parsed?.publicReply || parsed?.reply || '', COMMENT_PUBLIC_REPLY_MAX);
      inboxMessage = clipCommentReply(parsed?.inboxMessage || parsed?.message || parsed?.reply || '', COMMENT_INBOX_REPLY_MAX);
    }
  } catch {
    // plain text fallback below
  }
  if (!publicReply && !inboxMessage && text && !text.startsWith('{')) {
    const plain = clipCommentReply(text, COMMENT_INBOX_REPLY_MAX);
    inboxMessage = plain;
    publicReply = clipCommentReply(plain, COMMENT_PUBLIC_REPLY_MAX);
  }
  if (!publicReply && inboxMessage) publicReply = clipCommentReply(inboxMessage, COMMENT_PUBLIC_REPLY_MAX);
  if (!inboxMessage && publicReply) inboxMessage = publicReply;
  return { publicReply, inboxMessage };
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
