import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import {
  buildMessengerCapiPayload,
  canonicalizeCapiEvent,
  capiEventId,
  capiEventsUrl,
  isCapiHttpSuccess,
  isRetryableCapiError,
  normalizedPhoneForCapi,
  readCapiCredentials,
  resolveMessengerFunnelEvent,
  sha256Lower,
  splitPersonName,
} from './capi.ts';

function hash(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function testPhoneNormalization() {
  assert.equal(normalizedPhoneForCapi('01712345678'), '8801712345678');
  assert.equal(normalizedPhoneForCapi('+880 1712-345678'), '8801712345678');
  assert.equal(normalizedPhoneForCapi('8801712345678'), '8801712345678');
  assert.equal(normalizedPhoneForCapi('1712345678'), '8801712345678');
  assert.equal(normalizedPhoneForCapi('008801712345678'), '8801712345678');
}

function testNameSplit() {
  assert.deepEqual(splitPersonName('রাজু খান'), { fn: 'রাজু', ln: 'খান' });
  assert.deepEqual(splitPersonName('Karim'), { fn: 'Karim', ln: '' });
  assert.deepEqual(splitPersonName('  Abdul  Karim  Mia '), { fn: 'Abdul', ln: 'Karim Mia' });
}

function testFunnelResolution() {
  assert.equal(resolveMessengerFunnelEvent({ conversationStage: 'new_lead' }), 'Lead');
  assert.equal(resolveMessengerFunnelEvent({ conversationStage: 'interested' }), 'ViewContent');
  assert.equal(resolveMessengerFunnelEvent({ conversationStage: 'checkout_started' }), 'InitiateCheckout');
  assert.equal(resolveMessengerFunnelEvent({ conversationStage: 'order_completed' }), null);
  assert.equal(resolveMessengerFunnelEvent({ eventName: 'Purchase' }), null);

  assert.equal(
    resolveMessengerFunnelEvent({ conversationStage: 'interested', eventName: 'AddToCart' }),
    'AddToCart'
  );
  assert.equal(
    resolveMessengerFunnelEvent({ conversationStage: 'new_lead', eventName: 'InitiateCheckout' }),
    'Lead',
    'AI must not jump two stages ahead of conversation_stage'
  );
  assert.equal(
    resolveMessengerFunnelEvent({ conversationStage: 'checkout_started', eventName: 'Lead' }),
    'InitiateCheckout',
    'stale AI Lead must not downgrade checkout'
  );
  assert.equal(
    resolveMessengerFunnelEvent({
      conversationStage: 'interested',
      alreadySentToday: { Lead: '2026-08-31', ViewContent: '2026-08-31' },
      day: '2026-08-31',
    }),
    null
  );
  assert.equal(
    resolveMessengerFunnelEvent({
      conversationStage: 'checkout_started',
      alreadySentToday: { Lead: '2026-08-31', ViewContent: '2026-08-31' },
      day: '2026-08-31',
    }),
    'InitiateCheckout'
  );
  assert.equal(
    resolveMessengerFunnelEvent({
      conversationStage: 'new_lead',
      alreadySentToday: { Lead: '2026-08-30' },
      day: '2026-08-31',
    }),
    'Lead',
    'a new UTC day may send Lead again'
  );
  assert.equal(canonicalizeCapiEvent('add_to_cart'), 'AddToCart');
  assert.equal(canonicalizeCapiEvent('ViewContent'), 'ViewContent');
}

function testPayloadMatchesBusinessMessagingSpec() {
  const built = buildMessengerCapiPayload({
    eventName: 'Purchase',
    pixelId: '1234567890',
    pageId: '111',
    psid: '222333',
    phone: '01712345678',
    name: 'রাজু খান',
    ctwaClid: 'clid_abc',
    value: 1490.5,
    contentName: 'কটন পাঞ্জাবি',
    contentIds: ['p1'],
    quantity: 2,
    itemPrice: 680,
    orderId: 'ORD-1',
    eventTime: 1_700_000_000,
    day: '2026-08-31',
  });
  assert.equal(built.eventName, 'Purchase');
  assert.equal(built.eventId, 'Purchase_222333_ORD-1');
  assert.equal(built.body.test_event_code, undefined);
  const event = built.body.data[0];
  assert.equal(event.action_source, 'business_messaging');
  assert.equal(event.messaging_channel, 'messenger');
  assert.equal(event.event_name, 'Purchase');
  assert.equal(event.event_time, 1_700_000_000);
  const user = event.user_data as Record<string, unknown>;
  assert.equal(user.page_id, '111');
  assert.equal(user.page_scoped_user_id, '222333');
  assert.equal(user.ctwa_clid, 'clid_abc');
  assert.deepEqual(user.ph, [hash('8801712345678')]);
  assert.deepEqual(user.fn, [hash('রাজু')]);
  assert.deepEqual(user.ln, [hash('খান')]);
  assert.deepEqual(user.country, [hash('bd')]);
  assert.deepEqual(user.external_id, [hash('222333')]);
  const custom = event.custom_data as Record<string, unknown>;
  assert.equal(custom.currency, 'BDT');
  assert.equal(custom.value, 1490.5);
  assert.equal(custom.order_id, 'ORD-1');
  assert.equal(custom.num_items, 2);
  assert.deepEqual(custom.content_ids, ['p1']);
  assert.deepEqual(custom.contents, [{ id: 'p1', quantity: 2, item_price: 680 }]);
}

function testLivePayloadOmitsTestCodeUnlessAsked() {
  const live = buildMessengerCapiPayload({
    eventName: 'Lead',
    pixelId: '1',
    psid: '2',
    pageId: '3',
    testEventCode: '',
  });
  assert.equal('test_event_code' in live.body, false);
  const test = buildMessengerCapiPayload({
    eventName: 'Lead',
    pixelId: '1',
    psid: '2',
    testEventCode: 'TEST12345',
  });
  assert.equal(test.body.test_event_code, 'TEST12345');
}

function testEventIdAndUrl() {
  assert.equal(capiEventId('Lead', 'psid1', undefined, '2026-08-31'), 'Lead_psid1_2026-08-31');
  assert.equal(
    capiEventsUrl('12 3', 'tok&en'),
    'https://graph.facebook.com/v21.0/12%203/events?access_token=tok%26en'
  );
  assert.equal(isCapiHttpSuccess(200, { events_received: 1 }), true);
  assert.equal(isCapiHttpSuccess(200, { events_received: 0 }), false);
  assert.equal(isCapiHttpSuccess(400, { events_received: 1 }), false);
  assert.equal(isRetryableCapiError({ response: { status: 503 } }), true);
  assert.equal(isRetryableCapiError({ response: { status: 400 } }), false);
  assert.equal(sha256Lower('AbC'), hash('abc'));
}

function testCredentialsGate() {
  assert.deepEqual(readCapiCredentials({ facebookConfig: { pixelId: '1', accessToken: 't' } }), {
    pixelId: '1',
    accessToken: 't',
    enabled: true,
  });
  assert.equal(readCapiCredentials({ facebookConfig: { pixelId: '1', accessToken: 't', capiEnabled: false } }).enabled, false);
  assert.equal(readCapiCredentials({ facebookConfig: { pixelId: '1' } }).enabled, false);
}

testPhoneNormalization();
testNameSplit();
testFunnelResolution();
testPayloadMatchesBusinessMessagingSpec();
testLivePayloadOmitsTestCodeUnlessAsked();
testEventIdAndUrl();
testCredentialsGate();
console.log('api/capi tests passed');
