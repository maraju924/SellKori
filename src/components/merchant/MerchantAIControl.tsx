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
  ShieldAlert,
  Key,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { AVAILABLE_GEMINI_MODELS, testGeminiApiKeyAndModel } from '../../lib/gemini';

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

  // Dynamic Gemini Configuration for this store
  const [selectedAiModel, setSelectedAiModel] = useState<string>(business.selectedAiModel || 'gemini-3.7-flash');
  const [useOwnApiKey, setUseOwnApiKey] = useState<boolean>(business.useOwnApiKey || false);
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState<string>(business.customGeminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiTemperature, setAiTemperature] = useState<number>(business.aiTemperature ?? 0.4);
  const [aiMaxTokens, setAiMaxTokens] = useState<number>(business.aiMaxTokens ?? 1024);

  // Diagnostic Test State
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    responseText?: string;
    error?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const handleTestKey = async () => {
    setIsTestingKey(true);
    setTestResult(null);

    const keyToTest = useOwnApiKey ? customGeminiApiKey : '';
    try {
      const res = await testGeminiApiKeyAndModel(keyToTest, selectedAiModel);
      setTestResult(res);
      if (res.success) {
        toast.success(`জেমিনি সংযোগ সফল! রেসপন্স টাইম: ${res.latencyMs}ms`);
      } else {
        toast.error(`টেস্ট ব্যর্থ: ${res.error}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err?.message || 'টেস্ট চলাকালে ত্রুটি ঘটেছে।'
      });
      toast.error('টেস্ট কল ব্যর্থ হয়েছে');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        aiPersona,
        aiLanguage,
        bargainingSensitivity: Number(bargainingSensitivity),
        customSystemPrompt,
        selectedAiModel,
        useOwnApiKey: Boolean(useOwnApiKey),
        customGeminiApiKey: customGeminiApiKey.trim(),
        aiTemperature: Number(aiTemperature),
        aiMaxTokens: Number(aiMaxTokens),
        courierConfig: {
          ...(business.courierConfig || {}),
          deliveryChargeInsideDhaka: Number(deliveryInside),
          deliveryChargeOutsideDhaka: Number(deliveryOutside)
        }
      });
      toast.success('এআই ব্রেন ও জেমিনি সেটিংস সফলভাবে আপডেট হয়েছে!', {
        description: 'মেসেঞ্জার এবং পাবলিক চ্যাটে নতুন কনফিগারেশন তাৎক্ষণিক কার্যকর হয়েছে।'
      });
    } catch (e) {
      console.error(e);
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
              এআই সেলস ব্রেন ও জেমিনি মডেল কন্ট্রোল
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs font-mono">
              {selectedAiModel}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার শপের বটের জন্য জেমিনি মডেল সিলেক্ট করুন, নিজস্ব API Key ব্যবহার করুন এবং সেলস আচরণ নিয়ন্ত্রণ করুন।
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

      {/* Section: Gemini Model & API Key Selection */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">জেমিনি মডেল সিলেকশন (Gemini AI Model)</h3>
              <p className="text-[11px] text-zinc-500">আপনার শপের চ্যাটবট পরিচালনার জন্য উপযুক্ত মডেল বেছে নিন</p>
            </div>
          </div>

          <Badge variant="outline" className="text-[11px] font-mono self-start sm:self-auto">
            {useOwnApiKey ? 'Custom BYOK Active' : 'SaaS Pool Active'}
          </Badge>
        </div>

        {/* Model Selector Dropdown & Specification Overview */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-orange-500" />
              জেমিনি মডেল নির্বাচন (Select AI Model)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">নির্বাচিত:</span>
              <Badge className="bg-orange-50 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/80 font-mono text-[11px] font-bold">
                {selectedAiModel}
              </Badge>
            </div>
          </div>

          {/* Categorized Dropdown */}
          <div className="relative">
            <select
              value={selectedAiModel}
              onChange={e => {
                setSelectedAiModel(e.target.value);
                setTestResult(null);
              }}
              className="w-full h-12 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-500/60 focus:border-orange-500 text-zinc-900 dark:text-white text-xs font-semibold px-4 cursor-pointer outline-none transition-all shadow-xs"
            >
              <optgroup label="⚡ Flash Models (Fast & Conversational - Recommended for eCommerce)">
                {AVAILABLE_GEMINI_MODELS.filter(m => m.category === 'fast').map(model => (
                  <option key={model.id} value={model.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white py-1">
                    {model.name} — {model.id} ({model.latencyBadge} • {model.tokenCostBadge}){model.isPopular ? ' ★ RECOMMENDED' : ''}
                  </option>
                ))}
              </optgroup>

              <optgroup label="🧠 Pro & Deep Reasoning Models (Complex Logic & Deep Analysis)">
                {AVAILABLE_GEMINI_MODELS.filter(m => m.category === 'reasoning').map(model => (
                  <option key={model.id} value={model.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white py-1">
                    {model.name} — {model.id} ({model.latencyBadge} • {model.tokenCostBadge})
                  </option>
                ))}
              </optgroup>

              <optgroup label="🎨 Multimodal, Audio & Specialized Models (Vision, Speech & Translation)">
                {AVAILABLE_GEMINI_MODELS.filter(m => m.category === 'specialized').map(model => (
                  <option key={model.id} value={model.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white py-1">
                    {model.name} — {model.id} ({model.latencyBadge} • {model.tokenCostBadge})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Active Model Specification Card */}
          {(() => {
            const current = AVAILABLE_GEMINI_MODELS.find(m => m.id === selectedAiModel) || AVAILABLE_GEMINI_MODELS[0];
            return (
              <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">{current.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                      {current.id}
                    </span>
                    {current.isPopular && (
                      <Badge className="bg-orange-500 text-white text-[9px] font-bold uppercase">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                      ⚡ স্পিড: {current.latencyBadge}
                    </span>
                    <span className="text-amber-700 dark:text-amber-300 font-mono text-[11px] bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                      খরচ: {current.tokenCostBadge}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">বিবরণ ও কার্যকারিতা:</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                      {current.description}
                    </p>
                  </div>
                  <div className="space-y-1 bg-white dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">উপযুক্ত ক্ষেত্র:</span>
                    <p className="text-orange-600 dark:text-orange-400 font-medium text-[11px]">
                      {current.recommendedFor || 'All-Purpose eCommerce Live Chat'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Bring Your Own Key (BYOK) Section */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-zinc-900 dark:text-zinc-200 cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useOwnApiKey}
                  onChange={e => {
                    setUseOwnApiKey(e.target.checked);
                    setTestResult(null);
                  }}
                  className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                />
                আমার শপের জন্য নিজস্ব Gemini API Key ব্যবহার করব (BYOK)
              </label>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 ml-6">
                সক্রিয় থাকলে আপনার নিজস্ব গুগল এআই স্টুডিও কোটা থেকে কল হবে।
              </p>
            </div>

            {useOwnApiKey && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-none text-[10px]">
                BYOK Mode
              </Badge>
            )}
          </div>

          {useOwnApiKey && (
            <div className="space-y-2 pt-2 animate-in fade-in duration-200">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={customGeminiApiKey}
                    onChange={e => {
                      setCustomGeminiApiKey(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="AIzaSy... (আপনার নিজস্ব Gemini API Key)"
                    className="h-10 rounded-xl bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <Button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTestingKey}
                  variant="outline"
                  className="h-10 px-4 rounded-xl border-zinc-200 dark:border-zinc-700 font-bold text-xs shrink-0 flex items-center gap-1.5"
                >
                  {isTestingKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
                      <span>যাচাই...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>কী টেস্ট করুন</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Diagnostic Test Result */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-300 ${
                  testResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 flex-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>{testResult.success ? 'API Key ভ্যালিড এবং সক্রিয়!' : 'API সংযোগ ত্রুটি:'}</span>
                      {testResult.success && (
                        <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                          {testResult.latencyMs} ms
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-90">
                      {testResult.success ? testResult.responseText : testResult.error}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hyperparameter Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-orange-500" />
                ক্রিয়েটিভিটি / টেম্পারেচার (AI Temperature)
              </label>
              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{aiTemperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={aiTemperature}
              onChange={e => setAiTemperature(parseFloat(e.target.value))}
              className="w-full accent-orange-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>0.0 (নিখুঁত ও সুনির্দিষ্ট)</span>
              <span>0.4 (রিকমেন্ডেড)</span>
              <span>1.0 (বেশি ক্রিয়েটিভ)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-xs text-zinc-700 dark:text-zinc-300 block">
              ম্যাক্স আউটপুট টোকেন সীমা (Response Length)
            </label>
            <select
              value={aiMaxTokens}
              onChange={e => setAiMaxTokens(Number(e.target.value))}
              className="w-full h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-mono text-zinc-900 dark:text-white"
            >
              <option value="512">512 Tokens (খুব দ্রুত ও সংক্ষিপ্ত উত্তর)</option>
              <option value="1024">1024 Tokens (স্ট্যান্ডার্ড কমার্স রেসপন্স)</option>
              <option value="2048">2048 Tokens (দীর্ঘ আলোচনা)</option>
            </select>
          </div>
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
