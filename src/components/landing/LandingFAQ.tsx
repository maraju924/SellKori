import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles, MessageCircle, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';

export function LandingFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'সেলকরি (SellKori) কী এবং এটি কীভাবে ফেসবুক পেজের সাথে কাজ করে?',
      a: 'সেলকরি হলো বাংলাদেশের সর্বপ্রথম জেনারেটিভ এআই-চালিত সেলস প্ল্যাটফর্ম। এটি আপনার ফেসবুক পেজ মেসেঞ্জারের সাথে মেটা অফিসিয়াল ওয়েবহুকের মাধ্যমে যুক্ত হয়ে দিন-রাত ২৪ ঘণ্টা কাস্টমারের প্রশ্নের প্রমিত বাংলায় উত্তর দেয়, দরদাম হ্যান্ডেল করে, অর্ডার মেমো বানায় এবং স্টেডফাস্ট কুরিয়ারে পার্সেল বুকিং পাঠিয়ে দেয়।'
    },
    {
      q: 'এআই কি দরদাম (Bargaining) করতে পারে? এটি কি কোনো কম দামে বা লসে বিক্রি করবে?',
      a: 'কখনোই না! প্রতিটি প্রোডাক্ট যুক্ত করার সময় আপনি একটি রেগুলার দাম এবং একটি "মিনিমাম প্রাইস (Min Price)" নির্ধারণ করে দেবেন। কাস্টমার ডিসকাউন্ট বা ছাড় চাইলে এআই বুদ্ধি করে ধাপে ধাপে ছাড় দেবে, কিন্তু আপনার দেওয়া সর্বনিম্ন মূল্যের ১ টাকা নিচেও নামবে না।'
    },
    {
      q: 'কাস্টমার অর্ডার করলে আমি কীভাবে জানতে পারব এবং কুরিয়ারে পার্সেল কীভাবে যাবে?',
      a: 'কাস্টমার চ্যাটে সাইজ ও কালার পছন্দ করে নাম, ১১ ডিজিটের মোবাইল নম্বর এবং ঠিকানা দিলেই এআই স্বয়ংক্রিয়ভাবে একটি ডিজিটাল অর্ডার ইনভয়েস তৈরি করে কাস্টমার ও আপনার মার্চেন্ট ড্যাশবোর্ডে পাঠাবে। ড্যাশবোর্ড থেকে ১ ক্লিকে (অথবা ফুল অটোমেটিক্যালি) Steadfast Courier API দিয়ে পার্সেল বুকিং হয়ে ট্র্যাকিং কোড তৈরি হয়ে যাবে।'
    },
    {
      q: 'মেটা পিক্সেল ও সার্ভার কনভার্সন এপিআই (CAPI) কীভাবে আমার অ্যাডের খরচ কমায়?',
      a: 'ইনবক্সে হওয়া প্রতিটি সফল অর্ডারের ডাটা সার্ভার থেকে মেটার কাছে `Purchase` ইভেন্ট হিসেবে পৌঁছায়। ফেসবুক অ্যালগরিদম তখন বুঝতে পারে কোন ধরনের কাস্টমাররা সত্যিই কেনাকাটা করছে। ফলে আপনার বিজ্ঞাপন শুধুমাত্র হাই-কোয়ালিটি বায়ারদের কাছে পৌঁছায় এবং অপ্রয়োজনীয় ক্লিকের টাকা নষ্ট না হয়ে অ্যাডের ROAS বহুগুণ বেড়ে যায়।'
    },
    {
      q: 'টোকেন সিস্টেম কী এবং ১ লাখ টোকেন দিয়ে কতটি কাস্টমার চ্যাট সম্পন্ন হয়?',
      a: 'টোকেন হলো এআই প্রসেসিংয়ের পরিমাপক ইউনিট। সেলকরির খরচ অবিশ্বাস্য সাশ্রয়ী—প্রতি ১,০০,০০০ (১ লাখ) টোকেন মাত্র ২০ টাকা! ১ লাখ টোকেন দিয়ে গড়ে প্রায় ২০০ থেকে ৩০০টি পূর্ণাঙ্গ সেলস কনভার্সেশন সম্পন্ন হয়, অর্থাৎ প্রতি কাস্টমার চ্যাটে খরচ পড়ে মাত্র ৭ থেকে ৮ পয়সা।'
    },
    {
      q: 'আমার কি কোনো ই-কমার্স ওয়েবসাইট থাকা বাধ্যতামূলক?',
      a: 'না, কোনো ওয়েবসাইটের প্রয়োজন নেই। আপনার শুধু একটি ফেসবুক পেজ থাকলেই চলবে। এছাড়াও সেলকরি আপনাকে একটি ডেডিকেটেড পাবলিক চ্যাট লিংক প্রদান করে যা আপনি হোয়াটসঅ্যাপ, ইনস্টাগ্রাম বা ফেসবুকে বায়ো লিংক হিসেবে ব্যবহার করতে পারবেন।'
    },
    {
      q: 'আমি কীভাবে টোকেন রিচার্জ এবং পেমেন্ট করব?',
      a: 'আমাদের ওয়ালেট সিস্টেম Zinipay গেটওয়ের সাথে সরাসরি সংযুক্ত। মার্চেন্ট প্যানেল থেকে যেকোনো সময় bKash, Nagad, Rocket, Upay বা কার্ড দিয়ে ইনস্ট্যান্টলি অটোমেটিক রিচার্জ করে নিতে পারবেন।'
    },
    {
      q: 'আমার স্টোরের ডাটা ও কাস্টমার তথ্যের নিরাপত্তা কতটা সুরক্ষিত?',
      a: 'আমরা এন্টারপ্রাইজ-গ্রেড সিকিউরিটি ও Google Cloud ফায়ারবেস ডেটাবেস ব্যবহার করি। আপনার কাস্টমার ডাটা, ফোন নম্বর এবং অর্ডারের তথ্য সম্পূর্ণ এনক্রিপ্টেড থাকে এবং অন্য কোনো পক্ষের সাথে শেয়ার করা হয় না।'
    }
  ];

  return (
    <section id="faq" className="py-20 md:py-28 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            <HelpCircle className="w-3.5 h-3.5 mr-1 text-orange-600 fill-orange-600" />
            সাধারণ প্রশ্নোত্তর
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            সচরাচর জিজ্ঞাসিত প্রশ্নাবলি
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            সেলকরি নিয়ে আপনার সব প্রশ্নের বিস্তারিত ও স্বচ্ছ উত্তর এখানে পেয়ে যাবেন।
          </p>
        </div>

        {/* Accordion FAQ List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-zinc-950 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 md:p-6 text-left flex items-center justify-between gap-4 font-bold text-sm md:text-base text-zinc-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <span className="leading-snug">{faq.q}</span>
                  <div className={`w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 bg-orange-50 text-orange-600' : 'text-zinc-500'}`}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-6 md:px-6 md:pb-6 text-xs md:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still Have Questions Banner */}
        <div className="mt-14 p-8 bg-zinc-900 text-white rounded-3xl md:rounded-4xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg font-black text-white">অন্য কোনো প্রশ্ন বা কাস্টম চাহিদা আছে?</h4>
            <p className="text-xs text-zinc-400">আমাদের বিশেষজ্ঞ টিম আপনাকে সাহায্য করতে প্রস্তুত রয়েছে।</p>
          </div>
          <Link to="/login" className="shrink-0 w-full sm:w-auto">
            <Button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md">
              সাপোর্ট বা লগইন করুন
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
