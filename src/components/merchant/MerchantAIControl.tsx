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
  ShieldAlert
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

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
      await updateDoc(doc(db, 'businesses', business.id), {
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
      toast.success('এআই সেলস কন্ট্রোল সফলভাবে আপডেট হয়েছে!', {
        description: 'মেসেঞ্জার এবং পাবলিক চ্যাটে নতুন কনফিগারেশন প্রযোজ্য হয়েছে।'
      });
    } catch (e) {
      toast.error('কনফিগারেশন সংরক্ষণ ব্যর্থ হয়েছে');
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
              এআই সেলস ব্রেন ও দরদাম কন্ট্রোল
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Gemini 2.5 Flash
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার বটের কথা বলার স্টাইল, দরদামের নমনীয়তা এবং ডেলিভারি চার্জের নিয়ম নিয়ন্ত্রণ করুন।
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Persona & Tone Control Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">এআই সেলস পার্সোনা ও টোন</h3>
              <p className="text-[11px] text-zinc-500">কাস্টমারের সাথে বটের ব্যবহারের আচরণ</p>
            </div>
          </div>

          {/* Persona Choices */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'friendly', title: 'বন্ধুত্বপূর্ণ (Friendly)', desc: 'আন্তরিক ও বিনয়ী সেলসম্যান' },
              { id: 'professional', title: 'পেশাদার (Professional)', desc: 'সংক্ষিপ্ত, তথ্যবহুল ও মার্জিত' },
              { id: 'enthusiastic', title: 'উৎসাহী (Enthusiastic)', desc: 'অফার ও অফার-হাইলাইটেড টোন' },
              { id: 'humorous', title: 'কৌতুকপূর্ণ (Humorous)', desc: 'সহজ বাংলা ও আকর্ষণীয় ভাষা' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAiPersona(p.id as any)}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  aiPersona === p.id
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-950 dark:text-orange-200 ring-2 ring-orange-500/20'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300'
                }`}
              >
                <div className="font-black text-xs">{p.title}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">{p.desc}</div>
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
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
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
              <span>সহজ ছাড় (খুব দ্রুত রাজি হবে)</span>
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
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">
            কাস্টম নির্দেশনা বা বিশেষ পলিসি (Custom Instructions)
          </h3>
        </div>
        <p className="text-xs text-zinc-500">
          আপনার ব্যবসার কোনো বিশেষ শর্ত বা নিয়ম থাকলে এখানে লিখে দিন (যেমন: "অর্ডার করার সময় অবশ্যই অগ্রিম ২০০ টাকা বিকাশ করতে হবে" অথবা "রিটার্ন পলিসি ৭ দিন")। এআই এটি কাস্টমারদের সাথে মেনে চলবে।
        </p>
        <Textarea
          value={customSystemPrompt}
          onChange={e => setCustomSystemPrompt(e.target.value)}
          placeholder="যেমন: আমাদের পণ্যগুলো শতভাগ অরিজিনাল। পাইকারি অর্ডারের জন্য ০১৭XXXXXXXX নম্বরে কল দিতে বলুন।"
          className="min-h-[100px] rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-xs leading-relaxed"
        />
      </div>
    </div>
  );
}
