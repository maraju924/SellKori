import { BusinessConfig, BusinessFeatures } from '../types';

export const DEFAULT_FEATURES: Required<
  Pick<
    BusinessFeatures,
    | 'aiEnabled'
    | 'messengerRepliesEnabled'
    | 'photoReplyEnabled'
    | 'voiceReplyEnabled'
    | 'chatSummaryEnabled'
    | 'negotiationEnabled'
    | 'upsellEnabled'
    | 'autoOrderEnabled'
    | 'inventoryEnabled'
    | 'imageDisplayEnabled'
    | 'reviewImagesEnabled'
    | 'orderTrackingEnabled'
    | 'faqEnabled'
    | 'invoicingEnabled'
    | 'autoCourierBookingEnabled'
    | 'broadcastingEnabled'
    | 'commentToInboxEnabled'
    | 'analyticsEnabled'
    | 'proactiveNotificationsEnabled'
    | 'humanHandoverEnabled'
    | 'quietHoursEnabled'
  >
> & Pick<BusinessFeatures, 'quietHoursStart' | 'quietHoursEnd' | 'offlineMessage'> = {
  aiEnabled: true,
  messengerRepliesEnabled: true,
  photoReplyEnabled: true,
  voiceReplyEnabled: true,
  chatSummaryEnabled: true,
  negotiationEnabled: true,
  upsellEnabled: true,
  autoOrderEnabled: true,
  inventoryEnabled: true,
  imageDisplayEnabled: true,
  reviewImagesEnabled: true,
  orderTrackingEnabled: true,
  faqEnabled: true,
  invoicingEnabled: true,
  autoCourierBookingEnabled: true,
  broadcastingEnabled: true,
  commentToInboxEnabled: true,
  analyticsEnabled: true,
  proactiveNotificationsEnabled: true,
  humanHandoverEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  offlineMessage: 'ধন্যবাদ! আমাদের সেলস টিম শীঘ্রই আপনার মেসেজের উত্তর দিবে।'
};

export type BooleanFeatureKey = Exclude<
  keyof typeof DEFAULT_FEATURES,
  'quietHoursStart' | 'quietHoursEnd' | 'offlineMessage'
>;

export type FeatureGroupId = 'ai' | 'sales' | 'experience' | 'ops';

export interface FeatureDefinition {
  key: BooleanFeatureKey;
  title: string;
  desc: string;
  impact: string;
  group: FeatureGroupId;
  tab?: string;
  danger?: boolean;
}

export const FEATURE_GROUPS: { id: FeatureGroupId; title: string; hint: string }[] = [
  { id: 'ai', title: 'এআই কোর ইঞ্জিন', hint: 'মেসেঞ্জার রিপ্লাই, মিডিয়া ও মেমোরি' },
  { id: 'sales', title: 'সেলস ও অর্ডার অটোমেশন', hint: 'দরদাম, আপসেল, অটো অর্ডার, স্টক' },
  { id: 'experience', title: 'কাস্টমার এক্সপেরিয়েন্স', hint: 'ছবি, ট্র্যাকিং, FAQ, হ্যান্ডওভার' },
  { id: 'ops', title: 'অপারেশনস ও গ্রোথ', hint: 'কুরিয়ার, ব্রডকাস্ট, কমেন্ট-ইনবক্স, অ্যানালিটিক্স' }
];

export const FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: 'aiEnabled',
    title: 'এআই অটো-রিপ্লাই ইঞ্জিন',
    desc: 'মেসেঞ্জার ও চ্যাটে কাস্টমারের প্রতিটি মেসেজে স্বয়ংক্রিয় এআই উত্তর।',
    impact: 'বন্ধ থাকলে বট কথা বলবে না',
    group: 'ai',
    tab: 'ai-control',
    danger: true
  },
  {
    key: 'messengerRepliesEnabled',
    title: 'মেসেঞ্জার আউটবাউন্ড রিপ্লাই',
    desc: 'ফেসবুকে কোনো অটো টেক্সট পাঠানো হবে কি না।',
    impact: 'বন্ধ = সম্পূর্ণ নীরব',
    group: 'ai',
    tab: 'messenger'
  },
  {
    key: 'photoReplyEnabled',
    title: 'ফটো মেসেজ বুঝে উত্তর',
    desc: 'কাস্টমার ছবি পাঠালে এআই ছবি দেখে উত্তর দিবে।',
    impact: 'পণ্য স্ক্রিনশট / পেমেন্ট প্রুফ',
    group: 'ai'
  },
  {
    key: 'voiceReplyEnabled',
    title: 'ভয়েস মেসেজ বুঝে উত্তর',
    desc: 'ভয়েস নোট শুনে টেক্সটের মতো সেলস উত্তর।',
    impact: 'অডিও ইনকামিং',
    group: 'ai'
  },
  {
    key: 'chatSummaryEnabled',
    title: 'চ্যাট মেমোরি ও সামারি',
    desc: 'প্রতি কাস্টমারের কথোপকথন মনে রাখে যাতে একই তথ্য বারবার না চায়।',
    impact: 'CRM + এআই মেমোরি',
    group: 'ai',
    tab: 'customers'
  },
  {
    key: 'negotiationEnabled',
    title: 'স্মার্ট দরদাম ইঞ্জিন',
    desc: 'Min Price পর্যন্ত ধাপে ধাপে দরদাম করবে। বন্ধ থাকলে ফিক্সড দাম।',
    impact: 'প্রাইসিং পলিসি',
    group: 'sales',
    tab: 'ai-control'
  },
  {
    key: 'upsellEnabled',
    title: '১/২/৩ পিস বান্ডেল আপসেল',
    desc: 'এক পিস চাইলে কম্বো/মেগা প্যাকেজ সাজেস্ট করবে।',
    impact: 'AOV বাড়ায়',
    group: 'sales',
    tab: 'products'
  },
  {
    key: 'autoOrderEnabled',
    title: 'অটো অর্ডার কনফার্ম',
    desc: 'নাম+ফোন+ঠিকানা পেলে Firestore-এ অর্ডার অটো তৈরি হবে।',
    impact: 'অর্ডার ডেস্ক',
    group: 'sales',
    tab: 'orders'
  },
  {
    key: 'inventoryEnabled',
    title: 'স্টক কাটা ও আউট-অফ-স্টক',
    desc: 'অর্ডার হলে স্টক কমবে; স্টক শূন্য হলে এআই বিক্রি করবে না।',
    impact: 'ক্যাটালগ স্টক',
    group: 'sales',
    tab: 'products'
  },
  {
    key: 'imageDisplayEnabled',
    title: 'চ্যাটে পণ্যের ছবি পাঠানো',
    desc: 'কাস্টমার চাইলে প্রোডাক্ট ছবি মেসেঞ্জারে যাবে।',
    impact: 'মেসেঞ্জার অ্যাটাচমেন্ট',
    group: 'experience',
    tab: 'products'
  },
  {
    key: 'reviewImagesEnabled',
    title: 'রিভিউ ও প্রুফ ছবি পাঠানো',
    desc: 'কাস্টমার রিভিউ/আনবক্সিং চাইলে প্রুফ ফটো যাবে।',
    impact: 'সোশ্যাল প্রুফ',
    group: 'experience',
    tab: 'products'
  },
  {
    key: 'orderTrackingEnabled',
    title: 'লাইভ অর্ডার ট্র্যাকিং',
    desc: 'কাস্টমার স্ট্যাটাস চাইলে সাম্প্রতিক অর্ডার ও ট্র্যাকিং বলবে।',
    impact: 'সাপোর্ট',
    group: 'experience',
    tab: 'orders'
  },
  {
    key: 'faqEnabled',
    title: 'পলিসি ও নলেজবেস',
    desc: 'FAQ থেকে ডেলিভারি, রিটার্ন, COD উত্তর দিবে।',
    impact: 'নলেজবেস',
    group: 'experience',
    tab: 'faqs'
  },
  {
    key: 'humanHandoverEnabled',
    title: 'হিউম্যান এজেন্ট হ্যান্ডওভার',
    desc: 'কাস্টমার মানুষ চাইলে ১ ঘণ্টা বট পজ হবে।',
    impact: 'লাইভ ইনবক্স',
    group: 'experience',
    tab: 'messenger'
  },
  {
    key: 'invoicingEnabled',
    title: 'অর্ডার মেমো ও ইনভয়েস',
    desc: 'অর্ডার কনফার্মে মেমো/ইনভয়েস রেফারেন্স দিবে।',
    impact: 'অর্ডার ডেস্ক',
    group: 'ops',
    tab: 'orders'
  },
  {
    key: 'autoCourierBookingEnabled',
    title: 'স্টেডফাস্ট অটো পার্সেল বুক',
    desc: 'অর্ডার হলে কুরিয়ারে পার্সেল অটো বুক হবে।',
    impact: 'কুরিয়ার API',
    group: 'ops',
    tab: 'integrations'
  },
  {
    key: 'broadcastingEnabled',
    title: 'মেসেঞ্জার ব্রডকাস্টিং',
    desc: '২৪ ঘণ্টার উইন্ডোর ভিতরে অফার/রিমার্কেটিং ক্যাম্পেইন পাঠানো যাবে।',
    impact: 'গ্রোথ',
    group: 'ops',
    tab: 'broadcasting'
  },
  {
    key: 'commentToInboxEnabled',
    title: 'কমেন্ট-টু-ইনবক্স',
    desc: 'পোস্টে দাম/ইনবক্স কমেন্ট এলে প্রাইভেট মেসেজ খুলে সেলস শুরু করবে।',
    impact: 'ফিড কমেন্ট → মেসেঞ্জার',
    group: 'ops',
    tab: 'broadcasting'
  },
  {
    key: 'analyticsEnabled',
    title: 'অ্যানালিটিক্স ও সেলস ড্যাশবোর্ড',
    desc: 'ওভারভিউতে সেলস চার্ট ও KPI দেখাবে।',
    impact: 'ড্যাশবোর্ড',
    group: 'ops',
    tab: 'analytics'
  },
  {
    key: 'proactiveNotificationsEnabled',
    title: 'অ্যাবান্ডন্ড কার্ট রিকভারি',
    desc: 'অর্ডার অসম্পূর্ণ থাকলে ফলো-আপ মেসেজ যাবে।',
    impact: 'ক্রন জব',
    group: 'ops'
  },
  {
    key: 'quietHoursEnabled',
    title: 'নীরব সময় (Quiet Hours)',
    desc: 'নির্ধারিত সময়ে এআই অফলাইন মেসেজ দিবে, অর্ডার নেবে না।',
    impact: 'শিডিউল',
    group: 'ops'
  }
];

export interface FeaturePreset {
  id: string;
  title: string;
  desc: string;
  patch: Partial<BusinessFeatures>;
}

export const FEATURE_PRESETS: FeaturePreset[] = [
  {
    id: 'sales',
    title: 'ফুল সেলস মোড',
    desc: 'এআই, দরদাম, অটো অর্ডার, ছবি — সব চালু',
    patch: { ...DEFAULT_FEATURES, quietHoursEnabled: false }
  },
  {
    id: 'support',
    title: 'সাপোর্ট মোড',
    desc: 'ট্র্যাকিং ও FAQ চালু, দরদাম/অটো অর্ডার বন্ধ',
    patch: {
      aiEnabled: true,
      messengerRepliesEnabled: true,
      negotiationEnabled: false,
      upsellEnabled: false,
      autoOrderEnabled: false,
      autoCourierBookingEnabled: false,
      broadcastingEnabled: false,
      commentToInboxEnabled: true,
      orderTrackingEnabled: true,
      faqEnabled: true,
      humanHandoverEnabled: true,
      quietHoursEnabled: false
    }
  },
  {
    id: 'manual',
    title: 'ম্যানুয়াল ইনবক্স',
    desc: 'বট নীরব — আপনি নিজে রিপ্লাই দিবেন',
    patch: {
      aiEnabled: false,
      messengerRepliesEnabled: false,
      autoOrderEnabled: false,
      autoCourierBookingEnabled: false,
      broadcastingEnabled: false,
      commentToInboxEnabled: false,
      proactiveNotificationsEnabled: false,
      quietHoursEnabled: false
    }
  },
  {
    id: 'night',
    title: 'নাইট সেফ মোড',
    desc: 'রাত ১০টা–সকাল ৮টা নীরব, দিনে সেলস চালু',
    patch: {
      ...DEFAULT_FEATURES,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      autoOrderEnabled: true
    }
  }
];

export function mergeFeatures(raw?: BusinessFeatures | null): BusinessFeatures {
  return {
    ...DEFAULT_FEATURES,
    ...(raw || {})
  };
}

export function isFeatureEnabled(
  features: BusinessFeatures | null | undefined,
  key: BooleanFeatureKey
): boolean {
  const merged = mergeFeatures(features);
  return merged[key] !== false;
}

export function featuresOf(business?: Pick<BusinessConfig, 'features'> | null): BusinessFeatures {
  return mergeFeatures(business?.features);
}

export function countEnabled(features: BusinessFeatures | null | undefined): { on: number; total: number } {
  const merged = mergeFeatures(features);
  const keys = FEATURE_CATALOG.map(f => f.key);
  const on = keys.filter(k => merged[k] !== false).length;
  return { on, total: keys.length };
}

export function parseMinutes(value: string | undefined, fallback: string): number {
  const raw = value && /^\d{1,2}:\d{2}$/.test(value.trim()) ? value.trim() : fallback;
  const [h, m] = raw.split(':').map(Number);
  const hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0;
  const minute = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  return hour * 60 + minute;
}

export function dhakaMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export function isQuietHoursNow(features: BusinessFeatures | null | undefined, now = new Date()): boolean {
  const merged = mergeFeatures(features);
  if (merged.quietHoursEnabled !== true) return false;
  const current = dhakaMinutes(now);
  const start = parseMinutes(merged.quietHoursStart, '22:00');
  const end = parseMinutes(merged.quietHoursEnd, '08:00');
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function shouldRunAi(features: BusinessFeatures | null | undefined, now = new Date()): boolean {
  return isFeatureEnabled(features, 'aiEnabled') && !isQuietHoursNow(features, now);
}

export function buildFeaturePromptBlock(features: BusinessFeatures | null | undefined): string {
  const f = mergeFeatures(features);
  const lines: string[] = ['# মার্চেন্ট ফিচার সুইচবোর্ড (কঠোরভাবে মানবে)'];

  if (f.negotiationEnabled === false) {
    lines.push('- দরদাম নিষিদ্ধ। ক্যাটালগে লেখা বিক্রয় মূল্যই চূড়ান্ত। minPrice পর্যন্তও নামবে না।');
  } else {
    lines.push('- দরদাম অনুমোদিত, কিন্তু কখনোই minPrice-এর নিচে নামবে না।');
  }

  if (f.upsellEnabled === false) {
    lines.push('- বান্ডেল/আপসেল অফার জোর করে দিবে না, কাস্টমার না চাইলে চুপ।');
  }

  if (f.autoOrderEnabled === false) {
    lines.push('- should_create_order সবসময় false। অর্ডার কনফার্ম করতে মার্চেন্টের অপেক্ষা করতে বলো।');
  }

  if (f.inventoryEnabled === false) {
    lines.push('- স্টক কাটা/আউট-অফ-স্টক লজিক স্কিপ করো, স্টক নিয়ে নিষেধাজ্ঞা দিবে না।');
  }

  if (f.imageDisplayEnabled === false) {
    lines.push('- show_product_image সবসময় false। ছবি পাঠাবে না, লিখে বর্ণনা দাও।');
  }

  if (f.reviewImagesEnabled === false) {
    lines.push('- show_review_images সবসময় false।');
  }

  if (f.orderTrackingEnabled === false) {
    lines.push('- অর্ডার স্ট্যাটাস/ট্র্যাকিং বলবে না। সাপোর্ট টিমের সাথে যোগাযোগ করতে বলো।');
  }

  if (f.faqEnabled === false) {
    lines.push('- স্টোর FAQ ব্যবহার করবে না; সাধারণভাবে নম্র উত্তর দাও।');
  }

  if (f.humanHandoverEnabled === false) {
    lines.push('- হিউম্যান এজেন্ট হ্যান্ডওভার অফার করবে না, নিজেই সাহায্য করতে চেষ্টা করো।');
  }

  if (f.invoicingEnabled === false) {
    lines.push('- ইনভয়েস/মেমো নম্বর উল্লেখ করবে না।');
  }

  if (f.chatSummaryEnabled === false) {
    lines.push('- দীর্ঘ সামারি লিখবে না; summary খালি রাখতে পারো।');
  }

  return lines.join('\n');
}
