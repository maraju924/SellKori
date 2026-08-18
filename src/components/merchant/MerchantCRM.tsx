import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  Sparkles, 
  Clock, 
  Flame, 
  Tag,
  MessageCircle,
  TrendingUp
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig, Order } from '../../types';

interface MerchantCRMProps {
  business: BusinessConfig;
  orders: Order[];
}

export function MerchantCRM({ business, orders }: MerchantCRMProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Derive Customers from Orders
  const customerMap = new Map<string, {
    name: string;
    phone: string;
    address: string;
    totalOrders: number;
    totalSpent: number;
    lastOrder: any;
    leadStage: 'hot' | 'buyer' | 'repeat' | 'lead';
  }>();

  orders.forEach(ord => {
    const key = ord.phone || ord.customerName;
    if (!key) return;

    const existing = customerMap.get(key);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpent += (ord.totalPrice || 0);
      if (existing.totalOrders > 1) existing.leadStage = 'repeat';
    } else {
      customerMap.set(key, {
        name: ord.customerName || 'গ্রাহক',
        phone: ord.phone,
        address: ord.address || 'ঠিকানা দেওয়া হয়নি',
        totalOrders: 1,
        totalSpent: ord.totalPrice || 0,
        lastOrder: ord.createdAt,
        leadStage: ord.status === 'delivered' ? 'buyer' : 'hot'
      });
    }
  });

  const customerList = Array.from(customerMap.values());

  const filteredCustomers = customerList.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === 'all' || c.leadStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              কাস্টমার CRM ও লিড হাব
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              AI Contact Intelligence
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            এআই চ্যাটে কথা বলা এবং অর্ডার করা প্রতিটি গ্রাহকের ফোন, ঠিকানা ও কেনাকাটার হিস্ট্রি।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500">মোট লিড: {customerList.length} জন</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="গ্রাহকের নাম বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="pl-9 h-11 rounded-2xl bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: 'all', label: 'সব গ্রাহক' },
            { id: 'repeat', label: 'রিপিট কাস্টমার' },
            { id: 'buyer', label: 'সফল ক্রেতা' },
            { id: 'hot', label: 'হট লিড' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStageFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                stageFilter === tab.id
                  ? 'bg-orange-600 text-white'
                  : 'bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <h3 className="font-black text-sm text-zinc-800 dark:text-zinc-200">কোনো গ্রাহক রেকর্ড পাওয়া যায়নি</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            এআই চ্যাটে গ্রাহক অর্ডার বা তথ্য দেওয়ার সাথে সাথে তাদের প্রোফাইল স্বয়ংক্রিয়ভাবে তৈরি হবে।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center font-black text-sm">
                    {cust.name.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-zinc-900 dark:text-white line-clamp-1">{cust.name}</h4>
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-orange-500" />
                      {cust.phone}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  cust.leadStage === 'repeat'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                    : cust.leadStage === 'buyer'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {cust.leadStage}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl text-xs space-y-1.5 border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">মোট অর্ডার:</span>
                  <span className="font-bold">{cust.totalOrders} টি</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">মোট কেনাকাটা:</span>
                  <span className="font-black text-orange-600">৳ {cust.totalSpent.toLocaleString()}</span>
                </div>
                <div className="flex items-start gap-1 text-[11px] text-zinc-500 pt-1 border-t border-zinc-200 dark:border-zinc-700/60">
                  <MapPin className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{cust.address}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
