export interface LandingNavLink {
  label: string;
  href: string;
}

export interface LandingStat {
  value: string;
  label: string;
  sub: string;
}

export interface LandingFeature {
  title: string;
  description: string;
  bullets: string[];
}

export interface LandingStep {
  title: string;
  description: string;
  tag: string;
}

export interface LandingComparisonRow {
  feature: string;
  traditional: string;
  buttonBot: string;
  sellkori: string;
}

export interface LandingTestimonial {
  name: string;
  role: string;
  store: string;
  result: string;
  quote: string;
}

export interface LandingFaq {
  q: string;
  a: string;
}

export interface LandingDemo {
  storeName: string;
  productName: string;
  regularPrice: number;
  offerPrice: number;
  prompts: string[];
}

export interface LandingContent {
  brandName: string;
  brandSuffix: string;
  tagline: string;
  promo: string;
  heroEyebrow: string;
  heroHeadline: string;
  heroHeadlineAccent: string;
  heroSubheadline: string;
  primaryCta: string;
  secondaryCta: string;
  trustItems: string[];
  stats: LandingStat[];
  featuresEyebrow: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: LandingFeature[];
  comparisonEyebrow: string;
  comparisonTitle: string;
  comparisonSubtitle: string;
  comparisonColumns: [string, string, string];
  comparisonRows: LandingComparisonRow[];
  stepsEyebrow: string;
  stepsTitle: string;
  stepsSubtitle: string;
  steps: LandingStep[];
  pricingEyebrow: string;
  pricingTitle: string;
  pricingSubtitle: string;
  tokensPerConversation: number;
  conversionRate: number;
  avgOrderValue: number;
  testimonialsEyebrow: string;
  testimonialsTitle: string;
  testimonials: LandingTestimonial[];
  faqEyebrow: string;
  faqTitle: string;
  faqs: LandingFaq[];
  ctaEyebrow: string;
  ctaTitle: string;
  ctaSubtitle: string;
  footerBlurb: string;
  footerEmail: string;
  footerPhone: string;
  footerNote: string;
  integrations: string[];
  demo: LandingDemo;
  nav: LandingNavLink[];
}

export interface PublicBillingConfig {
  tokenRatePerLakh: number;
  monthlyServerCost: number;
  freeTrialTokens: number;
}

export interface PublicSiteConfig {
  globalAnnouncement: string;
  maintenanceMode: boolean;
  billing: PublicBillingConfig;
  landing: LandingContent;
}

const DEFAULT_BILLING: PublicBillingConfig = {
  tokenRatePerLakh: 20,
  monthlyServerCost: 1000,
  freeTrialTokens: 100000,
};

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  brandName: 'Sell',
  brandSuffix: 'Kori',
  tagline: 'Messenger commerce platform',
  promo: 'নতুন অ্যাকাউন্টে {freeTrial} ফ্রি টোকেন — ক্রেডিট কার্ডের প্রয়োজন নেই।',
  heroEyebrow: 'Facebook Messenger · ২৪/৭ সেলস অপারেশন',
  heroHeadline: 'ইনবক্স থেকে অর্ডার পর্যন্ত',
  heroHeadlineAccent: 'একটি নিয়ন্ত্রিত সেলস সিস্টেম।',
  heroSubheadline:
    'কাস্টমার বাংলা বা বাংলিশে লিখুক, প্ল্যাটফর্ম উত্তর দেয়, দরদাম সীমা রক্ষা করে, অর্ডার সংগ্রহ করে এবং কুরিয়ার ও বিজ্ঞাপন ইভেন্ট একই প্রবাহে রাখে।',
  primaryCta: 'অ্যাকাউন্ট খুলুন',
  secondaryCta: 'প্ল্যাটফর্ম দেখুন',
  trustItems: [
    'ক্রেডিট কার্ড ছাড়া শুরু',
    'পেজ ওয়েবহুক সংযোগ',
    'bKash / Nagad রিচার্জ',
  ],
  stats: [
    { value: '২৪/৭', label: 'ইনবক্স কভারেজ', sub: 'মানব শিফটের বাইরেও উত্তর' },
    { value: 'Min Price', label: 'দরদাম নিয়ন্ত্রণ', sub: 'নির্ধারিত সীমার নিচে নামে না' },
    { value: 'CAPI', label: 'সার্ভার-সাইড ইভেন্ট', sub: 'Purchase ট্র্যাকিং' },
    { value: 'API', label: 'কুরিয়ার সংযোগ', sub: 'Steadfast বুকিং' },
  ],
  featuresEyebrow: 'সক্ষমতা',
  featuresTitle: 'যা অপারেশনে দৈনন্দিন প্রয়োজন',
  featuresSubtitle: 'চ্যাট, মূল্য, অর্ডার, কুরিয়ার ও বিজ্ঞাপন ডেটা একই প্ল্যাটফর্মে।',
  features: [
    {
      title: 'বাংলা ও বাংলিশ কথোপকথন',
      description: 'কাস্টমার যে ভাষায় লেখে, সেই ধারায় সংক্ষিপ্ত ও স্পষ্ট উত্তর। স্টোরের পলিসি ও ক্যাটালগকে ভিত্তি ধরে।',
      bullets: ['প্রমিত বাংলা ও বাংলিশ', 'ফটো ও ভয়েস ইনপুট', 'জানা তথ্য পুনরায় না চাওয়া'],
    },
    {
      title: 'নিয়ন্ত্রিত দরদাম',
      description: 'প্রতি পণ্যে রেগুলার ও সর্বনিম্ন মূল্য। ছাড় আলোচনা হয়, নির্ধারিত সীমার নিচে যায় না।',
      bullets: ['Min Price লক', 'কোয়ান্টিটি বান্ডেল', 'অনুমানে দাম না বলা'],
    },
    {
      title: 'চ্যাট থেকে অর্ডার',
      description: 'নাম, ১১ ডিজিট মোবাইল ও ঠিকানা চ্যাটের ভিতরেই সংগ্রহ। কনফার্মের পর ডিজিটাল মেমো।',
      bullets: ['ফোন ভ্যালিডেশন', 'ডেলিভারি চার্জ হিসাব', 'ড্যাশবোর্ডে অর্ডার লগ'],
    },
    {
      title: 'কুরিয়ার ও পেমেন্ট',
      description: 'Steadfast বুকিং এবং Zinipay-এর মাধ্যমে টোকেন রিচার্জ একই অপারেশন ফ্লোতে।',
      bullets: ['ট্র্যাকিং কোড', 'bKash / Nagad / Rocket', 'ওয়ালেট ব্যালেন্স'],
    },
    {
      title: 'Meta Conversion API',
      description: 'ইনবক্স সেল সার্ভার থেকে Purchase ইভেন্ট হিসেবে মেটায় যায়, বিজ্ঞাপন অপটিমাইজেশনের জন্য।',
      bullets: ['Lead থেকে Purchase', 'ইভেন্ট ডিডুপ', 'ম্যাচ কোয়ালিটি'],
    },
    {
      title: 'মাল্টি-পেজ CRM',
      description: 'কাস্টমার, অর্ডার ও পেজ সংযোগ এক ড্যাশবোর্ডে। হিস্ট্রি হারিয়ে যায় না।',
      bullets: ['লিড স্তর', 'অর্ডার স্ট্যাটাস', 'পেজ টোকেন'],
    },
  ],
  comparisonEyebrow: 'তুলনা',
  comparisonTitle: 'ম্যানুয়াল ইনবক্স, বাটন বট, এবং SellKori',
  comparisonSubtitle: 'একই কাজ তিন পদ্ধতিতে কীভাবে সম্পন্ন হয়।',
  comparisonColumns: ['ম্যানুয়াল সেলস', 'বাটন বট', 'SellKori'],
  comparisonRows: [
    {
      feature: 'উত্তরের সময়',
      traditional: 'মিনিট থেকে ঘণ্টা',
      buttonBot: 'তাৎক্ষণিক, কিন্তু ফ্রি-টেক্সটে আটকে যায়',
      sellkori: 'কয়েক সেকেন্ডে পূর্ণ উত্তর',
    },
    {
      feature: 'দরদাম',
      traditional: 'হাতে; ভুল ছাড়ের ঝুঁকি',
      buttonBot: 'নেই',
      sellkori: 'Min Price রেখে ধাপে ধাপে আলোচনা',
    },
    {
      feature: 'ভাষা',
      traditional: 'মানুষ বোঝে, ধীর',
      buttonBot: 'নির্দিষ্ট কিওয়ার্ড',
      sellkori: 'বাংলা ও বাংলিশ',
    },
    {
      feature: 'অর্ডার মেমো',
      traditional: 'কপি-পেস্ট / এক্সেল',
      buttonBot: 'বাহ্যিক ফর্ম',
      sellkori: 'চ্যাট থেকে স্বয়ংক্রিয় ইনভয়েস',
    },
    {
      feature: 'কুরিয়ার',
      traditional: 'প্যানেলে ম্যানুয়াল এন্ট্রি',
      buttonBot: 'নেই',
      sellkori: 'Steadfast API বুকিং',
    },
    {
      feature: 'বিজ্ঞাপন ইভেন্ট',
      traditional: 'ইনবক্স সেল ট্র্যাক হয় না',
      buttonBot: 'শুধু ব্রাউজার পিক্সেল',
      sellkori: 'সার্ভার-সাইড CAPI Purchase',
    },
  ],
  stepsEyebrow: 'প্রক্রিয়া',
  stepsTitle: 'চার ধাপে চালু',
  stepsSubtitle: 'কোডিং ছাড়াই পেজের ইনবক্সকে অপারেশন সিস্টেমে রূপান্তর।',
  steps: [
    { title: 'অ্যাকাউন্ট তৈরি', description: 'Google দিয়ে প্রবেশ করলে {freeTrial} টোকেন দিয়ে ট্রায়াল শুরু হয়।', tag: 'প্রবেশ' },
    { title: 'ক্যাটালগ ও মূল্য', description: 'পণ্য, ছবি, রেগুলার মূল্য ও সর্বনিম্ন দরদামের সীমা যোগ করুন।', tag: 'ক্যাটালগ' },
    { title: 'পেজ সংযোগ', description: 'Messenger ওয়েবহুক যুক্ত করুন। প্রয়োজনে ম্যানুয়াল সাবস্ক্রিপশনের নির্দেশনা দেওয়া হয়।', tag: 'সংযোগ' },
    { title: 'অপারেশন চালু', description: 'চ্যাট, অর্ডার ও কুরিয়ার এক ড্যাশবোর্ডে পর্যবেক্ষণ করুন।', tag: 'চালু' },
  ],
  pricingEyebrow: 'মূল্য',
  pricingTitle: 'ব্যবহার অনুযায়ী টোকেন',
  pricingSubtitle: 'প্রতি ১,০০,০০০ টোকেন {tokenRate} টাকা। মাসিক প্ল্যাটফর্ম ফি {serverFee} টাকা।',
  tokensPerConversation: 400,
  conversionRate: 18,
  avgOrderValue: 1200,
  testimonialsEyebrow: 'ফলাফল',
  testimonialsTitle: 'অপারেশন দল যা পরিবর্তন দেখেছে',
  testimonials: [
    {
      name: 'তুষার আহমেদ',
      role: 'ফাউন্ডার',
      store: 'Dhaka Dapper',
      result: 'রাতের অর্ডার ধরা যায়',
      quote: 'বিজ্ঞাপনের মেসেজ রাতে আসত, সকালে কাস্টমার আর সাড়া দিত না। এখন ইনবক্স শিফটের বাইরেও অর্ডার সম্পন্ন হয়।',
    },
    {
      name: 'নাদিয়া ইসলাম',
      role: 'স্বত্বাধিকারী',
      store: 'Pure Glow Cosmetics',
      result: 'ঠিকানা ভুল কমেছে',
      quote: 'পণ্যের প্রশ্ন ও ঠিকানা সংগ্রহ একই কথোপকথনে হয়। কুরিয়ার এন্ট্রির সময় বাঁচে।',
    },
    {
      name: 'মাহির ফয়সাল',
      role: 'কো-ফাউন্ডার',
      store: 'Gadget Vault BD',
      result: 'অ্যাড ইভেন্ট মিলে',
      quote: 'ইনবক্স Purchase CAPI-তে যাওয়ায় ক্যাম্পেইন অপটিমাইজেশন আগের চেয়ে নির্ভরযোগ্য।',
    },
  ],
  faqEyebrow: 'প্রশ্ন',
  faqTitle: 'প্ল্যাটফর্ম সম্পর্কে',
  faqs: [
    {
      q: 'SellKori কী?',
      a: 'Facebook Messenger ইনবক্সকে সেলস অপারেশনে রূপান্তরের প্ল্যাটফর্ম। ওয়েবহুকের মাধ্যমে পেজ যুক্ত হয়; চ্যাট, অর্ডার, কুরিয়ার ও বিজ্ঞাপন ইভেন্ট একত্রে থাকে।',
    },
    {
      q: 'এআই কি লসে বিক্রি করতে পারে?',
      a: 'না। প্রতি পণ্যে সর্বনিম্ন মূল্য সেট করা যায়। আলোচনা হয়, সেই সীমার নিচে যায় না।',
    },
    {
      q: 'অর্ডার কীভাবে আসে?',
      a: 'কাস্টমার চ্যাটে পণ্য নিশ্চিত করে নাম, মোবাইল ও ঠিকানা দিলে অর্ডার ড্যাশবোর্ডে জমা হয়। সেখান থেকে কুরিয়ার বুকিং করা যায়।',
    },
    {
      q: 'টোকেন খরচ কীভাবে হিসাব হয়?',
      a: 'প্রতি ১,০০,০০০ টোকেন {tokenRate} টাকা। গড়ে একটি পূর্ণ কথোপকথনে কয়েকশ টোকেন লাগে। ব্যালেন্স শেষ হলে কেন্দ্রীয় এআই থেমে যায়।',
    },
    {
      q: 'ওয়েবসাইট কি বাধ্যতামূলক?',
      a: 'না। একটি Facebook পেজই যথেষ্ট। পাবলিক চ্যাট লিংক আলাদাভাবেও ব্যবহার করা যায়।',
    },
    {
      q: 'পেমেন্ট কীভাবে হয়?',
      a: 'মার্চেন্ট ওয়ালেট Zinipay-এর মাধ্যমে bKash, Nagad, Rocket বা কার্ডে রিচার্জ হয়।',
    },
  ],
  ctaEyebrow: 'শুরু',
  ctaTitle: 'ইনবক্সকে অপারেশন সিস্টেম করুন',
  ctaSubtitle: '{freeTrial} টোকেন দিয়ে ট্রায়াল। সেটআপের পর পেজ সংযোগ করলেই কথোপকথন রেকর্ড হতে শুরু করে।',
  footerBlurb: 'বাংলাদেশি ই-কমার্স দলের জন্য Messenger সেলস অবকাঠামো।',
  footerEmail: 'support@sellkori.com',
  footerPhone: '',
  footerNote: 'SellKori · সর্বস্বত্ব সংরক্ষিত',
  integrations: [
    'Facebook Messenger',
    'Meta Conversion API',
    'Steadfast Courier',
    'Zinipay',
    'Google Gemini',
  ],
  demo: {
    storeName: 'ঢাকা অ্যাটেলিয়ার',
    productName: 'কটন পাঞ্জাবি',
    regularPrice: 1450,
    offerPrice: 1250,
    prompts: ['দাম কত?', 'একটু কম রাখেন', 'অর্ডার করতে চাই'],
  },
  nav: [
    { label: 'সক্ষমতা', href: '#features' },
    { label: 'ডেমো', href: '#demo' },
    { label: 'তুলনা', href: '#comparison' },
    { label: 'প্রক্রিয়া', href: '#how-it-works' },
    { label: 'মূল্য', href: '#pricing' },
    { label: 'প্রশ্ন', href: '#faq' },
  ],
};

function clip(value: unknown, max: number): string {
  return String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function clipList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clip(item, maxLen)).filter(Boolean).slice(0, maxItems);
}

export function formatBnNumber(value: number): string {
  const safe = Number.isFinite(value) ? Math.round(value) : 0;
  return String(safe).replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
}

export function interpolateCopy(text: string, billing: PublicBillingConfig, brand = 'SellKori'): string {
  return String(text || '')
    .replaceAll('{freeTrial}', formatBnNumber(billing.freeTrialTokens))
    .replaceAll('{tokenRate}', formatBnNumber(billing.tokenRatePerLakh))
    .replaceAll('{serverFee}', formatBnNumber(billing.monthlyServerCost))
    .replaceAll('{brand}', brand);
}

function mergeFeature(raw: any, fallback: LandingFeature): LandingFeature {
  return {
    title: clip(raw?.title, 80) || fallback.title,
    description: clip(raw?.description, 400) || fallback.description,
    bullets: clipList(raw?.bullets, 6, 120).length ? clipList(raw?.bullets, 6, 120) : fallback.bullets,
  };
}

export function sanitizeLandingContent(raw: unknown, billing: PublicBillingConfig = DEFAULT_BILLING): LandingContent {
  const source = raw && typeof raw === 'object' ? raw as Record<string, any> : {};
  const brandName = clip(source.brandName, 24) || DEFAULT_LANDING_CONTENT.brandName;
  const brandSuffix = clip(source.brandSuffix, 24) || DEFAULT_LANDING_CONTENT.brandSuffix;
  const brand = `${brandName}${brandSuffix}`;
  const interpolate = (value: string) => interpolateCopy(value, billing, brand);

  const nav = Array.isArray(source.nav) && source.nav.length
    ? source.nav.slice(0, 8).map((item: any, index: number) => ({
      label: clip(item?.label, 32) || DEFAULT_LANDING_CONTENT.nav[index]?.label || 'লিংক',
      href: clip(item?.href, 64) || DEFAULT_LANDING_CONTENT.nav[index]?.href || '#',
    }))
    : DEFAULT_LANDING_CONTENT.nav;

  const stats = Array.isArray(source.stats) && source.stats.length
    ? source.stats.slice(0, 4).map((item: any, index: number) => ({
      value: interpolate(clip(item?.value, 24) || DEFAULT_LANDING_CONTENT.stats[index]?.value || ''),
      label: interpolate(clip(item?.label, 48) || DEFAULT_LANDING_CONTENT.stats[index]?.label || ''),
      sub: interpolate(clip(item?.sub, 80) || DEFAULT_LANDING_CONTENT.stats[index]?.sub || ''),
    }))
    : DEFAULT_LANDING_CONTENT.stats.map((item) => ({
      ...item,
      value: interpolate(item.value),
      label: interpolate(item.label),
      sub: interpolate(item.sub),
    }));

  const features = Array.isArray(source.features) && source.features.length
    ? source.features.slice(0, 8).map((item: any, index: number) =>
      mergeFeature(item, DEFAULT_LANDING_CONTENT.features[index] || DEFAULT_LANDING_CONTENT.features[0]))
    : DEFAULT_LANDING_CONTENT.features;

  const steps = Array.isArray(source.steps) && source.steps.length
    ? source.steps.slice(0, 6).map((item: any, index: number) => ({
      title: clip(item?.title, 80) || DEFAULT_LANDING_CONTENT.steps[index]?.title || '',
      description: interpolate(clip(item?.description, 280) || DEFAULT_LANDING_CONTENT.steps[index]?.description || ''),
      tag: clip(item?.tag, 24) || DEFAULT_LANDING_CONTENT.steps[index]?.tag || '',
    }))
    : DEFAULT_LANDING_CONTENT.steps.map((item) => ({ ...item, description: interpolate(item.description) }));

  const comparisonRows = Array.isArray(source.comparisonRows) && source.comparisonRows.length
    ? source.comparisonRows.slice(0, 10).map((item: any, index: number) => ({
      feature: clip(item?.feature, 80) || DEFAULT_LANDING_CONTENT.comparisonRows[index]?.feature || '',
      traditional: clip(item?.traditional, 180) || DEFAULT_LANDING_CONTENT.comparisonRows[index]?.traditional || '',
      buttonBot: clip(item?.buttonBot, 180) || DEFAULT_LANDING_CONTENT.comparisonRows[index]?.buttonBot || '',
      sellkori: clip(item?.sellkori, 180) || DEFAULT_LANDING_CONTENT.comparisonRows[index]?.sellkori || '',
    }))
    : DEFAULT_LANDING_CONTENT.comparisonRows;

  const testimonials = Array.isArray(source.testimonials) && source.testimonials.length
    ? source.testimonials.slice(0, 6).map((item: any, index: number) => ({
      name: clip(item?.name, 48) || DEFAULT_LANDING_CONTENT.testimonials[index]?.name || '',
      role: clip(item?.role, 48) || DEFAULT_LANDING_CONTENT.testimonials[index]?.role || '',
      store: clip(item?.store, 64) || DEFAULT_LANDING_CONTENT.testimonials[index]?.store || '',
      result: clip(item?.result, 48) || DEFAULT_LANDING_CONTENT.testimonials[index]?.result || '',
      quote: clip(item?.quote, 360) || DEFAULT_LANDING_CONTENT.testimonials[index]?.quote || '',
    }))
    : DEFAULT_LANDING_CONTENT.testimonials;

  const faqs = Array.isArray(source.faqs) && source.faqs.length
    ? source.faqs.slice(0, 12).map((item: any, index: number) => ({
      q: interpolate(clip(item?.q, 160) || DEFAULT_LANDING_CONTENT.faqs[index]?.q || ''),
      a: interpolate(clip(item?.a, 600) || DEFAULT_LANDING_CONTENT.faqs[index]?.a || ''),
    }))
    : DEFAULT_LANDING_CONTENT.faqs.map((item) => ({ q: interpolate(item.q), a: interpolate(item.a) }));

  const demoRaw = source.demo && typeof source.demo === 'object' ? source.demo : {};

  return {
    brandName,
    brandSuffix,
    tagline: clip(source.tagline, 80) || DEFAULT_LANDING_CONTENT.tagline,
    promo: interpolate(clip(source.promo, 180) || DEFAULT_LANDING_CONTENT.promo),
    heroEyebrow: interpolate(clip(source.heroEyebrow, 80) || DEFAULT_LANDING_CONTENT.heroEyebrow),
    heroHeadline: interpolate(clip(source.heroHeadline, 120) || DEFAULT_LANDING_CONTENT.heroHeadline),
    heroHeadlineAccent: interpolate(clip(source.heroHeadlineAccent, 120) || DEFAULT_LANDING_CONTENT.heroHeadlineAccent),
    heroSubheadline: interpolate(clip(source.heroSubheadline, 400) || DEFAULT_LANDING_CONTENT.heroSubheadline),
    primaryCta: interpolate(clip(source.primaryCta, 48) || DEFAULT_LANDING_CONTENT.primaryCta),
    secondaryCta: interpolate(clip(source.secondaryCta, 48) || DEFAULT_LANDING_CONTENT.secondaryCta),
    trustItems: clipList(source.trustItems, 4, 64).length
      ? clipList(source.trustItems, 4, 64).map((item) => interpolate(item))
      : DEFAULT_LANDING_CONTENT.trustItems,
    stats,
    featuresEyebrow: clip(source.featuresEyebrow, 32) || DEFAULT_LANDING_CONTENT.featuresEyebrow,
    featuresTitle: interpolate(clip(source.featuresTitle, 120) || DEFAULT_LANDING_CONTENT.featuresTitle),
    featuresSubtitle: interpolate(clip(source.featuresSubtitle, 240) || DEFAULT_LANDING_CONTENT.featuresSubtitle),
    features,
    comparisonEyebrow: clip(source.comparisonEyebrow, 32) || DEFAULT_LANDING_CONTENT.comparisonEyebrow,
    comparisonTitle: interpolate(clip(source.comparisonTitle, 120) || DEFAULT_LANDING_CONTENT.comparisonTitle),
    comparisonSubtitle: interpolate(clip(source.comparisonSubtitle, 240) || DEFAULT_LANDING_CONTENT.comparisonSubtitle),
    comparisonColumns: [
      clip(source.comparisonColumns?.[0], 32) || DEFAULT_LANDING_CONTENT.comparisonColumns[0],
      clip(source.comparisonColumns?.[1], 32) || DEFAULT_LANDING_CONTENT.comparisonColumns[1],
      clip(source.comparisonColumns?.[2], 32) || DEFAULT_LANDING_CONTENT.comparisonColumns[2],
    ],
    comparisonRows,
    stepsEyebrow: clip(source.stepsEyebrow, 32) || DEFAULT_LANDING_CONTENT.stepsEyebrow,
    stepsTitle: interpolate(clip(source.stepsTitle, 120) || DEFAULT_LANDING_CONTENT.stepsTitle),
    stepsSubtitle: interpolate(clip(source.stepsSubtitle, 240) || DEFAULT_LANDING_CONTENT.stepsSubtitle),
    steps,
    pricingEyebrow: clip(source.pricingEyebrow, 32) || DEFAULT_LANDING_CONTENT.pricingEyebrow,
    pricingTitle: interpolate(clip(source.pricingTitle, 120) || DEFAULT_LANDING_CONTENT.pricingTitle),
    pricingSubtitle: interpolate(clip(source.pricingSubtitle, 280) || DEFAULT_LANDING_CONTENT.pricingSubtitle),
    tokensPerConversation: Math.min(5000, Math.max(50, Number(source.tokensPerConversation) || DEFAULT_LANDING_CONTENT.tokensPerConversation)),
    conversionRate: Math.min(80, Math.max(1, Number(source.conversionRate) || DEFAULT_LANDING_CONTENT.conversionRate)),
    avgOrderValue: Math.min(100000, Math.max(100, Number(source.avgOrderValue) || DEFAULT_LANDING_CONTENT.avgOrderValue)),
    testimonialsEyebrow: clip(source.testimonialsEyebrow, 32) || DEFAULT_LANDING_CONTENT.testimonialsEyebrow,
    testimonialsTitle: interpolate(clip(source.testimonialsTitle, 120) || DEFAULT_LANDING_CONTENT.testimonialsTitle),
    testimonials,
    faqEyebrow: clip(source.faqEyebrow, 32) || DEFAULT_LANDING_CONTENT.faqEyebrow,
    faqTitle: interpolate(clip(source.faqTitle, 120) || DEFAULT_LANDING_CONTENT.faqTitle),
    faqs,
    ctaEyebrow: clip(source.ctaEyebrow, 32) || DEFAULT_LANDING_CONTENT.ctaEyebrow,
    ctaTitle: interpolate(clip(source.ctaTitle, 120) || DEFAULT_LANDING_CONTENT.ctaTitle),
    ctaSubtitle: interpolate(clip(source.ctaSubtitle, 280) || DEFAULT_LANDING_CONTENT.ctaSubtitle),
    footerBlurb: interpolate(clip(source.footerBlurb, 240) || DEFAULT_LANDING_CONTENT.footerBlurb),
    footerEmail: clip(source.footerEmail, 80) || DEFAULT_LANDING_CONTENT.footerEmail,
    footerPhone: clip(source.footerPhone, 32),
    footerNote: interpolate(clip(source.footerNote, 80) || DEFAULT_LANDING_CONTENT.footerNote),
    integrations: clipList(source.integrations, 8, 48).length
      ? clipList(source.integrations, 8, 48)
      : DEFAULT_LANDING_CONTENT.integrations,
    demo: {
      storeName: clip(demoRaw.storeName, 48) || DEFAULT_LANDING_CONTENT.demo.storeName,
      productName: clip(demoRaw.productName, 48) || DEFAULT_LANDING_CONTENT.demo.productName,
      regularPrice: Math.min(100000, Math.max(1, Number(demoRaw.regularPrice) || DEFAULT_LANDING_CONTENT.demo.regularPrice)),
      offerPrice: Math.min(100000, Math.max(1, Number(demoRaw.offerPrice) || DEFAULT_LANDING_CONTENT.demo.offerPrice)),
      prompts: clipList(demoRaw.prompts, 6, 48).length
        ? clipList(demoRaw.prompts, 6, 48)
        : DEFAULT_LANDING_CONTENT.demo.prompts,
    },
    nav,
  };
}

export function sanitizePublicBilling(raw: Record<string, any> | null | undefined): PublicBillingConfig {
  const source = raw || {};
  return {
    tokenRatePerLakh: Math.min(10000, Math.max(1, Number(source.tokenRatePerLakh || source.tokenPricePerLakh) || DEFAULT_BILLING.tokenRatePerLakh)),
    monthlyServerCost: Math.min(100000, Math.max(0, Number(source.monthlyServerCost) || DEFAULT_BILLING.monthlyServerCost)),
    freeTrialTokens: Math.min(10_000_000, Math.max(1000, Number(source.freeTrialTokens) || DEFAULT_BILLING.freeTrialTokens)),
  };
}

export function buildPublicSiteConfig(
  publicDoc: Record<string, any> | null | undefined,
  billingDoc: Record<string, any> | null | undefined = {},
): PublicSiteConfig {
  const merged = { ...(billingDoc || {}), ...(publicDoc || {}) };
  const billing = sanitizePublicBilling(merged);
  return {
    globalAnnouncement: clip(merged.globalAnnouncement || merged.announcement, 500),
    maintenanceMode: Boolean(merged.maintenanceMode),
    billing,
    landing: sanitizeLandingContent(merged.landing, billing),
  };
}

export function defaultPublicSiteConfig(): PublicSiteConfig {
  return buildPublicSiteConfig({}, {});
}
