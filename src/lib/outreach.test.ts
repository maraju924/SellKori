import assert from 'node:assert/strict';
import {
  classifyBroadcastAudience,
  coerceMillis,
  commentMatchesKeywords,
  extractFeedCommentEvents,
  facebookObjectIdsMatch,
  findMentionedProductName,
  isWithinMessagingWindow,
  mapPool,
  matchesBroadcastAudience,
  MESSAGING_WINDOW_MS,
  normalizeOutreachCustomer,
  buildCommentReplyPrompt,
  parseCommentAiReplyJson,
  parseCommentKeywords,
  personalizeOutreachMessage,
  planBroadcastRecipients,
  shouldReplyToComment,
  shouldPrivateReplyToComment
} from './outreach.ts';

function testKeywords() {
  assert.ok(commentMatchesKeywords('এই প্রোডাক্টের দাম কত?', ['দাম']));
  assert.ok(commentMatchesKeywords('Price please', ['price']));
  assert.ok(commentMatchesKeywords('ইনবক্স করুন', ['ইনবক্স', 'দাম']));
  assert.equal(commentMatchesKeywords('শুভ সকাল', ['দাম', 'price']), false);
  assert.ok(parseCommentKeywords('দাম, price\nইনবক্স').includes('দাম'));
  assert.ok(parseCommentKeywords([]).includes('price'));
}

function testPersonalize() {
  const msg = personalizeOutreachMessage('হ্যালো{{name}} — {{shop}} থেকে {{product}}', {
    name: 'রাফি',
    shop: 'ফ্যাশন হাউজ',
    product: 'পাঞ্জাবি'
  });
  assert.match(msg, /রাফি/);
  assert.match(msg, /ফ্যাশন হাউজ/);
  assert.match(msg, /পাঞ্জাবি/);
  const noName = personalizeOutreachMessage('হ্যালো{{name}}!', { name: '' });
  assert.equal(noName, 'হ্যালো!');
}

function testProductMention() {
  const products = [{ name: 'প্রিমিয়াম পাঞ্জাবি' }, { name: 'টি-শার্ট' }];
  assert.equal(findMentionedProductName('প্রিমিয়াম পাঞ্জাবি দাম কত', products), 'প্রিমিয়াম পাঞ্জাবি');
  assert.equal(findMentionedProductName('শুধু ইনবক্স', products), undefined);
}

function testCoerceAndNormalize() {
  assert.equal(coerceMillis(1700000000000), 1700000000000);
  assert.equal(coerceMillis({ seconds: 1700000000 }), 1700000000 * 1000);
  assert.equal(coerceMillis({ toMillis: () => 42 }), 42);
  const customer = normalizeOutreachCustomer({
    passengerId: 'psid-9',
    leadInfo: { name: 'সাজিদ' },
    lastInteraction: { seconds: 1700000000 },
    lastOrderId: 'ord-2'
  });
  assert.equal(customer.messengerId, 'psid-9');
  assert.equal(customer.name, 'সাজিদ');
  assert.equal(customer.lastIncomingAtMs, 1700000000 * 1000);
  assert.equal(customer.lastOrderId, 'ord-2');
}

function testWindowAndAudience() {
  const now = Date.now();
  assert.equal(isWithinMessagingWindow(now - 60 * 60 * 1000, now), true);
  assert.equal(isWithinMessagingWindow(now - MESSAGING_WINDOW_MS - 1000, now), false);
  assert.equal(isWithinMessagingWindow(undefined, now), false);

  const hot = { messengerId: 'psid-1', lastIncomingAtMs: now };
  const buyer = { messengerId: 'psid-2', lastIncomingAtMs: now, lastOrderId: 'ord-1' };
  assert.equal(classifyBroadcastAudience(hot), 'hot_leads');
  assert.equal(classifyBroadcastAudience(buyer), 'buyers');
  assert.equal(matchesBroadcastAudience(hot, 'all'), true);
  assert.equal(matchesBroadcastAudience(hot, 'buyers'), false);
  assert.equal(matchesBroadcastAudience(buyer, 'buyers'), true);
}

function testPlanRecipients() {
  const now = Date.now();
  const plan = planBroadcastRecipients(
    [
      { messengerId: 'a', lastIncomingAtMs: now },
      { messengerId: 'a', lastIncomingAtMs: now },
      { messengerId: 'b', lastIncomingAtMs: now - MESSAGING_WINDOW_MS - 5000 },
      { name: 'no-psid' },
      { messengerId: 'c', lastIncomingAtMs: now, lastOrderId: 'o1' }
    ],
    'all',
    now
  );
  assert.equal(plan.eligible.length, 2);
  assert.equal(plan.skippedOutsideWindow, 1);
  assert.equal(plan.skippedNoPsid, 1);

  const buyers = planBroadcastRecipients(
    [
      { messengerId: 'a', lastIncomingAtMs: now },
      { messengerId: 'c', lastIncomingAtMs: now, lastOrderId: 'o1' }
    ],
    'buyers',
    now
  );
  assert.equal(buyers.eligible.length, 1);
  assert.equal(buyers.eligible[0].messengerId, 'c');
}

function testFeedComments() {
  const events = extractFeedCommentEvents({
    id: '111',
    changes: [
      {
        field: 'feed',
        value: {
          item: 'comment',
          verb: 'add',
          comment_id: 'p_c1',
          post_id: '111_222',
          parent_id: '111_222',
          message: 'দাম কত?',
          from: { id: '999', name: 'রাফি' }
        }
      },
      {
        field: 'feed',
        value: {
          item: 'comment',
          verb: 'add',
          comment_id: 'p_c2',
          post_id: '111_222',
          parent_id: 'p_c1',
          message: 'সুন্দর',
          from: { id: '888', name: 'Nested' }
        }
      },
      {
        field: 'comments',
        value: {
          verb: 'add',
          comment_id: 'p_c3',
          post_id: '111_222',
          parent_id: '222',
          message: 'ভাইয়া',
          from: { id: '777', name: 'PhotoPost' }
        }
      },
      {
        field: 'messages',
        value: { item: 'comment', verb: 'add', comment_id: 'ignore' }
      }
    ]
  });
  assert.equal(events.length, 3);
  assert.equal(events[0].isTopLevel, true);
  assert.equal(events[1].isTopLevel, false);
  assert.equal(events[2].isTopLevel, true);
  assert.equal(shouldReplyToComment(events[0]), true);
  assert.equal(shouldReplyToComment(events[1]), true);
  assert.equal(shouldPrivateReplyToComment({ ...events[0], message: 'শুভ সকাল' }, ['দাম']), true);
  assert.equal(shouldReplyToComment({ ...events[0], message: '' }), true);
  assert.equal(shouldReplyToComment({ ...events[0], fromId: '' }), true);

  const pageOwn = {
    ...events[0],
    fromId: '111',
    pageId: '111'
  };
  assert.equal(shouldPrivateReplyToComment(pageOwn, ['দাম']), false);
  assert.equal(facebookObjectIdsMatch('111_222', '222'), true);
  assert.equal(facebookObjectIdsMatch('111_222', '111_333'), false);
}

function testCommentAiParse() {
  const parsed = parseCommentAiReplyJson('{"publicReply":"৳১২০০","inboxMessage":"এই প্রোডাক্টের দাম ১২০০ টাকা।"}');
  assert.equal(parsed.publicReply, '৳১২০০');
  assert.match(parsed.inboxMessage, /১২০০/);
  const plain = parseCommentAiReplyJson('দাম ৫০০ টাকা ভাই');
  assert.equal(plain.publicReply, 'দাম ৫০০ টাকা ভাই');
  assert.equal(plain.inboxMessage, 'দাম ৫০০ টাকা ভাই');
  const prompt = buildCommentReplyPrompt({
    shopName: 'টেস্ট শপ',
    comment: 'এইটা কেমন?',
    products: [{ name: 'পাঞ্জাবি', price: 1200 }]
  });
  assert.match(prompt, /এইটা কেমন\?/);
  assert.match(prompt, /পাঞ্জাবি/);
}

async function testMapPool() {
  const out = await mapPool([1, 2, 3, 4], 2, async (n) => n * 2);
  assert.deepEqual(out, [2, 4, 6, 8]);
}

testKeywords();
testPersonalize();
testProductMention();
testCoerceAndNormalize();
testWindowAndAudience();
testPlanRecipients();
testFeedComments();
testCommentAiParse();
await testMapPool();
console.log('outreach tests passed');
