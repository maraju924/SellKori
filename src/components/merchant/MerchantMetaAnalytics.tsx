import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import type { BusinessConfig, Order } from '../../types';
import { listenQueryAcrossPanelDbs } from '../../lib/panelDb';
import {
  META_FUNNEL_EVENTS,
  computeMetaKpis,
  filterMetaEvents,
  formatRangeLabel,
  funnelSteps,
  mergeMetaEvents,
  previousRange,
  purchasesFromMessengerOrders,
  rangeForPreset,
  trendSeries,
  type MetaChartGroup,
  type MetaDatePreset,
  type MetaDeliveryFilter,
  type MetaEventRecord,
  type MetaSourceFilter,
} from '../../lib/metaAnalytics';
import { Input } from '../ui/input';

interface MerchantMetaAnalyticsProps {
  business: BusinessConfig;
  orders: Order[];
}

const PRESETS: { id: MetaDatePreset; label: string }[] = [
  { id: 'today', label: 'আজ' },
  { id: 'yesterday', label: 'গতকাল' },
  { id: '7d', label: '৭ দিন' },
  { id: '30d', label: '৩০ দিন' },
  { id: '90d', label: '৯০ দিন' },
  { id: 'this_month', label: 'এই মাস' },
  { id: 'last_month', label: 'গত মাস' },
  { id: 'custom', label: 'কাস্টম' },
];

const EVENT_LABEL: Record<string, string> = {
  Lead: 'Lead',
  ViewContent: 'ViewContent',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'Purchase',
};

const DEFAULT_EVENTS = ['Lead', 'InitiateCheckout', 'Purchase'];

function ChangePill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`text-[11px] font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function eventTime(value: unknown): number {
  if (typeof value === 'number' && value > 0) return value;
  const anyValue = value as { toMillis?: () => number; seconds?: number };
  if (anyValue?.toMillis) return anyValue.toMillis();
  if (typeof anyValue?.seconds === 'number') return anyValue.seconds * 1000;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function MerchantMetaAnalytics({ business, orders }: MerchantMetaAnalyticsProps) {
  const [tab, setTab] = useState<'tracking' | 'logs'>('tracking');
  const [preset, setPreset] = useState<MetaDatePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(DEFAULT_EVENTS);
  const [source, setSource] = useState<MetaSourceFilter>('all');
  const [delivery, setDelivery] = useState<MetaDeliveryFilter>('all');
  const [group, setGroup] = useState<MetaChartGroup>('day');
  const [minRevenue, setMinRevenue] = useState('0');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [compare, setCompare] = useState(true);
  const [capiEvents, setCapiEvents] = useState<MetaEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business.id) return;
    setLoading(true);
    return listenQueryAcrossPanelDbs<MetaEventRecord>(
      (database) => query(
        collection(database, 'capi_events'),
        where('businessId', '==', business.id),
        orderBy('createdAtMs', 'desc'),
        limit(4000),
      ),
      (docs) => {
        setCapiEvents(docs.map((row) => ({
          ...row,
          createdAtMs: eventTime(row.createdAtMs),
        })));
        setLoading(false);
      },
      (database) => query(
        collection(database, 'capi_events'),
        where('businessId', '==', business.id),
        limit(4000),
      ),
    );
  }, [business.id]);

  const range = useMemo(
    () => rangeForPreset(preset, Date.now(), { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );
  const prev = useMemo(() => previousRange(range), [range]);
  const merged = useMemo(
    () => mergeMetaEvents(capiEvents, purchasesFromMessengerOrders(orders)),
    [capiEvents, orders],
  );
  const minRev = Number(minRevenue);
  const maxRev = maxRevenue.trim() === '' ? undefined : Number(maxRevenue);
  const current = useMemo(
    () => filterMetaEvents(merged, {
      range,
      eventNames: selectedEvents,
      source,
      delivery,
      minRevenue: Number.isFinite(minRev) ? minRev : 0,
      maxRevenue: maxRev,
    }),
    [merged, range, selectedEvents, source, delivery, minRev, maxRev],
  );
  const previous = useMemo(
    () => (compare ? filterMetaEvents(merged, {
      range: prev,
      eventNames: selectedEvents,
      source,
      delivery,
      minRevenue: Number.isFinite(minRev) ? minRev : 0,
      maxRevenue: maxRev,
    }) : []),
    [compare, merged, prev, selectedEvents, source, delivery, minRev, maxRev],
  );
  const kpis = useMemo(() => computeMetaKpis(current, previous, selectedEvents), [current, previous, selectedEvents]);
  const funnel = useMemo(() => funnelSteps(current, selectedEvents), [current, selectedEvents]);
  const trend = useMemo(() => trendSeries(current, selectedEvents, group), [current, selectedEvents, group]);
  const pixelReady = Boolean(business.facebookConfig?.pixelId && business.facebookConfig?.accessToken);

  const toggleEvent = (name: string) => {
    setSelectedEvents((currentEvents) => {
      if (currentEvents.includes(name)) {
        const next = currentEvents.filter((item) => item !== name);
        return next.length ? next : currentEvents;
      }
      return META_FUNNEL_EVENTS.filter((item) => [...currentEvents, name].includes(item));
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-zinc-900 text-white p-5 sm:p-6">
        <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-400">Meta Analytics</p>
        <div className="mt-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black">Meta Analytics Dashboard</h2>
            <p className="text-xs text-zinc-400 mt-1">মেসেঞ্জার CAPI · ইনবক্স Lead থেকে Purchase</p>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTab('tracking')}
              className={`px-3 py-1.5 rounded-lg ${tab === 'tracking' ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
            >
              Meta Tracking
            </button>
            <button
              type="button"
              onClick={() => setTab('logs')}
              className={`px-3 py-1.5 rounded-lg ${tab === 'logs' ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'}`}
            >
              Event Logs
            </button>
          </div>
        </div>
      </div>

      {!pixelReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          পিক্সেল ও CAPI টোকেন সেভ করলে ইনবক্স ইভেন্ট এখানে জমা হবে। আগের মেসেঞ্জার অর্ডার থেকে Purchase এখনও দেখা যাচ্ছে।
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`h-8 px-3 rounded-lg text-xs font-bold ${
                preset === item.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 rounded-lg text-xs" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 rounded-lg text-xs" />
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">
          {META_FUNNEL_EVENTS.map((name) => (
            <label key={name} className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEvents.includes(name)}
                onChange={() => toggleEvent(name)}
                className="accent-orange-600"
              />
              {EVENT_LABEL[name]}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value as MetaSourceFilter)} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="all">ব্রাউজার স্ট্যাটাস: সব</option>
            <option value="server">শুধু সার্ভার (CAPI)</option>
            <option value="browser">শুধু ব্রাউজার</option>
          </select>
          <select value={delivery} onChange={(e) => setDelivery(e.target.value as MetaDeliveryFilter)} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="all">ডেলিভারি: সব</option>
            <option value="sent">পাঠানো</option>
            <option value="failed">ব্যর্থ</option>
          </select>
          <select value={group} onChange={(e) => setGroup(e.target.value as MetaChartGroup)} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="day">গ্রুপ: দৈনিক</option>
            <option value="week">সাপ্তাহিক</option>
            <option value="month">মাসিক</option>
          </select>
          <Input value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} placeholder="সর্বনিম্ন রেভিনিউ" className="h-9 rounded-lg text-xs" />
          <Input value={maxRevenue} onChange={(e) => setMaxRevenue(e.target.value)} placeholder="সর্বোচ্চ রেভিনিউ" className="h-9 rounded-lg text-xs" />
          <select value={compare ? 'yes' : 'no'} onChange={(e) => setCompare(e.target.value === 'yes')} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="yes">আগের পিরিয়ডের সাথে তুলনা</option>
            <option value="no">তুলনা ছাড়া</option>
          </select>
        </div>
        <p className="text-[11px] text-zinc-500">{formatRangeLabel(range)}{loading ? ' · লোড হচ্ছে...' : ''}</p>
      </div>

      {tab === 'tracking' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {selectedEvents.map((name) => (
              <div key={name} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
                <p className="text-xs text-zinc-500 font-bold">{EVENT_LABEL[name]}</p>
                <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">{(kpis.counts[name] || 0).toLocaleString()}</p>
                {compare ? <ChangePill value={Number((kpis.changes as Record<string, number>)[name] || 0)} /> : null}
              </div>
            ))}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-bold">Conversion Rate</p>
              <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">{kpis.conversion.toFixed(2)}%</p>
              {compare ? <ChangePill value={kpis.changes.conversion} /> : null}
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-bold">Checkout Rate</p>
              <p className="text-[10px] text-zinc-400">Lead → Checkout</p>
              <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">{kpis.checkoutRate.toFixed(2)}%</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-bold">Purchase Completion</p>
              <p className="text-[10px] text-zinc-400">Checkout → Purchase</p>
              <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">{kpis.completion.toFixed(2)}%</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-bold">মোট রেভিনিউ</p>
              <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">৳{Math.round(kpis.revenue).toLocaleString()}</p>
              {compare ? <ChangePill value={kpis.changes.revenue} /> : null}
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 font-bold">AOV (গড় অর্ডার)</p>
              <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">৳{Math.round(kpis.aov).toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-black">Conversion Funnel</h3>
            {funnel.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center">এই সময়ে কোনো ইভেন্ট নেই</p>
            ) : (
              funnel.map((step) => (
                <div key={step.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>{step.name}</span>
                    <span>{step.count.toLocaleString()} · {step.ofTotal.toFixed(1)}%{step.drop > 0 ? ` · ↓ ${step.drop.toFixed(1)}%` : ''}</span>
                  </div>
                  <div className="h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-400"
                      style={{ width: `${Math.min(100, Math.max(4, step.ofTotal))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-black">Event Trend</h3>
              </div>
              <div className="h-56">
                {trend.length === 0 ? (
                  <p className="h-full flex items-center justify-center text-sm text-zinc-400">ডাটা নেই</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      {selectedEvents.map((name, index) => (
                        <Area
                          key={name}
                          type="monotone"
                          dataKey={name}
                          stroke={['#0f766e', '#ea580c', '#2563eb', '#9333ea', '#ca8a04'][index % 5]}
                          fillOpacity={0.15}
                          fill={['#0f766e', '#ea580c', '#2563eb', '#9333ea', '#ca8a04'][index % 5]}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-black">Revenue (৳)</h3>
              </div>
              <div className="h-56">
                {trend.length === 0 ? (
                  <p className="h-full flex items-center justify-center text-sm text-zinc-400">ডাটা নেই</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                      <XAxis dataKey="label" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#0f766e" radius={[6, 6, 0, 0]} name="রেভিনিউ" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-black">Event Logs</h3>
            <span className="text-[11px] text-zinc-400 inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> {current.length} ইভেন্ট
            </span>
          </div>
          {current.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">এই ফিল্টারে কোনো ইভেন্ট নেই</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-2 font-bold">সময়</th>
                    <th className="px-4 py-2 font-bold">ইভেন্ট</th>
                    <th className="px-4 py-2 font-bold">সোর্স</th>
                    <th className="px-4 py-2 font-bold">স্ট্যাটাস</th>
                    <th className="px-4 py-2 font-bold">রেভিনিউ</th>
                    <th className="px-4 py-2 font-bold">পণ্য</th>
                  </tr>
                </thead>
                <tbody>
                  {current.slice(0, 200).map((event) => (
                    <tr key={event.id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                      <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(event.createdAtMs).toLocaleString('bn-BD')}
                      </td>
                      <td className="px-4 py-2 font-bold text-xs">{event.eventName}</td>
                      <td className="px-4 py-2 text-xs">{event.source === 'browser' ? 'ব্রাউজার' : 'সার্ভার'}</td>
                      <td className="px-4 py-2 text-xs">
                        {String(event.status || 'sent') === 'failed' || String(event.status) === 'error' ? 'ব্যর্থ' : 'পাঠানো'}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {event.eventName === 'Purchase' ? `৳${Number(event.value || 0).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500 truncate max-w-[180px]">{event.contentName || event.orderId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
