import type { BusinessConfig, Order } from '../types';
import type { CartLine, ShopCustomerInput } from './storefront';
import { sanitizePublicOrder } from './storefront';

interface ApiErrorBody {
  error?: string;
  code?: string;
}

export type PublicShopOrder = ReturnType<typeof sanitizePublicOrder>;

export async function fetchShop(businessId: string): Promise<BusinessConfig | null> {
  const response = await fetch(`/api/shop/${encodeURIComponent(businessId)}`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('স্টোর লোড করা যায়নি');
  return response.json() as Promise<BusinessConfig>;
}

export async function checkoutShop(input: {
  businessId: string;
  items: CartLine[];
  customer: ShopCustomerInput;
  sessionId?: string;
}): Promise<{ order: PublicShopOrder }> {
  const response = await fetch(`/api/shop/${encodeURIComponent(input.businessId)}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      items: input.items,
      customer: input.customer,
      sessionId: input.sessionId || '',
    }),
  });
  const body = await response.json().catch(() => ({})) as ApiErrorBody & { order?: PublicShopOrder };
  if (!response.ok || !body.order) {
    const error = new Error(body.error || 'অর্ডার সম্পন্ন হয়নি');
    error.name = body.code || 'CHECKOUT_FAILED';
    throw error;
  }
  return { order: body.order };
}

export async function trackShopOrders(input: {
  businessId: string;
  phone: string;
  orderId?: string;
}): Promise<PublicShopOrder[]> {
  const params = new URLSearchParams({ phone: input.phone });
  if (input.orderId) params.set('orderId', input.orderId);
  const response = await fetch(
    `/api/shop/${encodeURIComponent(input.businessId)}/orders?${params.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    throw new Error(body.error || 'অর্ডার খোঁজা যায়নি');
  }
  const body = await response.json() as { orders?: PublicShopOrder[] };
  return Array.isArray(body.orders) ? body.orders : [];
}

export function orderFromUnknown(value: unknown): Order | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Order;
  if (!row.id) return null;
  return row;
}
