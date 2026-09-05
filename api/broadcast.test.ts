import assert from 'node:assert/strict';
import handler, { maxDuration } from './broadcast.js';
import {
  broadcastFeaturesAllowed,
  clipBroadcastMessage,
  clipBroadcastTitle,
  normalizeBroadcastAudience,
  pageTokenForBusiness,
} from './broadcastCore.js';
import { parseBroadcastRequest, readJsonBody } from './broadcastRoute.js';

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
  assert.equal(maxDuration, 60);
}

function testAudience() {
  assert.equal(normalizeBroadcastAudience(''), 'all');
  assert.equal(normalizeBroadcastAudience('ALL'), 'all');
  assert.equal(normalizeBroadcastAudience('hot'), 'hot_leads');
  assert.equal(normalizeBroadcastAudience('hot_leads'), 'hot_leads');
  assert.equal(normalizeBroadcastAudience('leads'), 'hot_leads');
  assert.equal(normalizeBroadcastAudience('buyer'), 'buyers');
  assert.equal(normalizeBroadcastAudience('buyers'), 'buyers');
}

function testFeatureGate() {
  assert.equal(broadcastFeaturesAllowed(undefined), true);
  assert.equal(broadcastFeaturesAllowed({}), true);
  assert.equal(broadcastFeaturesAllowed({ broadcastingEnabled: true, messengerRepliesEnabled: true }), true);
  assert.equal(broadcastFeaturesAllowed({ broadcastingEnabled: false }), false);
  assert.equal(broadcastFeaturesAllowed({ messengerRepliesEnabled: false }), false);
}

function testPageToken() {
  const business = {
    pageAccessToken: 'root-token',
    messengerPages: [
      { pageId: '111', pageAccessToken: 'page-111', enabled: true },
      { pageId: '222', pageAccessToken: 'page-222', enabled: false },
    ],
  };
  assert.equal(pageTokenForBusiness(business), 'root-token');
  assert.equal(pageTokenForBusiness(business, '111'), 'page-111');
  assert.equal(pageTokenForBusiness(business, '222'), 'root-token');
  assert.equal(pageTokenForBusiness({ messengerPages: business.messengerPages }, '222'), 'page-111');
  assert.equal(pageTokenForBusiness({ accessToken: 'legacy' }), 'legacy');
}

function testClips() {
  assert.equal(clipBroadcastTitle(''), 'মেসেঞ্জার অফার');
  assert.equal(clipBroadcastTitle(' উইকেন্ড '), 'উইকেন্ড');
  assert.equal(clipBroadcastMessage('  hello  '), 'hello');
  assert.equal(clipBroadcastMessage('x'.repeat(2000)).length, 1900);
}

function testParsesPreviewPath() {
  const parsed = parseBroadcastRequest({
    method: 'POST',
    url: '/api/broadcast/preview',
  });
  assert.equal(parsed.op, 'preview');
  assert.equal(parsed.method, 'POST');
}

function testParsesSendPath() {
  const parsed = parseBroadcastRequest({
    method: 'POST',
    url: '/api/broadcast',
  });
  assert.equal(parsed.op, 'send');
}

function testParsesRewrittenPreview() {
  const parsed = parseBroadcastRequest({
    method: 'POST',
    url: '/api/broadcast?op=preview',
    query: { op: 'preview' },
  });
  assert.equal(parsed.op, 'preview');
}

function testPrefersOriginalUrlAfterRewrite() {
  const parsed = parseBroadcastRequest({
    method: 'POST',
    url: '/api/broadcast',
    originalUrl: '/api/broadcast/preview',
  });
  assert.equal(parsed.op, 'preview');
}

function testReadsJsonBody() {
  assert.equal(readJsonBody({ body: { businessId: 'biz-1' } }).businessId, 'biz-1');
  assert.equal(readJsonBody({ body: '{"targetAudience":"buyers"}' }).targetAudience, 'buyers');
}

async function testHandlerRejectsGet() {
  const res = mockRes();
  await handler({ method: 'GET', url: '/api/broadcast/preview' }, res);
  assert.equal(res.statusCode, 405);
  const json = JSON.parse(res.body);
  assert.equal(json.success, false);
  assert.equal(res.headers.Allow, 'POST');
}

async function testPreviewRequiresBusinessId() {
  const res = mockRes();
  await handler({ method: 'POST', url: '/api/broadcast/preview', body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /businessId/);
}

async function testSendRequiresMessage() {
  const res = mockRes();
  await handler({ method: 'POST', url: '/api/broadcast', body: { businessId: 'biz-1' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /মেসেজ/);
}

testMaxDuration();
testAudience();
testFeatureGate();
testPageToken();
testClips();
testParsesPreviewPath();
testParsesSendPath();
testParsesRewrittenPreview();
testPrefersOriginalUrlAfterRewrite();
testReadsJsonBody();
await testHandlerRejectsGet();
await testPreviewRequiresBusinessId();
await testSendRequiresMessage();
console.log('broadcast tests passed');
