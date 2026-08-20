import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Zap, 
  CheckCircle2, 
  ArrowUpRight, 
  ShieldCheck, 
  Coins, 
  Sparkles,
  TrendingUp,
  Clock,
  History,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, increment, collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { toast } from 'sonner';
import { parseJsonResponse } from '../../lib/safeJson';

interface MerchantBillingProps {
  business: BusinessConfig;
}

export function MerchantBilling({ business }: MerchantBillingProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  // Live payment history for this store
  useEffect(() => {
    if (!business.id) return;
    const q = query(collection(db, 'payments'), where('businessId', '==', business.id), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      setPayments(list);
    }, (err) => console.warn('[Billing] payments snapshot error:', err));
    return () => unsub();
  }, [business.id]);

  // Settle any paid-but-uncredited payment (server marks paid after ZiniPay
  // verification; the owner's client applies the token credit when the
  // server had no Admin credentials to do it itself).
  useEffect(() => {
    const uncredited = payments.find(p => p.status === 'paid' && p.credited !== true);
    if (!uncredited) return;
    (async () => {
      try {
        await updateDoc(doc(db, 'businesses', business.id), {
          tokenBalance: increment(Number(uncredited.tokens) || 0),
        });
        await updateDoc(doc(db, 'payments', uncredited.id), { credited: true });
        toast.success(`${Number(uncredited.tokens).toLocaleString()} টোকেন আপনার ওয়ালেটে যুক্ত হয়েছে!`);
      } catch (e) {
        console.warn('[Billing] client credit notice:', e);
      }
    })();
  }, [payments, business.id]);

  const tokenPacks = [
    {
      id: 1,
      taka: 100,
      tokens: 500000,
      badge: 'স্টার্টার',
      approxChats: '১৫০-২০০ টি কনভারসেশন',
      popular: false
    },
    {
      id: 2,
      taka: 200,
      tokens: 1000000,
      badge: 'মোস্ট পপুলার',
      approxChats: '৩৫০-৪৫০ টি কনভারসেশন',
      popular: true
    },
    {
      id: 3,
      taka: 500,
      tokens: 2500000,
      badge: 'বেস্ট ভ্যালু',
      approxChats: '১,০০০+ কনভারসেশন',
      popular: false
    },
    {
      id: 4,
      taka: 1000,
      tokens: 5500000,
      badge: 'এন্টারপ্রাইজ বোনাস',
      approxChats: '২,৫০০+ কনভারসেশন',
      popular: false
    }
  ];

  const handleRecharge = async (pack: typeof tokenPacks[0]) => {
    setSelectedPack(pack.id);
    setIsProcessing(true);

    try {
      // Real ZiniPay checkout: the server (super admin's gateway key) creates
      // a hosted invoice and we redirect to the bKash/Nagad/Rocket page.
      const res = await fetch('/api/billing/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, amount: pack.taka })
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success || !data.paymentUrl) {
        throw new Error(data.error || 'পেমেন্ট লিংক তৈরি করা যায়নি');
      }
      toast.info('ZiniPay পেমেন্ট পেজে নিয়ে যাওয়া হচ্ছে...');
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      toast.error(e.message || 'রিচার্জ প্রক্রিয়া ব্যর্থ হয়েছে');
      setIsProcessing(false);
      setSelectedPack(null);
    }
  };

  const tokenBalance = business.tokenBalance || 0;
  const totalTokensUsed = business.totalTokensUsed || 0;

  return (
    <div className="space-y-6">
      {/* Top Wallet Card */}
      <div className="bg-linear-to-r from-orange-600 via-amber-600 to-orange-500 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-600/15 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-xs">
            <Coins className="w-3.5 h-3.5" />
            <span>পে-অ্যাজ-ইউ-গো (Pay As You Go)</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black font-mono tracking-tight">
            {tokenBalance.toLocaleString()} <span className="text-xl font-sans font-bold opacity-90">টোকেন বাকি</span>
          </h2>
          <p className="text-orange-100 text-xs md:text-sm">
            রেট: প্রতি ১ লক্ষ টোকেন মাত্র ২০ টাকা (মেসেঞ্জারে ১টি ফুল চ্যাটে প্রায় ৭-৮ পয়সা খরচ)
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-xs space-y-1.5 min-w-[200px]">
          <div className="flex justify-between">
            <span className="opacity-80">মোট ব্যবহৃত টোকেন:</span>
            <span className="font-mono font-bold">{totalTokensUsed.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-1.5">
            <span className="opacity-80">প্ল্যান মেয়াদ:</span>
            <span className="font-bold text-emerald-300">আনলিমিটেড ভ্যালিডিটি</span>
          </div>
        </div>
      </div>

      {/* Recharge Packs Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-zinc-900 dark:text-white">
            ইনস্ট্যান্ট বিকাশ / নগদ টোকেন রিচার্জ প্যাক
          </h3>
          <p className="text-xs text-zinc-500">
            যেকোনো সময় নিরাপদে Zinipay পেমেন্ট গেটওয়ের মাধ্যমে ব্যালেন্স রিচার্জ করুন
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tokenPacks.map((pack) => (
            <div
              key={pack.id}
              className={`bg-white dark:bg-zinc-900 border rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative transition-all ${
                pack.popular
                  ? 'border-orange-500 ring-2 ring-orange-500/20'
                  : 'border-zinc-200/80 dark:border-zinc-800 hover:border-orange-300'
              }`}
            >
              {pack.badge && (
                <span className={`absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  pack.popular
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}>
                  {pack.badge}
                </span>
              )}

              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">রিচার্জ প্যাকেজ</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-zinc-900 dark:text-white">৳ {pack.taka}</span>
                </div>
                <div className="text-sm font-black text-orange-600 dark:text-orange-400 font-mono">
                  {(pack.tokens).toLocaleString()} টোকেন
                </div>
                <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {pack.approxChats}
                </p>
              </div>

              <Button
                onClick={() => handleRecharge(pack)}
                disabled={isProcessing && selectedPack === pack.id}
                className={`w-full h-10 rounded-xl text-xs font-black transition-all ${
                  pack.popular
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20'
                    : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-orange-600 dark:hover:bg-orange-500 dark:hover:text-white'
                }`}
              >
                {isProcessing && selectedPack === pack.id ? 'পেমেন্ট হচ্ছে...' : 'রিচার্জ করুন (Zinipay)'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Security and Transparency Info */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="text-xs space-y-0.5">
          <h4 className="font-bold text-zinc-900 dark:text-white text-sm">শতভাগ নিরাপদ বাংলাদেশ গেটওয়ে</h4>
          <p className="text-zinc-500 leading-relaxed">
            সকল পেমেন্ট সরাসরি Zinipay এর মাধ্যমে bKash, Nagad, Rocket ও ভিসা কার্ড দিয়ে সম্পন্ন হয়। কোনো হিডেন চার্জ নেই।
          </p>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-zinc-900 dark:text-white">পেমেন্ট হিস্ট্রি</h3>
            <p className="text-[11px] text-zinc-500">আপনার সব রিচার্জ ও তাদের স্ট্যাটাস</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <p className="text-[11px] text-zinc-500 py-4 text-center">এখনো কোনো রিচার্জ করা হয়নি</p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/40 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-zinc-900 dark:text-white">৳ {Number(p.amount || 0).toLocaleString()} → {Number(p.tokens || 0).toLocaleString()} টোকেন</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate">
                    {p.id}{p.paymentMethod ? ` · ${p.paymentMethod}` : ''}{p.createdAtMs ? ` · ${new Date(p.createdAtMs).toLocaleString('bn-BD')}` : ''}
                  </p>
                </div>
                <Badge className={
                  p.status === 'paid'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 shrink-0'
                }>
                  {p.status === 'paid' ? 'সফল' : 'পেন্ডিং'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
