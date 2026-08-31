export const META_FUNNEL_EVENTS = ['Lead', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'] as const;
export type MetaFunnelEvent = (typeof META_FUNNEL_EVENTS)[number];

export type MetaDatePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom';
export type MetaChartGroup = 'day' | 'week' | 'month';
export type MetaSourceFilter = 'all' | 'server' | 'browser';
export type MetaDeliveryFilter = 'all' | 'sent' | 'failed';

export interface MetaEventRecord {
  id: string;
  eventName: string;
  createdAtMs: number;
  value?: number;
  currency?: string;
  status?: string;
  source?: string;
  orderId?: string;
  contentName?: string;
  eventId?: string;
  channel?: string;
}

export interface DateRange {
  startMs: number;
  endMs: number;
}

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDay(ms: number): number {
  return startOfLocalDay(ms) + 24 * 60 * 60 * 1000 - 1;
}

export function rangeForPreset(
  preset: MetaDatePreset,
  now = Date.now(),
  custom?: { from?: string; to?: string },
): DateRange {
  const today = startOfLocalDay(now);
  if (preset === 'today') return { startMs: today, endMs: endOfLocalDay(now) };
  if (preset === 'yesterday') {
    const y = today - 24 * 60 * 60 * 1000;
    return { startMs: y, endMs: endOfLocalDay(y) };
  }
  if (preset === '7d') return { startMs: today - 6 * 86400000, endMs: endOfLocalDay(now) };
  if (preset === '30d') return { startMs: today - 29 * 86400000, endMs: endOfLocalDay(now) };
  if (preset === '90d') return { startMs: today - 89 * 86400000, endMs: endOfLocalDay(now) };
  if (preset === 'this_month') {
    const d = new Date(now);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return { startMs: d.getTime(), endMs: endOfLocalDay(now) };
  }
  if (preset === 'last_month') {
    const start = new Date(now);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { startMs: start.getTime(), endMs: end.getTime() - 1 };
  }
  const from = custom?.from ? startOfLocalDay(new Date(`${custom.from}T00:00:00`).getTime()) : today - 29 * 86400000;
  const to = custom?.to ? endOfLocalDay(new Date(`${custom.to}T00:00:00`).getTime()) : endOfLocalDay(now);
  return { startMs: Math.min(from, to), endMs: Math.max(from, to) };
}

export function previousRange(range: DateRange): DateRange {
  const length = Math.max(1, range.endMs - range.startMs + 1);
  return { startMs: range.startMs - length, endMs: range.startMs - 1 };
}

export function formatRangeLabel(range: DateRange): string {
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const days = Math.max(1, Math.round((range.endMs - range.startMs) / 86400000) + 1);
  return `${fmt(range.startMs)} → ${fmt(range.endMs)} · ${days} দিন`;
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function isCountedDelivery(status?: string): boolean {
  const value = String(status || 'sent').toLowerCase();
  return value === 'sent' || value === 'success' || value === '';
}

export function purchasesFromMessengerOrders(orders: Array<{
  id?: string;
  source?: string;
  status?: string;
  totalPrice?: number;
  productName?: string;
  createdAtMs?: number;
  passengerId?: string;
  capiPurchaseSentAt?: number;
}>): MetaEventRecord[] {
  return (orders || [])
    .filter((order) => {
      const status = String(order.status || '');
      if (status === 'cancelled' || status === 'returned') return false;
      const source = String(order.source || '').toLowerCase();
      const fromInbox = source === 'messenger' || Boolean(order.capiPurchaseSentAt) || /^\d{6,32}$/.test(String(order.passengerId || ''));
      return fromInbox && Number(order.createdAtMs || 0) > 0;
    })
    .map((order) => ({
      id: `order-${order.id}`,
      eventName: 'Purchase',
      createdAtMs: Number(order.createdAtMs || 0),
      value: Number(order.totalPrice || 0),
      currency: 'BDT',
      status: 'sent',
      source: 'server',
      orderId: String(order.id || ''),
      contentName: String(order.productName || ''),
      channel: 'messenger',
    }));
}

export function mergeMetaEvents(capiEvents: MetaEventRecord[], orderPurchases: MetaEventRecord[]): MetaEventRecord[] {
  const seenPurchase = new Set<string>();
  const out: MetaEventRecord[] = [];
  for (const event of capiEvents || []) {
    const name = String(event.eventName || '');
    if (name === 'Purchase' && event.orderId) seenPurchase.add(String(event.orderId));
    out.push(event);
  }
  for (const event of orderPurchases || []) {
    if (event.orderId && seenPurchase.has(event.orderId)) continue;
    out.push(event);
  }
  out.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return out;
}

export function filterMetaEvents(events: MetaEventRecord[], input: {
  range: DateRange;
  eventNames: string[];
  source?: MetaSourceFilter;
  delivery?: MetaDeliveryFilter;
  minRevenue?: number;
  maxRevenue?: number;
}): MetaEventRecord[] {
  const names = new Set(input.eventNames);
  return (events || []).filter((event) => {
    if (event.createdAtMs < input.range.startMs || event.createdAtMs > input.range.endMs) return false;
    if (names.size && !names.has(event.eventName)) return false;
    if (input.source && input.source !== 'all') {
      const source = String(event.source || 'server');
      if (source !== input.source) return false;
    }
    if (input.delivery && input.delivery !== 'all') {
      const sent = isCountedDelivery(event.status);
      if (input.delivery === 'sent' && !sent) return false;
      if (input.delivery === 'failed' && sent) return false;
    }
    if (event.eventName === 'Purchase') {
      const value = Number(event.value || 0);
      if (typeof input.minRevenue === 'number' && value < input.minRevenue) return false;
      if (typeof input.maxRevenue === 'number' && Number.isFinite(input.maxRevenue) && value > input.maxRevenue) return false;
    }
    return true;
  });
}

export function countByEvent(events: MetaEventRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    counts[event.eventName] = (counts[event.eventName] || 0) + 1;
  }
  return counts;
}

export function purchaseRevenue(events: MetaEventRecord[]): { revenue: number; count: number; aov: number } {
  const purchases = events.filter((event) => event.eventName === 'Purchase' && isCountedDelivery(event.status));
  const revenue = purchases.reduce((sum, event) => sum + Number(event.value || 0), 0);
  const count = purchases.length;
  return { revenue, count, aov: count ? revenue / count : 0 };
}

export function funnelSteps(events: MetaEventRecord[], selected: string[]) {
  const order = META_FUNNEL_EVENTS.filter((name) => selected.includes(name));
  const counts = countByEvent(events);
  return order.map((name, index) => {
    const count = counts[name] || 0;
    const first = counts[order[0]] || 0;
    const prev = index === 0 ? count : (counts[order[index - 1]] || 0);
    const ofTotal = first > 0 ? (count / first) * 100 : 0;
    const drop = index === 0 || prev === 0 ? 0 : ((prev - count) / prev) * 100;
    return { name, count, ofTotal, drop };
  });
}

function bucketKey(ms: number, group: MetaChartGroup): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (group === 'month') return `${y}-${m}`;
  if (group === 'week') {
    const start = new Date(startOfLocalDay(ms));
    start.setDate(start.getDate() - start.getDay());
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  }
  return `${y}-${m}-${day}`;
}

export function trendSeries(
  events: MetaEventRecord[],
  selected: string[],
  group: MetaChartGroup,
): Array<Record<string, string | number>> {
  const map = new Map<string, Record<string, number>>();
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    if (!selected.includes(event.eventName)) continue;
    const key = bucketKey(event.createdAtMs, group);
    const row = map.get(key) || { revenue: 0 };
    row[event.eventName] = (row[event.eventName] || 0) + 1;
    if (event.eventName === 'Purchase') row.revenue = (row.revenue || 0) + Number(event.value || 0);
    map.set(key, row);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, values]) => ({ label, revenue: values.revenue || 0, ...values }));
}

export function computeMetaKpis(current: MetaEventRecord[], previous: MetaEventRecord[], selected: string[]) {
  const curCounts = countByEvent(current);
  const prevCounts = countByEvent(previous);
  const lead = selected.includes('Lead') ? 'Lead' : selected[0] || 'Lead';
  const checkout = selected.includes('InitiateCheckout') ? 'InitiateCheckout' : '';
  const purchase = selected.includes('Purchase') ? 'Purchase' : '';
  const leadCount = curCounts[lead] || 0;
  const checkoutCount = checkout ? (curCounts[checkout] || 0) : 0;
  const money = purchaseRevenue(current);
  const prevMoney = purchaseRevenue(previous);
  const conversion = leadCount > 0 && purchase ? (money.count / leadCount) * 100 : 0;
  const checkoutRate = leadCount > 0 && checkout ? (checkoutCount / leadCount) * 100 : 0;
  const completion = checkoutCount > 0 && purchase ? (money.count / checkoutCount) * 100 : 0;
  const prevLead = prevCounts[lead] || 0;
  const prevCheckout = checkout ? (prevCounts[checkout] || 0) : 0;
  const prevPurchase = prevCounts.Purchase || 0;
  const prevConversion = prevLead > 0 ? (prevPurchase / prevLead) * 100 : 0;
  return {
    counts: curCounts,
    previousCounts: prevCounts,
    revenue: money.revenue,
    aov: money.aov,
    purchaseCount: money.count,
    conversion,
    checkoutRate,
    completion,
    changes: {
      Lead: percentChange(curCounts.Lead || 0, prevCounts.Lead || 0),
      ViewContent: percentChange(curCounts.ViewContent || 0, prevCounts.ViewContent || 0),
      AddToCart: percentChange(curCounts.AddToCart || 0, prevCounts.AddToCart || 0),
      InitiateCheckout: percentChange(curCounts.InitiateCheckout || 0, prevCounts.InitiateCheckout || 0),
      Purchase: percentChange(money.count, prevPurchase),
      conversion: percentChange(conversion, prevConversion),
      checkoutRate: percentChange(checkoutRate, prevLead > 0 ? (prevCheckout / prevLead) * 100 : 0),
      completion: percentChange(completion, prevCheckout > 0 ? (prevPurchase / prevCheckout) * 100 : 0),
      revenue: percentChange(money.revenue, prevMoney.revenue),
    },
  };
}
