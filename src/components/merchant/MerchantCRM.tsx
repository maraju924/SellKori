import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Phone, 
  MapPin, 
  MessageCircle,
  Megaphone
} from 'lucide-react';
import { Input } from '../ui/input';
import { BusinessConfig, Order } from '../../types';
import { collection, query, where, limit } from 'firebase/firestore';
import { listenQueryAcrossPanelDbs } from '../../lib/panelDb';

interface MerchantCRMProps {
  business: BusinessConfig;
  orders: Order[];
}

interface CrmCustomer {
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastActivityMs: number;
  leadStage: 'hot' | 'buyer' | 'repeat' | 'lead';
  source: 'messenger' | 'order' | 'both';
  adSource?: string;
  chatSummary?: string;
}

export function MerchantCRM({ business, orders }: MerchantCRMProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [messengerLeads, setMessengerLeads] = useState<any[]>([]);

  // Live Messenger leads (every person who chatted with the bot),
  // including which ad brought them (acquisition).
  useEffect(() => {
    if (!business.id) return;
    return listenQueryAcrossPanelDbs<any>(
      (database) => query(
        collection(database, 'customers'),
        where('businessId', '==', business.id),
        limit(500)
      ),
      (docs) => setMessengerLeads(docs),
    );
  }, [business.id]);

  const customerMap = new Map<string, CrmCustomer>();

  // 1) Orders -> buyers
  orders.forEach(ord => {
    const key = ord.phone || ord.customerName;
    if (!key) return;
    const existing = customerMap.get(key);
    const tMs = (ord as any).createdAtMs || 0;
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpent += (ord.totalPrice || 0);
      if (existing.totalOrders > 1) existing.leadStage = 'repeat';
      existing.lastActivityMs = Math.max(existing.lastActivityMs, tMs);
      if ((ord as any).adSource && !existing.adSource) existing.adSource = (ord as any).adSource;
    } else {
      customerMap.set(key, {
        name: ord.customerName || 'গ্রাহক',
        phone: ord.phone,
        address: ord.address || 'ঠিকানা দেওয়া হয়নি',
        totalOrders: 1,
        totalSpent: ord.totalPrice || 0,
        lastActivityMs: tMs,
        leadStage: ord.status === 'delivered' ? 'buyer' : 'hot',
        source: 'order',
        adSource: (ord as any).adSource || ''
      });
    }
  });

  // 2) Messenger leads -> merge (chat-only people become 'lead')
  messengerLeads.forEach((lead) => {
    const leadPhone = String(lead.phone || lead.leadInfo?.phone || '').trim();
    const leadName = String(lead.name || lead.leadInfo?.name || '').trim();
    const key = leadPhone || `psid:${lead.messengerId || lead.id}`;
    const adSource = String(lead.acquisition?.adTitle || lead.acquisition?.ref || lead.acquisition?.adId || '').trim();
    const existing = leadPhone ? customerMap.get(leadPhone) : customerMap.get(key);
    if (existing) {
      existing.source = 'both';
      if (adSource && !existing.adSource) existing.adSource = adSource;
      if (lead.chatSummary) existing.chatSummary = lead.chatSummary;
      existing.lastActivityMs = Math.max(existing.lastActivityMs, Number(lead.lastIncomingAtMs) || 0);
    } else {
      customerMap.set(key, {
        name: leadName || 'মেসেঞ্জার লিড',
        phone: leadPhone || '',
        address: String(lead.address || lead.leadInfo?.address || '').trim() || 'ঠিকানা এখনো দেয়নি',
        totalOrders: 0,
        totalSpent: 0,
        lastActivityMs: Number(lead.lastIncomingAtMs) || 0,
        leadStage: 'lead',
        source: 'messenger',
        adSource,
        chatSummary: lead.chatSummary || ''
      });
    }
  });

  const customerList = Array.from(customerMap.values())
    .sort((a, b) => b.lastActivityMs - a.lastActivityMs);

  const filteredCustomers = customerList.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.adSource || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === 'all' || c.leadStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const adLeadCount = customerList.filter(c => c.adSource).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">গ্রাহক</h2>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{customerList.length} জন</span>
          {adLeadCount > 0 && (
            <span className="flex items-center gap-1">
              <Megaphone className="w-3.5 h-3.5" /> অ্যাড: {adLeadCount}
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="নাম, ফোন, ঠিকানা বা অ্যাড সোর্স দিয়ে খুঁজুন..."
            className="pl-9 h-11 rounded-2xl bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: 'all', label: 'সব গ্রাহক' },
            { id: 'lead', label: 'চ্যাট লিড' },
            { id: 'hot', label: 'হট লিড' },
            { id: 'buyer', label: 'সফল ক্রেতা' },
            { id: 'repeat', label: 'রিপিট কাস্টমার' },
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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-sm text-zinc-400">কোনো গ্রাহক নেই</p>
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
                      {cust.phone ? (
                        <><Phone className="w-3 h-3 text-orange-500" />{cust.phone}</>
                      ) : (
                        <><MessageCircle className="w-3 h-3 text-blue-500" />মেসেঞ্জার চ্যাট</>
                      )}
                    </p>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  cust.leadStage === 'repeat'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                    : cust.leadStage === 'buyer'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : cust.leadStage === 'lead'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {cust.leadStage === 'lead' ? 'চ্যাট লিড' : cust.leadStage}
                </span>
              </div>

              {cust.adSource && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                  <Megaphone className="w-3 h-3 text-purple-600 shrink-0" />
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 truncate">অ্যাড: {cust.adSource}</span>
                </div>
              )}

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
                {cust.chatSummary && (
                  <p className="text-[10px] text-zinc-400 line-clamp-2 pt-1 border-t border-zinc-200 dark:border-zinc-700/60">
                    {cust.chatSummary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
