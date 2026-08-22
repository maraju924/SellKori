import assert from 'node:assert/strict';
import type { BusinessConfig, Product } from '../types';
import {
  addCartLine,
  addressLooksInsideDhaka,
  isInsideDhakaDelivery,
  bestPricingTier,
  buildStoreCheckoutOrder,
  cartItemCount,
  cartSignatureOf,
  decrementShopStock,
  filterShopProducts,
  findShopProduct,
  isRepeatWebsiteCheckout,
  isShopProductBuyable,
  maxBuyableQuantity,
  orderItemsOf,
  orderProductLabel,
  parseStoredCart,
  productPath,
  removeCartLine,
  resolveCart,
  sanitizeCart,
  setCartLineQuantity,
  shopPath,
  unitPriceForQuantity,
  validateShopCheckout,
} from './storefront.ts';

const shirt: Product = {
  id: 'p1',
  name: 'প্রিমিয়াম শার্ট',
  price: 500,
  description: 'কটন শার্ট',
  category: 'পোশাক',
  stock: 8,
  isAvailable: true,
  pricingTiers: [
    { quantity: 1, price: 500, minPrice: 450, label: '১ পিস' },
    { quantity: 2, price: 900, minPrice: 850, label: '২ পিস' },
  ],
};

const ink: Product = {
  id: 'p2',
  name: 'প্রিন্টার ইঙ্ক',
  price: 350,
  description: 'কালো ইঙ্ক',
  category: 'প্রিন্টিং',
  stock: 0,
  isAvailable: true,
};

const hidden: Product = {
  id: 'p3',
  name: 'গোপন',
  price: 10,
  description: '',
  isAvailable: false,
};

const business: Pick<BusinessConfig, 'id' | 'ownerId' | 'courierConfig' | 'products'> = {
  id: 'biz-1',
  ownerId: 'owner-1',
  products: [shirt, ink, hidden],
  courierConfig: {
    deliveryChargeInsideDhaka: 70,
    deliveryChargeOutsideDhaka: 130,
  },
};

function testCartMerge() {
  const cart = addCartLine(addCartLine([], 'p1', 2), 'p1', 1);
  assert.deepEqual(cart, [{ productId: 'p1', quantity: 3 }]);
  assert.equal(cartItemCount(cart), 3);
  assert.deepEqual(setCartLineQuantity(cart, 'p1', 0), []);
  assert.deepEqual(removeCartLine(addCartLine(cart, 'p2', 1), 'p1'), [{ productId: 'p2', quantity: 1 }]);
  assert.deepEqual(sanitizeCart([{ productId: '', quantity: 2 }, { productId: 'x', quantity: -3 }]), []);
  assert.deepEqual(parseStoredCart('[{"productId":"p1","quantity":2}]'), [{ productId: 'p1', quantity: 2 }]);
  assert.deepEqual(parseStoredCart('not-json'), []);
}

function testPricing() {
  assert.equal(unitPriceForQuantity(shirt, 1), 500);
  assert.equal(unitPriceForQuantity(shirt, 2), 450);
  assert.equal(bestPricingTier(shirt, 2)?.label, '২ পিস');
  assert.equal(maxBuyableQuantity(shirt), 8);
  assert.equal(maxBuyableQuantity(ink), 50);
  assert.equal(isShopProductBuyable(hidden), false);
}

function testResolveCart() {
  const totals = resolveCart(business.products, [{ productId: 'p1', quantity: 2 }, { productId: 'p3', quantity: 1 }], {
    address: 'মিরপুর, ঢাকা',
    business,
  });
  assert.equal(totals.lines.length, 1);
  assert.equal(totals.subtotal, 900);
  assert.equal(totals.insideDhaka, true);
  assert.equal(totals.deliveryFee, 70);
  assert.equal(totals.total, 970);

  const outside = resolveCart(business.products, [{ productId: 'p2', quantity: 1 }], {
    address: 'বগুড়া সদর',
    business,
  });
  assert.equal(outside.insideDhaka, false);
  assert.equal(outside.deliveryFee, 130);
}

function testFilter() {
  const products = [shirt, ink, hidden];
  assert.equal(filterShopProducts(products, '', 'সব').length, 2);
  assert.equal(filterShopProducts(products, 'ইঙ্ক').map(p => p.id).join(), 'p2');
  assert.equal(filterShopProducts(products, '', 'পোশাক').length, 1);
}

function testCheckoutValidation() {
  const missing = validateShopCheckout(business.products, [{ productId: 'p1', quantity: 1 }], {
    name: 'আ',
    phone: '017',
    address: 'ঢাকা',
  });
  assert.equal(missing.some(i => i.field === 'name'), true);
  assert.equal(missing.some(i => i.field === 'phone'), true);
  assert.equal(missing.some(i => i.field === 'address'), true);

  const overstock = validateShopCheckout(business.products, [{ productId: 'p1', quantity: 99 }], {
    name: 'রহিম',
    phone: '01712345678',
    address: 'মিরপুর ১০, ঢাকা',
  });
  assert.equal(overstock.some(i => i.field === 'stock'), true);
}

function testBuildOrder() {
  const result = buildStoreCheckoutOrder({
    business,
    lines: [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }],
    customer: {
      name: 'করিম আহমেদ',
      phone: '01712345678',
      address: 'বাড়ি ১২, রোড ৫, বগুড়া',
      district: 'বগুড়া',
      notes: 'সন্ধ্যায় ডেলিভারি',
    },
    sessionId: 'web-abc',
    now: 1_700_000_000_000,
    orderId: 'ORD-WEB-TEST',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const { order, inventory } = result.value;
  assert.equal(order.id, 'ORD-WEB-TEST');
  assert.equal(order.source, 'website');
  assert.equal(order.paymentMethod, 'cod');
  assert.equal(order.items?.length, 2);
  assert.equal(order.quantity, 3);
  assert.equal(order.insideDhaka, false);
  assert.equal(order.deliveryFee, 130);
  assert.equal(order.totalPrice, 900 + 350 + 130);
  assert.equal(order.phone, '01712345678');
  assert.match(order.address, /বগুড়া/);
  assert.equal(order.cartSignature, cartSignatureOf(order.items || []));
  assert.deepEqual(inventory, [
    { productId: 'p1', quantity: 2 },
    { productId: 'p2', quantity: 1 },
  ]);
}

function testDeliveryZoneIgnoresClientToggle() {
  assert.equal(isInsideDhakaDelivery({ district: 'ঢাকা', address: 'মিরপুর ১০' }), true);
  assert.equal(isInsideDhakaDelivery({ district: 'বগুড়া', address: 'সদর' }), false);
  assert.equal(isInsideDhakaDelivery({ address: 'মিরপুর, ঢাকা' }), true);

  const forced = buildStoreCheckoutOrder({
    business,
    lines: [{ productId: 'p1', quantity: 1 }],
    customer: {
      name: 'করিম আহমেদ',
      phone: '01712345678',
      address: 'বাড়ি ১২, রোড ৫, বগুড়া সদর',
      district: 'বগুড়া',
      insideDhaka: true,
    },
    now: 2,
    orderId: 'ORD-ZONE',
  });
  assert.equal(forced.ok, true);
  if (!forced.ok) return;
  assert.equal(forced.value.order.insideDhaka, false);
  assert.equal(forced.value.order.deliveryFee, 130);
  assert.equal(JSON.stringify(forced.value.order).includes('undefined'), false);
}

function testIgnoreClientPrices() {
  const cheap: Product = { ...shirt, price: 500 };
  const result = buildStoreCheckoutOrder({
    business: { ...business, products: [cheap] },
    lines: [{ productId: 'p1', quantity: 1 }],
    customer: {
      name: 'করিম আহমেদ',
      phone: '01712345678',
      address: 'মিরপুর ১০, ঢাকা ১২১৬',
    },
    now: 1,
    orderId: 'ORD-1',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.order.unitPrice, 500);
  assert.equal(result.value.order.totalPrice, 570);
}

function testDuplicateWindow() {
  const existing = {
    phone: '01712345678',
    cartSignature: 'p1:1',
    createdAtMs: 1000,
    status: 'confirmed',
  };
  assert.equal(
    isRepeatWebsiteCheckout(existing, { phone: '01712345678', cartSignature: 'p1:1' }, 1000 + 30_000),
    true
  );
  assert.equal(
    isRepeatWebsiteCheckout(existing, { phone: '01712345678', cartSignature: 'p1:2' }, 1000 + 30_000),
    false
  );
  assert.equal(
    isRepeatWebsiteCheckout(existing, { phone: '01712345678', cartSignature: 'p1:1' }, 1000 + 3 * 60_000),
    false
  );
}

function testStockAndLabels() {
  const next = decrementShopStock([shirt, ink], [{ productId: 'p1', quantity: 3 }]);
  assert.equal(next[0].stock, 5);
  assert.equal(next[1].stock, 0);

  const multi = orderItemsOf({
    items: [
      { productId: 'p1', productName: 'শার্ট', quantity: 2, unitPrice: 450, lineTotal: 900 },
      { productId: 'p2', productName: 'ইঙ্ক', quantity: 1, unitPrice: 350, lineTotal: 350 },
    ],
    productName: 'শার্ট, ইঙ্ক',
    quantity: 3,
    unitPrice: 450,
  });
  assert.equal(orderProductLabel({ items: multi, productName: 'শার্ট, ইঙ্ক', quantity: 3, unitPrice: 450 }), 'শার্ট × 2, ইঙ্ক × 1');
  assert.equal(orderProductLabel({ productName: 'পুরনো অর্ডার', quantity: 2, unitPrice: 100 }), 'পুরনো অর্ডার × 2');
}

function testHelpers() {
  assert.equal(shopPath('myshop', 'cart'), '/myshop/cart');
  assert.equal(shopPath({ slug: 'myshop', id: 'biz-1' }, 'checkout'), '/myshop/checkout');
  assert.equal(addressLooksInsideDhaka('গুলশান ২'), true);
  assert.equal(addressLooksInsideDhaka('সিলেট সদর'), false);
  assert.equal(productPath({ slug: 'myshop' }, { ...shirt, slug: 'premium-shirt' }), '/myshop/p/premium-shirt');
  assert.equal(productPath({ slug: 'myshop' }, shirt), '/myshop/p/p1');
  assert.equal(findShopProduct([shirt], 'p1')?.name, shirt.name);
  assert.equal(findShopProduct([{ ...shirt, slug: 'premium-shirt' }], 'premium-shirt')?.id, 'p1');
}

function testVariantCart() {
  const cart = addCartLine(addCartLine([], 'p1', 1, 'XL'), 'p1', 1, 'M');
  assert.equal(cart.length, 2);
  const merged = addCartLine(cart, 'p1', 1, 'XL');
  assert.equal(merged.find(line => line.variant === 'XL')?.quantity, 2);
  assert.equal(merged.find(line => line.variant === 'M')?.quantity, 1);
}

testCartMerge();
testPricing();
testResolveCart();
testFilter();
testCheckoutValidation();
testBuildOrder();
testDeliveryZoneIgnoresClientToggle();
testIgnoreClientPrices();
testDuplicateWindow();
testStockAndLabels();
testHelpers();
testVariantCart();
console.log('storefront tests passed');
