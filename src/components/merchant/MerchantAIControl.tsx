import React, { useState } from 'react';
import { 
  Bot, 
  Sliders, 
  Lock, 
  Save, 
  Check, 
  FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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
      toast.success('সেভ হয়েছে');
    } catch (e: any) {
      console.error('[Save AI Control Error]', e);
      toast.error(e?.message ? `সংরক্ষণ ব্যর্থ: ${e.message}` : 'কনফিগারেশন সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">এআই</h2>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white text-xs rounded-lg h-9 px-4 shrink-0"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সেভ হচ্ছে...' : 'সেভ'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Persona & Tone Control Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">টোন</h3>
          </div>

          {/* Persona Choices */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'friendly', title: 'বন্ধুত্বপূর্ণ' },
              { id: 'professional', title: 'পেশাদার' },
              { id: 'enthusiastic', title: 'উৎসাহী' },
              { id: 'humorous', title: 'কৌতুকপূর্ণ' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAiPersona(p.id as any)}
                className={`p-3 rounded-lg text-left border ${
                  aiPersona === p.id
                    ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <div className="text-xs flex items-center justify-between">
                  <span>{p.title}</span>
                  {aiPersona === p.id && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            ))}
          </div>

          {/* Language Mode */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              ভাষা
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bangla', label: 'বাংলা' },
                { id: 'banglish', label: 'বাংলিশ' },
                { id: 'auto', label: 'অটো' }
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
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">দরদাম ও ডেলিভারি</h3>
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
            <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              সেভের পর এই স্লাইডার অনুযায়ী এআই ধাপে ধাপে ছাড় দেবে। Min Price-এর নিচে নামবে না।
            </p>
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
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">
            অতিরিক্ত নির্দেশনা
          </h3>
        </div>
        <Textarea
          value={customSystemPrompt}
          onChange={e => setCustomSystemPrompt(e.target.value)}
          placeholder="যেমন: আমাদের পণ্যগুলো শতভাগ অরিজিনাল। পাইকারি অর্ডারের জন্য ০১৭XXXXXXXX নম্বরে যোগাযোগ করতে বলুন।"
          className="min-h-[100px] rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-xs leading-relaxed"
        />
        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          সেভের পর এই নির্দেশনা রিপ্লাইয়ের ইমোজি, ফরম্যাট, সম্বোধন ও অর্ডার সামারিতে প্রাধান্য পাবে। দাম, স্টক ও নিরাপত্তা নিয়ম অপরিবর্তিত থাকবে।
        </p>
      </div>
    </div>
  );
}
