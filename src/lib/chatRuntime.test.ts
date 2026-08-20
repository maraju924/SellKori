import assert from 'node:assert/strict';
import {
  CHAT_MEMORY_LIMIT,
  isExplicitOrderConfirmation,
  shouldCreateConfirmedOrder,
  takeRecentMessages,
} from './chatRuntime.ts';

const messages = Array.from({ length: 125 }, (_, index) => index + 1);
const recent = takeRecentMessages(messages);
assert.equal(recent.length, CHAT_MEMORY_LIMIT);
assert.equal(recent[0], 26);
assert.equal(recent.at(-1), 125);

assert.equal(isExplicitOrderConfirmation('ঠিক আছে'), true);
assert.equal(isExplicitOrderConfirmation('অর্ডারটা কনফার্ম করেন'), true);
assert.equal(isExplicitOrderConfirmation('confirm'), true);
assert.equal(isExplicitOrderConfirmation('অর্ডার কনফার্ম করবেন না'), false);
assert.equal(isExplicitOrderConfirmation('এখন অর্ডার চাই না'), false);
assert.equal(isExplicitOrderConfirmation('দাম কত?'), false);
assert.equal(isExplicitOrderConfirmation('দাম কত জি'), false);

assert.equal(shouldCreateConfirmedOrder({
  modelRequested: false,
  customerMessage: 'জি',
  hasCompleteOrder: true,
}), true);
assert.equal(shouldCreateConfirmedOrder({
  modelRequested: true,
  customerMessage: 'কনফার্ম',
  hasCompleteOrder: false,
}), false);
assert.equal(shouldCreateConfirmedOrder({
  modelRequested: true,
  customerMessage: 'অর্ডার করবেন না',
  hasCompleteOrder: true,
}), false);

console.log('chatRuntime tests passed');
