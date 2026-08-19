import assert from 'node:assert/strict';
import {
  classifyWebhookToken,
  DEFAULT_MESSENGER_VERIFY_TOKEN,
  deterministicVerifyToken,
  extractWebhookBusinessId,
  firstQueryValue,
  isMetaPageWebhookPayload,
  isMetaWebhookVerification,
  isVercelFunctionPath,
  parseWebhookVerification,
  resolveRequestPath,
  tokenMatchesBusiness,
  withTimeout
} from './messengerWebhook.ts';

function testQueryParsing() {
  assert.equal(firstQueryValue(['abc', 'def']), 'abc');
  assert.equal(firstQueryValue(1158201444 as unknown as string), '1158201444');

  const parsed = parseWebhookVerification({
    'hub.mode': 'subscribe',
    'hub.challenge': ['1158201444'],
    'hub.verify_token': ' sk_store1 '
  });
  assert.equal(parsed.mode, 'subscribe');
  assert.equal(parsed.challenge, '1158201444');
  assert.equal(parsed.token, 'sk_store1');
  assert.equal(isMetaWebhookVerification(parsed as unknown as Record<string, unknown>), true);
  assert.equal(
    isMetaWebhookVerification({
      'hub.mode': 'subscribe',
      'hub.challenge': '1158201444',
      'hub.verify_token': 'x'
    }),
    true
  );
  assert.equal(isMetaWebhookVerification({ 'hub.mode': 'subscribe' }), false);
}

function testPayloadDetection() {
  assert.equal(isMetaPageWebhookPayload({ object: 'page', entry: [] }), true);
  assert.equal(isMetaPageWebhookPayload({ object: 'user', entry: [] }), false);
  assert.equal(isMetaPageWebhookPayload({ object: 'page' }), false);
  assert.equal(isMetaPageWebhookPayload(null), false);
}

function testPathRestoreAndBusinessId() {
  assert.equal(isVercelFunctionPath('/api/index.ts'), true);
  assert.equal(isVercelFunctionPath('/api/webhook'), false);

  const restored = resolveRequestPath({
    path: '/api/index.ts',
    url: '/api/index.ts?hub.mode=subscribe',
    headers: { 'x-forwarded-uri': '/api/webhook/biz_123?hub.mode=subscribe' }
  });
  assert.equal(restored, '/api/webhook/biz_123');
  assert.equal(extractWebhookBusinessId(restored), 'biz_123');
  assert.equal(extractWebhookBusinessId('/api/webhook'), undefined);
  assert.equal(extractWebhookBusinessId('/api/webhook/webhook'), undefined);
  assert.equal(extractWebhookBusinessId('/api/index.ts', { businessId: 'store-9' }), 'store-9');
}

function testTokenRules() {
  const business = { messengerVerifyToken: 'shop-secret', id: 'abc' };
  assert.equal(tokenMatchesBusiness('shop-secret', business), true);
  assert.equal(tokenMatchesBusiness('sk_abc', business, 'abc'), true);
  assert.equal(tokenMatchesBusiness('abc', {}, 'abc'), true);
  assert.equal(tokenMatchesBusiness('nope', business, 'zzz'), false);

  assert.equal(classifyWebhookToken({ token: '' }).authorized, false);
  assert.equal(classifyWebhookToken({ token: DEFAULT_MESSENGER_VERIFY_TOKEN }).reason, 'platform');
  assert.equal(classifyWebhookToken({ token: 'abc', businessId: 'abc' }).reason, 'business-id');
  assert.equal(classifyWebhookToken({ token: 'shop-secret', business }).reason, 'business-token');
  assert.equal(classifyWebhookToken({ token: 'random-from-meta' }).reason, 'subscribe-handshake');
  assert.equal(classifyWebhookToken({ token: 'random-from-meta' }).authorized, true);
  assert.equal(deterministicVerifyToken('store99'), 'sk_store99');
}

async function testTimeout() {
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 50));
  const value = await withTimeout(slow, 5, 'fallback');
  assert.equal(value, 'fallback');
}

testQueryParsing();
testPayloadDetection();
testPathRestoreAndBusinessId();
testTokenRules();
await testTimeout();
console.log('messengerWebhook tests passed');
