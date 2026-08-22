import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Sliders, 
  Lock, 
  Globe, 
  Truck, 
  Save, 
  Check, 
  MessageSquare,
  ShieldCheck,
  Zap,
  Cpu,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData } from '../../lib/utils';

interface MerchantAIControlProps {
  business: BusinessConfig;
}

export function MerchantAIControl({ business }: MerchantAIControlProps) {
  const [aiPersona, setAiPersona] = useState<BusinessConfig['aiPersona']>(business.aiPersona || 'friendly');
  const [aiLanguage, setAiLanguage] = useState<BusinessConfig['aiLanguage']>(business.aiLanguage || 'bangla');
  const [bargainingSensitivity, setBargainingSensitivity] = useState<number>(business.bargainingSensitivity ?? 60);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>(business.customSystemPrompt || '');
  const [deliveryInside, setDeliveryInside] = useState<number>(business.courierConfig?.deliveryChargeInsideDhaka ?? 70);
  const [deliveryOutside, setDeliveryOutside] = useState<number>(business.courierConfig?.deliveryChargeOutsideDhaka ?? 130);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = cleanFirestoreData({
        aiPersona,
        aiLanguage,
        bargainingSensitivity: Number(bargainingSensitivity),
        customSystemPrompt,
        courierConfig: {
          ...(business.courierConfig || {}),
          deliveryChargeInsideDhaka: Number(deliveryInside),
          deliveryChargeOutsideDhaka: Number(deliveryOutside)
        }
      });

      await updateDoc(doc(db, 'businesses', business.id), payload);
      toast.success('এআই সেলস ব্রেন সেটিংস সফলভাবে সংরক্ষিত হয়েছে!', {
        description: 'মেসেঞ্জার ও পাবলিক চ্যাটে নতুন কনফিগারেশন তাৎক্ষণিক কার্যকর হয়েছে।'
      });
    } catch (e: any) {
      console.error('[Save AI Control Error]', e);
      toast.error(e?.message ? `সংরক্ষণ ব্যর্থ: ${e.message}` : 'কনফিগারেশন সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              এআই সেলস ব্রেন কনফিগারেশন
            </h2>
            <Badge className="bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              ম্যানেজড সেন্ট্রাল এআই সক্রিয়
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার শপের গ্রাহকদের সাথে স্বাভাবিক ভাষায় কথা বলা, দরদাম করা এবং অর্ডার কনফার্ম করার আচরণ নির্ধারণ করুন।
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20 active:scale-95 transition-transform shrink-0"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
        </Button>
      </div>

      {/* Fully Managed Cloud AI Banner */}
      <div className="p-4 md:p-5 rounded-3xl bg-linear-to-r from-orange-50 via-amber-50 to-orange-50/50 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-900 border border-orange-200/70 dark:border-zinc-800 flex items-start gap-3.5 shadow-xs">
        <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-600/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
            সম্পূর্ণ স্বয়ংক্রিয় ক্লাউড এআই ইঞ্জিন (Zero Technical Setup)
          </h4>
          <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            সেলকরি সেন্ট্রাল এআই ব্রেন স্বয়ংক্রিয়ভাবে আপনার ক্যাটালগ ও FAQ পড়ে মেসেঞ্জারে প্রতিটি গ্রাহককে তাৎক্ষণিক সঠিক উত্তর প্রদান করে। আপনার কোনো টেকনিক্যাল কোডিং বা অতিরিক্ত কনফিগারেশনের প্রয়োজন নেই।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Persona & Tone Control Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">এআই সেলস পার্সোনা ও টোন</h3>
              <p className="text-[11px] text-zinc-500">গ্রাহকের সাথে বটের কথা বলার ভঙ্গি</p>
            </div>
          </div>

          {/* Persona Choices */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'friendly', title: 'বন্ধুত্বপূর্ণ (Friendly)', desc: 'আন্তরিক, বিনয়ী ও সেবামূলক সেলসম্যান' },
              { id: 'professional', title: 'পেশাদার (Professional)', desc: 'মার্জিত, তথ্যবহুল ও ব্র্যান্ডেড' },
              { id: 'enthusiastic', title: 'উৎসাহী (Enthusiastic)', desc: 'অফার ও ডিসকাউন্ট হাইলাইটকারী' },
              { id: 'humorous', title: 'কৌতুকপূর্ণ (Humorous)', desc: 'সহজ বাংলা ও ফ্রেন্ডলি ভাব' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAiPersona(p.id as any)}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  aiPersona === p.id
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-950 dark:text-orange-200 ring-2 ring-orange-500/20 font-bold'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="font-black text-xs flex items-center justify-between">
                  <span>{p.title}</span>
                  {aiPersona === p.id && <Check className="w-3.5 h-3.5 text-orange-600" />}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Language Mode */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              কথোপকথনের ভাষা (Language Preference)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bangla', label: 'বাংলা (প্রমিত)' },
                { id: 'banglish', label: 'বাংলিশ (Banglish)' },
                { id: 'auto', label: 'অটো ডিটেক্ট (Auto)' }
              ].map(lang => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setAiLanguage(lang.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                    aiLanguage === lang.id
                      ? 'border-orange-500 bg-orange-500 text-white shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bargaining Engine & Delivery Rules */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">দরদাম ও ডেলিভারি নীতিমালা</h3>
              <p className="text-[11px] text-zinc-500">Min Price এবং ডেলিভারি চার্জ গাইডলাইন</p>
            </div>
          </div>

          {/* Bargaining Sensitivity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-orange-500" />
                দরদামে ছাড় দেওয়ার আগ্রহ:
              </span>
              <span className="font-mono font-black text-orange-600 dark:text-orange-400">
                {bargainingSensitivity}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={bargainingSensitivity}
              onChange={e => setBargainingSensitivity(Number(e.target.value))}
              className="w-full accent-orange-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>একদাম (কখনোই কমবে না)</span>
              <span>মাঝারি ছাড় (Min Price পর্যন্ত)</span>
              <span>সহজ ছাড় (দ্রুত অফার দেবে)</span>
            </div>
          </div>

          {/* Delivery Charges */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                ঢাকার ভেতর ডেলিভারি চার্জ (৳)
              </label>
              <Input
                type="number"
                value={deliveryInside}
                onChange={e => setDeliveryInside(Number(e.target.value))}
                className="h-10 rounded-xl font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                ঢাকার বাইরে ডেলিভারি চার্জ (৳)
              </label>
              <Input
                type="number"
                value={deliveryOutside}
                onChange={e => setDeliveryOutside(Number(e.target.value))}
                className="h-10 rounded-xl font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Custom Prompt Instructions Box */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-orange-500" />
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">
            কাস্টম নির্দেশনা বা বিশেষ পলিসি (Store Guidelines)
          </h3>
        </div>
        <p className="text-xs text-zinc-500">
          আপনার ব্যবসার কোনো বিশেষ শর্ত বা নিয়ম থাকলে এখানে লিখে দিন (যেমন: "অর্ডার করার সময় অবশ্যই অগ্রিম ১০০ টাকা বিকাশ করতে হবে" অথবা "রিটার্ন পলিসি ৭ দিন")। এআই কাস্টমারদের সাথে কথা বলার সময় এই নিয়মগুলো মেনে চলবে।
        </p>
        <Textarea
          value={customSystemPrompt}
          onChange={e => setCustomSystemPrompt(e.target.value)}
          placeholder="যেমন: আমাদের পণ্যগুলো শতভাগ অরিজিনাল। পাইকারি অর্ডারের জন্য ০১৭XXXXXXXX নম্বরে যোগাযোগ করতে বলুন।"
          className="min-h-[100px] rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-xs leading-relaxed"
        />
      </div>
    </div>
  );
}
