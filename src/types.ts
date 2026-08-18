export interface Product {
  id: string;
  name: string;
  price: number;
  minPrice?: number;
  description: string;
  specs?: string;
  stock?: number;
  category?: string;
  images?: string[];
  isAvailable?: boolean;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface BusinessFeatures {
  aiEnabled?: boolean;
  orderTrackingEnabled?: boolean;
  proactiveNotificationsEnabled?: boolean;
  chatSummaryEnabled?: boolean;
  negotiationEnabled?: boolean;
  imageDisplayEnabled?: boolean;
  inventoryEnabled?: boolean;
  analyticsEnabled?: boolean;
  invoicingEnabled?: boolean;
  broadcastingEnabled?: boolean;
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
  pageAccessToken?: string;
  pageId?: string;
  status?: 'active' | 'suspended' | 'pending';
  plan?: 'free' | 'pro' | 'enterprise';
  verificationStatus?: 'verified' | 'pending' | 'rejected';
  themePreference?: 'light' | 'dark' | 'system';
  createdAt?: any;
  updatedAt?: any;
}

export interface Order {
  id: string;
  businessId: string;
  merchantId?: string;
  sessionId?: string;
  customerName: string;
  phone: string;
  address: string;
  quantity: number;
  productName: string;
  unitPrice: number;
  totalPrice: number;
  deliveryFee?: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod?: 'cod' | 'bkash' | 'nagad' | 'card';
  courierStatus?: string;
  courierTrackingId?: string;
  courierConsignmentId?: string;
  notes?: string;
  createdAt?: any;
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

export interface BroadcastingCampaign {
  id: string;
  businessId: string;
  title: string;
  message: string;
  targetAudience: 'all' | 'hot_leads' | 'buyers' | 'custom';
  sentCount: number;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  createdAt?: any;
}

export interface AIResponse {
  intent: string;
  show_product_image?: boolean;
  product_name?: string;
  reply: string;
  summary?: string;
  order_data: {
    name?: string;
    phone?: string;
    address?: string;
    quantity?: string;
    negotiated_price?: string;
  };
  conversation_stage: string;
  event_name: string;
  need_more_info: boolean;
  confidence: number;
}
