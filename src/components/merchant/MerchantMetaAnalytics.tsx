import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
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
  adBreakdown,
  computeMetaKpis,
  filterMetaEvents,
  formatDhakaDateTime,
  formatDurationMs,
  formatRangeLabel,
  formatRelativeMs,
  funnelSteps,
  hourHeatmap,
  isCountedDelivery,
  logsToCsv,
  mergeMetaEvents,
  peakCell,
  previousRange,
  productBreakdown,
  purchasesFromMessengerOrders,
  qualityStats,
  rangeForPreset,
  searchMetaLogs,
  trendSeries,
  weekdaySeries,
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

type DashTab = 'tracking' | 'breakdown' | 'quality' | 'logs';

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

const EVENT_COLOR = ['#0f766e', '#2563eb', '#9333ea', '#ea580c', '#ca8a04'];
const WEEKDAY_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
const DEFAULT_EVENTS = ['Lead', 'InitiateCheckout', 'Purchase'];
const LOG_PAGE = 50;

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

function money(value: number) {
  return `৳${Math.round(value || 0).toLocaleString('en-BD')}`;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function mapCapiDoc(row: MetaEventRecord): MetaEventRecord {
  return {
    ...row,
    createdAtMs: eventTime(row.createdAtMs),
    psidTail: String(row.psidTail || ''),
    hasPhone: Boolean(row.hasPhone),
    hasName: Boolean(row.hasName),
    hasClid: Boolean(row.hasClid),
    adId: String(row.adId || ''),
    adRef: String(row.adRef || ''),
    adSource: String(row.adSource || ''),
    contentId: String(row.contentId || ''),
    contentName: String(row.contentName || ''),
    pageId: String(row.pageId || ''),
    quantity: Number(row.quantity || 0) || undefined,
  };
}

function KpiCard({
  label,
  hint,
  value,
  change,
  compare,
}: {
  label: string;
  hint?: string;
  value: string;
  change?: number;
  compare?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
      <p className="text-xs text-zinc-500 font-bold">{label}</p>
      {hint ? <p className="text-[10px] text-zinc-400 mt-0.5">{hint}</p> : null}
      <p className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-400">{value}</p>
      {compare && typeof change === 'number' ? <ChangePill value={change} /> : null}
    </div>
  );
}

export function MerchantMetaAnalytics({ business, orders }: MerchantMetaAnalyticsProps) {
  const [tab, setTab] = useState<DashTab>('tracking');
  const [preset, setPreset] = useState<MetaDatePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(DEFAULT_EVENTS);
  const [source, setSource] = useState<MetaSourceFilter>('all');
  const [delivery, setDelivery] = useState<MetaDeliveryFilter>('sent');
  const [group, setGroup] = useState<MetaChartGroup>('day');
  const [minRevenue, setMinRevenue] = useState('0');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [product, setProduct] = useState('');
  const [ad, setAd] = useState('');
  const [compare, setCompare] = useState(true);
  const [logQuery, setLogQuery] = useState('');
  const [logPage, setLogPage] = useState(0);
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
        limit(8000),
      ),
      (docs) => {
        setCapiEvents(docs.map(mapCapiDoc));
        setLoading(false);
      },
      (database) => query(
        collection(database, 'capi_events'),
        where('businessId', '==', business.id),
        limit(8000),
      ),
    );
  }, [business.id]);

  const range = useMemo(
    () => rangeForPreset(preset, Date.now(), { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );
  const prev = useMemo(() => previousRange(range), [range]);
  const merged = useMemo(
    () => mergeMetaEvents(capiEvents, purchasesFromMessengerOrders(orders as any[])),
    [capiEvents, orders],
  );
  const minRev = Number(minRevenue);
  const maxRev = maxRevenue.trim() === '' ? undefined : Number(maxRevenue);
  const filterBase = {
    source,
    minRevenue: Number.isFinite(minRev) ? minRev : 0,
    maxRevenue: maxRev,
    product,
    ad,
  };
  const current = useMemo(
    () => filterMetaEvents(merged, {
      ...filterBase,
      range,
      eventNames: selectedEvents,
      delivery,
    }),
    [merged, range, selectedEvents, source, delivery, minRev, maxRev, product, ad],
  );
  const previous = useMemo(
    () => (compare ? filterMetaEvents(merged, {
      ...filterBase,
      range: prev,
      eventNames: selectedEvents,
      delivery,
    }) : []),
    [compare, merged, prev, selectedEvents, source, delivery, minRev, maxRev, product, ad],
  );
  const qualityEvents = useMemo(
    () => filterMetaEvents(merged, { ...filterBase, range, delivery: 'all' }),
    [merged, range, source, minRev, maxRev, product, ad],
  );
  const kpis = useMemo(() => computeMetaKpis(current, previous, selectedEvents), [current, previous, selectedEvents]);
  const funnel = useMemo(() => funnelSteps(current, selectedEvents), [current, selectedEvents]);
  const trend = useMemo(() => trendSeries(current, selectedEvents, group, range), [current, selectedEvents, group, range]);
  const products = useMemo(() => productBreakdown(current), [current]);
  const ads = useMemo(() => adBreakdown(current), [current]);
  const weekdays = useMemo(() => weekdaySeries(current), [current]);
  const heat = useMemo(() => hourHeatmap(current), [current]);
  const quality = useMemo(() => qualityStats(qualityEvents), [qualityEvents]);
  const logs = useMemo(() => searchMetaLogs(current, logQuery), [current, logQuery]);
  const peak = useMemo(() => peakCell(heat), [heat]);
  const heatMax = Math.max(1, peak.count);
  const pixelReady = Boolean(business.facebookConfig?.pixelId && business.facebookConfig?.accessToken);
  const logPages = Math.max(1, Math.ceil(logs.length / LOG_PAGE));
  const pageLogs = logs.slice(logPage * LOG_PAGE, (logPage + 1) * LOG_PAGE);

  useEffect(() => {
    setLogPage(0);
  }, [logQuery, range.startMs, range.endMs, delivery, source, product, ad, selectedEvents]);

  const toggleEvent = (name: string) => {
    setSelectedEvents((currentEvents) => {
      if (currentEvents.includes(name)) {
        const next = currentEvents.filter((item) => item !== name);
        return next.length ? next : currentEvents;
      }
      return META_FUNNEL_EVENTS.filter((item) => [...currentEvents, name].includes(item));
    });
  };

  const tabs: { id: DashTab; label: string; icon: typeof Activity }[] = [
    { id: 'tracking', label: 'ট্র্যাকিং', icon: Activity },
    { id: 'breakdown', label: 'ব্রেকডাউন', icon: BarChart3 },
    { id: 'quality', label: 'কোয়ালিটি', icon: ShieldCheck },
    { id: 'logs', label: 'লগ', icon: Table2 },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-zinc-900 text-white p-5 sm:p-6">
        <p className="text-[11px] font-bold tracking-widest uppercase text-zinc-400">Meta Analytics</p>
        <div className="mt-1 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black">Messenger CAPI Dashboard</h2>
            <p className="text-xs text-zinc-400 mt-1">
              ইনবক্স Lead → Checkout → Purchase · Asia/Dhaka · ইউনিক মানুষ + ইভেন্ট আলাদা
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${
                    tab === item.id ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!pixelReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          পিক্সেল ও CAPI টোকেন সেভ করলে নতুন ইনবক্স ইভেন্ট এখানে জমা হবে। আগের মেসেঞ্জার অর্ডার থেকে Purchase এখনও দেখা যাচ্ছে।
        </div>
      )}

      {kpis.orphanPurchases > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            এই সময়ে {kpis.orphanPurchases} জন ক্রেতার Lead নেই (অন্য দিনের লিড বা পুরনো অর্ডার ব্যাকফিল)।
            হেডলাইন কনভার্শন শুধু <b>লিড-সহ ক্রেতা</b> গণনা করে ({kpis.matchedBuyers}/{kpis.leadUnique}) — তাই সংখ্যা কৃত্রিমভাবে ১০০% ছাড়ায় না।
          </p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value as MetaSourceFilter)} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="all">সোর্স: সব</option>
            <option value="server">শুধু সার্ভার (CAPI)</option>
            <option value="browser">শুধু ব্রাউজার</option>
          </select>
          <select value={delivery} onChange={(e) => setDelivery(e.target.value as MetaDeliveryFilter)} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="sent">ডেলিভারি: পাঠানো</option>
            <option value="all">ডেলিভারি: সব</option>
            <option value="failed">ডেলিভারি: ব্যর্থ</option>
          </select>
          <select value={group} onChange={(e) => setGroup(e.target.value as MetaChartGroup)} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="day">গ্রুপ: দৈনিক</option>
            <option value="week">সাপ্তাহিক</option>
            <option value="month">মাসিক</option>
          </select>
          <Input value={minRevenue} onChange={(e) => setMinRevenue(e.target.value)} placeholder="সর্বনিম্ন রেভিনিউ" className="h-9 rounded-lg text-xs" />
          <Input value={maxRevenue} onChange={(e) => setMaxRevenue(e.target.value)} placeholder="সর্বোচ্চ রেভিনিউ" className="h-9 rounded-lg text-xs" />
          <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="পণ্য ফিল্টার" className="h-9 rounded-lg text-xs" />
          <Input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="অ্যাড / ref ফিল্টার" className="h-9 rounded-lg text-xs" />
          <select value={compare ? 'yes' : 'no'} onChange={(e) => setCompare(e.target.value === 'yes')} className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs">
            <option value="yes">আগের পিরিয়ডের সাথে তুলনা</option>
            <option value="no">তুলনা ছাড়া</option>
          </select>
        </div>
        <p className="text-[11px] text-zinc-500">
          {formatRangeLabel(range)}
          {loading ? ' · লোড হচ্ছে...' : ` · ${current.length} ইভেন্ট · ${kpis.uniquePeople} ইউনিক মানুষ`}
          {quality.lastEventAtMs ? ` · শেষ ইভেন্ট ${formatRelativeMs(quality.lastEventAtMs)}` : ''}
        </p>
      </div>

      {tab === 'tracking' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {selectedEvents.map((name) => (
              <div key={name} className="contents">
                <KpiCard
                  label={EVENT_LABEL[name]}
                  hint={`${(kpis.uniques[name] || 0).toLocaleString()} ইউনিক মানুষ`}
                  value={(kpis.counts[name] || 0).toLocaleString()}
                  change={Number((kpis.changes as Record<string, number>)[name] || 0)}
                  compare={compare}
                />
              </div>
            ))}
            <KpiCard
              label="মিলিত কনভার্শন"
              hint="লিড-সহ ইউনিক ক্রেতা ÷ ইউনিক লিড"
              value={`${kpis.conversion.toFixed(2)}%`}
              change={kpis.changes.conversion}
              compare={compare}
            />
            <KpiCard
              label="ইভেন্ট কনভার্শন"
              hint="Purchase ইভেন্ট ÷ Lead ইভেন্ট"
              value={`${kpis.conversionEvents.toFixed(2)}%`}
            />
            <KpiCard
              label="চেকআউট রেট"
              hint="ইউনিক Lead → Checkout"
              value={`${kpis.checkoutRate.toFixed(2)}%`}
              change={kpis.changes.checkoutRate}
              compare={compare}
            />
            <KpiCard
              label="চেকআউট সম্পন্ন"
              hint="ইউনিক Checkout → Purchase"
              value={`${kpis.completion.toFixed(2)}%`}
              change={kpis.changes.completion}
              compare={compare}
            />
            <KpiCard label="মোট রেভিনিউ" hint={`${kpis.purchaseCount} অর্ডার · ${kpis.items} আইটেম`} value={money(kpis.revenue)} change={kpis.changes.revenue} compare={compare} />
            <KpiCard label="AOV" hint="গড় অর্ডার ভ্যালু" value={money(kpis.aov)} change={kpis.changes.aov} compare={compare} />
            <KpiCard label="বাউন্স রেট" hint="লিড যারা চেকআউট/কিনেনি" value={`${kpis.bounceRate.toFixed(1)}%`} />
            <KpiCard label="চেকআউট অ্যাবানডন" hint="চেকআউট করেনি কিনেনি" value={`${kpis.abandonRate.toFixed(1)}%`} />
            <KpiCard
              label="লিড → অর্ডার সময়"
              hint={`${kpis.leadToPurchaseSamples} জনের মিডিয়ান · একই দিন ${kpis.sameDayPurchaseRate.toFixed(0)}%`}
              value={kpis.leadToPurchaseHours ? `${kpis.leadToPurchaseHours.toFixed(1)} ঘণ্টা` : '—'}
            />
            <KpiCard label="রিপিট পারচেজ" hint="একই মানুষের একাধিক অর্ডার" value={`${kpis.repeatRate.toFixed(1)}%`} />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black">Conversion Funnel</h3>
              <p className="text-[11px] text-zinc-400">বার = ইউনিক মানুষ · ড্রপ আগের স্টেজ থেকে</p>
            </div>
            {funnel.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center">এই সময়ে কোনো ইভেন্ট নেই</p>
            ) : (
              funnel.map((step, index) => {
                const latency = index > 0 ? kpis.latencies[index - 1] : null;
                return (
                  <div key={step.name} className="space-y-1">
                    <div className="flex flex-wrap justify-between gap-2 text-xs font-bold">
                      <span>{step.name}</span>
                      <span className="text-zinc-500">
                        {step.count.toLocaleString()} ইভেন্ট · {step.unique.toLocaleString()} ইউনিক · {step.ofTotal.toFixed(1)}%
                        {step.drop > 0 ? ` · ↓ ${step.drop.toFixed(1)}%` : ''}
                        {latency?.samples ? ` · ${formatDurationMs(latency.medianMs)}` : ''}
                      </span>
                    </div>
                    <div className="h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-400"
                        style={{ width: `${Math.min(100, Math.max(step.unique ? 4 : 0, step.ofTotal))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-black">Event Trend</h3>
              </div>
              <div className="h-56">
                {trend.every((row) => selectedEvents.every((name) => Number(row[name] || 0) === 0)) ? (
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
                          stroke={EVENT_COLOR[index % EVENT_COLOR.length]}
                          fillOpacity={0.15}
                          fill={EVENT_COLOR[index % EVENT_COLOR.length]}
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
                {trend.every((row) => Number(row.revenue || 0) === 0) ? (
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

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
              <h3 className="text-sm font-black mb-3">সপ্তাহের দিন (Dhaka)</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdays}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="events" fill="#2563eb" radius={[4, 4, 0, 0]} name="ইভেন্ট" />
                    <Bar dataKey="purchases" fill="#0f766e" radius={[4, 4, 0, 0]} name="অর্ডার" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black">ঘণ্টা হিটম্যাপ (Asia/Dhaka)</h3>
                <p className="text-[11px] text-zinc-400">
                  {peak.count ? `পিক: ${WEEKDAY_BN[peak.weekday]} ${String(peak.hour).padStart(2, '0')}:00` : 'ডাটা নেই'}
                </p>
              </div>
              <div className="min-w-[640px]">
                <div className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-0.5 mb-0.5">
                  <span />
                  {Array.from({ length: 24 }, (_, hour) => (
                    <span key={hour} className="text-[9px] text-zinc-400 text-center">{hour}</span>
                  ))}
                </div>
                {heat.map((row, weekday) => (
                  <div key={weekday} className="grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-0.5 mb-0.5">
                    <span className="text-[10px] text-zinc-500">{WEEKDAY_BN[weekday]}</span>
                    {row.map((count, hour) => (
                      <div
                        key={hour}
                        title={`${WEEKDAY_BN[weekday]} ${hour}:00 — ${count} ইভেন্ট`}
                        className="h-4 rounded-sm"
                        style={{ backgroundColor: `rgba(15, 118, 110, ${count ? Math.max(0.12, count / heatMax) : 0.04})` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'breakdown' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-black">পণ্য অনুযায়ী Purchase</h3>
            </div>
            {products.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400">এই ফিল্টারে কোনো পণ্য নেই</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      <th className="px-4 py-2 font-bold">পণ্য</th>
                      <th className="px-4 py-2 font-bold">অর্ডার</th>
                      <th className="px-4 py-2 font-bold">আইটেম</th>
                      <th className="px-4 py-2 font-bold">রেভিনিউ</th>
                      <th className="px-4 py-2 font-bold">AOV</th>
                      <th className="px-4 py-2 font-bold">শেয়ার</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row) => (
                      <tr key={row.name} className="border-b border-zinc-50 dark:border-zinc-800/80">
                        <td className="px-4 py-2 text-xs font-bold max-w-[180px] truncate">{row.name}</td>
                        <td className="px-4 py-2 text-xs">{row.purchases}</td>
                        <td className="px-4 py-2 text-xs">{row.items}</td>
                        <td className="px-4 py-2 text-xs font-mono">{money(row.revenue)}</td>
                        <td className="px-4 py-2 text-xs font-mono">{money(row.aov)}</td>
                        <td className="px-4 py-2 text-xs">{row.share.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-black">অ্যাড / সোর্স</h3>
              <p className="text-[11px] text-zinc-400">ctwa / ad_id / ref না থাকলে অর্গানিক</p>
            </div>
            {ads.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-400">এই ফিল্টারে কোনো সোর্স নেই</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      <th className="px-4 py-2 font-bold">সোর্স</th>
                      <th className="px-4 py-2 font-bold">লিড</th>
                      <th className="px-4 py-2 font-bold">চেকআউট</th>
                      <th className="px-4 py-2 font-bold">অর্ডার</th>
                      <th className="px-4 py-2 font-bold">রেভিনিউ</th>
                      <th className="px-4 py-2 font-bold">CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((row) => (
                      <tr key={row.label} className="border-b border-zinc-50 dark:border-zinc-800/80">
                        <td className="px-4 py-2 text-xs font-bold max-w-[180px] truncate">{row.label}</td>
                        <td className="px-4 py-2 text-xs">{row.leads}</td>
                        <td className="px-4 py-2 text-xs">{row.checkouts}</td>
                        <td className="px-4 py-2 text-xs">{row.purchases}</td>
                        <td className="px-4 py-2 text-xs font-mono">{money(row.revenue)}</td>
                        <td className="px-4 py-2 text-xs">{row.conversion.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'quality' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="CAPI ডেলিভারি" hint={`${quality.sent} পাঠানো · ${quality.failed} ব্যর্থ`} value={`${quality.deliveryRate.toFixed(1)}%`} />
            <KpiCard label="ফোন ম্যাচ" hint="hashed phone পাঠানো হয়েছে" value={`${quality.phoneRate.toFixed(1)}%`} />
            <KpiCard label="নাম ম্যাচ" hint="fn/ln পাঠানো হয়েছে" value={`${quality.nameRate.toFixed(1)}%`} />
            <KpiCard label="Click ID (ctwa)" hint="অ্যাড অ্যাট্রিবিউশন" value={`${quality.clidRate.toFixed(1)}%`} />
            <KpiCard label="PSID কভারেজ" hint="ইউনিক মানুষ চেনা যায়" value={`${quality.personRate.toFixed(1)}%`} />
            <KpiCard label="ডুপ্লিকেট ইভেন্ট আইডি" hint="একই event_id একাধিকবার" value={`${quality.duplicateRate.toFixed(1)}%`} />
            <KpiCard label="মোট ইভেন্ট" hint="এই রেঞ্জে সব স্ট্যাটাস" value={quality.total.toLocaleString()} />
            <KpiCard label="শেষ ইভেন্ট" hint="Asia/Dhaka" value={quality.lastEventAtMs ? formatRelativeMs(quality.lastEventAtMs) : '—'} />
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-sm text-zinc-600 dark:text-zinc-300 space-y-2">
            <p className="font-black text-zinc-900 dark:text-white">কীভাবে হিসাব হয় — ভুল এড়াতে</p>
            <ul className="list-disc pl-5 space-y-1 text-xs leading-5">
              <li>শুধু মেসেঞ্জার CAPI (`business_messaging`)। ওয়েবসাইট Pixel এই ট্যাবে আসে না।</li>
              <li>তারিখ বাucket সবসময় Asia/Dhaka (UTC+6), ব্রাউজার টাইমজোন নয়।</li>
              <li>KPI ডিফল্টে শুধু <b>পাঠানো</b> ইভেন্ট। ব্যর্থ CAPI রেভিনিউ/ফানেলে ধরা হয় না।</li>
              <li>ক্যান্সেল/রিটার্ন অর্ডার বাদ। একই `orderId` CAPI ও অর্ডার লিস্টে দুইবার গোনা হয় না।</li>
              <li>হেডলাইন কনভার্শন = এই সময়ে লিড আছে এমন ইউনিক ক্রেতা ÷ ইউনিক লিড। পুরনো অর্ডার ব্যাকফিল আলাদা দেখানো হয়।</li>
              <li>ইভেন্ট কনভার্শন ১০০% ছাড়াতে পারে যদি একজন একাধিকবার কেনে।</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <h3 className="text-sm font-black">Event Logs</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-zinc-400" />
                <Input
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="ইভেন্ট, পণ্য, অর্ডার, PSID, অ্যাড"
                  className="h-8 w-56 pl-7 rounded-lg text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => downloadCsv(logsToCsv(logs), `meta-capi-${formatDhakaDateTime(range.startMs).slice(0, 10)}.csv`)}
                className="h-8 px-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <span className="text-[11px] text-zinc-400 inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> {logs.length} ইভেন্ট
              </span>
            </div>
          </div>
          {logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">এই ফিল্টারে কোনো ইভেন্ট নেই</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                      <th className="px-4 py-2 font-bold">সময় (Dhaka)</th>
                      <th className="px-4 py-2 font-bold">ইভেন্ট</th>
                      <th className="px-4 py-2 font-bold">স্ট্যাটাস</th>
                      <th className="px-4 py-2 font-bold">রেভিনিউ</th>
                      <th className="px-4 py-2 font-bold">পণ্য</th>
                      <th className="px-4 py-2 font-bold">অর্ডার</th>
                      <th className="px-4 py-2 font-bold">PSID</th>
                      <th className="px-4 py-2 font-bold">অ্যাড</th>
                      <th className="px-4 py-2 font-bold">ম্যাচ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageLogs.map((event) => (
                      <tr key={event.id} className="border-b border-zinc-50 dark:border-zinc-800/80">
                        <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">{formatDhakaDateTime(event.createdAtMs)}</td>
                        <td className="px-4 py-2 font-bold text-xs">{event.eventName}</td>
                        <td className="px-4 py-2 text-xs">
                          {isCountedDelivery(event.status) ? 'পাঠানো' : 'ব্যর্থ'}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono">
                          {event.eventName === 'Purchase' ? money(Number(event.value || 0)) : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500 truncate max-w-[160px]">{event.contentName || '—'}</td>
                        <td className="px-4 py-2 text-xs font-mono">{event.orderId || '—'}</td>
                        <td className="px-4 py-2 text-xs font-mono">…{event.psidTail || '—'}</td>
                        <td className="px-4 py-2 text-xs truncate max-w-[140px]">{event.adSource || event.adId || event.adRef || '—'}</td>
                        <td className="px-4 py-2 text-[10px] text-zinc-500 whitespace-nowrap">
                          {[event.hasPhone ? 'ফোন' : '', event.hasName ? 'নাম' : '', event.hasClid ? 'clid' : ''].filter(Boolean).join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-xs text-zinc-500">
                <span>পৃষ্ঠা {logPage + 1} / {logPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={logPage === 0} onClick={() => setLogPage((p) => Math.max(0, p - 1))} className="h-8 px-3 rounded-lg border border-zinc-200 disabled:opacity-40">আগে</button>
                  <button type="button" disabled={logPage + 1 >= logPages} onClick={() => setLogPage((p) => p + 1)} className="h-8 px-3 rounded-lg border border-zinc-200 disabled:opacity-40">পরে</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
