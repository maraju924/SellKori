import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  ShieldCheck, 
  Lock, 
  CreditCard, 
  MessageCircle, 
  Globe, 
  Heart,
  Mail,
  PhoneCall
} from 'lucide-react';
import { Button } from '../ui/button';

export function LandingFooter() {
  return (
    <footer className="bg-zinc-950 text-zinc-300 border-t border-zinc-900 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Col 1 & 2: Brand Info */}
          <div className="md:col-span-2 space-y-5">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-600/30">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <span className="font-black text-2xl tracking-tight text-white">
                Sell<span className="text-orange-500">Kori</span>
              </span>
            </Link>

            <p className="text-xs md:text-sm text-zinc-400 leading-relaxed max-w-sm">
              বাংলাদেশের প্রথম ফুল-স্ট্যাক এআই সেলসম্যান প্ল্যাটফর্ম। ফেসবুক মেসেঞ্জারে স্বয়ংক্রিয় দরদাম, অর্ডার মেমো এবং স্টেডফাস্ট কুরিয়ার বুকিং নিশ্চিত করে আপনার ই-কমার্স ব্যবসাকে স্কেল করুন।
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-semibold pt-1">
              <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Meta API Ready</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>SSL এনক্রিপ্টেড</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <CreditCard className="w-4 h-4 text-orange-400" />
                <span>Zinipay সাপোর্টেড</span>
              </div>
            </div>
          </div>

          {/* Col 3: Features & Navigation */}
          <div className="space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-zinc-100">
              প্ল্যাটফর্ম
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-medium">
              <li><a href="#features" className="hover:text-orange-400 transition-colors">ফিচারসমূহ</a></li>
              <li><a href="#demo" className="hover:text-orange-400 transition-colors">ইন্টারেক্টিভ এআই ডেমো</a></li>
              <li><a href="#comparison" className="hover:text-orange-400 transition-colors">তুলনামূলক চার্ট</a></li>
              <li><a href="#how-it-works" className="hover:text-orange-400 transition-colors">কীভাবে কাজ করে</a></li>
              <li><a href="#pricing" className="hover:text-orange-400 transition-colors">প্রাইসিং ও খরচ ক্যালকুলেটর</a></li>
            </ul>
          </div>

          {/* Col 4: Integrations */}
          <div className="space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-zinc-100">
              ইন্টিগ্রেশন
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-medium">
              <li><span className="text-zinc-400">Facebook Messenger API</span></li>
              <li><span className="text-zinc-400">Meta Conversion API (CAPI)</span></li>
              <li><span className="text-zinc-400">Steadfast Courier API</span></li>
              <li><span className="text-zinc-400">Zinipay Payment Gateway</span></li>
              <li><span className="text-zinc-400">Google Gemini AI LLM</span></li>
            </ul>
          </div>

          {/* Col 5: Support & Legal */}
          <div className="space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-zinc-100">
              লিগ্যাল ও যোগাযোগ
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400 font-medium">
              <li><a href="#faq" className="hover:text-orange-400 transition-colors">সচরাচর জিজ্ঞাসা (FAQ)</a></li>
              <li><span className="text-zinc-400">প্রাইভেসি পলিসি</span></li>
              <li><span className="text-zinc-400">ব্যবহারের নিয়মাবলী</span></li>
              <li className="flex items-center gap-1.5 text-zinc-400 pt-1">
                <Mail className="w-3.5 h-3.5 text-orange-400" />
                <span>support@sellkori.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="border-t border-zinc-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© 2026 SellKori AI Inc. সর্বস্বত্ব সংরক্ষিত।</p>
          <div className="flex items-center gap-1">
            <span>Made with precision for Bangladeshi eCommerce</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
