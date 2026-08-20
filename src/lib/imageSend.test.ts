import assert from 'node:assert/strict';
import {
  detectImageRequest,
  normalizeImageLink,
  parseImageLinks,
  pickProductForImages,
  resolveImageSendFlags,
  uniqueHttpUrls,
} from './imageSend.ts';

assert.equal(normalizeImageLink('https://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg');
assert.equal(
  normalizeImageLink('https://drive.google.com/file/d/abc123/view?usp=sharing'),
  'https://drive.google.com/uc?export=view&id=abc123',
);
assert.equal(normalizeImageLink('javascript:alert(1)'), null);
assert.equal(normalizeImageLink('not a url'), null);

const parsed = parseImageLinks('https://cdn.example.com/a.jpg, https://cdn.example.com/b.webp\nnope');
assert.deepEqual(parsed.urls, ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.webp']);
assert.deepEqual(parsed.invalid, ['nope']);

assert.deepEqual(detectImageRequest('এই প্রোডাক্টের ছবি পাঠান'), {
  wantsProductPhotos: true,
  wantsReviewPhotos: false,
});
assert.deepEqual(detectImageRequest('রিভিউ ছবি দিবেন?'), {
  wantsProductPhotos: false,
  wantsReviewPhotos: true,
});
assert.deepEqual(detectImageRequest('পণ্যের ছবি আর রিভিউ দুইটাই পাঠান'), {
  wantsProductPhotos: true,
  wantsReviewPhotos: true,
});
assert.deepEqual(detectImageRequest('দাম কত?'), {
  wantsProductPhotos: false,
  wantsReviewPhotos: false,
});
assert.deepEqual(detectImageRequest('দাম দেখতে চাই'), {
  wantsProductPhotos: false,
  wantsReviewPhotos: false,
});
assert.deepEqual(detectImageRequest('ঠিকানা পাঠান'), {
  wantsProductPhotos: false,
  wantsReviewPhotos: false,
});
assert.deepEqual(detectImageRequest('ছবি আর রিভিউ দুইটাই পাঠান'), {
  wantsProductPhotos: true,
  wantsReviewPhotos: true,
});

assert.deepEqual(
  resolveImageSendFlags('দাম কত?', { show_product_image: true, show_review_images: true }),
  { show_product_image: false, show_review_images: false },
);
assert.deepEqual(
  resolveImageSendFlags('রিভিউ চাই', { show_product_image: true, show_review_images: false }),
  { show_product_image: false, show_review_images: true },
);
assert.deepEqual(
  resolveImageSendFlags('ছবি দাও', { show_product_image: false, show_review_images: true }),
  { show_product_image: true, show_review_images: false },
);

const products = [
  { name: 'হুডি' },
  { name: 'টি-শার্ট' },
];
assert.equal(pickProductForImages(products, 'টি-শার্ট')?.name, 'টি-শার্ট');
assert.equal(pickProductForImages(products, '', 'দাম কত?'), undefined);
assert.equal(pickProductForImages([{ name: 'একটাই' }], '', 'দাম কত?')?.name, 'একটাই');
assert.deepEqual(uniqueHttpUrls(['https://a.com/1.jpg', 'data:image/png;base64,xx', 'https://a.com/1.jpg'], 3), [
  'https://a.com/1.jpg',
  'data:image/png;base64,xx',
]);

console.log('imageSend tests passed');
