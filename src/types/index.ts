/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  minPrice?: number;
  description: string;
  image?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  productId?: string;
}

export interface FacebookConfig {
  pixelId: string;
  accessToken: string; // For CAPI
  testEventCode?: string;
}

export interface BusinessFeatures {
  aiEnabled: boolean;
  orderTrackingEnabled: boolean;
  proactiveNotificationsEnabled: boolean;
  chatSummaryEnabled: boolean;
  negotiationEnabled: boolean;
  imageDisplayEnabled: boolean;
}

export interface BusinessConfig {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  products: Product[];
  faqs: FAQ[];
  facebookConfig: FacebookConfig;
  features: BusinessFeatures;
  customSystemPrompt: string;
  messengerWebhookUrl?: string;
  messengerVerifyToken?: string;
  facebookAppId?: string;
  pageAccessToken?: string;
  verifyToken?: string;
  pageName?: string;
  steadfastApiKey?: string;
  steadfastSecretKey?: string;
  zinipayApiKey?: string;
  zinipayMerchantId?: string;
  status: 'active' | 'suspended';
  plan: 'free' | 'pro' | 'enterprise';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'merchant' | 'admin';
  createdAt: any;
}

export interface SystemConfig {
  geminiApiKey: string;
  zinipayApiKey?: string;
  zinipayMerchantId?: string;
  globalAnnouncement?: string;
  defaultSystemPrompt?: string;
  updatedAt: any;
  updatedBy: string;
}

export interface OrderData {
  name: string;
  phone: string;
  address: string;
  quantity: string;
  negotiated_price?: string;
}

export type Intent = 'product_query' | 'order' | 'general' | 'unknown';
export type ConversationStage = 'new_lead' | 'interested' | 'checkout_started' | 'order_completed';
export type FacebookEvent = 'Lead' | 'ViewContent' | 'InitiateCheckout' | 'AddToCart' | 'Purchase';

export interface AIResponse {
  intent: Intent;
  product_name: string;
  show_product_image: boolean;
  reply: string;
  summary?: string; // Concise summary of the entire conversation so far
  order_data: OrderData;
  conversation_stage: ConversationStage;
  event_name: FacebookEvent;
  need_more_info: boolean;
  confidence: number;
  recommendations?: { id: string, name: string, reason: string }[];
}

export interface AnalyticsEvent {
  id: string;
  businessId: string;
  eventName: string;
  properties: Record<string, any>;
  timestamp: any;
  sessionId: string;
}

export interface Order {
  id: string;
  merchantId: string;
  businessId: string;
  customerName: string;
  phone: string;
  address: string;
  quantity: number;
  productName: string;
  unitPrice?: number;
  totalPrice?: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'failed';
  paymentMethod?: 'cod' | 'online';
  courierTrackingId?: string;
  courierStatus?: string;
  createdAt: any;
}

export interface Customer {
  id: string;
  businessId: string;
  messengerId?: string;
  name: string;
  phone?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  leadScore: number; // 0-100
  chatSummary?: string; // Summary of the complete chat history for AI context
  lastInteraction: any;
  createdAt: any;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  aiMetadata?: AIResponse;
}
