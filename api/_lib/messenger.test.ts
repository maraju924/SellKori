import assert from 'node:assert/strict';
import handler, { maxDuration } from '../messenger.js';
import {
  MANUAL_SUBSCRIBE_HINT,
  PAGE_SUBSCRIBE_FIELDS,
  evaluateSubscriptionState,
  pageSubscriptionsIncludeField,
  tokenSuccessPayload,
} from './messengerTokenCore.js';
import { parseMessengerTokenRequest, readJsonBody } from './messengerTokenRoute.js';

function mockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 0,
    headers,
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    end(payload: string) {
      res.body = payload;
    },
  };
  return res;
}

function testMaxDuration() {
  assert.equal(maxDuration, 30);
}

function testSubscribeFields() {
  assert.ok(PAGE_SUBSCRIBE_FIELDS.includes('messages'));
  assert.ok(PAGE_SUBSCRIBE_FIELDS.includes('feed'));
}

function testSubscriptionFieldHelper() {
  assert.equal(pageSubscriptionsIncludeField({ data: [{ subscribed_fields: ['messages', 'feed'] }] }, 'feed'), true);
  assert.equal(pageSubscriptionsIncludeField({ data: [{ subscribedFields: ['messages'] }] }, 'feed'), false);
  assert.equal(pageSubscriptionsIncludeField({}, 'feed'), false);
}

function testEvaluateSubscription() {
  const auto = evaluateSubscriptionState({ autoSubscribeOk: true, subscribeError: '', subscriptions: null });
  assert.equal(auto.subscribed, true);
  assert.equal(auto.needsManualSubscribe, false);
  assert.equal(auto.hasFeed, true);

  const alreadyListed = evaluateSubscriptionState({
    autoSubscribeOk: false,
    subscribeError: '(#200) permission',
    subscriptions: { data: [{ subscribed_fields: ['messages', 'feed'] }] },
  });
  assert.equal(alreadyListed.subscribed, true);
  assert.equal(alreadyListed.subscribeError, '');
  assert.equal(alreadyListed.hasFeed, true);
  assert.equal(alreadyListed.needsManualSubscribe, false);

  const needsManual = evaluateSubscriptionState({
    autoSubscribeOk: false,
    subscribeError: 'pages_manage_metadata required',
    subscriptions: { data: [] },
  });
  assert.equal(needsManual.subscribed, false);
  assert.equal(needsManual.needsManualSubscribe, true);

  const missingFeed = evaluateSubscriptionState({
    autoSubscribeOk: false,
    subscribeError: '',
    subscriptions: { data: [{ subscribed_fields: ['messages'] }] },
  });
  assert.equal(missingFeed.subscribed, true);
  assert.equal(missingFeed.hasFeed, false);
  assert.equal(missingFeed.needsManualSubscribe, true);
}

function testTokenPayloadHint() {
  const payload = tokenSuccessPayload({
    page: { id: '1', name: 'Shop' },
    subscribed: false,
    subscribeError: 'permission',
    subscriptions: null,
    needsManualSubscribe: true,
    hasFeed: false,
  });
  assert.equal(payload.success, true);
  assert.equal(payload.manualSubscribeHint, MANUAL_SUBSCRIBE_HINT);
}

function testParsesTestTokenPath() {
  assert.equal(parseMessengerTokenRequest({ method: 'POST', url: '/api/messenger/test-token' }).op, 'test-token');
}

function testParsesSubscribePath() {
  assert.equal(parseMessengerTokenRequest({ method: 'POST', url: '/api/messenger/subscribe-page' }).op, 'subscribe-page');
}

function testParsesRewrittenOp() {
  assert.equal(parseMessengerTokenRequest({
    method: 'POST',
    url: '/api/messenger?op=test-token',
    query: { op: 'test-token' },
  }).op, 'test-token');
}

function testPrefersOriginalUrl() {
  assert.equal(parseMessengerTokenRequest({
    method: 'POST',
    url: '/api/messenger',
    originalUrl: '/api/messenger/subscribe-page',
  }).op, 'subscribe-page');
}

function testReadsBody() {
  assert.equal(readJsonBody({ body: { pageAccessToken: 'EAAG' } }).pageAccessToken, 'EAAG');
}

async function testHandlerRejectsGet() {
  const res = mockRes();
  await handler({ method: 'GET', url: '/api/messenger/test-token' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(JSON.parse(res.body).success, false);
}

async function testHandlerRequiresToken() {
  const res = mockRes();
  await handler({ method: 'POST', url: '/api/messenger/test-token', body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /Page Access Token/);
}

testMaxDuration();
testSubscribeFields();
testSubscriptionFieldHelper();
testEvaluateSubscription();
testTokenPayloadHint();
testParsesTestTokenPath();
testParsesSubscribePath();
testParsesRewrittenOp();
testPrefersOriginalUrl();
testReadsBody();
await testHandlerRejectsGet();
await testHandlerRequiresToken();
console.log('messenger token tests passed');
