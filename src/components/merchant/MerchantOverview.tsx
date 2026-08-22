import React from 'react';
import { 
  TrendingUp, 
  Package, 
  CreditCard, 
  MessageSquare, 
  Zap, 
  ArrowRight, 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Truck,
  Users,
  Eye,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BusinessConfig, Order } from '../../types';
import { countEnabled, shouldRunAi } from '../../lib/featureFlags';
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

  // Real daily sales for the last 7 days, computed from actual orders
  const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
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
    <div className="space-y-6">
      {/* Top Banner / Quick Action Row */}
      <div className="bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-white/20 text-white px-3 py-1 rounded-full text-xs font-black backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>স্বাগতম, {business.name || 'মার্চেন্ট'}!</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
            {shouldRunAi(business.features)
              ? 'আপনার এআই সেলসম্যান ২৪/৭ সক্রিয় রয়েছে'
              : 'এআই এখন সুইচবোর্ড অনুযায়ী অফলাইন'}
          </h2>
          <p className="text-orange-100 text-xs md:text-sm max-w-xl leading-relaxed">
            {shouldRunAi(business.features)
              ? 'ফেসবুক মেসেঞ্জারে কাস্টমারদের সাথে দরদাম করা, তথ্য জানানো এবং অর্ডার মেমো তৈরিতে কোনো বিরতি নেই।'
              : 'ফিচার সুইচবোর্ড থেকে এআই, অর্ডার, ছবি ও কুরিয়ার আবার চালু করতে পারেন।'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <Button
            onClick={() => onNavigateTab('test-chat')}
            className="bg-white text-orange-600 hover:bg-orange-50 font-black text-xs px-5 py-2.5 rounded-2xl shadow-md transition-transform active:scale-95"
          >
            <Bot className="w-4 h-4 mr-1.5" />
            টেস্ট সিমুলেটর
          </Button>
          <Button
            onClick={() => onNavigateTab('features')}
            className="bg-zinc-950/40 hover:bg-zinc-950/60 text-white font-bold text-xs px-4 py-2.5 rounded-2xl border border-white/20"
          >
            কন্ট্রোল সেন্টার
          </Button>
          <Button
            onClick={() => onNavigateTab('products')}
            className="bg-zinc-950/40 hover:bg-zinc-950/60 text-white font-bold text-xs px-4 py-2.5 rounded-2xl border border-white/20"
          >
            <Plus className="w-4 h-4 mr-1" />
            প্রোডাক্ট যোগ করুন
          </Button>
        </div>
      </div>

      {(() => {
        const stats = countEnabled(business.features);
        const live = shouldRunAi(business.features);
        return (
          <button
            type="button"
            onClick={() => onNavigateTab('features')}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:border-orange-300 dark:hover:border-orange-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${live ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'}`}>
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-zinc-900 dark:text-white">ফিচার সুইচবোর্ড</div>
                <div className="text-[11px] text-zinc-500">
                  {stats.on}/{stats.total} মডিউল সক্রিয় · {live ? 'এআই লাইভ' : 'এআই অফলাইন'}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-black text-orange-600">কন্ট্রোল খুলুন →</span>
          </button>
        );
      })()}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 rounded-3xl space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">মোট বিক্রয়</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">
              ৳ {totalSales.toLocaleString()}
            </p>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3" /> এআই ড্রাইভেন অর্ডার
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 rounded-3xl space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">মোট অর্ডার</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">
              {totalOrdersCount} টি
            </p>
            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" /> {pendingOrders.length} টি পেন্ডিং
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 rounded-3xl space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ক্যাটালগ পণ্য</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">
              {business.products?.length || 0} টি
            </p>
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" /> Min Price লক সক্রিয়
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 rounded-3xl space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">টোকেন ব্যালেন্স</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black text-orange-600 dark:text-orange-400 font-mono">
              {(business.tokenBalance || 0).toLocaleString()}
            </p>
            <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 mt-0.5">
              ব্যবহৃত: {(business.totalTokensUsed || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Analytics Chart & Funnel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Performance Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-zinc-900 dark:text-white">
                সাপ্তাহিক বিক্রয় ও অর্ডার ট্রেন্ড
              </h3>
              <p className="text-xs text-zinc-500">এআই চ্যাট থেকে কনভার্ট হওয়া দৈনিক সেলস</p>
            </div>
            <Badge variant="outline" className="text-xs font-bold text-orange-600 border-orange-200">
              গত ৭ দিন
            </Badge>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
                <XAxis dataKey="name" stroke="#88888880" fontSize={11} />
                <YAxis stroke="#88888880" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderRadius: '16px',
                    border: '1px solid #27272a',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" name="বিক্রয় (৳)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Conversion & Health Status */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-zinc-900 dark:text-white">
                এআই সেলস অটোমেশন হেলথ
              </h3>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">এআই স্ট্যাটাস:</span>
                <span className={`font-black ${shouldRunAi(business.features) ? 'text-emerald-600' : 'text-red-500'}`}>
                  {shouldRunAi(business.features) ? 'সক্রিয় (২৪/৭)' : 'সুইচবোর্ডে বন্ধ'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">ডেলিভারি সফলতা:</span>
                <span className="font-black text-orange-600">
                  {totalOrdersCount > 0 ? `${Math.round((deliveredOrders.length / totalOrdersCount) * 100)}% (${deliveredOrders.length}/${totalOrdersCount})` : 'এখনো অর্ডার নেই'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">মেটা CAPI ইভেন্ট সিঙ্ক:</span>
                <span className={`font-black ${business.facebookConfig?.pixelId && business.facebookConfig?.accessToken ? 'text-indigo-600' : 'text-zinc-400'}`}>
                  {business.facebookConfig?.pixelId && business.facebookConfig?.accessToken ? 'সক্রিয়' : 'সেটআপ প্রয়োজন'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl">
                <span className="text-zinc-600 dark:text-zinc-400 font-medium">স্টেডফাস্ট কুরিয়ার:</span>
                <span className="font-black text-emerald-600">
                  {business.courierConfig?.steadfastApiKey ? 'সংযুক্ত' : 'সেটআপ প্রয়োজন'}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => onNavigateTab('ai-control')}
            className="w-full h-11 rounded-2xl font-bold text-xs border-orange-200 dark:border-orange-900 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40"
          >
            এআই কনফিগারেশন পরিবর্তন করুন
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Recent Orders Stream Preview */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              সাম্প্রতিক অর্ডারসমূহ
            </h3>
            <p className="text-xs text-zinc-500">সর্বশেষ গ্রহণ করা অর্ডার ও কাস্টমারের তথ্য</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateTab('orders')}
            className="text-orange-600 font-bold text-xs"
          >
            সব দেখুন ({orders.length})
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl">
            <Package className="w-10 h-10 text-zinc-400 mx-auto" />
            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">এখনো কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
              সিমুলেটরে কথা বলে অথবা ফেসবুক মেসেঞ্জারে কাস্টমার অর্ডার দিলেই এখানে স্বয়ংক্রিয়ভাবে ইনভয়েস যুক্ত হবে।
            </p>
            <Button
              size="sm"
              onClick={() => onNavigateTab('test-chat')}
              className="bg-orange-600 text-white font-bold text-xs rounded-xl"
            >
              সিমুলেটরে টেস্ট অর্ডার দিন
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-bold uppercase">
                  <th className="py-3 px-3">অর্ডার আইডি</th>
                  <th className="py-3 px-3">কাস্টমার ও ফোন</th>
                  <th className="py-3 px-3">পণ্য</th>
                  <th className="py-3 px-3">মূল্য</th>
                  <th className="py-3 px-3">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {orders.slice(0, 5).map(ord => (
                  <tr key={ord.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                      {ord.id.slice(0, 10)}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-zinc-900 dark:text-white">{ord.customerName}</p>
                      <p className="text-[11px] text-zinc-500">{ord.phone}</p>
                    </td>
                    <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                      {ord.productName} (x{ord.quantity})
                    </td>
                    <td className="py-3 px-3 font-bold text-orange-600">
                      ৳ {ord.totalPrice?.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        ord.status === 'delivered'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : ord.status === 'shipped'
                          ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}>
                        {ord.status}
                      </span>
                    </td>
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
