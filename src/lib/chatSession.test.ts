import assert from 'node:assert/strict';
import { chatSessionKey, clearChatSession, loadChatSession, saveChatSession } from './chatSession';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const storage = new MemoryStorage();
const businessId = 'shop-1';

saveChatSession(storage, businessId, {
  messages: [{
    id: 'm1',
    role: 'user',
    content: 'দাম কত?',
    timestamp: 100,
    deliveryStatus: 'sending',
  }],
  summary: 'দাম জানতে চেয়েছেন',
  collected: { phone: '01700000000' },
  orderPlacedId: '',
});

assert.deepEqual(loadChatSession(storage, businessId), {
  messages: [{
    id: 'm1',
    role: 'user',
    content: 'দাম কত?',
    timestamp: 100,
  }],
  summary: 'দাম জানতে চেয়েছেন',
  collected: { phone: '01700000000' },
  orderPlacedId: '',
});

storage.setItem(chatSessionKey(businessId), '{broken');
assert.deepEqual(loadChatSession(storage, businessId), {
  messages: [],
  summary: '',
  collected: {},
  orderPlacedId: '',
});

storage.setItem(chatSessionKey(businessId), JSON.stringify({
  messages: [
    { id: 'bad', role: 'admin', content: 'ignore me', timestamp: 1 },
    { id: 'good', role: 'assistant', content: 'স্বাগতম', timestamp: 2 },
  ],
}));
assert.equal(loadChatSession(storage, businessId).messages.length, 1);

storage.setItem(`sellkori_mem_${businessId}`, '{}');
clearChatSession(storage, businessId);
assert.equal(storage.getItem(chatSessionKey(businessId)), null);
assert.equal(storage.getItem(`sellkori_mem_${businessId}`), null);

console.log('chatSession tests passed');

