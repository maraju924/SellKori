import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Zap, 
  Bot, 
  Sparkles, 
  Flame,
  ArrowRight
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';

export function LandingComparison() {
  const comparisonData = [
    {
      feature: 'রিপ্লাই টাইম ও কাস্টমার রেসপন্স',
      traditional: '১০ মিনিট থেকে কয়েক ঘণ্টা (দেরিতে রিপ্লাইয়ের কারণে ৬০% কাস্টমার অন্য পেজে যায়)',
      buttonBot: 'ইনস্ট্যান্ট, তবে কাস্টমার কোনো প্রশ্ন টাইপ করলেই আটকে যায়',
      sellkori: 'মাত্র ২ সেকেন্ডে মানুষের মতো পূর্ণাঙ্গ এবং সঠিক বাংলায় জবাব',
    },
    {
      feature: 'স্মার্ট দরদাম ও ডিসকাউন্ট (Bargaining)',
      traditional: 'ম্যানুয়ালি করতে হয়, অনেক সময় অসাবধানতাবশত অতিরিক্ত কমে বিক্রি হয়ে যায়',
      buttonBot: 'অসম্ভব (কোনো দরদাম করার ক্ষমতা নেই, ফিক্সড টেক্সট দেখায়)',
      sellkori: 'মিনিমাম দাম রক্ষা করে বুদ্ধিদীপ্তভাবে ধাপে ধাপে দরদাম করে সেল কনফার্ম করে',
    },
    {
      feature: 'বাংলা ও বাংলিশ ভাষা বোঝার ক্ষমতা',
      traditional: 'মানুষ বোঝে, তবে টাইপ করতে অনেক সময় লাগে',
      buttonBot: 'শুধুমাত্র নির্দিষ্ট কি-ওয়ার্ড ছাড়া অন্য কিছু বুঝতেই পারে না',
      sellkori: 'শুদ্ধ বাংলা ও রোমানাইজড বাংলিশ ("dam koto", "size hobe") উভয়ই অনর্গল বোঝে',
    },
    {
      feature: 'স্বয়ংক্রিয় অর্ডার মেমো ও ইনভয়েস',
      traditional: 'ইনবক্স থেকে কপি পেস্ট করে এক্সেল বা ডায়রিতে ম্যানুয়ালি লিখতে হয়',
      buttonBot: 'এক্সটার্নাল থার্ডপার্টি জটিল ফর্ম পূরণ করতে হয় (কাস্টমার ড্রপআউট)',
      sellkori: 'চ্যাট থেকেই নাম, ফোন ও ঠিকানা নিয়ে স্বয়ংক্রিয়ভাবে ডিজিটাল মেমো তৈরি করে',
    },
    {
      feature: 'স্টেডফাস্ট কুরিয়ারে অটো পার্সেল বুকিং',
      traditional: 'কুরিয়ার প্যানেলে গিয়ে প্রতিটা পার্সেল আলাদা আলাদা ম্যানুয়ালি এন্ট্রি',
      buttonBot: 'কোনো কুরিয়ার অটোমেশন নেই',
      sellkori: '১ ক্লিকে অথবা সম্পূর্ণ অটোমেটিকভাবে Steadfast API-তে পার্সেল তৈরি ও ট্র্যাকিং',
    },
    {
      feature: 'মেটা পিক্সেল ও কনভার্সন এপিআই (CAPI)',
      traditional: 'ইনবক্স সেলে কোনো পিক্সেল ট্র্যাকিং হয় না (বিজ্ঞাপনের ROAS কমে যায়)',
      buttonBot: 'শুধুমাত্র ব্রাউজার ইভেন্ট (iOS 14+ এ কাজ করে না)',
      sellkori: 'সার্ভার-সাইড মেটা CAPI দিয়ে Purchase ইভেন্ট ট্র্যাকিং করে অ্যাড কস্ট কমায়',
    },
    {
      feature: '২৪/৭ নাইট সেলস (রাত ৩টা থেকে সকাল ৮টা)',
      traditional: 'এডমিন ঘুমালে সম্পূর্ণ সেলস বন্ধ',
      buttonBot: 'রোবটিক বাটন থাকায় অর্ডার সম্পূর্ণ হয় না',
      sellkori: 'সারারাত নিরবচ্ছিন্নভাবে প্রতিটি কাস্টমারকে সন্তুষ্ট করে অর্ডার চূড়ান্ত করে',
    },
  ];

  return (
    <section id="comparison" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            সরাসরি তুলনা
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            কেন প্রচলিত পদ্ধতির চেয়ে <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 to-amber-500">
              SellKori AI শতগুণে এগিয়ে?
            </span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            ম্যানুয়াল ইনবক্স চ্যাট, সাধারণ বোতাম-নির্ভর বট এবং সেলকরি এআই-এর বাস্তব পার্থক্য দেখুন।
          </p>
        </div>

        {/* Comparison Table / Bento Matrix */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl md:rounded-4xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                  <th className="py-5 px-6 font-black text-sm text-zinc-900 dark:text-white w-1/4">
                    ফিচার ও সুবিধা
                  </th>
                  <th className="py-5 px-6 font-bold text-xs text-zinc-500 uppercase tracking-wider w-1/4">
                    ম্যানুয়াল ইনবক্স চ্যাট
                  </th>
                  <th className="py-5 px-6 font-bold text-xs text-zinc-500 uppercase tracking-wider w-1/4">
                    সাধারণ বাটন চ্যাটবট
                  </th>
                  <th className="py-5 px-6 font-black text-sm text-orange-600 dark:text-orange-400 bg-orange-50/70 dark:bg-orange-950/40 w-1/4">
                    ✨ SellKori AI Salesman
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 text-xs md:text-sm">
                {comparisonData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                    <td className="py-4 px-6 font-bold text-zinc-900 dark:text-zinc-100">
                      {row.feature}
                    </td>
                    <td className="py-4 px-6 text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>{row.traditional}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>{row.buttonBot}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-zinc-900 dark:text-white bg-orange-50/40 dark:bg-orange-950/20">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-zinc-900 dark:text-white">{row.sellkori}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Card Footer */}
          <div className="p-6 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="font-bold text-sm text-zinc-900 dark:text-white">
                এখনই সিদ্ধান্ত নিন — আপনার ব্যবসার সময় ও খরচ উভয়ই বাঁচান
              </p>
              <p className="text-xs text-zinc-500">আজই সাইন আপ করে ফ্রিতে টেস্ট করুন।</p>
            </div>
            <Link to="/login">
              <Button className="bg-orange-600 hover:bg-orange-500 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md shadow-orange-600/20">
                ফ্রি ট্রায়াল একাউন্ট তৈরি করুন
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
