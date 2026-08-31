/** Asia/Dhaka is UTC+6 with no DST. All dashboard buckets use this, not the browser TZ. */
export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

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
  contentId?: string;
  eventId?: string;
  channel?: string;
  psidTail?: string;
  hasPhone?: boolean;
  hasName?: boolean;
  hasClid?: boolean;
  pageId?: string;
  adId?: string;
  adRef?: string;
  adSource?: string;
  quantity?: number;
}

export interface DateRange {
  startMs: number;
  endMs: number;
}

export function dhakaParts(ms: number) {
  const shifted = new Date(ms + DHAKA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  };
}

export function startOfDhakaDay(ms: number): number {
  const p = dhakaParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day) - DHAKA_OFFSET_MS;
}

export function endOfDhakaDay(ms: number): number {
  return startOfDhakaDay(ms) + 86400000 - 1;
}

export function formatDhakaDate(ms: number): string {
  const p = dhakaParts(ms);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function formatDhakaDateTime(ms: number): string {
  const p = dhakaParts(ms);
  return `${formatDhakaDate(ms)} ${String(p.hour).padStart(2, '0')}:${String(new Date(ms + DHAKA_OFFSET_MS).getUTCMinutes()).padStart(2, '0')}`;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)} সেকেন্ড`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} মিনিট`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)} ঘণ্টা`;
  return `${(ms / 86400000).toFixed(1)} দিন`;
}

export function formatRelativeMs(ms: number, now = Date.now()): string {
  if (!ms) return '—';
  const diff = now - ms;
  if (diff < 0) return formatDhakaDateTime(ms);
  if (diff < 60000) return 'এইমাত্র';
  if (diff < 3600000) return `${Math.round(diff / 60000)} মিনিট আগে`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)} ঘণ্টা আগে`;
  if (diff < 7 * 86400000) return `${Math.round(diff / 86400000)} দিন আগে`;
  return formatDhakaDateTime(ms);
}

export function rangeForPreset(
  preset: MetaDatePreset,
  now = Date.now(),
  custom?: { from?: string; to?: string },
): DateRange {
  const today = startOfDhakaDay(now);
  if (preset === 'today') return { startMs: today, endMs: endOfDhakaDay(now) };
  if (preset === 'yesterday') {
    const y = today - 86400000;
    return { startMs: y, endMs: y + 86400000 - 1 };
  }
  if (preset === '7d') return { startMs: today - 6 * 86400000, endMs: endOfDhakaDay(now) };
  if (preset === '30d') return { startMs: today - 29 * 86400000, endMs: endOfDhakaDay(now) };
  if (preset === '90d') return { startMs: today - 89 * 86400000, endMs: endOfDhakaDay(now) };
  if (preset === 'this_month') {
    const p = dhakaParts(now);
    const start = Date.UTC(p.year, p.month - 1, 1) - DHAKA_OFFSET_MS;
    return { startMs: start, endMs: endOfDhakaDay(now) };
  }
  if (preset === 'last_month') {
    const p = dhakaParts(now);
    const start = Date.UTC(p.year, p.month - 2, 1) - DHAKA_OFFSET_MS;
    const end = Date.UTC(p.year, p.month - 1, 1) - DHAKA_OFFSET_MS - 1;
    return { startMs: start, endMs: end };
  }
  const fromMs = custom?.from ? startOfDhakaDay(Date.parse(`${custom.from}T00:00:00+06:00`)) : today - 29 * 86400000;
  const toMs = custom?.to ? endOfDhakaDay(Date.parse(`${custom.to}T00:00:00+06:00`)) : endOfDhakaDay(now);
  return { startMs: Math.min(fromMs, toMs), endMs: Math.max(fromMs, toMs) };
}

export function previousRange(range: DateRange): DateRange {
  const length = Math.max(1, range.endMs - range.startMs + 1);
  return { startMs: range.startMs - length, endMs: range.startMs - 1 };
}

export function formatRangeLabel(range: DateRange): string {
  const days = Math.max(1, Math.round((range.endMs - range.startMs + 1) / 86400000));
  return `${formatDhakaDate(range.startMs)} → ${formatDhakaDate(range.endMs)} · ${days} দিন · Asia/Dhaka`;
}

export function percentChange(current: number, previous: number): number {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(previous) || previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function isCountedDelivery(status?: string): boolean {
  const value = String(status || 'sent').toLowerCase();
  return value === 'sent' || value === 'success' || value === '';
}

export function personKey(event: MetaEventRecord): string {
  const tail = String(event.psidTail || '').trim();
  if (tail) return `psid:${tail}`;
  const orderId = String(event.orderId || '').trim();
  if (orderId) return `order:${orderId}`;
  return `event:${event.id || event.eventId || event.createdAtMs}`;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function purchasesFromMessengerOrders(orders: Array<{
  id?: string;
  source?: string;
  status?: string;
  totalPrice?: number;
  productName?: string;
  productId?: string;
  createdAtMs?: number;
  passengerId?: string;
  sessionId?: string;
  phone?: string;
  customerName?: string;
  capiPurchaseSentAt?: number;
  adId?: string;
  adRef?: string;
  adSource?: string;
  pageId?: string;
  quantity?: number;
}>): MetaEventRecord[] {
  return (orders || [])
    .filter((order) => {
      const status = String(order.status || '');
      if (status === 'cancelled' || status === 'returned') return false;
      const source = String(order.source || '').toLowerCase();
      const pid = String(order.passengerId || order.sessionId || '');
      const fromInbox = source === 'messenger' || Boolean(order.capiPurchaseSentAt) || /^\d{6,32}$/.test(pid);
      return fromInbox && Number(order.createdAtMs || 0) > 0;
    })
    .map((order) => {
      const pid = String(order.passengerId || order.sessionId || '');
      return {
        id: `order-${order.id}`,
        eventName: 'Purchase',
        createdAtMs: Number(order.createdAtMs || 0),
        value: Number(order.totalPrice || 0),
        currency: 'BDT',
        status: 'sent',
        source: 'server',
        orderId: String(order.id || ''),
        contentName: String(order.productName || ''),
        contentId: String(order.productId || ''),
        channel: 'messenger',
        psidTail: /^\d{6,32}$/.test(pid) ? pid.slice(-6) : '',
        hasPhone: Boolean(String(order.phone || '').trim()),
        hasName: Boolean(String(order.customerName || '').trim()),
        hasClid: Boolean(String(order.adId || order.adRef || '').trim()),
        pageId: String(order.pageId || ''),
        adId: String(order.adId || ''),
        adRef: String(order.adRef || ''),
        adSource: String(order.adSource || ''),
        quantity: Number(order.quantity || 1) || 1,
      };
    });
}

export function mergeMetaEvents(capiEvents: MetaEventRecord[], orderPurchases: MetaEventRecord[]): MetaEventRecord[] {
  const seenPurchase = new Set<string>();
  const seenEventId = new Set<string>();
  const out: MetaEventRecord[] = [];
  for (const event of capiEvents || []) {
    const eventId = String(event.eventId || event.id || '');
    if (eventId && seenEventId.has(eventId)) continue;
    if (eventId) seenEventId.add(eventId);
    if (String(event.eventName) === 'Purchase' && event.orderId) seenPurchase.add(String(event.orderId));
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
  eventNames?: string[];
  source?: MetaSourceFilter;
  delivery?: MetaDeliveryFilter;
  minRevenue?: number;
  maxRevenue?: number;
  product?: string;
  ad?: string;
}): MetaEventRecord[] {
  const names = new Set(input.eventNames || []);
  const product = String(input.product || '').trim().toLowerCase();
  const ad = String(input.ad || '').trim().toLowerCase();
  return (events || []).filter((event) => {
    if (!event.createdAtMs || event.createdAtMs < input.range.startMs || event.createdAtMs > input.range.endMs) return false;
    if (names.size && !names.has(event.eventName)) return false;
    if (input.source && input.source !== 'all' && String(event.source || 'server') !== input.source) return false;
    if (input.delivery && input.delivery !== 'all') {
      const sent = isCountedDelivery(event.status);
      if (input.delivery === 'sent' && !sent) return false;
      if (input.delivery === 'failed' && sent) return false;
    }
    if (event.eventName === 'Purchase') {
      const value = Number(event.value || 0);
      if (typeof input.minRevenue === 'number' && Number.isFinite(input.minRevenue) && value < input.minRevenue) return false;
      if (typeof input.maxRevenue === 'number' && Number.isFinite(input.maxRevenue) && value > input.maxRevenue) return false;
    }
    if (product) {
      const hay = `${event.contentName || ''} ${event.contentId || ''}`.toLowerCase();
      if (!hay.includes(product)) return false;
    }
    if (ad) {
      const hay = `${event.adId || ''} ${event.adRef || ''} ${event.adSource || ''}`.toLowerCase();
      if (!hay.includes(ad)) return false;
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

export function uniqueByEvent(events: MetaEventRecord[]): Record<string, number> {
  const sets: Record<string, Set<string>> = {};
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    if (!sets[event.eventName]) sets[event.eventName] = new Set();
    sets[event.eventName].add(personKey(event));
  }
  const out: Record<string, number> = {};
  for (const [name, set] of Object.entries(sets)) out[name] = set.size;
  return out;
}

export function purchaseRevenue(events: MetaEventRecord[]): { revenue: number; count: number; aov: number; items: number } {
  const purchases = events.filter((event) => event.eventName === 'Purchase' && isCountedDelivery(event.status));
  const revenue = purchases.reduce((sum, event) => sum + Number(event.value || 0), 0);
  const items = purchases.reduce((sum, event) => sum + Math.max(1, Number(event.quantity || 1)), 0);
  const count = purchases.length;
  return { revenue, count, aov: count ? revenue / count : 0, items };
}

export function funnelSteps(events: MetaEventRecord[], selected: string[]) {
  const order = META_FUNNEL_EVENTS.filter((name) => selected.includes(name));
  const counts = countByEvent(events);
  const uniques = uniqueByEvent(events);
  return order.map((name, index) => {
    const count = counts[name] || 0;
    const unique = uniques[name] || 0;
    const first = uniques[order[0]] || counts[order[0]] || 0;
    const prevUnique = index === 0 ? unique : (uniques[order[index - 1]] || 0);
    const prevCount = index === 0 ? count : (counts[order[index - 1]] || 0);
    const ofTotal = first > 0 ? (unique / first) * 100 : 0;
    const drop = index === 0 || prevUnique === 0 ? 0 : Math.max(0, ((prevUnique - unique) / prevUnique) * 100);
    return {
      name,
      count,
      unique,
      ofTotal,
      drop,
      prevCount,
      prevUnique,
    };
  });
}

export function stageLatencies(events: MetaEventRecord[], selected: string[]) {
  const order = META_FUNNEL_EVENTS.filter((name) => selected.includes(name));
  const byPerson = new Map<string, Partial<Record<string, number>>>();
  for (const event of events) {
    if (!isCountedDelivery(event.status) || !order.includes(event.eventName as MetaFunnelEvent)) continue;
    const key = personKey(event);
    const row = byPerson.get(key) || {};
    const prev = row[event.eventName];
    row[event.eventName] = prev == null ? event.createdAtMs : Math.min(prev, event.createdAtMs);
    byPerson.set(key, row);
  }
  const pairs: Array<{ from: string; to: string; samples: number; medianMs: number; medianHours: number }> = [];
  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i];
    const to = order[i + 1];
    const diffs: number[] = [];
    for (const row of byPerson.values()) {
      const a = row[from];
      const b = row[to];
      if (a && b && b >= a) diffs.push(b - a);
    }
    const medianMs = median(diffs);
    pairs.push({ from, to, samples: diffs.length, medianMs, medianHours: medianMs / 3600000 });
  }
  const leadToBuy: number[] = [];
  const first = order[0];
  if (order.includes('Purchase') && first) {
    for (const row of byPerson.values()) {
      const a = row[first];
      const b = row.Purchase;
      if (a && b && b >= a) leadToBuy.push(b - a);
    }
  }
  return {
    pairs,
    leadToPurchaseMedianMs: median(leadToBuy),
    leadToPurchaseSamples: leadToBuy.length,
    sameDayPurchaseRate: leadToBuy.length
      ? (leadToBuy.filter((ms) => ms < 86400000).length / leadToBuy.length) * 100
      : 0,
  };
}

function bucketKey(ms: number, group: MetaChartGroup): string {
  const p = dhakaParts(ms);
  const y = p.year;
  const m = String(p.month).padStart(2, '0');
  const day = String(p.day).padStart(2, '0');
  if (group === 'month') return `${y}-${m}`;
  if (group === 'week') {
    const start = startOfDhakaDay(ms) - p.weekday * 86400000;
    return formatDhakaDate(start);
  }
  return `${y}-${m}-${day}`;
}

export function enumerateBuckets(range: DateRange, group: MetaChartGroup): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = range.startMs;
  let guard = 0;
  while (cursor <= range.endMs && guard < 400) {
    guard += 1;
    const key = bucketKey(cursor, group);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    if (group === 'month') {
      const p = dhakaParts(cursor);
      const next = Date.UTC(p.year, p.month, 1) - DHAKA_OFFSET_MS;
      cursor = next <= cursor ? cursor + 86400000 : next;
    } else {
      cursor += 86400000;
    }
  }
  const endKey = bucketKey(range.endMs, group);
  if (!seen.has(endKey)) keys.push(endKey);
  return keys;
}

export function trendSeries(
  events: MetaEventRecord[],
  selected: string[],
  group: MetaChartGroup,
  range?: DateRange,
): Array<Record<string, string | number>> {
  const map = new Map<string, Record<string, number>>();
  const ensure = (key: string) => {
    if (!map.has(key)) {
      const row: Record<string, number> = { revenue: 0, unique: 0, uniquePurchases: 0 };
      for (const name of selected) row[name] = 0;
      map.set(key, row);
    }
    return map.get(key)!;
  };
  if (range) {
    for (const key of enumerateBuckets(range, group)) ensure(key);
  }
  const uniqueInBucket = new Map<string, Set<string>>();
  const uniqueBuyBucket = new Map<string, Set<string>>();
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    if (!selected.includes(event.eventName)) continue;
    const key = bucketKey(event.createdAtMs, group);
    const row = ensure(key);
    row[event.eventName] = (row[event.eventName] || 0) + 1;
    if (event.eventName === 'Purchase') row.revenue = (row.revenue || 0) + Number(event.value || 0);
    const people = uniqueInBucket.get(key) || new Set();
    people.add(personKey(event));
    uniqueInBucket.set(key, people);
    row.unique = people.size;
    if (event.eventName === 'Purchase') {
      const buyers = uniqueBuyBucket.get(key) || new Set();
      buyers.add(personKey(event));
      uniqueBuyBucket.set(key, buyers);
      row.uniquePurchases = buyers.size;
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, values]) => ({ label, ...values }));
}

export function hourHeatmap(events: MetaEventRecord[]) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    const p = dhakaParts(event.createdAtMs);
    grid[p.weekday][p.hour] += 1;
  }
  return grid;
}

export function weekdaySeries(events: MetaEventRecord[]) {
  const names = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
  const rows = names.map((label, weekday) => ({ label, weekday, events: 0, purchases: 0, revenue: 0 }));
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    const p = dhakaParts(event.createdAtMs);
    rows[p.weekday].events += 1;
    if (event.eventName === 'Purchase') {
      rows[p.weekday].purchases += 1;
      rows[p.weekday].revenue += Number(event.value || 0);
    }
  }
  return rows;
}

export function productBreakdown(events: MetaEventRecord[]) {
  const map = new Map<string, { name: string; purchases: number; revenue: number; items: number }>();
  for (const event of events) {
    if (event.eventName !== 'Purchase' || !isCountedDelivery(event.status)) continue;
    const name = String(event.contentName || event.contentId || 'অজানা পণ্য').trim() || 'অজানা পণ্য';
    const row = map.get(name) || { name, purchases: 0, revenue: 0, items: 0 };
    row.purchases += 1;
    row.revenue += Number(event.value || 0);
    row.items += Math.max(1, Number(event.quantity || 1));
    map.set(name, row);
  }
  const total = [...map.values()].reduce((sum, row) => sum + row.revenue, 0);
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((row) => ({ ...row, aov: row.purchases ? row.revenue / row.purchases : 0, share: total ? (row.revenue / total) * 100 : 0 }));
}

export function adBreakdown(events: MetaEventRecord[]) {
  const map = new Map<string, { label: string; leads: number; checkouts: number; purchases: number; revenue: number }>();
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    const label = String(event.adSource || event.adId || event.adRef || '').trim() || 'অর্গানিক / আনঅ্যাট্রিবিউটেড';
    const row = map.get(label) || { label, leads: 0, checkouts: 0, purchases: 0, revenue: 0 };
    if (event.eventName === 'Lead') row.leads += 1;
    if (event.eventName === 'InitiateCheckout') row.checkouts += 1;
    if (event.eventName === 'Purchase') {
      row.purchases += 1;
      row.revenue += Number(event.value || 0);
    }
    map.set(label, row);
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)
    .map((row) => ({
      ...row,
      conversion: row.leads > 0 ? (row.purchases / row.leads) * 100 : 0,
    }));
}

export function qualityStats(allInRange: MetaEventRecord[]) {
  const total = allInRange.length;
  const sent = allInRange.filter((event) => isCountedDelivery(event.status)).length;
  const failed = total - sent;
  const withPhone = allInRange.filter((event) => event.hasPhone).length;
  const withName = allInRange.filter((event) => event.hasName).length;
  const withClid = allInRange.filter((event) => event.hasClid).length;
  const withPerson = allInRange.filter((event) => String(event.psidTail || '').trim()).length;
  const ids = allInRange.map((event) => event.eventId || event.id).filter(Boolean);
  const uniqueIds = new Set(ids);
  const last = allInRange.reduce((max, event) => Math.max(max, event.createdAtMs || 0), 0);
  return {
    total,
    sent,
    failed,
    deliveryRate: total ? (sent / total) * 100 : 0,
    phoneRate: total ? (withPhone / total) * 100 : 0,
    nameRate: total ? (withName / total) * 100 : 0,
    clidRate: total ? (withClid / total) * 100 : 0,
    personRate: total ? (withPerson / total) * 100 : 0,
    duplicateRate: ids.length ? ((ids.length - uniqueIds.size) / ids.length) * 100 : 0,
    lastEventAtMs: last,
  };
}

export function bounceAndAbandon(events: MetaEventRecord[]) {
  const byPerson = new Map<string, Set<string>>();
  for (const event of events) {
    if (!isCountedDelivery(event.status)) continue;
    const key = personKey(event);
    const set = byPerson.get(key) || new Set();
    set.add(event.eventName);
    byPerson.set(key, set);
  }
  let leads = 0;
  let leadOnly = 0;
  let checkouts = 0;
  let checkoutNoBuy = 0;
  for (const set of byPerson.values()) {
    if (set.has('Lead')) {
      leads += 1;
      if (!set.has('InitiateCheckout') && !set.has('Purchase')) leadOnly += 1;
    }
    if (set.has('InitiateCheckout')) {
      checkouts += 1;
      if (!set.has('Purchase')) checkoutNoBuy += 1;
    }
  }
  return {
    uniquePeople: byPerson.size,
    bounceRate: leads ? (leadOnly / leads) * 100 : 0,
    abandonRate: checkouts ? (checkoutNoBuy / checkouts) * 100 : 0,
    leadOnly,
    checkoutNoBuy,
  };
}

export function computeMetaKpis(current: MetaEventRecord[], previous: MetaEventRecord[], selected: string[]) {
  const curCounts = countByEvent(current);
  const prevCounts = countByEvent(previous);
  const curUnique = uniqueByEvent(current);
  const prevUnique = uniqueByEvent(previous);
  const lead = selected.includes('Lead') ? 'Lead' : selected[0] || 'Lead';
  const checkout = selected.includes('InitiateCheckout') ? 'InitiateCheckout' : '';
  const purchaseOn = selected.includes('Purchase');
  const leadEvents = curCounts[lead] || 0;
  const leadUnique = curUnique[lead] || 0;
  const checkoutEvents = checkout ? (curCounts[checkout] || 0) : 0;
  const checkoutUnique = checkout ? (curUnique[checkout] || 0) : 0;
  const money = purchaseRevenue(current);
  const prevMoney = purchaseRevenue(previous);
  const buyUnique = curUnique.Purchase || 0;
  const prevBuyUnique = prevUnique.Purchase || 0;
  const conversionEvents = leadEvents > 0 && purchaseOn ? (money.count / leadEvents) * 100 : 0;
  const conversionUnique = leadUnique > 0 && purchaseOn ? (buyUnique / leadUnique) * 100 : 0;
  const leadKeys = new Set<string>();
  const buyKeys = new Set<string>();
  for (const event of current) {
    if (!isCountedDelivery(event.status)) continue;
    if (event.eventName === lead) leadKeys.add(personKey(event));
    if (purchaseOn && event.eventName === 'Purchase') buyKeys.add(personKey(event));
  }
  let matchedBuyers = 0;
  for (const key of buyKeys) if (leadKeys.has(key)) matchedBuyers += 1;
  const matchedConversion = leadUnique > 0 && purchaseOn ? (matchedBuyers / leadUnique) * 100 : 0;
  const orphanPurchases = Math.max(0, buyKeys.size - matchedBuyers);
  const checkoutRate = leadUnique > 0 && checkout ? (checkoutUnique / leadUnique) * 100 : 0;
  const completion = checkoutUnique > 0 && purchaseOn ? (buyUnique / checkoutUnique) * 100 : 0;
  const prevLeadU = prevUnique[lead] || 0;
  const prevCheckoutU = checkout ? (prevUnique[checkout] || 0) : 0;
  const prevLeadKeys = new Set<string>();
  const prevBuyKeys = new Set<string>();
  for (const event of previous) {
    if (!isCountedDelivery(event.status)) continue;
    if (event.eventName === lead) prevLeadKeys.add(personKey(event));
    if (purchaseOn && event.eventName === 'Purchase') prevBuyKeys.add(personKey(event));
  }
  let prevMatched = 0;
  for (const key of prevBuyKeys) if (prevLeadKeys.has(key)) prevMatched += 1;
  const prevMatchedConversion = prevLeadU > 0 ? (prevMatched / prevLeadU) * 100 : 0;
  const journey = bounceAndAbandon(current);
  const latency = stageLatencies(current, selected);
  const repeatRate = buyUnique > 0 ? (Math.max(0, money.count - buyUnique) / buyUnique) * 100 : 0;
  return {
    counts: curCounts,
    uniques: curUnique,
    previousCounts: prevCounts,
    previousUniques: prevUnique,
    revenue: money.revenue,
    aov: money.aov,
    items: money.items,
    purchaseCount: money.count,
    leadEvents,
    leadUnique,
    checkoutEvents,
    checkoutUnique,
    buyUnique,
    conversion: matchedConversion,
    conversionUnique,
    conversionEvents,
    matchedBuyers,
    matchedConversion,
    checkoutRate,
    completion,
    orphanPurchases,
    repeatRate,
    bounceRate: journey.bounceRate,
    abandonRate: journey.abandonRate,
    uniquePeople: journey.uniquePeople,
    leadToPurchaseHours: latency.leadToPurchaseMedianMs / 3600000,
    leadToPurchaseSamples: latency.leadToPurchaseSamples,
    sameDayPurchaseRate: latency.sameDayPurchaseRate,
    latencies: latency.pairs,
    changes: {
      Lead: percentChange(curUnique.Lead || 0, prevUnique.Lead || 0),
      ViewContent: percentChange(curUnique.ViewContent || 0, prevUnique.ViewContent || 0),
      AddToCart: percentChange(curUnique.AddToCart || 0, prevUnique.AddToCart || 0),
      InitiateCheckout: percentChange(curUnique.InitiateCheckout || 0, prevUnique.InitiateCheckout || 0),
      Purchase: percentChange(buyUnique, prevBuyUnique),
      conversion: percentChange(matchedConversion, prevMatchedConversion),
      conversionUnique: percentChange(conversionUnique, prevLeadU > 0 ? (prevBuyUnique / prevLeadU) * 100 : 0),
      checkoutRate: percentChange(checkoutRate, prevLeadU > 0 ? (prevCheckoutU / prevLeadU) * 100 : 0),
      completion: percentChange(completion, prevCheckoutU > 0 ? (prevBuyUnique / prevCheckoutU) * 100 : 0),
      revenue: percentChange(money.revenue, prevMoney.revenue),
      aov: percentChange(money.aov, prevMoney.aov),
    },
  };
}

export function searchMetaLogs(events: MetaEventRecord[], query: string): MetaEventRecord[] {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return events;
  return events.filter((event) => {
    const hay = [
      event.eventName,
      event.status,
      event.source,
      event.contentName,
      event.contentId,
      event.orderId,
      event.psidTail,
      event.adId,
      event.adRef,
      event.adSource,
      event.eventId,
      event.pageId,
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function peakCell(grid: number[][]): { weekday: number; hour: number; count: number } {
  let weekday = 0;
  let hour = 0;
  let count = 0;
  for (let d = 0; d < grid.length; d++) {
    for (let h = 0; h < (grid[d]?.length || 0); h++) {
      if (grid[d][h] > count) {
        weekday = d;
        hour = h;
        count = grid[d][h];
      }
    }
  }
  return { weekday, hour, count };
}

export function logsToCsv(events: MetaEventRecord[]): string {
  const header = ['time_dhaka', 'event', 'status', 'source', 'revenue', 'product', 'order_id', 'psid_tail', 'ad', 'phone', 'clid'];
  const rows = events.map((event) => [
    formatDhakaDateTime(event.createdAtMs),
    event.eventName,
    isCountedDelivery(event.status) ? 'sent' : 'failed',
    event.source || 'server',
    event.eventName === 'Purchase' ? String(Number(event.value || 0)) : '',
    event.contentName || '',
    event.orderId || '',
    event.psidTail || '',
    event.adSource || event.adId || event.adRef || '',
    event.hasPhone ? '1' : '0',
    event.hasClid ? '1' : '0',
  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}
