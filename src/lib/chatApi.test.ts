import assert from 'node:assert/strict';
import type { BusinessConfig } from '../types';
import { fetchPublicBusiness, requestAIResponse } from './chatApi';

const originalFetch = globalThis.fetch;
const business: BusinessConfig = {
  id: 'store-1',
  ownerId: 'private-owner',
  name: 'Test Store',
  products: [],
  faqs: [],
  customGeminiApiKey: 'must-not-leave-the-server',
};

let requestBody: Record<string, unknown> = {};
globalThis.fetch = async (_input, init) => {
  requestBody = JSON.parse(String(init?.body || '{}'));
  return new Response(JSON.stringify({
    response: {
      intent: 'general',
      reply: 'স্বাগতম',
      order_data: {},
      conversation_stage: 'new_lead',
      event_name: 'Lead',
      need_more_info: false,
      confidence: 1,
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const response = await requestAIResponse({
  userMessage: 'হ্যালো',
  chatHistory: '',
  businessConfig: business,
});
assert.equal(response.reply, 'স্বাগতম');
assert.equal(requestBody.businessId, 'store-1');
assert.equal(requestBody.message, 'হ্যালো');
assert.equal('businessConfig' in requestBody, false);
assert.equal(JSON.stringify(requestBody).includes('must-not-leave-the-server'), false);

globalThis.fetch = async () => new Response('Not found', { status: 404 });
assert.equal(await fetchPublicBusiness('missing'), null);

globalThis.fetch = originalFetch;
console.log('chatApi tests passed');

