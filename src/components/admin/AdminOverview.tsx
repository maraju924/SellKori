import React from 'react';
import { 
  Users, 
  Store, 
  Zap, 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  Server,
  DollarSign
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';

interface AdminOverviewProps {
  merchants: BusinessConfig[];
}

export function AdminOverview({ merchants }: AdminOverviewProps) {
  const totalMerchants = merchants.length;
  const activeMerchants = merchants.filter(m => m.status !== 'suspended').length;
  const totalTokensDistributed = merchants.reduce((sum, m) => sum + (m.tokenBalance || 0), 0);
  const totalTokensConsumed = merchants.reduce((sum, m) => sum + (m.totalTokensUsed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-linear-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-500/30">
            <Activity className="w-3.5 h-3.5" />
            <span>সিস্টেম লাইভ ড্যাশবোর্ড</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">
            সেলকরি প্ল্যাটফর্ম কন্ট্রোল সেন্টার
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm max-w-xl">
            বাংলাদেশের শত শত ই-কমার্স মার্চেন্টের জন্য মেসেনঞ্জার অটোমেশন, জেমিনি এআই এপিআই এবং পেমেন্ট মনিটরিং।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-800/80 p-4 rounded-2xl border border-zinc-700 text-xs space-y-1">
            <span className="text-zinc-400 font-bold block">সার্ভার স্ট্যাটাস</span>
            <span className="text-emerald-400 font-black text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              100% Operational
            </span>
          </div>
        </div>
      </div>

      {/* 4 Primary Admin Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">মোট মার্চেন্ট</span>
            <div className="w-8 h-8 rounded-xl bg-orange-950/60 text-orange-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black">{totalMerchants} জন</p>
            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3" /> {activeMerchants} জন সক্রিয়
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">টোকেন ভলিউম</span>
            <div className="w-8 h-8 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl md:text-3xl font-black font-mono">
              {(totalTokensDistributed).toLocaleString()}
            </p>
            <span className="text-[10px] font-bold text-zinc-400 mt-0.5 block">
              ব্যবহৃত: {totalTokensConsumed.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">AI API মডেল</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-950/60 text-indigo-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg md:text-xl font-black text-indigo-400 font-mono">gemini-2.5-flash</p>
            <span className="text-[10px] font-bold text-emerald-400 mt-0.5 block">
              Latency: ~420ms
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2 text-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">গেটওয়ে ইন্টিগ্রেশন</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg md:text-xl font-black text-emerald-400">Zinipay & Steadfast</p>
            <span className="text-[10px] font-bold text-zinc-400 mt-0.5 block">
              bKash / Nagad Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
