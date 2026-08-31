import assert from 'node:assert/strict';
import {
  computeMetaKpis,
  filterMetaEvents,
  funnelSteps,
  mergeMetaEvents,
  percentChange,
  previousRange,
  purchasesFromMessengerOrders,
  rangeForPreset,
  trendSeries,
} from './metaAnalytics.ts';

const now = Date.parse('2026-08-31T12:00:00');

function testRanges() {
  const thirty = rangeForPreset('30d', now);
  assert.equal(thirty.endMs > thirty.startMs, true);
  const prev = previousRange(thirty);
  assert.equal(prev.endMs + 1, thirty.startMs);
  const month = rangeForPreset('this_month', now);
  const start = new Date(month.startMs);
  assert.equal(start.getDate(), 1);
}

function testMergeAndKpis() {
  const capi = [
    { id: '1', eventName: 'Lead', createdAtMs: now - 86400000, status: 'sent', source: 'server' },
    { id: '2', eventName: 'InitiateCheckout', createdAtMs: now - 3600000, status: 'sent', source: 'server' },
    { id: '3', eventName: 'Purchase', createdAtMs: now - 1800000, value: 1580, orderId: 'ORD-1', status: 'sent', source: 'server' },
  ];
  const fromOrders = purchasesFromMessengerOrders([
    { id: 'ORD-1', source: 'messenger', status: 'confirmed', totalPrice: 1580, createdAtMs: now - 1800000, passengerId: '1234567890' },
    { id: 'ORD-2', source: 'messenger', status: 'confirmed', totalPrice: 2000, createdAtMs: now - 7200000, passengerId: '1234567890' },
    { id: 'ORD-X', source: 'website', status: 'confirmed', totalPrice: 9000, createdAtMs: now - 1000 },
    { id: 'ORD-C', source: 'messenger', status: 'cancelled', totalPrice: 500, createdAtMs: now - 1000, passengerId: '1' },
  ]);
  assert.equal(fromOrders.length, 2);
  const merged = mergeMetaEvents(capi, fromOrders);
  assert.equal(merged.filter((e) => e.eventName === 'Purchase').length, 2);

  const range = rangeForPreset('30d', now);
  const current = filterMetaEvents(merged, {
    range,
    eventNames: ['Lead', 'InitiateCheckout', 'Purchase'],
  });
  const kpis = computeMetaKpis(current, [], ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(kpis.counts.Lead, 1);
  assert.equal(kpis.counts.InitiateCheckout, 1);
  assert.equal(kpis.purchaseCount, 2);
  assert.equal(kpis.revenue, 3580);
  assert.ok(Math.abs(kpis.conversion - 200) < 0.01);
  assert.ok(Math.abs(kpis.completion - 200) < 0.01);
  assert.equal(percentChange(32, 0), 100);

  const funnel = funnelSteps(current, ['Lead', 'InitiateCheckout', 'Purchase']);
  assert.equal(funnel[0].name, 'Lead');
  assert.equal(funnel[2].count, 2);

  const trend = trendSeries(current, ['Purchase'], 'day');
  assert.ok(trend.length >= 1);
  assert.ok(trend.some((row) => Number(row.revenue) > 0));
}

testRanges();
testMergeAndKpis();
console.log('metaAnalytics tests passed');
