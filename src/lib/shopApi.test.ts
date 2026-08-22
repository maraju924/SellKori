import assert from 'node:assert/strict';
import { checkoutShop, fetchShop, trackShopOrders } from './shopApi.ts';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/api/shop/missing')) {
    return new Response('Not found', { status: 404 });
  }
  if (url.includes('/api/shop/biz-1/checkout')) {
    return new Response(JSON.stringify({
      order: { id: 'ORD-WEB-1', productName: 'শার্ট', quantity: 1, totalPrice: 570, status: 'confirmed' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('/api/shop/biz-1/orders')) {
    return new Response(JSON.stringify({ orders: [{ id: 'ORD-WEB-1' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ id: 'biz-1', name: 'টেস্ট শপ', products: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

assert.equal(await fetchShop('missing'), null);
const shop = await fetchShop('biz-1');
assert.equal(shop?.name, 'টেস্ট শপ');

const placed = await checkoutShop({
  businessId: 'biz-1',
  items: [{ productId: 'p1', quantity: 1 }],
  customer: { name: 'করিম', phone: '01712345678', address: 'মিরপুর ১০, ঢাকা' },
});
assert.equal(placed.order.id, 'ORD-WEB-1');

const tracked = await trackShopOrders({ businessId: 'biz-1', phone: '01712345678' });
assert.equal(tracked[0]?.id, 'ORD-WEB-1');

globalThis.fetch = originalFetch;
console.log('shopApi tests passed');
