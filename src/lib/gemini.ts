/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, BusinessConfig, Product } from "../types";
import { db } from "./firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { buildFeaturePromptBlock, isFeatureEnabled } from "./featureFlags";

/** Strip huge base64 payloads so the model actually sees chat history + customer memory. */
export function sanitizeProductsForAI(products?: Product[]) {
  return (products || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    minPrice: p.minPrice || p.price,
    pricingTiers: p.pricingTiers || [],
    description: (p.description || '').slice(0, 400),
    specs: (p.specs || '').slice(0, 250),
    stock: p.stock ?? 0,
    category: p.category || 'General',
    hasImages: (p.images || []).length > 0,
    imageCount: (p.images || []).length,
    hasReviewImages: (p.reviewImages || []).length > 0,
    reviewImageCount: (p.reviewImages || []).length,
  }));
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  category: 'fast' | 'reasoning' | 'specialized' | 'custom';
  categoryLabel?: string;
  description: string;
  latencyBadge: string;
  tokenCostBadge: string;
  recommendedFor?: string;
  isPopular?: boolean;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelInfo[] = [
  // Fast & Conversational (eCommerce, Sales, Live Chat)
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    category: 'fast',
    categoryLabel: '⚡ Flash Models (Fast & Conversational)',
    description: 'সর্বোচ্চ গতি, আধুনিক হাইব্রিড থিংকিং এবং বাংলা ভাষায় নিখুঁত সেলস পারফরম্যান্স। রিয়েল-টাইম কাস্টমার চ্যাটের জন্য প্রধান রিকমেন্ডেড।',
    latencyBadge: '~350ms',
    tokenCostBadge: 'Standard',
    recommendedFor: 'eCommerce Live Chat & Fast Sales',
    isPopular: true
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Auto-Update)',
    category: 'fast',
    categoryLabel: '⚡ Flash Models (Fast & Conversational)',
    description: 'গুগলের সর্বদা আপ-টু-ডেট ফ্ল্যাশ অ্যালিয়াস। নিয়মিত স্বয়ংক্রিয়ভাবে লেটেস্ট ভার্সনে আপডেট হয়।',
    latencyBadge: '~380ms',
    tokenCostBadge: 'Auto',
    recommendedFor: 'Continuous Auto-Updates',
    isPopular: true
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    category: 'fast',
    categoryLabel: '⚡ Flash Models (Fast & Conversational)',
    description: 'সবচেয়ে কম খরচে আল্ট্রা-লাইটওয়েট মডেল। সাধারণ প্রশ্নোত্তর ও হাই-ভলিউম ট্রাফিকের জন্য দ্রুততম।',
    latencyBadge: '~200ms',
    tokenCostBadge: 'Lowest Cost',
    recommendedFor: 'High-Volume FAQs & Rapid Responses'
  },

  // Pro & Reasoning Models
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    category: 'reasoning',
    categoryLabel: '🧠 Pro & Deep Reasoning Models',
    description: 'ফ্ল্যাগশিপ অ্যাডভান্সড মডেল। জটিল ডেটা স্ট্রাকচার, ডিপ রিজনিং ও পলিসি অ্যানালাইসিস।',
    latencyBadge: '~950ms',
    tokenCostBadge: 'Flagship',
    recommendedFor: 'Enterprise Automated Workflows & Deep Reasoning'
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro (Auto-Update)',
    category: 'reasoning',
    categoryLabel: '🧠 Pro & Deep Reasoning Models',
    description: 'গুগলের সর্বদা আপ-টু-ডেট প্রো অ্যালিয়াস। উচ্চমানের রিজনিং ও জটিল ক্যাটালগ অ্যানালিসিস।',
    latencyBadge: '~900ms',
    tokenCostBadge: 'High Quality',
    recommendedFor: 'Complex Sales Logic & Policy Analysis'
  },

  // Multimodal, Speech & Specialized Models
  {
    id: 'gemini-3.1-flash-lite-image',
    name: 'Gemini 3.1 Flash Lite Image',
    category: 'specialized',
    categoryLabel: '🎨 Multimodal & Specialized Models',
    description: 'লাইটওয়েট ইমেজ জেনারেশন ও দ্রুত ফটো প্রসেসিং। ক্যাটালগ ব্যানার ও থাম্বনেইল তৈরি।',
    latencyBadge: '~1200ms',
    tokenCostBadge: 'Specialized',
    recommendedFor: 'General Image Generation & Product Visuals'
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Gemini 3.1 Flash Image HD',
    category: 'specialized',
    categoryLabel: '🎨 Multimodal & Specialized Models',
    description: 'হাই-কোয়ালিটি প্রোডাক্ট ভিজ্যুয়াল জেনারেশন ও ইমেজ এডিটিং (HD / 4K সাপোর্ট)।',
    latencyBadge: '~1800ms',
    tokenCostBadge: 'High Quality Visual',
    recommendedFor: 'High-Resolution Product Visuals'
  },
  {
    id: 'gemini-3.1-flash-tts-preview',
    name: 'Gemini 3.1 Flash TTS (Speech)',
    category: 'specialized',
    categoryLabel: '🎨 Multimodal & Specialized Models',
    description: 'টেক্সট-টু-স্পিচ ভয়েস জেনারেশন। গ্রাহকদের জন্য সরাসরি অডিও ভয়েস মেসেজ রিপ্লাই।',
    latencyBadge: '~500ms',
    tokenCostBadge: 'Audio',
    recommendedFor: 'Audio Voice Messages'
  },
  {
    id: 'gemini-3.1-flash-live-preview',
    name: 'Gemini 3.1 Flash Live (Realtime Audio)',
    category: 'specialized',
    categoryLabel: '🎨 Multimodal & Specialized Models',
    description: 'রিয়েল-টাইম লাইভ অডিও ও ভয়েস কনভার্সেশন ইন্টারফেস।',
    latencyBadge: '~250ms',
    tokenCostBadge: 'Realtime',
    recommendedFor: 'Interactive Live Voice Callbot'
  },
  {
    id: 'gemini-3.5-live-translate-preview',
    name: 'Gemini 3.5 Live Translate',
    category: 'specialized',
    categoryLabel: '🎨 Multimodal & Specialized Models',
    description: 'রিয়েল-টাইম বহুভাষিক অনুবাদ এবং ক্রস-ল্যাঙ্গুয়েজ কাস্টমার সাপোর্ট।',
    latencyBadge: '~350ms',
    tokenCostBadge: 'Translation',
    recommendedFor: 'Multilingual Customer Support'
  }
];

// Global runtime cache for system API key to prevent repeated Firestore fetches
let cachedSystemApiKey: string | null = null;
let cachedSystemModel: string | null = null;
let lastCacheFetchTime = 0;

export async function fetchSystemGeminiSettings(): Promise<{ apiKey: string; defaultModel: string }> {
  const now = Date.now();
  if (cachedSystemApiKey !== null && (now - lastCacheFetchTime < 60000)) {
    return {
      apiKey: cachedSystemApiKey,
      defaultModel: cachedSystemModel || 'gemini-3.7-flash'
    };
  }

  try {
    if (db) {
      const publicDoc = await getDoc(doc(db, 'system_config', 'public'));
      if (publicDoc.exists()) {
        const data = publicDoc.data();
        if (data.geminiApiKey) cachedSystemApiKey = data.geminiApiKey;
        if (data.defaultAiModel) cachedSystemModel = data.defaultAiModel;
      }

      if (!cachedSystemApiKey) {
        const settingsDoc = await getDoc(doc(db, 'system', 'settings'));
        if (settingsDoc.exists()) {
          const sData = settingsDoc.data();
          if (sData.geminiApiKey) cachedSystemApiKey = sData.geminiApiKey;
          if (sData.defaultAiModel) cachedSystemModel = sData.defaultAiModel;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch system Gemini settings from Firestore:", e);
  }

  lastCacheFetchTime = now;
  return {
    apiKey: cachedSystemApiKey || process.env.GEMINI_API_KEY || '',
    defaultModel: cachedSystemModel || 'gemini-3.7-flash'
  };
}

/**
 * Diagnostic test tool for verifying any Gemini API Key and Model
 */
export async function testGeminiApiKeyAndModel(
  apiKey: string,
  modelName: string
): Promise<{ success: boolean; latencyMs: number; responseText?: string; error?: string }> {
  const effectiveModel = modelName.trim() || 'gemini-3.7-flash';
  const cleanKey = apiKey.trim();

  // 1. Try server-side validation endpoint first (which has access to process.env.GEMINI_API_KEY)
  try {
    const res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: cleanKey, model: effectiveModel })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        latencyMs: data.latencyMs || 250,
        responseText: data.responseText || 'সেলকরি এআই ইঞ্জিন প্রস্তুত ও সক্রিয়।'
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        return {
          success: false,
          latencyMs: 0,
          error: errData.error
        };
      }
    }
  } catch (backendErr) {
    // If backend fetch failed, fall through to client-side test if key is provided
  }

  // 2. Client-side fallback test if key is provided
  if (!cleanKey) {
    return {
      success: false,
      latencyMs: 0,
      error: 'কোনো Gemini API Key কনফিগার করা নেই। অনুগ্রহ করে একটি ভ্যালিড API Key ইনপুট দিন।'
    };
  }

  const startTime = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: "Hello! Reply with a single short sentence in Bengali: সেলকরি এআই ইঞ্জিন প্রস্তুত।",
    });

    const latencyMs = Date.now() - startTime;
    const responseText = response.text?.trim() || 'সফল সংযোগ!';

    // Asynchronously log success
    if (db) {
      addDoc(collection(db, 'system_logs'), {
        type: 'gemini_api',
        action: 'api_key_diagnostic_test',
        model: effectiveModel,
        latencyMs,
        status: 'success',
        timestamp: serverTimestamp()
      }).catch(() => {});
    }

    return {
      success: true,
      latencyMs,
      responseText
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    let rawMsg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || '');
    
    let errorMsg = 'API Key টি সঠিক নয় বা গুগল পারমিশন পাওয়া যায়নি।';
    if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('permission') || rawMsg.includes('API_KEY_INVALID')) {
      errorMsg = 'API Key টি সঠিক নয় বা মেয়াদোত্তীর্ণ। Google AI Studio থেকে নতুন API Key সংগ্রহ করে পেস্ট করুন।';
    } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota') || rawMsg.includes('429')) {
      errorMsg = 'এই API Key এর নির্ধারিত কোটা শেষ হয়েছে (Rate Limit / Quota Exceeded)।';
    } else if (rawMsg.includes('NOT_FOUND') || rawMsg.includes('404')) {
      errorMsg = `মডেল "${effectiveModel}" পাওয়া যায়নি বা এই API Key দিয়ে অ্যাক্সেসযোগ্য নয়।`;
    }

    if (db) {
      addDoc(collection(db, 'system_logs'), {
        type: 'gemini_api',
        action: 'api_key_diagnostic_test',
        model: effectiveModel,
        latencyMs,
        status: 'failed',
        error: errorMsg,
        timestamp: serverTimestamp()
      }).catch(() => {});
    }

    return {
      success: false,
      latencyMs,
      error: errorMsg
    };
  }
}

export async function generateIssueFollowUp(
  businessConfig: BusinessConfig,
  orderData: any,
  issueType: string,
  overrideApiKey?: string
): Promise<string> {
  const sysConfig = await fetchSystemGeminiSettings();
  const apiKey = (businessConfig.useOwnApiKey && businessConfig.customGeminiApiKey)
    ? businessConfig.customGeminiApiKey
    : (overrideApiKey || sysConfig.apiKey || process.env.GEMINI_API_KEY || '');
  
  const model = businessConfig.selectedAiModel || sysConfig.defaultModel || "gemini-3.7-flash";
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are a proactive customer support assistant for ${businessConfig.name}.
A delivery issue has occurred for the following order:
Product: ${orderData.productName}
Customer Name: ${orderData.customerName}
Issue: ${issueType} (e.g., unreachable, phone switched off, address not found)

Generate a very polite, helpful and empathetic message in Bengali to the customer. 
The goal is to inform them about the issue and ask how we can help resolve it (e.g., ask for an alternative number or clear address).
Keep it short and professional. Do NOT use placeholders like [Name]. Use the data provided.

Output ONLY the Bengali message text.
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Follow-up Generation Error:", error);
    return `আসসালামু আলাইকুম, আপনার ${orderData.productName} অর্ডারটি ডেলিভারি করতে আমাদের রাইডার আপনার সাথে যোগাযোগ করতে পারছে না। অনুগ্রহ করে আমাদের একটু জানাবেন আপনার ফোনটি সচল আছে কি না? ধন্যবাদ।`;
  }
}

export async function getAIResponse(
  userMessage: string,
  chatHistory: string,
  businessConfig: BusinessConfig,
  customerContext?: string,
  audioData?: { inlineData: { data: string, mimeType: string } },
  overrideApiKey?: string,
  chatSummary?: string,
  imageData?: { inlineData: { data: string, mimeType: string } } | { inlineData: { data: string, mimeType: string } }[]
): Promise<AIResponse> {
  const sysConfig = await fetchSystemGeminiSettings();
  
  // Dynamic API Key resolution hierarchy:
  // 1. Merchant's own custom key (if enabled and provided)
  // 2. Explicit override key parameter
  // 3. System Global Admin dynamic key
  // 4. Server environment GEMINI_API_KEY
  const apiKey = (businessConfig.useOwnApiKey && businessConfig.customGeminiApiKey?.trim())
    ? businessConfig.customGeminiApiKey.trim()
    : (overrideApiKey || sysConfig.apiKey || process.env.GEMINI_API_KEY || '');

  // Dynamic Model resolution hierarchy:
  // 1. Merchant's selected model (e.g. gemini-3.7-flash, gemini-flash-latest, etc.)
  // 2. System Global Admin default model
  // 3. Fallback: gemini-3.7-flash
  const model = businessConfig.selectedAiModel?.trim() || sysConfig.defaultModel || "gemini-3.7-flash";
  const temperature = businessConfig.aiTemperature ?? 0.4;
  const maxOutputTokens = businessConfig.aiMaxTokens ?? 1024;

  const ai = new GoogleGenAI({ apiKey });
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      intent: {
        type: Type.STRING,
        description: "Intent of the user message: product_query, order, delivery_status, general, unknown",
      },
      show_product_image: {
        type: Type.BOOLEAN,
        description: "Set to true if the customer asks to see a picture/image/photo of a product, or if they are asking about price/details for the first time.",
      },
      show_review_images: {
        type: Type.BOOLEAN,
        description: "Set to true if the customer asks for reviews, customer photos, delivery proof, feedback screenshots, or unboxing photos.",
      },
      should_create_order: {
        type: Type.BOOLEAN,
        description: "Set true ONLY when name + 11-digit phone + full address + product are all known AND the customer has confirmed they want the order. Never true if an order was already placed recently in Customer Context.",
      },
      product_name: {
        type: Type.STRING,
        description: "Identified product name if any",
      },
      reply: {
        type: Type.STRING,
        description: "The reply in Bengali language",
      },
      summary: {
        type: Type.STRING,
        description: "Concise updated summary of the entire conversation until now in Bengali",
      },
      order_data: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          phone: { type: Type.STRING },
          address: { type: Type.STRING },
          quantity: { type: Type.STRING },
          negotiated_price: { type: Type.STRING, description: "The final agreed unit price after bargaining" },
          product_name: { type: Type.STRING },
        },
      },
      conversation_stage: {
        type: Type.STRING,
        description: "Stage: new_lead, interested, checkout_started, order_completed",
      },
      event_name: {
        type: Type.STRING,
        description: "Facebook Event: Lead, ViewContent, InitiateCheckout, AddToCart, Purchase",
      },
      need_more_info: {
        type: Type.BOOLEAN,
      },
      confidence: {
        type: Type.NUMBER,
      },
      recommendations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            reason: { type: Type.STRING, description: "Why this product is recommended based on query or history" },
          },
        },
        description: "Suggest 1-2 related products if relevant to the user query or past behavior",
      },
    },
    required: ["intent", "reply", "conversation_stage", "event_name", "need_more_info", "confidence", "summary", "should_create_order"],
  };

  // Separate FAQs into general and product-specific
  const generalFaqs = (businessConfig.faqs || []).filter(f => (f.type || (f.productId ? 'product' : 'general')) === 'general');
  const productFaqs = (businessConfig.faqs || []).filter(f => (f.type || (f.productId ? 'product' : 'general')) === 'product');

  const defaultPrompt = `
# মাস্টার সেলস গাইডলাইন (SaaS AI eCommerce)

তুমি একজন অত্যন্ত বিচক্ষণ, বিনয়ী এবং দক্ষ সেলস অ্যাসিস্ট্যান্ট। তোমার মূল লক্ষ্য হলো কাস্টমারকে সন্তুষ্ট রাখা এবং সর্বোচ্চ বিক্রয় নিশ্চিত করা।

Business Name: ${businessConfig.name}
${businessConfig.description ? `Business Info: ${businessConfig.description}` : ''}
Products Data: ${JSON.stringify(sanitizeProductsForAI(businessConfig.products))}

General Store FAQs (সাধারণ পলিসি):
${JSON.stringify(generalFaqs)}

Product-Specific FAQs (পণ্যভিত্তিক প্রশ্নোত্তর):
${JSON.stringify(productFaqs)}

${customerContext ? `Customer Context (CRITICAL — treat as already known facts): ${customerContext}` : ''}
${chatSummary ? `Previous Conversation Summary: ${chatSummary}` : ''}

## ১. প্রাইসিং, কোয়ান্টিটি বান্ডেল ও দরদাম পলিসি (Tiered Pricing & Bargaining Rules) - CRITICAL
কাস্টমাররা পণ্য সম্পর্কে জানতে চাইলে বা দরদাম করতে চাইলে নিচের নিয়মগুলো পালন করো:
- **১/২/৩ পিস কোয়ান্টিটি বান্ডেল অফার (Tiered Pricing):** প্রোডাক্টে যদি 'pricingTiers' থাকে (যেমন: ১ পিস ৫০০৳, ২ পিস ৮০০৳, ৩ পিস ১০০০৳), তবে কাস্টমারকে একক মূল্যের পাশাপাশি আকর্ষণীয় বান্ডেল অফার জানাও (যেমন: "স্যার, ১ পিস ৫০০ টাকা, কিন্তু ২ পিস নিলে পাচ্ছেন মাত্র ৮০০ টাকায় (২০০ টাকা সাশ্রয়) এবং ৩ পিস নিলে মাত্র ১০০০ টাকায়!")।
- **কোয়ান্টিটি অফার আপসেলিং:** কাস্টমার ১ পিস চাইলে তাকে বিনয়ের সাথে ২ পিস বা ৩ পিসের স্পেশাল কম্বো অফারটি সাজেস্ট করো যেন স্টোরের এভারেজ অর্ডার ভ্যালু (AOV) বাড়ে।
- **স্টেপ-বাই-স্টেপ নেগোসিয়েশন ও দরদাম সীমা:** কাস্টমার যদি দরদাম করতে চায়, তবে প্রোডাক্টের 'pricingTiers'-এ উল্লেখিত সংশ্লিষ্ট কোয়ান্টিটির 'minPrice' (অথবা প্রোডাক্টের 'minPrice') লক্ষ্য করো। কখনোই 'minPrice'-এর নিচে দাম কমাতে রাজি হবে না। কাস্টমারকে বুঝতে দেবে না যে তোমার কোনো ফিক্সড মিনিমাম লিমিট আছে।

## ১.১ স্টক ও ইনভেন্টরি পলিসি (Inventory Rules)
- প্রতিটি প্রোডাক্টের 'stockCount' বা 'stock' চেক করো। 
- যদি স্টক ০ হয়, তবে কাস্টমারকে নম্রভাবে জানাও যে প্রোডাক্টটি বর্তমানে আউট অফ স্টক এবং তাকে একটি সংশ্লিষ্ট (related) প্রোডাক্ট সাজেস্ট করো।
- 'show_product_image' তখনই true করো যখন কাস্টমার ছবি দেখতে চায় বা প্রথমবার পণ্য সম্পর্কে বিস্তারিত জানতে চায় এবং প্রোডাক্টটি স্টকে আছে।
- কাস্টমার যদি প্রোডাক্টের রিভিউ, কাস্টমার ফিডব্যাক, আনবক্সিং বা ডেলিভারি প্রুফ দেখতে চায়, তবে 'show_review_images: true' করো এবং পজিটিভ রিভিউর কথা জানাও। প্রোডাক্টে reviewImageCount > 0 থাকলে ছবি পাঠানো হবে।

## ১.২ নলেজবেস ও প্রশ্নোত্তর পলিসি (General & Product-Based FAQ Matching)
- **সাধারণ পলিসি প্রশ্ন:** কাস্টমার যদি ডেলিভারি সময়/চার্জ, ক্যাশ অন ডেলিভারি, পার্সেল চেক করা, রিটার্ন বা এক্সচেঞ্জ নিয়ে প্রশ্ন করে, তবে 'General Store FAQs' থেকে নির্ভুল তথ্য প্রদান করো।
- **পণ্যভিত্তিক প্রশ্ন:** কাস্টমার যদি কোনো বিশেষ পণ্যের ফেব্রিক, সাইজ মেজারমেন্ট, ওয়াটারপ্রুফ কিনা, যত্ন বা ওয়ারেন্টি নিয়ে প্রশ্ন করে, তবে 'Product-Specific FAQs' সেকশনে সংশ্লিষ্ট পণ্যের প্রশ্নোত্তর থেকে তথ্য নিয়ে উত্তর দাও।

## ২. কাজের ধাপ ও লজিক
১. **Intent Detect:** (product_query, order, delivery_status, general, unknown)
২. **Product ID:** প্রোডাক্ট identify করো এবং "product_name" ফিল্ডে সঠিকভাবে লেখো।
৩. **Visuals:** কাস্টমার ছবি চাইলে বা প্রথমবার দাম/ডিটেইলস জানতে চাইলে এবং প্রোডাক্টটি স্টকে থাকলে 'show_product_image: true' করো।
৪. **Lead Scoring:** কাস্টমারের কথা বলার ধরন অনুযায়ী তাকে গ্রেইড করো:
   - যারা সরাসরি অর্ডার দিতে চায় বা ঠিকানা দিচ্ছে তারা "Hot Lead" (conversation_stage: order_completed or checkout_started)।
   - যারা শুধু দাম বা ছবি দেখছে তারা "Warm Lead" (interested)।
   - যারা শুধু হাই-হ্যালো বলছে তারা "Cold Lead" (new_lead)।
৫. **Delivery Status Check:** কাস্টমার যদি তার অর্ডারের খোঁজ জানতে চায়, তবে "Customer Context" সেকশনটি চেক করো। সেখানে কাস্টমারের সাম্প্রতিক অর্ডারের লিস্ট এবং তাদের 'Status' দেওয়া থাকবে।
৬. **Recommendations:** কাস্টমারের ইন্টারেস্ট অনুযায়ী ১-২টি সংশ্লিষ্ট প্রোডাক্ট সাজেস্ট করো।
৭. **Order Extraction:** অর্ডারের জন্য নাম, মোবাইল নাম্বার (১১ ডিজিট) এবং পূর্ণাঙ্গ ঠিকানা সংগ্রহ করো। Customer Context-এ যা আগেই আছে তা order_data-তে কপি করো — হারিয়ে যেতে দিও না।
৮. **কখনোই জানা তথ্য আবার চাইবে না:** Customer Context-এ নাম/ফোন/ঠিকানা থাকলে সেগুলো আর জিজ্ঞেস করবে না। সাম্প্রতিক অর্ডার থাকলে তাকে আবার অর্ডার করতে বলবে না; স্ট্যাটাস জানাবে।
৯. **Order Confirm:** নাম+ফোন+ঠিকানা+পণ্য সব জানা এবং কাস্টমার কনফার্ম করলে should_create_order: true, conversation_stage: order_completed, event_name: Purchase, need_more_info: false।
১০. **Summary Update:** প্রতিটি টার্নে "summary" ফিল্ডে সম্পূর্ণ চ্যাট হিস্টোরির একটি আপডেট করা সামারি প্রদান করো (নাম, ফোন, ঠিকানা, পণ্য, অর্ডার স্ট্যাটাস সহ)।

## ৩. কথা বলার ধরন ও কঠোর নিয়মাবলী (Tone, Voice & Strict Directives)
- **সংক্ষিপ্ত ও টু-দ্য-পয়েন্ট উত্তর:** কাস্টমার যা জানতে চেয়েছে ঠিক ততটুকুরই সুনির্দিষ্ট, প্রাসঙ্গিক ও সংক্ষিপ্ত উত্তর দাও (১-৩ লাইনের মধ্যে)। অপ্রয়োজনীয় কোনো লম্বা ভূমিকা, অতিরিক্ত সালাম/ভাষণ বা না চাওয়া বড় তথ্য তালিকা দেবে না।
- **প্রসঙ্গ ও হিস্ট্রি স্মরণ:** পূর্বের চ্যাট হিস্ট্রি ও Customer Context দেখে কাস্টমার কোন পণ্যের কথা বলছে তা মনে রেখে সরাসরি উত্তর দাও। একই কথা বা একই তথ্য (মোবাইল/নাম/ঠিকানা) বারবার চাইবে না।
- **অতিরিক্ত কথা বর্জন:** কাস্টমার নিজে থেকে না চাইলে জোর করে কোনো বাড়তি অফার বা অপ্রাসঙ্গিক কথা বলবে না।
- **ভাষা:** কাস্টমার যে ভাষায় কথা বলবে (বাংলা/ইংরেজি), তুমিও সেই ভাষায় কথা বলো। তবে ডিফল্ট হিসেবে সুন্দর প্রমিত বাংলা ব্যবহার করো।
- **সম্বোধন:** কাস্টমারকে "স্যার/ম্যাম" বা "আপনি" বলে সম্মান দিয়ে কথা বলবে।

## ৩.১ ফটো ও ভয়েস মেসেজ রিপ্লাই
- **ছবি:** কাস্টমার ছবি পাঠালে অবশ্যই ছবিটি দেখে উত্তর দাও। পণ্য/স্ক্রিনশট হলে ক্যাটালগ মিলিয়ে দাম ও স্টক বলো। পেমেন্ট স্ক্রিনশট হলে ভেরিফিকেশনের কথা বলো, নিজে থেকে পেইড কনফার্ম করবে না। ঠিকানা/ফোন লেখা ছবি হলে পড়ে নিশ্চিত করো। বোঝা না গেলে জিজ্ঞেস করো ছবিটি কোন পণ্য সম্পর্কে।
- **ভয়েস:** অডিও শুনে যা বলেছে তা বুঝে টেক্সট মেসেজের মতো সেলস উত্তর দাও। প্রথম বাক্যে সংক্ষেপে নিশ্চিত করো তুমি কী শুনেছ। বোঝা না গেলে লিখে পাঠাতে বলো।
- কখনোই ফটো বা ভয়েস মেসেজে নীরব থাকবে না।

## ৪. কনফার্মেশন রুলস
- সব তথ্য (নাম, ফোন, ঠিকানা, পরিমাণ) না পাওয়া পর্যন্ত 'need_more_info: true' রাখবে।
- ফোন নম্বর অবশ্যই ১১ ডিজিটের হতে হবে।
- অর্ডার শেষ করার আগে একবার সব ডিটেইলস (পণ্যের নাম, পরিমাণ, দাম এবং ঠিকানা) সামারি আকারে জানাবে।
`;

  const memoryGuard = `
CRITICAL MEMORY RULES:
- Never re-ask for name, phone or address if they already appear in Customer Context or chat history.
- If a recent order exists in Customer Context, do not ask the customer to place the same order again. Confirm/status instead.
- Always copy known name/phone/address/product into order_data every turn so they are not lost.
- When the customer asks for reviews/proof photos, set show_review_images=true.
`;

  const mediaDirective = `

## ফটো ও ভয়েস মেসেজ
কাস্টমার ছবি পাঠালে অবশ্যই ছবিটি দেখে উত্তর দাও। ভয়েস পাঠালে অডিও শুনে টেক্সট মেসেজের মতো উত্তর দাও। নীরব থাকবে না। পেমেন্ট স্ক্রিনশটে নিজে থেকে পেইড কনফার্ম করবে না।`;

  const systemInstruction = `${
    businessConfig.customSystemPrompt
      ? `${businessConfig.customSystemPrompt}\n\n${memoryGuard}\nContext:\nBusiness Name: ${businessConfig.name}\n${businessConfig.description ? `Business Info: ${businessConfig.description}\n` : ''}Products Data: ${JSON.stringify(sanitizeProductsForAI(businessConfig.products))}\nFAQs: ${JSON.stringify(isFeatureEnabled(businessConfig.features, 'faqEnabled') ? (businessConfig.faqs || []) : [])}\n${customerContext ? `Customer Context: ${customerContext}` : ''}${chatSummary && isFeatureEnabled(businessConfig.features, 'chatSummaryEnabled') ? `\nPrevious Conversation Summary: ${chatSummary}` : ''}${mediaDirective}`
      : defaultPrompt
  }\n\n${buildFeaturePromptBlock(businessConfig.features)}`;

  const startTime = Date.now();

  try {
    const parts: any[] = [{ text: `Previous Chat History:\n${chatHistory || '(no prior messages)'}\n\nUser Message: ${userMessage}` }];
    if (audioData) {
      parts.push(audioData);
    }
    if (imageData) {
      const images = Array.isArray(imageData) ? imageData : [imageData];
      for (const img of images) {
        if (img?.inlineData?.data) parts.push(img);
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature,
        maxOutputTokens,
      },
    });

    const latencyMs = Date.now() - startTime;
    const text = response.text;
    if (!text) throw new Error("No response from AI");

    // Asynchronously log telemetry
    if (db) {
      addDoc(collection(db, 'system_logs'), {
        type: 'gemini_api',
        action: 'chat_completion',
        model,
        businessId: businessConfig.id,
        latencyMs,
        status: 'success',
        timestamp: serverTimestamp()
      }).catch(() => {});
    }

    const parsed = JSON.parse(text) as AIResponse;
    if (!isFeatureEnabled(businessConfig.features, 'imageDisplayEnabled')) parsed.show_product_image = false;
    if (!isFeatureEnabled(businessConfig.features, 'reviewImagesEnabled')) parsed.show_review_images = false;
    if (!isFeatureEnabled(businessConfig.features, 'autoOrderEnabled')) parsed.should_create_order = false;
    if (!isFeatureEnabled(businessConfig.features, 'chatSummaryEnabled')) parsed.summary = '';
    return parsed;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error("Gemini Error:", error);

    if (db) {
      addDoc(collection(db, 'system_logs'), {
        type: 'gemini_api',
        action: 'chat_completion',
        model,
        businessId: businessConfig.id,
        latencyMs,
        status: 'error',
        error: error?.message || 'Unknown error',
        timestamp: serverTimestamp()
      }).catch(() => {});
    }

    return {
      intent: 'unknown',
      product_name: '',
      show_product_image: false,
      show_review_images: false,
      should_create_order: false,
      reply: 'দুঃখিত, আমি এই মুহূর্তে আপনাকে সাহায্য করতে পারছি না। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন অথবা শপ অ্যাডমিনের সাথে যোগাযোগ করুন।',
      summary: chatSummary || '',
      order_data: { name: '', phone: '', address: '', quantity: '' },
      conversation_stage: 'new_lead',
      event_name: 'Lead',
      need_more_info: false,
      confidence: 0,
    };
  }
}
