import React from 'react';
import {
  ArrowRight,
  Clock,
  Bot,
} from 'lucide-react';
import { Button } from '../ui/button';
import { BusinessConfig, Order } from '../../types';
import { shouldRunAi } from '../../lib/featureFlags';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface MerchantOverviewProps {
  business: BusinessConfig;
  orders: Order[];
  onNavigateTab: (tabId: string) => void;
}

export function MerchantOverview({
  business,
  orders,
  onNavigateTab
}: MerchantOverviewProps) {
  const totalSales = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const totalOrdersCount = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');

  const dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayOrders = orders.filter(o => {
      const t = (o as any).createdAtMs || (o as any).createdAt?.toMillis?.() || 0;
      return t >= dayStart && t < dayEnd;
    });
    return {
      name: dayNames[d.getDay()],
      sales: dayOrders.reduce((s, o) => s + (o.totalPrice || 0), 0),
      orders: dayOrders.length,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">ওভারভিউ</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => onNavigateTab('meta')}
            className="h-9 rounded-lg text-xs px-3"
          >
            মেটা অ্যানালিটিক্স
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigateTab('products')}
            className="h-9 rounded-lg text-xs px-3"
          >
            পণ্য যোগ
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigateTab('features')}
            className="h-9 rounded-lg text-xs px-3"
          >
            <Bot className="w-3.5 h-3.5 mr-1.5" />
            {shouldRunAi(business.features) ? 'এআই চালু' : 'এআই বন্ধ'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl">
          <span className="text-xs text-zinc-500">মোট বিক্রয়</span>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
            ৳ {totalSales.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl">
          <span className="text-xs text-zinc-500">অর্ডার</span>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
            {totalOrdersCount}
          </p>
          {pendingOrders.length > 0 && (
            <span className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <Clock className="w-3 h-3" /> {pendingOrders.length} পেন্ডিং
            </span>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl">
          <span className="text-xs text-zinc-500">পণ্য</span>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
            {business.products?.length || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl">
          <span className="text-xs text-zinc-500">টোকেন</span>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-white">
            {(business.tokenBalance || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">৭ দিনের বিক্রয়</h3>
          <div className="h-56 w-full pt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3f3f46" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3f3f46" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                <XAxis dataKey="name" stroke="#88888880" fontSize={11} />
                <YAxis stroke="#88888880" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3f3f46" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" name="বিক্রয় (৳)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">স্ট্যাটাস</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">এআই</span>
              <span className={shouldRunAi(business.features) ? 'text-emerald-600' : 'text-zinc-400'}>
                {shouldRunAi(business.features) ? 'চালু' : 'বন্ধ'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ডেলিভারি</span>
              <span>
                {totalOrdersCount > 0
                  ? `${Math.round((deliveredOrders.length / totalOrdersCount) * 100)}%`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">পিক্সেল</span>
              <span className={business.facebookConfig?.pixelId && business.facebookConfig?.accessToken ? 'text-emerald-600' : 'text-zinc-400'}>
                {business.facebookConfig?.pixelId && business.facebookConfig?.accessToken ? 'সংযুক্ত' : 'নেই'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">কুরিয়ার</span>
              <span className={business.courierConfig?.steadfastApiKey ? 'text-emerald-600' : 'text-zinc-400'}>
                {business.courierConfig?.steadfastApiKey ? 'সংযুক্ত' : 'নেই'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">সাম্প্রতিক অর্ডার</h3>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white inline-flex items-center gap-1"
          >
            সব <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">কোনো অর্ডার নেই</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
                  <th className="py-2 pr-3 font-medium">আইডি</th>
                  <th className="py-2 pr-3 font-medium">গ্রাহক</th>
                  <th className="py-2 pr-3 font-medium">পণ্য</th>
                  <th className="py-2 pr-3 font-medium">মূল্য</th>
                  <th className="py-2 font-medium">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {orders.slice(0, 5).map(ord => (
                  <tr key={ord.id}>
                    <td className="py-2.5 pr-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {ord.id.slice(0, 10)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-zinc-900 dark:text-white">{ord.customerName}</p>
                      <p className="text-xs text-zinc-500">{ord.phone}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-700 dark:text-zinc-300">
                      {ord.productName} (x{ord.quantity})
                    </td>
                    <td className="py-2.5 pr-3 font-medium">
                      ৳ {ord.totalPrice?.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-xs text-zinc-500">{ord.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
