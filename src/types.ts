export interface ProductTier {
  quantity: number;
  price: number;
  minPrice: number;
  label?: string; // e.g. "১ পিস ট্রায়াল", "২ পিস বেস্ট ডিল", "৩ পিস কম্বো"
}

export interface Product {
  id: string;
  name: string;
  price: number;
  minPrice?: number;
  pricingTiers?: ProductTier[];
  description: string;
  specs?: string;
  stock?: number;
  category?: string;
  images?: string[];
  reviewImages?: string[];
  isAvailable?: boolean;
}

export interface FAQ {
  id: string;
  type: 'general' | 'product'; // সাধারণ স্টোর প্রশ্নোত্তর নাকি নির্দিষ্ট পণ্যভিত্তিক
  question: string;
  answer: string;
  category?: string; // e.g. "ডেলিভারি", "পেমেন্ট ও সিওডি", "রিটার্ন ও রিফান্ড", "কোয়ালিটি ও সাইজ", "ওয়ারেন্টি", "অর্ডার প্রসেস"
  productId?: string; // যদি পণ্যভিত্তিক হয়
  productName?: string; // পণ্যটির নাম
  tags?: string[];
  isActive?: boolean;
}

export interface BusinessFeatures {
  aiEnabled?: boolean;
  messengerRepliesEnabled?: boolean;
  photoReplyEnabled?: boolean;
  voiceReplyEnabled?: boolean;
  chatSummaryEnabled?: boolean;
  negotiationEnabled?: boolean;
  upsellEnabled?: boolean;
  autoOrderEnabled?: boolean;
  inventoryEnabled?: boolean;
  imageDisplayEnabled?: boolean;
  reviewImagesEnabled?: boolean;
  orderTrackingEnabled?: boolean;
  faqEnabled?: boolean;
  invoicingEnabled?: boolean;
  autoCourierBookingEnabled?: boolean;
  broadcastingEnabled?: boolean;
  commentToInboxEnabled?: boolean;
  analyticsEnabled?: boolean;
  proactiveNotificationsEnabled?: boolean;
  humanHandoverEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  offlineMessage?: string;
}

export interface FacebookConfig {
  pixelId?: string;
  accessToken?: string;
  testEventCode?: string;
  capiEnabled?: boolean;
}

export interface CourierConfigType {
  steadfastApiKey?: string;
  steadfastSecretKey?: string;
  deliveryChargeInsideDhaka?: number;
  deliveryChargeOutsideDhaka?: number;
  autoBooking?: boolean;
}

export interface BusinessConfig {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  walletBalance?: number;
  tokenBalance?: number;
  totalTokensUsed?: number;
  subscriptionExpiry?: any;
  products: Product[];
  faqs: FAQ[];
  facebookConfig?: FacebookConfig;
  courierConfig?: CourierConfigType;
  features?: BusinessFeatures;
  customSystemPrompt?: string;
  aiPersona?: 'friendly' | 'professional' | 'humorous' | 'enthusiastic';
  aiLanguage?: 'bangla' | 'banglish' | 'english' | 'auto';
  bargainingSensitivity?: number; // 0 to 100
  useOwnApiKey?: boolean;
  customGeminiApiKey?: string;
  selectedAiModel?: string;
  aiTemperature?: number;
  aiMaxTokens?: number;
  messengerVerifyToken?: string;
  verifyToken?: string;
  pageAccessToken?: string;
  pageId?: string;
  facebookPageId?: string;
  commentToInboxKeywords?: string[] | string;
  commentInboxMessage?: string;
  commentPublicReply?: string;
  status?: 'active' | 'suspended' | 'pending';
  plan?: 'free' | 'pro' | 'enterprise';
  verificationStatus?: 'verified' | 'pending' | 'rejected';
  themePreference?: 'light' | 'dark' | 'system';
  createdAt?: any;
  updatedAt?: any;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'partial';
export type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'card' | 'rocket';
export type OrderPriority = 'normal' | 'urgent' | 'hold';

export interface OrderStatusEvent {
  status: OrderStatus;
  at: number;
  note?: string;
}

export interface Order {
  id: string;
  businessId: string;
  merchantId?: string;
  sessionId?: string;
  passengerId?: string;
  clientIp?: string;
  customerName: string;
  phone: string;
  address: string;
  district?: string;
  quantity: number;
  productId?: string;
  productName: string;
  unitPrice: number;
  totalPrice: number;
  deliveryFee?: number;
  discount?: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  courierStatus?: string;
  courierTrackingId?: string;
  courierConsignmentId?: string;
  notes?: string;
  internalNotes?: string;
  tags?: string[];
  priority?: OrderPriority;
  cancelReason?: string;
  returnReason?: string;
  source?: string;
  insideDhaka?: boolean;
  createdAt?: any;
  createdAtMs?: number;
  updatedAt?: any;
  updatedAtMs?: number;
  statusHistory?: OrderStatusEvent[];
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: any;
  leadStage?: 'lead' | 'hot' | 'buyer' | 'repeat' | 'inactive';
  notes?: string;
  tags?: string[];
  createdAt?: any;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  aiMetadata?: any;
  senderName?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'merchant' | 'admin';
  businessId?: string;
  phone?: string;
  createdAt?: any;
}

export interface SystemConfig {
  globalAnnouncement?: string;
  maintenanceMode?: boolean;
  defaultTokenRate?: number; // Taka per 100k tokens
  monthlyServerFee?: number;
  zinipayApiKey?: string;
  zinipaySecretKey?: string;
  steadfastGlobalApiKey?: string;
  steadfastGlobalSecret?: string;
  geminiModel?: string;
}

export type BroadcastAudience = 'all' | 'hot_leads' | 'buyers';

export interface BroadcastingCampaign {
  id: string;
  businessId: string;
  title: string;
  message: string;
  targetAudience: BroadcastAudience | 'custom';
  sentCount: number;
  failedCount?: number;
  skippedCount?: number;
  eligibleCount?: number;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  createdAt?: any;
  createdAtMs?: number;
  error?: string;
}

export interface AIResponse {
  intent: string;
  show_product_image?: boolean;
  show_review_images?: boolean;
  should_create_order?: boolean;
  product_name?: string;
  reply: string;
  summary?: string;
  order_data: {
    name?: string;
    phone?: string;
    address?: string;
    quantity?: string;
    negotiated_price?: string;
    product_name?: string;
  };
  conversation_stage: string;
  event_name: string;
  need_more_info: boolean;
  confidence: number;
}
