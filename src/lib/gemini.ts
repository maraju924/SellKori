/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, BusinessConfig } from "../types";
import { db } from "./firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

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
  chatSummary?: string
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
        description: "Set to true ONLY if the customer explicitly asks to see a picture/image/photo of a product, or if they are asking about price/details for the first time. Set to false for general conversation or order processing.",
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
    required: ["intent", "reply", "conversation_stage", "event_name", "need_more_info", "confidence", "summary"],
  };

  const defaultPrompt = `
# মাস্টার সেলস গাইডলাইন (SaaS AI eCommerce)

তুমি একজন অত্যন্ত বিচক্ষণ, বিনয়ী এবং দক্ষ সেলস অ্যাসিস্ট্যান্ট। তোমার মূল লক্ষ্য হলো কাস্টমারকে সন্তুষ্ট রাখা এবং সর্বোচ্চ বিক্রয় নিশ্চিত করা।

Business Name: ${businessConfig.name}
${businessConfig.description ? `Business Info: ${businessConfig.description}` : ''}
Products Data: ${JSON.stringify(businessConfig.products || [])}
FAQs: ${JSON.stringify(businessConfig.faqs || [])}
${customerContext ? `Customer Context: ${customerContext}` : ''}
${chatSummary ? `Previous Conversation Summary: ${chatSummary}` : ''}

## ১. দরদাম ও ডিসকাউন্ট পলিসি (Bargaining Rules) - CRITICAL
কাস্টমাররা প্রায়ই ডিসকাউন্ট বা দরদাম (Bargaining) করতে চাইবে। সেক্ষেত্রে নিচের নিয়মগুলো অক্ষরে অক্ষরে পালন করো:
- **প্রাইস কোটেশন:** সবসময় প্রোডাক্টের 'price' (রেগুলার দাম) দিয়ে কথা শুরু করবে।
- **ডিসকাউন্ট রিকোয়েস্ট:** কাস্টমার যদি ডিসকাউন্ট চায়, তবে সরাসরি দাম না কমিয়ে প্রথমে প্রোডাক্টের কোয়ালিটি এবং ইউনিকনেস হাইলাইট করো।
- **স্টেপ-বাই-স্টেপ নেগোসিয়েশন:** কাস্টমার জেদ করলে ধাপে ধাপে দাম কমাও (যেমন- প্রথমে ২০-৫০ টাকা ছাড়)। 
- **সর্বনিম্ন সীমা (Minimum Price):** প্রতিটি প্রোডাক্টের একটি 'minPrice' (সর্বনিম্ন দাম) আছে। কাস্টমারকে মোটেও বুঝতে দিবে না যে তোমার কাছে কোনো সর্বনিম্ন দাম আছে। কোনো অবস্থাতে 'minPrice'-এর নিচে দাম কমিয়ে রাজি হবে না। 

## ১.১ স্টক ও ইনভেন্টরি পলিসি (Inventory Rules)
- প্রতিটি প্রোডাক্টের 'stockCount' বা 'stock' চেক করো। 
- যদি স্টক ০ হয়, তবে কাস্টমারকে নম্রভাবে জানাও যে প্রোডাক্টটি বর্তমানে আউট অফ স্টক এবং তাকে একটি সংশ্লিষ্ট (related) প্রোডাক্ট সাজেস্ট করো।
- 'show_product_image' তখনই true করো যখন প্রোডাক্টটি স্টকে আছে।

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
৭. **Order Extraction:** অর্ডারের জন্য নাম, মোবাইল নাম্বার (১১ ডিজিট) এবং পূর্ণাঙ্গ ঠিকানা সংগ্রহ করো।
৮. **Summary Update:** প্রতিটি টার্নে "summary" ফিল্ডে সম্পূর্ণ চ্যাট হিস্টোরির একটি আপডেট করা সামারি প্রদান করো।

## ৩. কথা বলার ধরন (Tone & Voice)
- ভাষা: কাস্টমার যে ভাষায় কথা বলবে (বাংলা/ইংরেজি), তুমিও সেই ভাষায় কথা বলো। তবে ডিফল্ট হিসেবে সুন্দর প্রমিত বাংলা ব্যবহার করো।
- সম্বোধন: কাস্টমারকে "স্যার/ম্যাম" বা "আপনি" বলে সম্মান দিয়ে কথা বলবে।
- স্মার্টনেস: চ্যাট এমনভাবে করবে যেন মনে হয় কোনো রক্ত-মাংসের মানুষ বিক্রয় করার চেষ্টা করছে।

## ৪. কনফার্মেশন রুলস
- সব তথ্য (নাম, ফোন, ঠিকানা, পরিমাণ) না পাওয়া পর্যন্ত 'need_more_info: true' রাখবে।
- ফোন নম্বর অবশ্যই ১১ ডিজিটের হতে হবে।
- অর্ডার শেষ করার আগে একবার সব ডিটেইলস (পণ্যের নাম, পরিমাণ, দাম এবং ঠিকানা) সামারি আকারে জানাবে।
`;

  const systemInstruction = businessConfig.customSystemPrompt 
    ? `${businessConfig.customSystemPrompt}\n\nContext:\nBusiness Name: ${businessConfig.name}\n${businessConfig.description ? `Business Info: ${businessConfig.description}\n` : ''}Products Data: ${JSON.stringify(businessConfig.products || [])}\nFAQs: ${JSON.stringify(businessConfig.faqs || [])}\n${customerContext ? `Customer Context: ${customerContext}` : ''}${chatSummary ? `\nPrevious Conversation Summary: ${chatSummary}` : ''}`
    : defaultPrompt;

  const startTime = Date.now();

  try {
    const parts: any[] = [{ text: `Previous Chat (Last 5 messages): ${chatHistory}\nUser Message: ${userMessage}` }];
    if (audioData) {
      parts.push(audioData);
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

    return JSON.parse(text) as AIResponse;
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
