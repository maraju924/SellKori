import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Flame, 
  CheckCircle2, 
  Star, 
  MessageSquare, 
  TrendingUp, 
  Layers, 
  Bot, 
  Truck,
  Facebook,
  Play
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function LandingHero() {
  return (
    <section className="relative pt-8 pb-16 md:pt-16 md:pb-24 overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-linear-to-b from-orange-500/15 via-amber-500/10 to-transparent blur-[140px] rounded-full -z-10 pointer-events-none" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-orange-400/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          {/* Top Floating Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900/60 text-orange-700 dark:text-orange-300 text-xs font-bold shadow-xs animate-bounce-subtle">
            <span className="flex h-2 w-2 rounded-full bg-orange-600 animate-ping" />
            <Sparkles className="w-4 h-4 text-orange-600 fill-orange-600" />
            <span>ফেসবুক মেসেঞ্জারে ২৪/৭ অটোমেটিক সেলস ও অর্ডার কনফার্মেশন</span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-zinc-900 dark:text-white tracking-tight leading-[1.08]">
            মেসেঞ্জারে কাস্টমার আসবে, <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 via-amber-500 to-orange-500">
              অর্ডার ও ডেলিভারি করবে আপনার AI
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed font-normal">
            কাস্টমারের সাথে খাঁটি বাংলায় চ্যাট, বুদ্ধিদীপ্ত <strong>দরদাম (Bargaining)</strong> হ্যান্ডেলিং, স্বয়ংক্রিয় <strong>অর্ডার মেমো</strong> জেনারেশন, <strong>Steadfast কুরিয়ারে</strong> ১-ক্লিক পার্সেল বুকিং এবং <strong>Meta CAPI</strong> নিখুঁত ট্র্যাকিং।
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black rounded-2xl shadow-xl shadow-orange-500/25 transition-all hover:scale-103 active:scale-98">
                <span>ফ্রি ট্রায়াল শুরু করুন (১০,০০০ টোকেন)</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <a href="#demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 md:h-16 px-8 text-base md:text-lg border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <Play className="w-4 h-4 mr-2 fill-current text-orange-600" />
                লাইভ এআই চ্যাট ডেমো
              </Button>
            </a>
          </div>

          {/* Social Proof & Trust Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>কোনো ক্রেডিট কার্ড লাগবে না</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>১ মিনিটে ফেসবুক পেজ কানেক্ট</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Zinipay (বিকাশ/নগদ) সাপোর্টেড</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive App Mockup Preview */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          {/* Decorative frame shadow */}
          <div className="absolute -inset-1 bg-linear-to-r from-orange-500 to-amber-500 rounded-4xl blur-xl opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt" />
          
          <div className="relative rounded-3xl md:rounded-4xl bg-zinc-900 border-4 border-zinc-800/80 shadow-2xl overflow-hidden">
            {/* Window header */}
            <div className="bg-zinc-950 px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-zinc-400 ml-2 hidden sm:inline">sellkori.ai / live-merchant-dashboard</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-emerald-950 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-800/50 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Meta Webhook Active
                </span>
              </div>
            </div>

            {/* Dashboard Visual Grid inside mockup */}
            <div className="p-4 md:p-8 bg-zinc-950 text-zinc-100 space-y-6">
              {/* Top stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">আজকের অর্ডার</p>
                  <p className="text-2xl md:text-3xl font-black text-white">৩৮ টি</p>
                  <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> +৪২% বৃদ্ধি
                  </p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">মোট বিক্রয়</p>
                  <p className="text-2xl md:text-3xl font-black text-orange-400">৳ ৪৭,৫০০</p>
                  <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> এআই ক্লোজড রেট ৯১%
                  </p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">এআই মেসেজ রিপ্লাই</p>
                  <p className="text-2xl md:text-3xl font-black text-amber-400">১,৪২০ টি</p>
                  <p className="text-[10px] text-zinc-400 font-bold">গড় সময় ১.৮ সেকেন্ড</p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl space-y-1">
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">কুরিয়ার বুকিং</p>
                  <p className="text-2xl md:text-3xl font-black text-emerald-400">৩৬ টি</p>
                  <p className="text-[10px] text-emerald-400 font-bold">Steadfast API সিঙ্কড</p>
                </div>
              </div>

              {/* Bottom split: Recent automated sales feed */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-zinc-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-orange-400" />
                      লাইভ ফেসবুক মেসেঞ্জার অটোমেশন
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-mono">Real-time Stream</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center font-bold text-xs">
                          AI
                        </div>
                        <div>
                          <p className="font-bold text-zinc-200">কাস্টমার: "সাইজ ৪৪ হবে? একটু কম রাখেন ভাই"</p>
                          <p className="text-[11px] text-zinc-400">এআই: "জি স্যার, আপনার জন্য স্পেশাল অফারে ১,১৫০ টাকায় কনফার্ম করছি।"</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                        অর্ডার কনফার্মড
                      </span>
                    </div>

                    <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                          FB
                        </div>
                        <div>
                          <p className="font-bold text-zinc-200">Meta CAPI: Purchase Event ৳১,২২০</p>
                          <p className="text-[11px] text-zinc-400">Pixel ID: 8934... • Event Match Quality: 9.2/10</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
                        ROAS +3.4x
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-linear-to-br from-orange-950/40 to-amber-950/30 border border-orange-900/40 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs">
                      <Zap className="w-4 h-4 fill-orange-400" />
                      <span>আজকের অটোমেশন বেনিফিট</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      আপনি যখন ঘুমিয়ে ছিলেন, SellKori AI রাত ৩টা থেকে ভোর ৬টায় <strong>১২টি অর্ডার</strong> কনফার্ম করেছে!
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-900/80 rounded-xl border border-orange-500/20 text-center">
                    <span className="text-[10px] text-zinc-400 block">কাস্টমার স্যাটিসফ্যাকশন স্কোর</span>
                    <span className="text-lg font-black text-white">৯৮.৬% ⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Primary Big Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-5xl mx-auto">
          {[
            { metric: '৫,০০,০০০+', label: 'এআই চ্যাট মেসেজ সফলভাবে সম্পন্ন', sub: 'বাংলা ও বাংলিশ ল্যাঙ্গুয়েজে' },
            { metric: '২.৮ গুণ', label: 'গড় সেলস কনভার্সন বৃদ্ধি', sub: 'ইনস্ট্যান্ট রিপ্লাই ও বার্গেনিংয়ে' },
            { metric: '৯৯.৯%', label: 'সিস্টেম আপটাইম ও সার্ভার স্পিড', sub: '২৪/৭ মেটা লাইভ ক্লাউড সার্ভিস' },
            { metric: '০%', label: 'ম্যানুয়াল ভুলের ঝুঁকি', sub: 'স্বয়ংক্রিয় ফোন ও ঠিকানা যাচাই' },
          ].map((item, idx) => (
            <div key={idx} className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs text-center space-y-1">
              <p className="text-2xl sm:text-3xl md:text-4xl font-black text-orange-600 dark:text-orange-400">{item.metric}</p>
              <p className="font-bold text-xs text-zinc-900 dark:text-white leading-tight">{item.label}</p>
              <p className="text-[10px] text-zinc-500">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
