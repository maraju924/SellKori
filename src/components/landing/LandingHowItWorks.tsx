import React from 'react';
import { 
  UserPlus, 
  PackagePlus, 
  MessageSquareShare, 
  Rocket, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Zap
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';

export function LandingHowItWorks() {
  const steps = [
    {
      step: '০১',
      icon: UserPlus,
      title: '১ ক্লিকে অ্যাকাউন্ট তৈরি করুন',
      desc: 'গুগল দিয়ে সাইন আপ করলেই সাথে সাথে পেয়ে যাচ্ছেন ১০,০০০ ফ্রি এআই টোকেন টেস্ট ট্রায়াল ব্যালেন্স।',
      tag: 'মাত্র ৩০ সেকেন্ড'
    },
    {
      step: '০২',
      icon: PackagePlus,
      title: 'প্রোডাক্ট ও রেট সেট করুন',
      desc: 'আপনার পণ্যের নাম, বিবরণ, ছবি, রেগুলার প্রাইস এবং ন্যূনতম দরদামের সীমা (Min Price) যুক্ত করুন।',
      tag: 'ক্যাটালগ রেডি'
    },
    {
      step: '০৩',
      icon: MessageSquareShare,
      title: 'ফেসবুক পেজ কানেক্ট করুন',
      desc: 'ফেসবুক পেজ মেসেঞ্জারে অথবা আপনার ওয়েবসাইটের পাবলিক চ্যাট লিঙ্কে ১ ক্লিকে এআই সেলসম্যান যুক্ত করুন।',
      tag: 'অটো ওয়েবহুক'
    },
    {
      step: '০৪',
      icon: Rocket,
      title: 'ঘুমিয়ে থাকুন — সেলস বাড়বে স্বয়ংক্রিয়ভাবে',
      desc: 'এআই ২৪/৭ কাস্টমারের সাথে কথা বলবে, নিখুঁতভাবে অর্ডার নেবে এবং কুরিয়ারে বুকিং পাঠাবে।',
      tag: '২৪/৭ অটো সেলস'
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 relative bg-zinc-50/80 dark:bg-zinc-900/40 border-y border-zinc-200/80 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            সহজ ও দ্রুত
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            মাত্র ৪টি সহজ ধাপে <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 to-amber-500">
              চালু করুন আপনার এআই সেলসম্যান
            </span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            কোনো জটিল কোডিং বা টেকনিক্যাল জ্ঞানের প্রয়োজন নেই। যে কেউ ২ মিনিটে সেটআপ সম্পন্ন করতে পারবেন।
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-zinc-950 rounded-3xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-xs hover:shadow-lg transition-all duration-300 relative flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Step Number & Tag */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-orange-600/30 dark:text-orange-400/20 group-hover:text-orange-600 transition-colors font-mono">
                      {s.step}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      {s.tag}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white mb-2 leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                  <span>ধাপ সম্পন্ন</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button underneath */}
        <div className="text-center mt-12">
          <Link to="/login">
            <Button size="lg" className="h-14 px-8 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-orange-600/25 transition-all hover:scale-102">
              এখনই অ্যাকাউন্ট খুলে শুরু করুন
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
