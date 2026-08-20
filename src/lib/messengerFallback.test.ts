import assert from 'node:assert/strict';
import { buildSalesFallbackReply } from './messengerFallback.ts';

const business = {
  products: [
    { name: 'প্রিমিয়াম শার্ট', price: 1250, stock: 5, description: 'সফট কটন ফেব্রিক' },
    { name: 'লেদার ওয়ালেট', price: 850, stock: 0 },
  ],
  faqs: [
    { question: 'ডেলিভারি চার্জ কত', answer: 'ঢাকার ভিতরে ৬০ টাকা, বাইরে ১২০ টাকা।' },
  ],
};

assert.equal(
  buildSalesFallbackReply('ডেলিভারি চার্জ কত হবে?', business),
  'ঢাকার ভিতরে ৬০ টাকা, বাইরে ১২০ টাকা।'
);
assert.match(buildSalesFallbackReply('প্রিমিয়াম শার্টের দাম কত?', business), /প্রিমিয়াম শার্ট এর দাম ৳1,250/);
assert.match(buildSalesFallbackReply('লেদার ওয়ালেট অর্ডার করব', business), /বর্তমানে স্টকে নেই/);
assert.match(buildSalesFallbackReply('দাম কত?', business), /প্রিমিয়াম শার্ট — ৳1,250/);
assert.match(buildSalesFallbackReply('অর্ডার করতে চাই', business), /নাম, ১১ ডিজিটের ফোন নম্বর/);
assert.match(buildSalesFallbackReply('', business, ['audio']), /লিখে পাঠাবেন/);
assert.doesNotMatch(buildSalesFallbackReply('হ্যালো', business), /শীঘ্রই/);

console.log('messengerFallback tests passed');
