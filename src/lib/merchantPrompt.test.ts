import assert from 'node:assert/strict';
import {
  buildMerchantCustomInstructionBlock,
  buildReplyStyleBlock,
  DEFAULT_MESSENGER_STYLE_RULES,
  hasMerchantCustomPrompt,
  MERCHANT_STYLE_OVERRIDE_HINT,
  normalizeCustomSystemPrompt,
  pickFacebookProfileName,
  resolveOrderCustomerName,
} from './merchantPrompt.ts';

const merchantGuide = `# মাস্টার সেলস গাইডলাইন
## ১. রিপ্লাই সব সময় সাজিয়ে ইমোজি ব্যাবহার করে সুন্দর করে দিবে
যত সম্ভব কম কথায় উত্তর দিবে।
নাম না দিলে তার ফেসবুক প্রোফাইল এর নাম দিবে`;

function testNormalize() {
  assert.equal(normalizeCustomSystemPrompt('  hello\r\nworld  '), 'hello\nworld');
  assert.equal(normalizeCustomSystemPrompt('   '), '');
  assert.equal(normalizeCustomSystemPrompt(null), '');
  const long = 'ক'.repeat(9_000);
  assert.equal(normalizeCustomSystemPrompt(long).length, 8_000);
}

function testCustomBlockOverridesDefaultStyle() {
  assert.equal(hasMerchantCustomPrompt(''), false);
  assert.equal(buildMerchantCustomInstructionBlock(''), '');
  assert.equal(buildReplyStyleBlock(''), DEFAULT_MESSENGER_STYLE_RULES);

  const block = buildMerchantCustomInstructionBlock(merchantGuide);
  assert.match(block, /মার্চেন্টের অতিরিক্ত নির্দেশনা/);
  assert.match(block, /ওভাররাইড/);
  assert.match(block, /ইমোজি ব্যাবহার করে সুন্দর করে দিবে/);
  assert.match(block, /ফেসবুক প্রোফাইল এর নাম দিবে/);
  assert.ok(block.indexOf('ওভাররাইড') < block.indexOf('ইমোজি ব্যাবহার'));
  assert.equal(buildReplyStyleBlock(merchantGuide), MERCHANT_STYLE_OVERRIDE_HINT);
  assert.doesNotMatch(buildReplyStyleBlock(merchantGuide), /ইমোজির বন্যা/);
}

function testFacebookNameAndOrderFallback() {
  assert.equal(pickFacebookProfileName({ name: 'রাজু খান' }), 'রাজু খান');
  assert.equal(pickFacebookProfileName({ first_name: 'Raju', last_name: 'Khan' }), 'Raju Khan');
  assert.equal(pickFacebookProfileName({}), '');

  assert.equal(resolveOrderCustomerName({ leadName: 'করিম', facebookName: 'FB Profile' }), 'করিম');
  assert.equal(resolveOrderCustomerName({ leadName: '', facebookName: 'রাজু খান', senderId: '1234567890' }), 'রাজু খান');
  assert.equal(resolveOrderCustomerName({ leadName: 'FB User (7890)', facebookName: 'রাজু খান', senderId: '1234567890' }), 'রাজু খান');
  assert.equal(resolveOrderCustomerName({ senderId: '1234567890' }), 'FB User (7890)');
}

testNormalize();
testCustomBlockOverridesDefaultStyle();
testFacebookNameAndOrderFallback();
console.log('merchantPrompt tests passed');
