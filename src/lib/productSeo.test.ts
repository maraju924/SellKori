import assert from 'node:assert/strict';
import {
  decodeProductParam,
  imageAltFor,
  isValidProductSlug,
  normalizeProductSlug,
  productHighlights,
  productJsonLd,
  productPublicKey,
  productRatingSummary,
  productSeoDescription,
  productSeoTitle,
  productSpecRows,
  slugifyProductName,
  specRowsFromText,
  suggestedProductSlug,
  uniqueProductSlug,
  youtubeVideoId,
  categoryJsonLd,
  categorySeoDescription,
  categorySeoTitle,
} from './productSeo.ts';
import { sanitizeProduct } from './productCatalog.ts';

function testSlugify() {
  assert.equal(slugifyProductName('Cotton Panjabi Navy'), 'cotton-panjabi-navy');
  assert.equal(slugifyProductName('কটন পাঞ্জাবি'), '');
  assert.equal(normalizeProductSlug(' Cotton--Panjabi '), 'cotton-panjabi');
  assert.equal(isValidProductSlug('cotton-panjabi'), true);
  assert.equal(isValidProductSlug('কটন'), false);
  assert.equal(isValidProductSlug('a'), false);
  assert.equal(suggestedProductSlug('Wireless Earbuds', ''), 'wireless-earbuds');
  assert.equal(suggestedProductSlug('পাঞ্জাবি', 'navy-panjabi'), 'navy-panjabi');
}

function testUniqueSlug() {
  const products = [
    { id: '1', slug: 'cotton-panjabi' },
    { id: '2', slug: 'shirt' },
  ];
  assert.equal(uniqueProductSlug(products, 'cotton-panjabi', '1'), 'cotton-panjabi');
  assert.equal(uniqueProductSlug(products, 'cotton-panjabi', '3'), 'cotton-panjabi-2');
  assert.equal(productPublicKey({ id: 'prod-9', slug: 'navy-panjabi' }), 'navy-panjabi');
  assert.equal(productPublicKey({ id: 'prod-9', slug: '' }), 'prod-9');
  assert.equal(decodeProductParam('cotton-panjabi'), 'cotton-panjabi');
}

function testSpecsAndHighlights() {
  const rows = specRowsFromText('ফেব্রিক: কটন\nকালার - নেভি\nশুধু এক লাইন');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, 'ফেব্রিক');
  assert.equal(rows[1].value, 'নেভি');

  const product = sanitizeProduct({
    id: 'p1',
    name: 'কটন পাঞ্জাবি',
    price: 1490,
    description: '- ১০০% কটন\n- মেশিন ওয়াশ\nবিস্তারিত অনুচ্ছেদ',
    specs: 'ফেব্রিক: কটন',
    highlights: ['হালকা ফেব্রিক', ''],
    brand: 'Roj',
    slug: 'cotton-panjabi',
    imageAlts: ['সামনের ছবি'],
    images: ['https://cdn.example/a.jpg'],
    reviews: [{ author: 'করিম', rating: 5, text: 'ভালো কাপড়' }],
  });
  assert.equal(product.slug, 'cotton-panjabi');
  assert.deepEqual(product.highlights, ['হালকা ফেব্রিক']);
  assert.deepEqual(productHighlights({ ...product, highlights: undefined }), ['১০০% কটন', 'মেশিন ওয়াশ']);
  assert.equal(productSpecRows(product)[0].value, 'কটন');
  assert.equal(imageAltFor(product, 0), 'সামনের ছবি');
  assert.equal(imageAltFor(product, 1), 'কটন পাঞ্জাবি — 2');
  assert.equal(productRatingSummary(product)?.average, 5);
  assert.match(productSeoTitle(product, 'রোজ শপ'), /কটন পাঞ্জাবি/);
  assert.match(productSeoDescription(product), /1490/);
}

function testYoutubeAndJsonLd() {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9wgGcQ'), 'dQw4w9wgGcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9wgGcQ'), 'dQw4w9wgGcQ');
  const product = sanitizeProduct({
    id: 'p1',
    name: 'Earbuds',
    price: 900,
    description: 'TWS',
    slug: 'earbuds',
  });
  const graph = productJsonLd({
    product,
    shop: { name: 'Roj' },
    url: 'https://example.com/roj/p/earbuds',
    image: 'https://cdn.example/a.jpg',
    crumbs: [{ name: 'হোম', url: 'https://example.com/roj' }],
    faqs: [{ question: 'COD আছে?', answer: 'হ্যাঁ' }],
  });
  assert.equal(graph.length, 3);
  const offer = (graph[0] as { offers: { priceCurrency: string; price: number } }).offers;
  assert.equal(offer.priceCurrency, 'BDT');
  assert.equal(offer.price, 900);
}

function testEmptySeoOmitted() {
  const product = sanitizeProduct({
    id: 'p1',
    name: 'Tea',
    price: 10,
    description: '',
    slug: '??',
    brand: '  ',
    reviews: [{ author: '', rating: 5, text: '' }],
  });
  assert.equal(product.slug, undefined);
  assert.equal(product.brand, undefined);
  assert.equal(product.reviews, undefined);
}

testSlugify();
testUniqueSlug();
testSpecsAndHighlights();
testYoutubeAndJsonLd();
function testCategorySeo() {
  assert.equal(categorySeoTitle('পোশাক', 'রোজ শপ'), 'পোশাক | রোজ শপ');
  assert.match(categorySeoDescription('পোশাক', 4, 'রোজ শপ'), /4টি পণ্য/);
  const graph = categoryJsonLd({
    category: 'পোশাক',
    shopName: 'রোজ',
    url: 'https://example.com/roj/c/%E0%A6%AA%E0%A7%8B%E0%A6%B6%E0%A6%BE%E0%A6%95',
    products: [{ name: 'শার্ট', url: 'https://example.com/roj/p/shirt' }],
    crumbs: [{ name: 'রোজ', url: 'https://example.com/roj' }],
  });
  assert.equal(graph.length, 3);
}

testEmptySeoOmitted();
testCategorySeo();
console.log('productSeo tests passed');
