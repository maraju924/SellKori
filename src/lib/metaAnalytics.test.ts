import assert from 'node:assert/strict';
import {
  adBreakdown,
  bounceAndAbandon,
  computeMetaKpis,
  enumerateBuckets,
  filterMetaEvents,
  formatDhakaDate,
  formatDhakaDateTime,
  formatDurationMs,
  funnelSteps,
  hourHeatmap,
  isCountedDelivery,
  logsToCsv,
  mergeMetaEvents,
  peakCell,
  percentChange,
  previousRange,
  productBreakdown,
  purchasesFromMessengerOrders,
  qualityStats,
  rangeForPreset,
  searchMetaLogs,
  stageLatencies,
  startOfDhakaDay,
  trendSeries,
  uniqueByEvent,
  weekdaySeries,
} from './metaAnalytics.ts';

const now = Date.parse('2026-08-31T12:00:00+06:00');

function ev(partial: Record<string, unknown>) {
  return {
    id: String(partial.id || Math.random()),
    eventName: String(partial.eventName),
    createdAtMs: Number(partial.createdAtMs || now),
    status: String(partial.status || 'sent'),
    source: String(partial.source || 'server'),
    ...partial,
  } as any;
}

function testDhakaRanges() {
  const today = rangeForPreset('today', now);
  assert.equal(formatDhakaDate(today.startMs), '2026-08-31');
  assert.equal(formatDhakaDate(today.endMs), '2026-08-31');
  assert.equal(startOfDhakaDay(now), today.startMs);

  // 17:00 UTC on Aug 30 = 23:00 Dhaka Aug 30 — previous Dhaka day
  const beforeMidnight = Date.parse('2026-08-30T17:00:00Z');
  assert.equal(formatDhakaDate(beforeMidnight), '2026-08-30');
  assert.equal(beforeMidnight < today.startMs, true);

  // 18:30 UTC Aug 30 = 00:30 Dhaka Aug 31 — today
  const afterMidnight = Date.parse('2026-08-30T18:30:00Z');
  assert.equal(formatDhakaDate(afterMidnight), '2026-08-31');
  assert.equal(afterMidnight >= today.startMs, true);

  const yesterday = rangeForPreset('yesterday', now);
  assert.equal(formatDhakaDate(yesterday.startMs), '2026-08-30');

  const month = rangeForPreset('this_month', now);
  assert.equal(formatDhakaDate(month.startMs), '2026-08-01');

  const lastMonth = rangeForPreset('last_month', now);
  assert.equal(formatDhakaDate(lastMonth.startMs), '2026-07-01');
  assert.equal(formatDhakaDate(lastMonth.endMs), '2026-07-31');

  const seven = rangeForPreset('7d', now);
  assert.equal(formatDhakaDate(seven.startMs), '2026-08-25');
  const prev = previousRange(seven);
  assert.equal(prev.endMs + 1, seven.startMs);

  const custom = rangeForPreset('custom', now, { from: '2026-08-01', to: '2026-08-03' });
  assert.equal(formatDhakaDate(custom.startMs), '2026-08-01');
  assert.equal(formatDhakaDate(custom.endMs), '2026-08-03');

  assert.equal(formatDhakaDateTime(Date.parse('2026-08-31T06:05:00+06:00')), '2026-08-31 06:05');
}

function testFailedEventsExcluded() {
  const events = [
    ev({ id: 'ok', eventName: 'Lead', psidTail: '111111', status: 'sent' }),
    ev({ id: 'bad', eventName: 'Lead', psidTail: '222222', status: 'failed' }),
    ev({ id: 'err', eventName: 'Purchase', psidTail: '111111', value: 500, status: 'error' }),
  ];
  const kpis = computeMetaKpis(events, [], ['Lead', 'Purchase']);
  assert.equal(kpis.leadEvents, 1);
  assert.equal(kpis.purchaseCount, 0);
  assert.equal(kpis.revenue, 0);
  assert.equal(isCountedDelivery('failed'), false);
  assert.equal(isCountedDelivery('error'), false);
  assert.equal(isCountedDelivery('sent'), true);
}

function testUniqueVsEventsAndMatchedConversion() {
  const samePerson = [
    ev({ id: 'l1', eventName: 'Lead', psidTail: 'aaaaaa', createdAtMs: now - 7200000 }),
    ev({ id: 'c1', eventName: 'InitiateCheckout', psidTail: 'aaaaaa', createdAtMs: now - 3600000 }),
    ev({ id: 'p1', eventName: 'Purchase', psidTail: 'aaaaaa', value: 1000, orderId: 'ORD-1', createdAtMs: now - 1800000 }),
    ev({ id: 'p2', eventName: 'Purchase', psidTail: 'aaaaaa', value: 500, orderId: 'ORD-2', createdAtMs: now - 600000 }),
  ];
  const kpis = computeMetaKpis(samePerson, [], ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(kpis.leadEvents, 1);
  assert.equal(kpis.leadUnique, 1);
  assert.equal(kpis.purchaseCount, 2);
  assert.equal(kpis.buyUnique, 1);
  assert.equal(kpis.matchedBuyers, 1);
  assert.ok(Math.abs(kpis.conversion - 100) < 0.01, 'matched conversion is 100% for one buyer with a lead');
  assert.ok(Math.abs(kpis.conversionEvents - 200) < 0.01, 'event conversion counts repeat purchases');
  assert.ok(Math.abs(kpis.repeatRate - 100) < 0.01);
  assert.equal(kpis.orphanPurchases, 0);

  const withOrphan = [
    ...samePerson,
    ev({ id: 'p3', eventName: 'Purchase', psidTail: 'bbbbbb', value: 2000, orderId: 'ORD-9', createdAtMs: now - 300000 }),
  ];
  const orphanKpis = computeMetaKpis(withOrphan, [], ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(orphanKpis.buyUnique, 2);
  assert.equal(orphanKpis.matchedBuyers, 1);
  assert.equal(orphanKpis.orphanPurchases, 1);
  assert.ok(Math.abs(orphanKpis.conversion - 100) < 0.01, 'headline conversion ignores orphan backfill');
  assert.ok(Math.abs(orphanKpis.conversionUnique - 200) < 0.01);
}

function testMergeDedupAndCancelledOrders() {
  const capi = [
    ev({ id: '1', eventName: 'Lead', psidTail: '123456', createdAtMs: now - 86400000 }),
    ev({ id: '2', eventName: 'InitiateCheckout', psidTail: '123456', createdAtMs: now - 3600000 }),
    ev({ id: '3', eventName: 'Purchase', psidTail: '123456', value: 1580, orderId: 'ORD-1', eventId: 'Purchase_abc' }),
  ];
  const fromOrders = purchasesFromMessengerOrders([
    { id: 'ORD-1', source: 'messenger', status: 'confirmed', totalPrice: 1580, createdAtMs: now - 1800000, passengerId: '99000123456' },
    { id: 'ORD-2', source: 'messenger', status: 'confirmed', totalPrice: 2000, createdAtMs: now - 7200000, passengerId: '99000123456', productName: 'টি-শার্ট' },
    { id: 'ORD-X', source: 'website', status: 'confirmed', totalPrice: 9000, createdAtMs: now - 1000 },
    { id: 'ORD-C', source: 'messenger', status: 'cancelled', totalPrice: 500, createdAtMs: now - 1000, passengerId: '1' },
    { id: 'ORD-R', source: 'messenger', status: 'returned', totalPrice: 700, createdAtMs: now - 1000, passengerId: '99000123456' },
  ]);
  assert.equal(fromOrders.length, 2);
  const merged = mergeMetaEvents(capi, fromOrders);
  assert.equal(merged.filter((e) => e.eventName === 'Purchase').length, 2);

  const range = rangeForPreset('30d', now);
  const current = filterMetaEvents(merged, {
    range,
    eventNames: ['Lead', 'InitiateCheckout', 'Purchase'],
    delivery: 'sent',
  });
  const kpis = computeMetaKpis(current, [], ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(kpis.counts.Lead, 1);
  assert.equal(kpis.purchaseCount, 2);
  assert.equal(kpis.revenue, 3580);
  assert.equal(kpis.buyUnique, 1);
  assert.ok(Math.abs(kpis.conversion - 100) < 0.01);
  assert.equal(percentChange(32, 0), 100);
}

function testFilledTrendsAndHeatmap() {
  const range = rangeForPreset('7d', now);
  const events = [
    ev({
      id: 'p',
      eventName: 'Purchase',
      createdAtMs: Date.parse('2026-08-31T15:00:00+06:00'),
      value: 800,
      psidTail: '333333',
    }),
  ];
  const trend = trendSeries(events, ['Lead', 'Purchase'], 'day', range);
  assert.equal(trend.length, 7);
  assert.equal(trend[0].label, '2026-08-25');
  assert.equal(trend[6].label, '2026-08-31');
  assert.equal(Number(trend[6].revenue), 800);
  assert.equal(Number(trend[0].Purchase), 0);

  const grid = hourHeatmap(events);
  assert.equal(grid[1][15], 1, 'Monday 15:00 Dhaka');
  const peak = peakCell(grid);
  assert.equal(peak.hour, 15);
  assert.equal(peak.weekday, 1);

  const weekdays = weekdaySeries(events);
  assert.equal(weekdays[1].purchases, 1);
  assert.equal(weekdays[1].revenue, 800);

  const months = enumerateBuckets(rangeForPreset('90d', now), 'month');
  assert.ok(months.includes('2026-06'));
  assert.ok(months.includes('2026-08'));
}

function testProductAdQualityLatencyCsv() {
  const events = [
    ev({ id: 'l1', eventName: 'Lead', psidTail: 'aaaaaa', createdAtMs: now - 4 * 3600000, hasPhone: true, hasName: true, hasClid: true, adSource: 'Summer Ad' }),
    ev({ id: 'c1', eventName: 'InitiateCheckout', psidTail: 'aaaaaa', createdAtMs: now - 2 * 3600000, hasPhone: true, adSource: 'Summer Ad' }),
    ev({ id: 'p1', eventName: 'Purchase', psidTail: 'aaaaaa', createdAtMs: now - 3600000, value: 1500, contentName: 'শাড়ি', quantity: 2, adSource: 'Summer Ad', hasPhone: true }),
    ev({ id: 'l2', eventName: 'Lead', psidTail: 'cccccc', createdAtMs: now - 3600000, hasPhone: false, adSource: '' }),
    ev({ id: 'fail', eventName: 'Lead', psidTail: 'dddddd', status: 'failed', createdAtMs: now - 1000 }),
  ];
  const products = productBreakdown(events);
  assert.equal(products[0].name, 'শাড়ি');
  assert.equal(products[0].items, 2);
  assert.equal(products[0].revenue, 1500);

  const ads = adBreakdown(events);
  const summer = ads.find((row) => row.label === 'Summer Ad');
  assert.ok(summer);
  assert.equal(summer!.leads, 1);
  assert.equal(summer!.purchases, 1);
  assert.ok(Math.abs(summer!.conversion - 100) < 0.01);

  const quality = qualityStats(events);
  assert.equal(quality.total, 5);
  assert.equal(quality.failed, 1);
  assert.ok(Math.abs(quality.deliveryRate - 80) < 0.01);
  assert.ok(quality.phoneRate > 0);
  assert.ok(quality.clidRate > 0);

  const bounce = bounceAndAbandon(events);
  assert.equal(bounce.leadOnly, 1);
  assert.ok(Math.abs(bounce.bounceRate - 50) < 0.01);

  const latency = stageLatencies(events, ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(latency.pairs[0].samples, 1);
  assert.equal(latency.pairs[0].medianMs, 2 * 3600000);
  assert.equal(latency.leadToPurchaseSamples, 1);
  assert.ok(latency.sameDayPurchaseRate > 99);
  assert.equal(formatDurationMs(2 * 3600000), '2.0 ঘণ্টা');

  const funnel = funnelSteps(events, ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(funnel[0].unique, 2);
  assert.equal(funnel[2].count, 1);

  const csv = logsToCsv(events);
  assert.ok(csv.startsWith('time_dhaka,event,status'));
  assert.ok(csv.includes('Lead'));
  assert.ok(csv.includes('failed'));

  const found = searchMetaLogs(events, 'শাড়ি');
  assert.equal(found.length, 1);
  assert.equal(uniqueByEvent(events).Lead, 2);
}

testDhakaRanges();
testFailedEventsExcluded();
testUniqueVsEventsAndMatchedConversion();
testMergeDedupAndCancelledOrders();
testFilledTrendsAndHeatmap();
testProductAdQualityLatencyCsv();
console.log('metaAnalytics tests passed');
