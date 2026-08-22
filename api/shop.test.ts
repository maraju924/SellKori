import assert from 'node:assert/strict';
import { parseShopRequest, readJsonBody, requestPathname } from './shopRoute.js';
import { maxDuration } from './health.js';
import { buildStoreCheckoutOrder, isInsideDhakaDelivery } from './shopCheckout.js';

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

function testCheckoutValidationAndZone() {
  assert.equal(isInsideDhakaDelivery({ district: 'ঢাকা' }), true);
  assert.equal(isInsideDhakaDelivery({ district: 'বগুড়া' }), false);
  const invalid = buildStoreCheckoutOrder({
    business: { id: 'biz-1', products: [{ id: 'p1', name: 'পণ্য', price: 100, isAvailable: true }] },
    lines: [{ productId: 'p1', quantity: 1 }],
    customer: { name: 'ক', phone: '017', address: 'short' },
  });
  assert.equal(invalid.ok, false);

  const built = buildStoreCheckoutOrder({
    business: {
      id: 'biz-1',
      ownerId: 'owner-1',
      products: [{ id: 'p1', name: 'পণ্য', price: 100, stock: 5, isAvailable: true }],
      courierConfig: { deliveryChargeInsideDhaka: 70, deliveryChargeOutsideDhaka: 130 },
    },
    lines: [{ productId: 'p1', quantity: 1 }],
    customer: {
      name: 'করিম আহমেদ',
      phone: '01712345678',
      address: 'বাড়ি ১২ রোড ৫ সদর',
      district: 'বগুড়া',
      insideDhaka: true,
    },
    now: 1,
    orderId: 'ORD-TEST',
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.value.order.insideDhaka, false);
  assert.equal(built.value.order.deliveryFee, 130);
  assert.equal(built.value.order.totalPrice, 230);
}

testCheckoutValidationAndZone();
console.log('api/shop tests passed');
