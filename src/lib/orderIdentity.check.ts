import {
  isRecentIdentityDuplicate,
  isUntrustedCustomerIp,
  latestOrdersByIdentity,
  normalizePhone,
  orderIdentityKey,
  ordersShareCustomerIdentity,
} from './orderIdentity.ts';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const now = Date.now();
const recent = { createdAtMs: now - 5 * 60 * 1000, status: 'confirmed' };

assert(normalizePhone('+8801712345678') === '01712345678', 'normalize 880 prefix');
assert(normalizePhone('01712-345678') === '01712345678', 'normalize dashed phone');

assert(
  ordersShareCustomerIdentity(
    { phone: '01712345678', passengerId: 'psid-a' },
    { phone: '8801712345678', passengerId: 'psid-b' }
  ),
  'same mobile is the same customer even if passenger id differs'
);

assert(
  ordersShareCustomerIdentity(
    { phone: '01711111111', sessionId: 'psid-same' },
    { phone: '01722222222', passengerId: 'psid-same' }
  ),
  'same passenger/session id is the same customer'
);

assert(
  !ordersShareCustomerIdentity(
    { phone: '01711111111', passengerId: 'psid-a', clientIp: '1.1.1.1' },
    { phone: '01722222222', passengerId: 'psid-b', clientIp: '8.8.8.8' }
  ),
  'different mobile + passenger + ip stay unique'
);

assert(
  !ordersShareCustomerIdentity(
    { phone: '01711111111', passengerId: 'psid-a', clientIp: '10.0.0.1' },
    { phone: '01722222222', passengerId: 'psid-b', clientIp: '10.0.0.1' }
  ),
  'shared private/Facebook-like IP must not collapse unrelated customers'
);

assert(isUntrustedCustomerIp('127.0.0.1'), 'localhost is untrusted');
assert(isUntrustedCustomerIp('10.1.2.3'), 'rfc1918 is untrusted');
assert(!isUntrustedCustomerIp('103.4.5.6'), 'public ip is trusted');

assert(
  isRecentIdentityDuplicate(
    { ...recent, phone: '01712345678', productName: 'Shirt' },
    { phone: '01712345678', productName: 'T-Shirt Premium' }
  ),
  'product name mismatch must still count as duplicate'
);

assert(
  !isRecentIdentityDuplicate(
    { createdAtMs: now - 3 * 60 * 60 * 1000, phone: '01712345678', status: 'confirmed' },
    { phone: '01712345678' }
  ),
  'old orders outside the window are not duplicates'
);

assert(
  orderIdentityKey({ phone: '8801712345678', id: 'x' }) === 'phone:01712345678',
  'group key prefers normalized phone'
);

assert(
  latestOrdersByIdentity([
    { id: 'old', phone: '01712345678', createdAtMs: now - 60_000 },
    { id: 'new', phone: '01712345678', createdAtMs: now },
  ]).map(o => o.id).join() === 'new',
  'list keeps the newest order per identity'
);

console.log('orderIdentity checks passed');
