import React from 'react';
import { 
  Bot, 
  Tag, 
  ShoppingBag, 
  Truck, 
  Globe, 
  Users, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  TrendingUp,
  Cpu,
  Layers,
  FileText
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

export function LandingFeatures() {
  const coreFeatures = [
    {
      icon: Bot,
      color: 'bg-orange-500 text-white shadow-orange-500/20',
      badge: 'কোর এআই প্রযুক্তি',
      title: 'খাঁটি বাংলায় কথা বলা বুদ্ধিমান এআই সেলসম্যান',
      description: 'প্রমিত বাংলা, ইংরেজি কিংবা রোমানাইজড বাংলিশ ("dam koto", "bhai deliveri kobe pabo")—কাস্টমার যেভাবে খুশি লিখুক, আপনার এআই সেলসম্যান ২ সেকেন্ডে অত্যন্ত অমায়িক ও প্রফেশনাল ভাষায় উত্তর দেবে।',
      bullets: [
        'বাংলা ও বাংলিশ ল্যাঙ্গুয়েজের বিশাল ডাটাবেসে ট্রেইন্ড',
        'স্টোরের রিটার্ন ও ডেলিভারি পলিসি নির্ভুলভাবে বুঝিয়ে বলা',
        '২৪ ঘণ্টা নিরবচ্ছিন্ন কাস্টমার এনগেজমেন্ট',
        'মানুষের মতো ফ্রেন্ডলি এবং কনভার্সেশনাল টোন'
      ]
    },
    {
      icon: Tag,
      color: 'bg-amber-500 text-white shadow-amber-500/20',
      badge: 'স্মার্ট নেগোসিয়েশন',
      title: 'মিনিমাম প্রাইস গার্ড সহ বুদ্ধিদীপ্ত দরদাম (Bargaining)',
      description: 'বাঙালি কাস্টমার দরদাম করতে ভালোবাসে! প্রতিটি পণ্যের রেগুলার প্রাইস এবং "মিনিমাম প্রাইস" সেট করে রাখুন। এআই প্রথমে কোয়ালিটি বুঝিয়ে রেগুলার দামে বিক্রি করতে চাইবে, কাস্টমার চাপাচাপি করলে বুদ্ধি করে ছাড় দেবে কিন্তু কখনো মিনিমাম দামের নিচে নামবে না।',
      bullets: [
        'প্রোডাক্ট প্রতি Min Price লক করার সুবিধা',
        'কাস্টমারকে না হারিয়ে সেল ক্লোজ করার কৌশল',
        'ভুল দামে বিক্রির কোনো ঝুঁকি নেই',
        'অটোমেটিক কুপন কোড ও বান্ডেল অফার প্রেজেন্টেশন'
      ]
    },
    {
      icon: ShoppingBag,
      color: 'bg-emerald-500 text-white shadow-emerald-500/20',
      badge: 'অর্ডার অটোমেশন',
      title: 'চ্যাট থেকে স্বয়ংক্রিয় অর্ডার নেওয়া ও ইনস্ট্যান্ট মেমো',
      description: 'কাস্টমারকে কোনো বহিরাগত কঠিন ফর্ম পূরণ করতে হবে না। চ্যাটের ভেতরেই নাম, ১১ ডিজিটের মোবাইল নম্বর, জেলা ও বিস্তারিত ঠিকানা সংগ্রহ করে সাথে সাথে ডিজিটাল ইনভয়েস স্লিপ জেনারেট করে দেবে।',
      bullets: [
        '১১ ডিজিট মোবাইল নম্বর ফরম্যাট ভ্যালিডেশন',
        'জেলা ও ঢাকার ভিতরে/বাইরে ডেলিভারি চার্জ অটো ক্যালকুলেট',
        'কাস্টমারকে ইনস্ট্যান্ট ডিজিটাল মেমো দেখানো',
        'প্রিন্ট ও পিডিএফ মেমো ডাউনলোড সাপোর্ট'
      ]
    },
    {
      icon: Truck,
      color: 'bg-indigo-500 text-white shadow-indigo-500/20',
      badge: 'কুরিয়ার এপিআই',
      title: 'স্টেডফাস্ট কুরিয়ারের সাথে ১-ক্লিক পার্সেল এন্ট্রি',
      description: 'অর্ডার কনফার্ম হওয়ার পর আর কুরিয়ারের ওয়েবসাইটে গিয়ে ম্যানুয়ালি ঠিকানা টাইপ করতে হবে না। এক ক্লিকে Steadfast Courier API দিয়ে পার্সেল বুকিং হয়ে ট্র্যাকিং কোড জেনারেট হয়ে যাবে।',
      bullets: [
        'Steadfast Courier API ফুল ইন্টিগ্রেশন',
        'ইনস্ট্যান্ট কনসাইনমেন্ট ও ট্র্যাকিং আইডি ক্রিয়েশন',
        'কাস্টমারকে স্বয়ংক্রিয় কুরিয়ার ট্র্যাকিং নম্বর প্রদান',
        'ডেলিভারি স্ট্যাটাস ট্র্যাকিং ড্যাশবোর্ড'
      ]
    },
    {
      icon: Globe,
      color: 'bg-blue-500 text-white shadow-blue-500/20',
      badge: 'মেটা বিজ্ঞাপন অপটিমাইজেশন',
      title: 'মেটা পিক্সেল ও সার্ভার কনভার্সন এপিআই (CAPI)',
      description: 'ফেসবুক মেসেঞ্জারে হওয়া প্রতিটি সফল বিক্রয়ের জন্য সার্ভার থেকে সরাসরি Meta Conversion API (CAPI) ইভেন্ট ফায়ার করা হয়। ফলে ফেসবুক অ্যালগরিদম নিখুঁত অডিয়েন্স খুঁজে বের করে আপনার বিজ্ঞাপনের খরচ ৩০-৫০% কমিয়ে দেয়।',
      bullets: [
        'সার্ভার-সাইড Purchase, Lead, AddToCart ইভেন্ট',
        'iOS 14+ এবং ব্রাউজার অ্যাড-ব্লকার বাইপাস নিখুঁত ট্র্যাকিং',
        'অ্যাড সেটে হাই ROAS (Return On Ad Spend) অর্জন',
        'ইভেন্ট ম্যাচ কোয়ালিটি স্কোর ৯/১০+'
      ]
    },
    {
      icon: Users,
      color: 'bg-rose-500 text-white shadow-rose-500/20',
      badge: 'লিড সেগমেন্টেশন ও রি-টার্গেটিং',
      title: 'কাস্টমার ও লিড CRM এবং এক ক্লিকে ব্রডকাস্টিং',
      description: 'যাঁরা মেসেজ দিয়ে কিনতে চেয়েছেন কিন্তু শেষ মুহূর্তে নেননি, তাঁদের এআই "Hot Lead" হিসেবে চিহ্নিত করে রাখে। নতুন প্রোডাক্ট বা বিশেষ অফারে এক ক্লিকে হাজার হাজার লিডের কাছে ব্রডকাস্ট ক্যাম্পেইন পাঠিয়ে পুরনো সেলস ফিরিয়ে আনুন।',
      bullets: [
        'Hot, Warm, Cold লিড অটো সেগমেন্টেশন',
        'পূর্ববর্তী ক্রেতাদের ডাটাবেস ও পার্সোনাল নোটস',
        'এক ক্লিকে অফার ব্রডকাস্টিং ক্যাম্পেইন',
        'পুনরাবৃত্তি বিক্রয় (Repeat Purchase) উল্লেখযোগ্য বৃদ্ধি'
      ]
    }
  ];

  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            <Zap className="w-3.5 h-3.5 mr-1 text-orange-600 fill-orange-600" />
            পূর্ণাঙ্গ ফিচারসমূহ
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            আপনার অনলাইন ব্যবসাকে <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 to-amber-500">
              অটোমেশনে রূপান্তরের সব প্রযুক্তি
            </span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            কাস্টমার এনগেজমেন্ট থেকে শুরু করে কুরিয়ার ডেলিভারি ও ফেসবুক অ্যাড অপটিমাইজেশন—সবকিছু পাবেন একটি প্ল্যাটফর্মে।
          </p>
        </div>

        {/* 6 Core Feature Cards in 2-Column / 3-Column Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {coreFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-zinc-950 rounded-3xl p-7 border border-zinc-200/80 dark:border-zinc-800 shadow-xs hover:shadow-xl hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Top Icon & Badge */}
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl ${feat.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-900/50">
                      {feat.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-snug">
                    {feat.title}
                  </h3>
                  <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                {/* Bullet Points */}
                <div className="pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-900 space-y-2">
                  {feat.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
