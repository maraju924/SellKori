import assert from 'node:assert/strict';
import type { Product } from '../types';
import {
  applyBargainFloorToProduct,
  buildBargainSteps,
  buildBargainingPromptBlock,
  clampNegotiatedUnitPrice,
  countBargainAsks,
  inferBargainProduct,
  inferBargainQuantity,
  isBargainAsk,
  nextBargainOffer,
  normalizeSensitivity,
  resolveBargainBand,
} from './bargaining.ts';

const shirt: Product = {
  id: 'p1',
  name: 'প্রিমিয়াম শার্ট',
  price: 500,
  minPrice: 450,
  description: 'কটন',
  pricingTiers: [
    { quantity: 1, price: 500, minPrice: 450, label: '১ পিস' },
    { quantity: 2, price: 800, minPrice: 750, label: '২ পিস' },
  ],
};

function testSensitivityAndFloor() {
  assert.equal(normalizeSensitivity(undefined), 60);
  assert.equal(normalizeSensitivity(-10), 0);
  assert.equal(normalizeSensitivity(140), 100);

  const locked = resolveBargainBand(shirt, 1, 0, true);
  assert.equal(locked.listedUnit, 500);
  assert.equal(locked.floorUnit, 500);
  assert.deepEqual(locked.stepsUnit, [500]);

  const mid = resolveBargainBand(shirt, 1, 60, true);
  assert.equal(mid.listedUnit, 500);
  assert.equal(mid.catalogMinUnit, 450);
  assert.equal(mid.floorUnit, 470);
  assert.ok(mid.stepsUnit[0] === 500);
  assert.ok(mid.stepsUnit[mid.stepsUnit.length - 1] === 470);
  assert.ok(mid.stepsUnit.length >= 3);

  const easy = resolveBargainBand(shirt, 1, 100, true);
  assert.equal(easy.floorUnit, 450);
  assert.deepEqual(easy.stepsUnit, [500, 450]);

  const off = resolveBargainBand(shirt, 1, 100, false);
  assert.equal(off.floorUnit, 500);
  assert.equal(off.sensitivity, 0);
}

function testTierPackMath() {
  const two = resolveBargainBand(shirt, 2, 60, true);
  assert.equal(two.listedUnit, 400);
  assert.equal(two.listedPack, 800);
  assert.equal(two.catalogMinUnit, 375);
  assert.equal(two.floorUnit, 385);
  assert.equal(two.floorPack, 770);
}

function testStepsAndOffers() {
  assert.deepEqual(buildBargainSteps(500, 500, 60), [500]);
  const mid = resolveBargainBand(shirt, 1, 60, true);
  const open = nextBargainOffer(mid, 0);
  assert.equal(open.offerUnit, 500);
  assert.equal(open.isOpening, true);
  const first = nextBargainOffer(mid, 1);
  assert.ok(first.offerUnit < 500 && first.offerUnit > 470);
  const last = nextBargainOffer(mid, 9);
  assert.equal(last.offerUnit, 470);
  assert.equal(last.isFloor, true);
}

function testAskDetection() {
  assert.equal(isBargainAsk('দাম কত?'), false);
  assert.equal(isBargainAsk('একটু কম রাখেন ভাই'), true);
  assert.equal(isBargainAsk('আরও কম হবে?'), true);
  assert.equal(isBargainAsk('last price বলেন'), true);
  assert.equal(isBargainAsk('ডিসকাউন্ট আছে?'), true);

  const history = [
    'Customer: দাম কত?',
    'Assistant: ৫০০ টাকা।',
    'Customer: একটু কম রাখেন',
    'Assistant: ৪৮৫ রাখতে পারি।',
  ].join('\n');
  assert.equal(countBargainAsks(history, 'আরও কম'), 2);
  assert.equal(countBargainAsks('', 'দাম কত'), 0);
}

function testClamp() {
  assert.equal(clampNegotiatedUnitPrice({
    product: shirt,
    quantity: 1,
    negotiated: '400',
    sensitivity: 60,
    negotiationEnabled: true,
  }), 470);
  assert.equal(clampNegotiatedUnitPrice({
    product: shirt,
    quantity: 1,
    negotiated: '480',
    sensitivity: 60,
    negotiationEnabled: true,
  }), 480);
  assert.equal(clampNegotiatedUnitPrice({
    product: shirt,
    quantity: 1,
    negotiated: '999',
    sensitivity: 60,
    negotiationEnabled: true,
  }), 500);
  assert.equal(clampNegotiatedUnitPrice({
    product: shirt,
    quantity: 1,
    negotiated: '400',
    sensitivity: 100,
    negotiationEnabled: false,
  }), 500);
  assert.equal(clampNegotiatedUnitPrice({
    product: shirt,
    quantity: 2,
    negotiated: '800',
    sensitivity: 60,
    negotiationEnabled: true,
  }), 400);
}

function testFloorHidesTrueMin() {
  const floored = applyBargainFloorToProduct(shirt, 60, true);
  assert.equal(floored.minPrice, 470);
  assert.equal(floored.pricingTiers[0].minPrice, 470);
  assert.equal(floored.pricingTiers[1].minPrice, 770);
}

function testPromptAndInference() {
  const enabled = buildBargainingPromptBlock({
    products: [shirt],
    bargainingSensitivity: 60,
    negotiationEnabled: true,
    chatHistory: 'Customer: প্রিমিয়াম শার্ট এর দাম কত?',
    customerMessage: 'একটু কম রাখেন',
    knownProductName: 'প্রিমিয়াম শার্ট',
    knownQuantity: 1,
  });
  assert.match(enabled, /স্লাইডার: 60%/);
  assert.match(enabled, /ক্যাটালগ-অনুমোদিত দরদাম/);
  assert.match(enabled, /negotiated_price=/);
  assert.doesNotMatch(enabled, /দরদাম বন্ধ/);

  const disabled = buildBargainingPromptBlock({
    products: [shirt],
    negotiationEnabled: false,
  });
  assert.match(disabled, /দরদাম বন্ধ/);

  assert.equal(inferBargainProduct([shirt], 'প্রিমিয়াম শার্ট চাই')?.id, 'p1');
  assert.equal(inferBargainQuantity('2', ''), 2);
  assert.equal(inferBargainQuantity(undefined, '৩ পিস দরকার'), 3);
}

testSensitivityAndFloor();
testTierPackMath();
testStepsAndOffers();
testAskDetection();
testClamp();
testFloorHidesTrueMin();
testPromptAndInference();
console.log('bargaining tests passed');
