import assert from 'node:assert/strict';
import { parseShopRequest, readJsonBody, requestPathname } from './shopRoute.js';
import { maxDuration } from './health.js';

function testHealthExport() {
  assert.equal(maxDuration, 10);
}

function testParsesRootShopPath() {
  const parsed = parseShopRequest({
    method: 'GET',
    url: '/api/shop/rojbeuty',
  });
  assert.equal(parsed.op, 'get');
  assert.equal(parsed.businessId, 'rojbeuty');
}

function testParsesCheckoutPath() {
  const parsed = parseShopRequest({
    method: 'POST',
    url: '/api/shop/rojbeuty/checkout',
  });
  assert.equal(parsed.op, 'checkout');
  assert.equal(parsed.businessId, 'rojbeuty');
}

function testParsesOrdersPath() {
  const parsed = parseShopRequest({
    method: 'GET',
    url: '/api/shop/myshop/orders?phone=01712345678',
  });
  assert.equal(parsed.op, 'orders');
  assert.equal(parsed.businessId, 'myshop');
  assert.equal(parsed.query.phone, '01712345678');
}

function testParsesRewrittenQuery() {
  const parsed = parseShopRequest({
    method: 'GET',
    url: '/api/shop?businessId=rojbeuty',
    query: { businessId: 'rojbeuty' },
  });
  assert.equal(parsed.op, 'get');
  assert.equal(parsed.businessId, 'rojbeuty');
}

function testParsesRewrittenCheckout() {
  const parsed = parseShopRequest({
    method: 'POST',
    url: '/api/shop?businessId=rojbeuty&op=checkout',
    query: { businessId: 'rojbeuty', op: 'checkout' },
  });
  assert.equal(parsed.op, 'checkout');
  assert.equal(parsed.businessId, 'rojbeuty');
}

function testParsesSlugCheck() {
  const parsed = parseShopRequest({
    method: 'GET',
    url: '/api/public/shop-slug?slug=myshop',
  });
  assert.equal(parsed.op, 'slug');
  assert.equal(parsed.query.slug, 'myshop');
}

function testPrefersOriginalUrlAfterRewrite() {
  const parsed = parseShopRequest({
    method: 'GET',
    url: '/api/shop',
    originalUrl: '/api/shop/rojbeauty/orders?phone=01700000000',
  });
  assert.equal(parsed.op, 'orders');
  assert.equal(parsed.businessId, 'rojbeauty');
}

function testReadsJsonBody() {
  assert.deepEqual(readJsonBody({ body: { items: [{ productId: 'p1', quantity: 1 }] } }).items[0].productId, 'p1');
  assert.deepEqual(readJsonBody({ body: '{"ok":true}' }), { ok: true });
  assert.deepEqual(readJsonBody({ body: Buffer.from('{"n":2}') }), { n: 2 });
}

function testRequestPathname() {
  assert.equal(requestPathname({ url: '/api/shop/foo?x=1' }), '/api/shop/foo');
}

testHealthExport();
testParsesRootShopPath();
testParsesCheckoutPath();
testParsesOrdersPath();
testParsesRewrittenQuery();
testParsesRewrittenCheckout();
testParsesSlugCheck();
testPrefersOriginalUrlAfterRewrite();
testReadsJsonBody();
testRequestPathname();
console.log('api/shop tests passed');
