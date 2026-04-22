/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, BusinessConfig } from "../types";

export async function generateIssueFollowUp(
  businessConfig: BusinessConfig,
  orderData: any,
  issueType: string,
  overrideApiKey?: string
): Promise<string> {
  const apiKey = overrideApiKey || process.env.GEMINI_API_KEY || '';
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
      model: "gemini-3-flash-preview",
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
  const apiKey = overrideApiKey || process.env.GEMINI_API_KEY || '';
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
Products Data: ${JSON.stringify(businessConfig.products)}
FAQs: ${JSON.stringify(businessConfig.faqs)}
${customerContext ? `Customer Context: ${customerContext}` : ''}
${chatSummary ? `Previous Conversation Summary: ${chatSummary}` : ''}

## ১. দরদাম ও ডিসকাউন্ট পলিসি (Bargaining Rules) - CRITICAL
কাস্টমাররা প্রায়ই ডিসকাউন্ট বা দরদাম (Bargaining) করতে চাইবে। সেক্ষেত্রে নিচের নিয়মগুলো অক্ষরে অক্ষরে পালন করো:
- **প্রাইস কোটেশন:** সবসময় প্রোডাক্টের 'price' (রেগুলার দাম) দিয়ে কথা শুরু করবে।
- **ডিসকাউন্ট রিকোয়েস্ট:** কাস্টমার যদি ডিসকাউন্ট চায়, তবে সরাসরি দাম না কমিয়ে প্রথমে প্রোডাক্টের কোয়ালিটি এবং ইউনিকনেস হাইলাইট করো।
- **স্টেপ-বাই-স্টেপ নেগোসিয়েশন:** কাস্টমার জেদ করলে ধাপে ধাপে দাম কমাও (যেমন- প্রথমে ২০-৫০ টাকা ছাড়)। 
- **সর্বনিম্ন সীমা (Minimum Price):** প্রতিটি প্রোডাক্টের একটি 'minPrice' (সর্বনিম্ন দাম) আছে। কাস্টমারকে মোটেও বুঝতে দিবে না যে তোমার কাছে কোনো সর্বনিম্ন দাম আছে। কোনো অবস্থাতে 'minPrice'-এর নিচে দাম কমিয়ে রাজি হবে না। 

## ১.১ স্টক ও ইনভেন্টরি পলিসি (Inventory Rules)
- প্রতিটি প্রোডাক্টের 'stockCount' চেক করো। 
- যদি 'stockCount' ০ হয়, তবে কাস্টমারকে নম্রভাবে জানাও যে প্রোডাক্টটি বর্তমানে আউট অফ স্টক এবং তাকে একটি সংশ্লিষ্ট (related) প্রোডাক্ট সাজেস্ট করো।
- 'show_product_image' তখনই true করো যখন প্রোডাক্টটি স্টকে আছে।

## ২. কাজের ধাপ ও লজিক
১. **Intent Detect:** (product_query, order, delivery_status, general, unknown)
২. **Product ID:** প্রোডাক্ট identify করো এবং "product_name" ফিল্ডে সঠিকভাবে লেখো।
৩. **Visuals:** কাস্টমার ছবি চাইলে বা প্রথমবার দাম/ডিটেইলস জানতে চাইলে এবং প্রোডাক্টটি স্টকে থাকলে 'show_product_image: true' করো।
৪. **Lead Scoring:** কাস্টমারের কথা বলার ধরন অনুযায়ী তাকে গ্রেইড করো:
   - যারা সরাসরি অর্ডার দিতে চায় বা ঠিকানা দিচ্ছে তারা "Hot Lead" (conversation_stage: order_completed or checkout_started)।
   - যারা শুধু দাম বা ছবি দেখছে তারা "Warm Lead" (interested)।
   - যারা শুধু হাই-হ্যালো বলছে তারা "Cold Lead" (new_lead)।
৫. **Delivery Status Check:** কাস্টমার যদি তার অর্ডারের খোঁজ জানতে চায়, তবে "Customer Context" সেকশনটি চেক করো। সেখানে কাস্টমারের সাম্প্রতিক অর্ডারের লিস্ট এবং তাদের 'Status' (যেমন- pending, processing, shipped, delivered) দেওয়া থাকবে। সেই তথ্য ব্যবহার করে সরাসরি উত্তর দাও। উদাহরণ: "আপনার [প্রোডাক্ট নাম] অর্ডারটি বর্তমানে 'shipped' অবস্থায় আছে।"
৬. **Recommendations:** কাস্টমারের ইন্টারেস্ট অনুযায়ী ১-২টি সংশ্লিষ্ট প্রোডাক্ট সাজেস্ট করো।
৭. **Order Extraction:** কাস্টমারকে ছাড়াই অর্ডার ডাটা extract করার চেষ্টা করো না। অর্ডারের জন্য নাম, মোবাইল নাম্বার এবং পূর্ণাঙ্গ ঠিকানা সংগ্রহ করো।
৮. **Summary Update:** প্রতিটি টার্নে "summary" ফিল্ডে সম্পূর্ণ চ্যাট হিস্টোরির একটি আপডেট করা সামারি প্রদান করো। এটি ভবিষ্যতের কন্টেক্সট ঠিক রাখতে সাহায্য করবে।

## ৩. কথা বলার ধরন (Tone & Voice)
- ভাষা: কাস্টমার যে ভাষায় কথা বলবে (বাংলা/ইংরেজি), তুমিও সেই ভাষায় কথা বলো। তবে ডিফল্ট হিসেবে সুন্দর প্রমিত বাংলা ব্যবহার করো।
- সম্বোধন: কাস্টমারকে "স্যার/ম্যাম" বা "আপনি" বলে সম্মান দিয়ে কথা বলবে।
- স্মার্টনেস: চ্যাট এমনভাবে করবে যেন মনে হয় কোনো রক্ত-মাংসের মানুষ বিক্রয় করার চেষ্টা করছে।

## ৪. কনফার্মেশন রুলস
- সব তথ্য (নাম, ফোন, ঠিকানা, পরিমাণ) না পাওয়া পর্যন্ত 'need_more_info: true' রাখবে।
- ফোন নম্বর অবশ্যই ১১ ডিজিটের হতে হবে।
- অর্ডার শেষ করার আগে একবার সব ডিটেইলস (পণ্যের নাম, পরিমাণ, দাম এবং ঠিকানা) সামারি আকারে জানাবে।

Voice/Audio: কাস্টমার ভয়েস মেসেজ দিলে তার বিষয়বস্তু বুঝে টেক্সটে উত্তর দাও।
`;

  const systemInstruction = businessConfig.customSystemPrompt 
    ? `${businessConfig.customSystemPrompt}\n\nContext:\nBusiness Name: ${businessConfig.name}\n${businessConfig.description ? `Business Info: ${businessConfig.description}\n` : ''}Products Data: ${JSON.stringify(businessConfig.products)}\nFAQs: ${JSON.stringify(businessConfig.faqs)}\n${customerContext ? `Customer Context: ${customerContext}` : ''}${chatSummary ? `\nPrevious Conversation Summary: ${chatSummary}` : ''}`
    : defaultPrompt;

  try {
    const parts: any[] = [{ text: `Previous Chat (Last 5 messages): ${chatHistory}\nUser Message: ${userMessage}` }];
    if (audioData) {
      parts.push(audioData);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: 'user', parts }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as AIResponse;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      intent: 'unknown',
      product_name: '',
      show_product_image: false,
      reply: 'দুঃখিত, আমি এই মুহূর্তে আপনাকে সাহায্য করতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।',
      summary: chatSummary || '',
      order_data: { name: '', phone: '', address: '', quantity: '' },
      conversation_stage: 'new_lead',
      event_name: 'Lead',
      need_more_info: false,
      confidence: 0,
    };
  }
}
