import type { AIResponse, BusinessConfig } from '../types';

interface ChatRequest {
  userMessage: string;
  chatHistory: string;
  businessConfig: BusinessConfig;
  customerContext?: string;
  chatSummary?: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

export async function requestAIResponse({
  userMessage,
  chatHistory,
  businessConfig,
  customerContext,
  chatSummary,
}: ChatRequest): Promise<AIResponse> {
  const response = await fetch('/api/chat/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: businessConfig.id,
      message: userMessage,
      history: chatHistory,
      customerContext: customerContext || '',
      chatSummary: chatSummary || '',
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    const error = new Error(body.error || 'AI response request failed');
    error.name = body.code || 'CHAT_API_ERROR';
    throw error;
  }

  const body = await response.json() as { response?: AIResponse };
  if (!body.response?.reply) {
    throw new Error('Chat API returned an invalid response');
  }
  return body.response;
}

export async function fetchPublicBusiness(businessId: string): Promise<BusinessConfig | null> {
  const response = await fetch(`/api/chat/business/${encodeURIComponent(businessId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Unable to load public business');
  return response.json() as Promise<BusinessConfig>;
}

