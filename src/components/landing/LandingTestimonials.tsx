import React from 'react';
import { Star, Quote, CheckCircle2, TrendingUp } from 'lucide-react';
import { Badge } from '../ui/badge';

export function LandingTestimonials() {
  const reviews = [
    {
      name: 'তুষার আহমেদ',
      role: 'ফাউন্ডার ও সিইও',
      store: 'Dhaka Dapper (ফ্যাশন ও ক্লোথিং)',
      rating: 5,
      gain: '+৪৫% নাইট সেলস বৃদ্ধি',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      comment: 'বিজ্ঞাপন চালালে রাত ২টা থেকে ভোর ৫টায় সবচেয়ে বেশি মেসেজ আসত, কিন্তু আমরা ঘুমিয়ে থাকায় পরদিন সকালে কাস্টমার আর কিনতে চাইত না। সেলকরি চালু করার পর থেকে রাতভর এআই নিজে নিজে অর্ডার মেমো কনফার্ম করে নিচ্ছে!'
    },
    {
      name: 'নাদিয়া ইসলাম',
      role: 'স্বত্বাধিকারী',
      store: 'Pure Glow Cosmetics (বিউটি ও স্কিনকেয়ার)',
      rating: 5,
      gain: '০% ম্যানুয়াল ভুল',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
      comment: 'কাস্টমাররা স্কিনকেয়ার ও ব্যবহারের নিয়ম নিয়ে বিস্তারিত জানতে চায়। সেলকরি মানুষের মতো আন্তরিকভাবে সব প্রশ্নের উত্তর দিয়ে কনভিন্স করে। স্টেডফাস্ট কুরিয়ারে ১-ক্লিক পার্সেল বুকিং আমাদের প্রতিদিন অন্তত ২ ঘণ্টা সময় বাঁচায়।'
    },
    {
      name: 'মাহির ফয়সাল',
      role: 'কো-ফাউন্ডার',
      store: 'Gadget Vault BD (গ্যাজেট ও এক্সেসরিজ)',
      rating: 5,
      gain: '৩.৪x মেটা বিজ্ঞাপন ROAS',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      comment: 'মেটা CAPI সার্ভার ইন্টিগ্রেশনের কারণে আমাদের ফেসবুক অ্যাডের পারফর্মেন্স অবিশ্বাস্য ভালো হয়েছে। আর স্মার্ট দরদাম ফিচারটা সেরা—কাস্টমার ছাড় চাইলে ধাপে ধাপে কমায় কিন্তু আমাদের সেট করা মিনিমাম দামের নিচে কখনো যায় না।'
    },
    {
      name: 'রফিকুল হাসান',
      role: 'অপারেশন ম্যানেজার',
      store: 'Organic Shodai (অর্গানিক ফুড)',
      rating: 5,
      gain: '৯০% খরচ সাশ্রয়',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      comment: 'প্রতি মাসে কাস্টমার কেয়ার ম্যানেজারের পেছনে ১৫-২০ হাজার টাকা খরচের বদলে মাত্র কিছু টাকা টোকেন খরচে পুরো পেজের ইনবক্স অটোমেটেড হয়ে গেছে। কাস্টমারদের ইনস্ট্যান্ট রেসপন্স পেয়ে তারা খুব খুশি।'
    }
  ];

  return (
    <section className="py-20 md:py-28 relative bg-zinc-50/80 dark:bg-zinc-900/40 border-y border-zinc-200/80 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            সফল মার্চেন্টদের গল্প
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            বাংলাদেশের শত শত ই-কমার্স ও <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 to-amber-500">
              ফেসবুক পেজের নির্ভরযোগ্য সঙ্গী
            </span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            বাস্তব অভিজ্ঞতা শুনুন তাঁদের মুখ থেকেই যাঁরা ইতিমধ্যে সেলকরি ব্যবহার করে ব্যবসা স্কেল করেছেন।
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
          {reviews.map((rev, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-zinc-950 rounded-3xl p-7 border border-zinc-200/80 dark:border-zinc-800 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6 group"
            >
              <div className="space-y-4">
                {/* Rating Stars & Gain Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 text-amber-500">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {rev.gain}
                  </span>
                </div>

                {/* Comment Quote */}
                <p className="text-xs md:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
                  "{rev.comment}"
                </p>
              </div>

              {/* Author Footer */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3.5">
                <img
                  src={rev.avatar}
                  alt={rev.name}
                  className="w-11 h-11 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-700 shadow-xs"
                />
                <div>
                  <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white leading-tight">
                    {rev.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {rev.role} • <span className="text-orange-600 dark:text-orange-400 font-bold">{rev.store}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
