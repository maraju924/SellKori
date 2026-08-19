import assert from 'node:assert/strict';
import {
  asProductList,
  findSavedProduct,
  prepareProductsForWrite,
  productLooksUpdated,
  readInputValue,
  replaceEditedProduct,
  sameProductId,
  sanitizeProduct,
  stripInlineDataUrls
} from './productCatalog.ts';

function testSameProductId() {
  assert.equal(sameProductId('abc', 'abc'), true);
  assert.equal(sameProductId(' abc ', 'abc'), true);
  assert.equal(sameProductId(12, '12'), true);
  assert.equal(sameProductId('', ''), false);
  assert.equal(sameProductId(null, 'a'), false);
}

function testAsProductList() {
  assert.deepEqual(asProductList(undefined), []);
  assert.equal(asProductList([{ id: '1', name: 'A' }]).length, 1);
  const fromMap = asProductList({ a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } });
  assert.equal(fromMap.length, 2);
}

function testReplaceById() {
  const list = [
    { id: '1', name: 'Old', price: 10, description: '' },
    { id: '2', name: 'Keep', price: 20, description: '' }
  ];
  const payload = sanitizeProduct({ id: '1', name: 'New', price: 99, description: 'x', stock: 3 });
  const result = replaceEditedProduct(list as any, payload, list[0] as any, 0);
  assert.equal(result.matched, 'id');
  assert.equal(result.products.length, 2);
  assert.equal(result.products[0].name, 'New');
  assert.equal(result.products[0].price, 99);
  assert.equal(result.products[1].name, 'Keep');
}

function testReplaceByIndexWhenIdMissing() {
  const list = [
    { name: 'First', price: 10, description: '' },
    { name: 'Second', price: 20, description: '' }
  ];
  const payload = sanitizeProduct({ id: 'prod-new', name: 'First edited', price: 15, description: '' });
  const result = replaceEditedProduct(list as any, payload, list[0] as any, 0);
  assert.equal(result.matched, 'index');
  assert.equal(result.products[0].name, 'First edited');
  assert.equal(result.products.length, 2);
}

function testSanitizeDropsNaN() {
  const prod = sanitizeProduct({
    id: 'p1',
    name: 'Tea',
    price: Number.NaN,
    minPrice: undefined,
    stock: Number.POSITIVE_INFINITY,
    description: 'hot',
    pricingTiers: [{ quantity: 1, price: Number.NaN, minPrice: undefined }]
  });
  assert.equal(prod.price, 0);
  assert.equal(prod.minPrice, 0);
  assert.equal(prod.stock, 0);
  assert.equal(prod.pricingTiers?.[0].price, 0);
  const written = prepareProductsForWrite([prod]);
  assert.equal(written[0].price, 0);
  assert.ok(Number.isFinite(written[0].price));
}

function testStripInlineImages() {
  const stripped = stripInlineDataUrls([
    sanitizeProduct({
      id: 'p1',
      name: 'Pic',
      price: 10,
      description: '',
      images: ['https://cdn.example/a.jpg', 'data:image/png;base64,aaaa'],
      reviewImages: ['data:image/jpeg;base64,bbbb']
    })
  ]);
  assert.deepEqual(stripped[0].images, ['https://cdn.example/a.jpg']);
  assert.deepEqual(stripped[0].reviewImages, []);
}

function testLooksUpdated() {
  const payload = sanitizeProduct({ id: '1', name: 'N', price: 50, stock: 2, description: 'd' });
  assert.equal(productLooksUpdated(payload, payload), true);
  assert.equal(productLooksUpdated(undefined, payload), false);
  assert.equal(findSavedProduct([payload], payload)?.id, '1');
}

function testReadInputValue() {
  assert.equal(readInputValue('hello'), 'hello');
  assert.equal(readInputValue(42), '42');
  assert.equal(readInputValue({ target: { value: 'typed' } }), 'typed');
  assert.equal(readInputValue(null), '');
}

testSameProductId();
testAsProductList();
testReplaceById();
testReplaceByIndexWhenIdMissing();
testSanitizeDropsNaN();
testStripInlineImages();
testLooksUpdated();
testReadInputValue();
console.log('productCatalog tests passed');
