import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  CreditCard, 
  Zap, 
  ArrowRight, 
  HelpCircle, 
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';

export function LandingPricingCalculator() {
  const [monthlyConversations, setMonthlyConversations] = useState<number>(1500);

  // Math: 1 conversation roughly uses ~400 tokens (both ways).
  // 1 Lakh (100,000) tokens = ৳20.
  // Server monthly cost = ৳1,000.
  const estimatedTokens = monthlyConversations * 400;
  const tokenLakhs = Math.ceil(estimatedTokens / 100000);
  const tokenCost = Math.max(20, tokenLakhs * 20);
  const serverCost = 1000;
  const totalCost = tokenCost + serverCost;
  const costPerChat = (totalCost / monthlyConversations).toFixed(2);
  const estimatedSales = (monthlyConversations * 0.18 * 1200).toLocaleString(); // assuming 18% conversion rate & ৳1200 avg order value

  return (
    <section id="pricing" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            স্বচ্ছ ও সাশ্রয়ী
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            যতোটুকু ব্যবহার করবেন, <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 to-amber-500">
              শুধুমাত্র সেটুকুরই খরচ হবে!
            </span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            কোনো অপ্রয়োজনীয় প্যাকেজ বা লুকানো চার্জ নেই। প্রতি ১ লাখ এআই টোকেন মাত্র ২০ টাকা।
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {/* Plan 1: Free Trial */}
          <div className="bg-white dark:bg-zinc-950 rounded-3xl p-8 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-6 relative">
            <div>
              <div className="flex justify-between items-center mb-4">
                <Badge variant="outline" className="text-xs font-bold border-zinc-300 dark:border-zinc-700 px-3 py-1">
                  ফ্রি ট্রায়াল
                </Badge>
                <span className="text-xs text-zinc-500 font-medium">নতুন ইউজারদের জন্য</span>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">১০,০০০ ফ্রি টোকেন</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-zinc-900 dark:text-white">৳০</span>
                  <span className="text-xs text-zinc-500">/ আজীবন শুরু করার জন্য</span>
                </div>
                <p className="text-xs text-zinc-500 pt-1">
                  কোনো ক্রেডিট কার্ড ছাড়াই সাথে সাথে স্টোর তৈরি করে টেস্ট করার সুযোগ।
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                {[
                  '১০,০০০ ফ্রি এআই টোকেন ব্যালেন্স',
                  'আনলিমিটেড প্রোডাক্ট ও ক্যাটালগ যোগ',
                  'স্মার্ট বার্গেনিং ও পার্সোনা কন্ট্রোল',
                  'ওয়েব চ্যাট সিমুলেটর ও লাইভ লিঙ্ক',
                  'অটোমেটিক অর্ডার মেমো জেনারেটর',
                  'স্টেডফাস্ট কুরিয়ার ইন্টিগ্রেশন'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link to="/login">
              <Button variant="outline" className="w-full h-12 rounded-2xl font-black border-2 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                ফ্রিতে সাইন আপ করুন
              </Button>
            </Link>
          </div>

          {/* Plan 2: Pro Pay-As-You-Go */}
          <div className="bg-linear-to-b from-orange-500/10 via-amber-500/5 to-transparent dark:bg-zinc-900 rounded-3xl p-8 border-2 border-orange-500 shadow-xl flex flex-col justify-between space-y-6 relative">
            <div className="absolute -top-3.5 right-8 bg-orange-600 text-white text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
              মোস্ট পপুলার
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <Badge className="bg-orange-600 text-white font-black text-xs px-3 py-1">
                  মার্চেন্ট প্রো (Pay As You Go)
                </Badge>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-bold">Zinipay ইনস্ট্যান্ট রিচার্জ</span>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">মাত্র ৳২০ / ১ লাখ টোকেন</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-orange-600">৳২০</span>
                  <span className="text-xs text-zinc-500">/ ১,০০,০০০ এআই টোকেন</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                  প্রতি কাস্টমার কনভার্সনে গড়ে মাত্র ৭-৮ পয়সা খরচ!
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-orange-200/60 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                {[
                  'প্রতি ১ লাখ টোকেন মাত্র ২০ টাকা (২০০-৩০০ কনভার্সেশন)',
                  'মাসিক সার্ভার ফি: মাত্র ১,০০০ টাকা (২৪/৭ মেটা লাইভ ক্লাউড)',
                  'ফেসবুক মেসেঞ্জার পেজ লাইভ অটোমেশন',
                  'মেটা পিক্সেল ও সার্ভার কনভার্সন CAPI এপিআই',
                  'স্টেডফাস্ট ১-ক্লিক পার্সেল বুকিং',
                  'CRM ও টার্গেটেড ব্রডকাস্টিং ক্যাম্পেইন',
                  'bKash, Nagad, Rocket দিয়ে ইনস্ট্যান্ট রিচার্জ',
                  '২৪/৭ প্রায়োরিটি মার্চেন্ট সাপোর্ট'
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link to="/login">
              <Button className="w-full h-12 bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black rounded-2xl shadow-lg shadow-orange-600/25 transition-transform active:scale-98">
                এখনই প্রো মার্চেন্ট হন
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* 🧮 INTERACTIVE MONTHLY COST & ROI CALCULATOR */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl md:rounded-4xl p-6 md:p-10 border border-zinc-200/80 dark:border-zinc-800 shadow-xl max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-orange-600" />
                <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
                  আপনার মাসিক খরচ ও মুনাফার হিসাব করুন
                </h3>
              </div>
              <p className="text-xs md:text-sm text-zinc-500">
                স্লাইডারটি টেনে দেখুন আপনার পেজের মেসেজ ভলিউম অনুযায়ী খরচ কত সামান্য!
              </p>
            </div>
            <span className="text-xs font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-900 self-start md:self-auto">
              লাইভ সিমুলেটর
            </span>
          </div>

          <div className="space-y-8">
            {/* Slider Control */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">
                  মাসিক সম্ভাব্য কাস্টমার ইনবক্স মেসেজ / চ্যাট সংখ্যা:
                </label>
                <span className="text-xl font-black text-orange-600 bg-orange-50 dark:bg-orange-950/60 px-4 py-1 rounded-xl border border-orange-200 dark:border-orange-900">
                  {monthlyConversations.toLocaleString()} টি
                </span>
              </div>

              <input
                type="range"
                min="200"
                max="10000"
                step="100"
                value={monthlyConversations}
                onChange={e => setMonthlyConversations(Number(e.target.value))}
                className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />

              <div className="flex justify-between text-[11px] text-zinc-400 font-bold px-1">
                <span>২০০ চ্যাট (ছোট পেজ)</span>
                <span>২,৫০০ চ্যাট (মাঝারি পেজ)</span>
                <span>১০,০০০+ চ্যাট (বড় ব্র্যান্ড)</span>
              </div>
            </div>

            {/* Calculated Results Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 space-y-1">
                <span className="text-[11px] text-zinc-500 font-bold uppercase">টোকেন খরচ</span>
                <p className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">৳ {tokenCost}</p>
                <span className="text-[10px] text-zinc-400 block">~{tokenLakhs} লাখ টোকেন</span>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 space-y-1">
                <span className="text-[11px] text-zinc-500 font-bold uppercase">সার্ভার ও মেটা সাপোর্ট</span>
                <p className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">৳ {serverCost}</p>
                <span className="text-[10px] text-zinc-400 block">২৪/৭ ফিক্সড হোস্টিং</span>
              </div>

              <div className="bg-orange-50/70 dark:bg-orange-950/40 p-4 rounded-2xl border border-orange-200 dark:border-orange-900 space-y-1">
                <span className="text-[11px] text-orange-700 dark:text-orange-400 font-black uppercase">প্রতি চ্যাটে গড় খরচ</span>
                <p className="text-xl md:text-2xl font-black text-orange-600">৳ {costPerChat}</p>
                <span className="text-[10px] text-orange-600/80 font-bold block">মাত্র {(Number(costPerChat) * 100).toFixed(0)} পয়সা!</span>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 space-y-1">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-black uppercase">সম্ভাব্য অর্জিত বিক্রয়</span>
                <p className="text-xl md:text-2xl font-black text-emerald-600">৳ {estimatedSales}</p>
                <span className="text-[10px] text-emerald-600/80 font-bold block">গড়ে ১৮% কনভার্সনে</span>
              </div>
            </div>

            {/* Bottom summary alert */}
            <div className="bg-linear-to-r from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-900 p-4 rounded-2xl border border-orange-200 dark:border-orange-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  একজন কাস্টমার কেয়ার প্রতিনিধির বেতন (১০,০০০-১৫,০০০ টাকা) দেওয়ার চেয়ে সেলকরি ব্যবহারে <strong>৯০% খরচ সাশ্রয়</strong> হবে!
                </span>
              </div>
              <Link to="/login" className="shrink-0 w-full sm:w-auto">
                <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl">
                  এখনই শুরু করুন
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
