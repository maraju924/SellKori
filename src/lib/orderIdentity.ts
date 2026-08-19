/** Shared customer-identity helpers for order de-duplication. */

const BD_PHONE_RE = /(?:\+?88)?(01[3-9]\d{8})/;

export const DUPLICATE_ORDER_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface OrderIdentity {
  phone?: string | null;
  sessionId?: string | null;
  passengerId?: string | null;
  clientIp?: string | null;
  status?: string | null;
  createdAtMs?: number | null;
  createdAt?: any;
  productName?: string | null;
}

export function extractBdPhone(text?: string | null): string {
  if (!text) return '';
  const m = String(text).replace(/[\s-]/g, '').match(BD_PHONE_RE);
  return m ? m[1] : '';
}

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  return extractBdPhone(phone);
}

export function normalizePassengerId(id?: string | null): string {
  return String(id || '').trim();
}

export function normalizeClientIp(ip?: string | null): string {
  if (!ip) return '';
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '');
}

/**
 * Facebook webhooks, localhost, and private LAN addresses cannot identify a
 * shopper. Matching on those IPs would treat every Messenger order as the
 * same customer.
 */
export function isUntrustedCustomerIp(ip?: string | null): boolean {
  const value = normalizeClientIp(ip);
  if (!value) return true;
  if (value === '127.0.0.1' || value === '::1' || value === 'localhost') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.') || value.startsWith('127.')) return true;
  const parts = value.split('.').map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

export function trustedClientIp(ip?: string | null): string {
  const value = normalizeClientIp(ip);
  return isUntrustedCustomerIp(value) ? '' : value;
}

export function passengerIdOf(order: OrderIdentity): string {
  return normalizePassengerId(order.passengerId || order.sessionId);
}

/**
 * Two orders belong to the same shopper when mobile, Messenger/web passenger
 * id, or (web) public IP line up. IP is never used alone so shared NAT /
 * Facebook server IPs cannot collapse unrelated customers.
 */
export function ordersShareCustomerIdentity(existing: OrderIdentity, incoming: OrderIdentity): boolean {
  const existingPhone = normalizePhone(existing.phone);
  const incomingPhone = normalizePhone(incoming.phone);
  const existingPassenger = passengerIdOf(existing);
  const incomingPassenger = passengerIdOf(incoming);
  const existingIp = trustedClientIp(existing.clientIp);
  const incomingIp = trustedClientIp(incoming.clientIp);

  const phoneMatch = Boolean(existingPhone && incomingPhone && existingPhone === incomingPhone);
  const passengerMatch = Boolean(existingPassenger && incomingPassenger && existingPassenger === incomingPassenger);
  const ipMatch = Boolean(existingIp && incomingIp && existingIp === incomingIp);

  if (phoneMatch && passengerMatch) return true;
  if (phoneMatch && ipMatch) return true;
  if (passengerMatch && ipMatch) return true;
  if (phoneMatch) return true;
  if (passengerMatch) return true;
  return false;
}

export function orderCreatedAtMs(order: OrderIdentity): number {
  if (order.createdAtMs) return Number(order.createdAtMs) || 0;
  const createdAt = order.createdAt;
  if (createdAt?.toMillis) return createdAt.toMillis();
  if (typeof createdAt === 'number') return createdAt;
  if (createdAt?.seconds) return createdAt.seconds * 1000;
  if (typeof createdAt === 'string') return Date.parse(createdAt) || 0;
  return 0;
}

export function isRecentIdentityDuplicate(
  existing: OrderIdentity,
  incoming: OrderIdentity,
  now = Date.now(),
  windowMs = DUPLICATE_ORDER_WINDOW_MS
): boolean {
  if (existing.status === 'cancelled') return false;
  const ts = orderCreatedAtMs(existing);
  if (!ts || now - ts > windowMs) return false;
  return ordersShareCustomerIdentity(existing, incoming);
}

/** Grouping key for the merchant order list (phone, then passenger, then IP). */
export function orderIdentityKey(order: OrderIdentity & { id?: string }): string {
  const phone = normalizePhone(order.phone);
  if (phone) return `phone:${phone}`;
  const passenger = passengerIdOf(order);
  if (passenger) return `passenger:${passenger}`;
  const ip = trustedClientIp(order.clientIp);
  if (ip) return `ip:${ip}`;
  return `id:${order.id || 'unknown'}`;
}
