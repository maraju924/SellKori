import assert from 'node:assert/strict';
import {
  fallbackShopSlug,
  isReservedShopSlug,
  isValidShopSlug,
  nextShopSlugCandidate,
  normalizeShopSlug,
  matchRequestedShopSlug,
  publicShopSlug,
  shopPublicPath,
  shopPublicUrl,
  slugEditDistance,
  slugifyStoreName,
  suggestedShopSlug,
} from './storeSlug.ts';

assert.equal(slugifyStoreName('My Shop'), 'myshop');
assert.equal(slugifyStoreName('Al Amin Computer'), 'alamincomputer');
assert.equal(slugifyStoreName('Fashion-House BD'), 'fashionhousebd');
assert.equal(slugifyStoreName('ফ্যাশন হাউজ'), '');
assert.equal(normalizeShopSlug(' My-Shop!! '), 'my-shop');
assert.equal(isReservedShopSlug('login'), true);
assert.equal(isReservedShopSlug('myshop'), false);
assert.equal(isValidShopSlug('myshop'), true);
assert.equal(isValidShopSlug('my-shop'), true);
assert.equal(isValidShopSlug('login'), false);
assert.equal(isValidShopSlug('a'), false);

assert.equal(suggestedShopSlug({ name: 'My Shop', id: 'biz-1' }), 'myshop');
assert.equal(suggestedShopSlug({ name: 'ফ্যাশন হাউজ', id: 'biz-123456789' }), fallbackShopSlug('biz-123456789'));
assert.equal(suggestedShopSlug({ slug: 'Custom-Link', name: 'Other' }), 'custom-link');
assert.equal(nextShopSlugCandidate('myshop', 1), 'myshop');
assert.equal(nextShopSlugCandidate('myshop', 2), 'myshop2');

assert.equal(publicShopSlug({ slug: 'myshop', id: 'biz-9', name: 'Ignored' }), 'myshop');
assert.equal(shopPublicPath({ slug: 'myshop' }, 'cart'), '/myshop/cart');
assert.equal(shopPublicPath('myshop', 'p/1'), '/myshop/p/1');
assert.equal(shopPublicUrl('https://sell-kori.vercel.app', { slug: 'myshop' }), 'https://sell-kori.vercel.app/myshop');

assert.equal(slugEditDistance('rojbeauty', 'rojbeuty'), 1);
assert.equal(slugifyStoreName('Roj Beauty'), 'rojbeauty');
assert.deepEqual(
  matchRequestedShopSlug(
    [{ id: 'b1', name: 'Roj Beauty' }, { id: 'b2', name: 'My Shop' }],
    'rojbeuty'
  ),
  { id: 'b1', kind: 'close' }
);
assert.equal(
  matchRequestedShopSlug(
    [{ id: 'b1', slug: 'rojbeuty', name: 'Roj Beauty' }],
    'rojbeuty'
  )?.kind,
  'exact'
);

console.log('storeSlug tests passed');
