import React, { useState } from 'react';
import { 
  Megaphone, 
  Send, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Flame,
  MessageSquare
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { toast } from 'sonner';

interface MerchantBroadcastingProps {
  business: BusinessConfig;
}

export function MerchantBroadcasting({ business }: MerchantBroadcastingProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'hot_leads' | 'buyers'>('all');
  const [isSending, setIsSending] = useState(false);

  const handleSendBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('ক্যাম্পেইনের টাইটেল এবং মেসেজ লিখুন');
      return;
    }

    setIsSending(true);
    try {
      // Simulate broadcasting
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('ব্রডকাস্ট ক্যাম্পেইন সফলভাবে শিডিউল হয়েছে!', {
        description: 'নির্বাচিত কাস্টমারদের কাছে মেসেঞ্জারে অফার পৌঁছে যাচ্ছে।'
      });
      setTitle('');
      setMessage('');
    } catch (e) {
      toast.error('ব্রডকাস্ট ব্যর্থ হয়েছে');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              টার্গেটেড মেসেঞ্জার ব্রডকাস্টিং
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Smart Remarketing
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            অতীতের কাস্টমার বা যারা চ্যাটে দামাদামি করেও কেনেনি, তাদের কাছে নতুন অফার বা ডিসকাউন্ট পাঠান।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Broadcast Form */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">ক্যাম্পেইন নাম *</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="যেমন: উইকেন্ড স্পেশাল ফ্রি ডেলিভারি অফার"
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">টার্গেট অডিয়েন্স নির্বাচন করুন</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'all', label: 'সকল গ্রাহক (All)', desc: 'যাদের সাথে চ্যাট হয়েছে' },
                { id: 'hot_leads', label: 'হট লিড (Hot Leads)', desc: 'দামাদামি করেছে কিন্তু নেয়নি' },
                { id: 'buyers', label: 'সফল ক্রেতা (Buyers)', desc: 'যারা পূর্বে অর্ডার করেছে' }
              ].map(aud => (
                <button
                  key={aud.id}
                  type="button"
                  onClick={() => setTargetAudience(aud.id as any)}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    targetAudience === aud.id
                      ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-950 dark:text-orange-200'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <p className="font-bold text-xs">{aud.label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{aud.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">মেসেজ কন্টেন্ট *</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="যেমন: প্রিয় গ্রাহক, আমাদের নতুন কালেকশনে পাচ্ছেন ২০% ফ্ল্যাট ছাড়! স্টক শেষ হওয়ার আগেই অর্ডার করুন।"
              className="min-h-[120px] rounded-2xl text-xs leading-relaxed"
            />
          </div>

          <Button
            onClick={handleSendBroadcast}
            disabled={isSending}
            className="w-full bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 text-white font-black text-xs rounded-2xl h-11 shadow-md shadow-orange-600/20"
          >
            <Send className="w-4 h-4 mr-1.5" />
            {isSending ? 'পাঠানো হচ্ছে...' : 'ব্রডকাস্ট শুরু করুন'}
          </Button>
        </div>

        {/* Policy Box */}
        <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 space-y-3 text-xs">
          <h4 className="font-black text-sm text-zinc-900 dark:text-white">মেসেঞ্জার ব্রডকাস্ট পলিসি গাইডলাইন</h4>
          <p className="text-zinc-500 leading-relaxed">
            ফেসবুকের 24-hour Messaging Policy অনুযায়ী শুধুমাত্র বিগত ২৪ ঘণ্টার মধ্যে যোগাযোগ করা অথবা স্পনসর্ড মেসেজ ট্যাগসহ গ্রাহকদের কাছে স্বয়ংক্রিয়ভাবে মেসেজ পাঠানো নিরাপদ।
          </p>
        </div>
      </div>
    </div>
  );
}
