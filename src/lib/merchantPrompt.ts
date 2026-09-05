/**
 * Merchant "অতিরিক্ত নির্দেশনা" (customSystemPrompt) helpers.
 *
 * Default sales style (no emoji floods, no template summaries) used to be
 * labeled "never break" and placed AFTER the merchant text, so Gemini ignored
 * the merchant panel instructions. These helpers put merchant style first
 * while still protecting price/stock/identity safety rules.
 */

export const CUSTOM_PROMPT_MAX_CHARS = 8_000;

export const MERCHANT_STYLE_OVERRIDE_HINT = [
  '# রিপ্লাই স্টাইল (মার্চেন্ট নির্দেশনা প্রাধান্য)',
  'মার্চেন্টের অতিরিক্ত নির্দেশনা ডিফল্ট স্টাইলকে ওভাররাইড করে: ইমোজি, সাজানো ফরম্যাট, বুলেট/লাইন-ব্রেক, রিপ্লাই দৈর্ঘ্য, সম্বোধন, এবং অর্ডার কনফার্মেশনের সামারি টেমপ্লেট।',
  'ডিফল্ট "ইমোজি/বুলেট/হেডিং/টেমপ্লেট নিষেধ" এখানে প্রযোজ্য নয় — মার্চেন্ট যা লিখেছেন সেভাবেই রিপ্লাই সাজাবে।',
  'ব্যবসায়িক নিরাপত্তা ভাঙবে না: দরদাম ইঞ্জিনের ফ্লোরের নিচে দাম নয়, স্টক/পলিসি বানিয়ে বলা নয়, অনুমোদিত ব্যান্ডের বাইরে দাম নয়, ফোন-ঠিকানা ছাড়া অর্ডার কনফার্ম নয়, নিজেকে এআই/বট বলে স্বীকার নয়।',
].join('\n');

export const DEFAULT_MESSENGER_STYLE_RULES = [
  '# ডিফল্ট রিপ্লাই স্টাইল',
  'মানুষ যেভাবে মেসেঞ্জারে টাইপ করে সেভাবে লিখবে: ছোট ছোট সহজ বাক্য, কথ্য বাংলা।',
  'রোবটের মতো আনুষ্ঠানিক ভাষা, বুলেট লিস্ট, তারকা চিহ্ন (*), হেডিং, ইমোজির বন্যা বা টেমপ্লেট-টাইপ উত্তর দেবে না।',
].join('\n');

export function normalizeCustomSystemPrompt(raw: unknown, maxChars = CUSTOM_PROMPT_MAX_CHARS): string {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

export function hasMerchantCustomPrompt(raw: unknown): boolean {
  return Boolean(normalizeCustomSystemPrompt(raw));
}

export function buildMerchantCustomInstructionBlock(raw: unknown): string {
  const custom = normalizeCustomSystemPrompt(raw);
  if (!custom) return '';
  return [
    '# মার্চেন্টের অতিরিক্ত নির্দেশনা (ডিফল্ট স্টাইলের উপরে প্রাধান্য — অবশ্যই মানবে)',
    'নিচের নির্দেশনা আগের ডিফল্ট রিপ্লাই স্টাইলকে ওভাররাইড করে: ইমোজি, ফরম্যাটিং, বুলেট/লাইন-ব্রেক, রিপ্লাই দৈর্ঘ্য, সম্বোধন, এবং অর্ডার কনফার্মেশনের সামারি ফরম্যাট।',
    'এগুলো ব্যবসায়িক নিরাপত্তা নিয়ম (দরদাম ফ্লোর, স্টক/পলিসি বানিয়ে না বলা, অনুমোদিত ব্যান্ডের বাইরে দাম নয়, অর্ডারের ফোন-ঠিকানা যাচাই, নিজেকে এআই বলে স্বীকার না করা) ভাঙতে পারবে না।',
    '',
    custom,
  ].join('\n');
}

export function buildReplyStyleBlock(raw: unknown): string {
  return hasMerchantCustomPrompt(raw) ? MERCHANT_STYLE_OVERRIDE_HINT : DEFAULT_MESSENGER_STYLE_RULES;
}

export function pickFacebookProfileName(profile: {
  name?: unknown;
  first_name?: unknown;
  last_name?: unknown;
} | null | undefined): string {
  const full = String(profile?.name || '').trim();
  if (full) return full;
  return [profile?.first_name, profile?.last_name].map((part) => String(part || '').trim()).filter(Boolean).join(' ').trim();
}

export function resolveOrderCustomerName(input: {
  leadName?: unknown;
  facebookName?: unknown;
  senderId?: unknown;
}): string {
  const lead = String(input.leadName || '').trim();
  if (lead && !/^FB User\b/i.test(lead)) return lead;
  const facebookName = String(input.facebookName || '').trim();
  if (facebookName) return facebookName;
  const tail = String(input.senderId || '').replace(/\D/g, '').slice(-4);
  return tail ? `FB User (${tail})` : 'সম্মানিত গ্রাহক';
}
