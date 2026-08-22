import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Sparkles, 
  ShieldAlert, 
  Radio, 
  Globe, 
  CreditCard,
  Zap,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Cpu,
  RefreshCw,
  Sliders,
  Check,
  Server
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { db } from '../../lib/firebase';
import { getDocAcrossPanelDbs } from '../../lib/panelDb';
import { deleteField, doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { AVAILABLE_GEMINI_MODELS, testGeminiApiKeyAndModel } from '../../lib/gemini';

export function AdminSystemSettings() {
  const [announcement, setAnnouncement] = useState('স্বাগতম সেলকরি এআই প্ল্যাটফর্মে! নতুন জেমিনি ৩.৭ ফ্ল্যাশ ইঞ্জিন এখন লাইভ।');
  const [tokenRatePerLakh, setTokenRatePerLakh] = useState<number>(20);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  // Gemini Dynamic Configuration
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultAiModel, setDefaultAiModel] = useState('gemini-3.7-flash');
  const [customModelId, setCustomModelId] = useState('');
  const [isCustomModelActive, setIsCustomModelActive] = useState(false);
  const [aiTemperature, setAiTemperature] = useState<number>(0.4);
  const [aiMaxTokens, setAiMaxTokens] = useState<number>(1024);

  // Diagnostic Test State
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    responseText?: string;
    error?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing system config on mount
  useEffect(() => {
    async function loadConfig() {
      if (!db) {
        setIsLoading(false);
        return;
      }
      try {
        const [publicDoc, secretDoc] = await Promise.all([
          getDocAcrossPanelDbs('system_config', 'public'),
          getDocAcrossPanelDbs('system', 'settings'),
        ]);
        const publicData = publicDoc?.exists() ? (publicDoc.data() || {}) : {};
        const secretData = secretDoc?.exists() ? (secretDoc.data() || {}) : {};
        const data = { ...publicData, ...secretData };
        if (publicDoc?.exists() || secretDoc?.exists()) {
          if (data.globalAnnouncement) setAnnouncement(data.globalAnnouncement);
          if (data.tokenRatePerLakh) setTokenRatePerLakh(Number(data.tokenRatePerLakh));
          // Public fallback migrates keys saved by older releases.
          if (secretData.geminiApiKey || publicData.geminiApiKey) {
            setGeminiApiKey(secretData.geminiApiKey || publicData.geminiApiKey);
          }
          if (data.defaultAiModel) {
            const isStandard = AVAILABLE_GEMINI_MODELS.some(m => m.id === data.defaultAiModel);
            if (isStandard) {
              setDefaultAiModel(data.defaultAiModel);
            } else {
              setIsCustomModelActive(true);
              setCustomModelId(data.defaultAiModel);
            }
          }
          if (data.aiTemperature !== undefined) setAiTemperature(Number(data.aiTemperature));
          if (data.aiMaxTokens !== undefined) setAiMaxTokens(Number(data.aiMaxTokens));
          if (data.maintenanceMode !== undefined) setMaintenanceMode(Boolean(data.maintenanceMode));
        }
      } catch (e) {
        console.error("Error loading system config:", e);
      } finally {
        setIsLoading(false);
      }
    }

    loadConfig();
  }, []);

  const handleTestKey = async () => {
    setIsTestingKey(true);
    setTestResult(null);

    const activeModel = isCustomModelActive && customModelId.trim()
      ? customModelId.trim()
      : defaultAiModel;

    try {
      const res = await testGeminiApiKeyAndModel(geminiApiKey, activeModel);
      setTestResult(res);
      if (res.success) {
        toast.success(`Gemini API টেস্ট সফল! রেসপন্স টাইম: ${res.latencyMs}ms`);
      } else {
        toast.error(`টেস্ট ব্যর্থ: ${res.error}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err?.message || 'টেস্ট চলাকালে অজানা ত্রুটি ঘটেছে।'
      });
      toast.error('টেস্ট কল ব্যর্থ হয়েছে');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const activeModel = isCustomModelActive && customModelId.trim()
      ? customModelId.trim()
      : defaultAiModel;

    const publicPayload = {
      globalAnnouncement: announcement,
      announcement,
      tokenRatePerLakh: Number(tokenRatePerLakh),
      tokenPricePerLakh: Number(tokenRatePerLakh),
      maintenanceMode,
      defaultAiModel: activeModel,
      aiTemperature: Number(aiTemperature),
      aiMaxTokens: Number(aiMaxTokens),
      updatedAt: Date.now(),
      updatedBy: 'Admin Console',
      // Explicitly remove credentials left by older deployments.
      geminiApiKey: deleteField(),
    };
    const secretPayload = {
      ...publicPayload,
      geminiApiKey: geminiApiKey.trim(),
    };

    try {
      await Promise.all([
        setDoc(doc(db, 'system_config', 'public'), publicPayload, { merge: true }),
        setDoc(doc(db, 'system', 'settings'), secretPayload, { merge: true }),
      ]);
      toast.success('সিস্টেম ও জেমিনি এআই সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (e) {
      console.error(e);
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Top Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black">
              সিস্টেম ও জেমিনি এআই এপিআই সেটিংস
            </h2>
            <Badge className="bg-orange-950/60 text-orange-400 border-none font-bold text-xs">
              SaaS Central AI Hub
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            প্ল্যাটফর্মের গ্লোবাল Gemini API Key পরিবর্তন, মডেল সিলেক্ট, রেসপন্স প্যারামিটার এবং রিয়েল-টাইম টেস্ট করুন।
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20 active:scale-95 transition-all"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সকল সেটিংস সেভ করুন'}
        </Button>
      </div>

      {/* Primary Section: Dynamic Gemini API Key & Model Hub */}
      <div className="bg-linear-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">গ্লোবাল জেমিনি এআই ইঞ্জিন কনফিগারেশন</h3>
              <p className="text-xs text-zinc-400">এই কী এবং মডেল সকল মার্চেন্টের পাবলিক চ্যাট ও মেসেঞ্জারে ডিফল্ট হিসেবে কাজ করবে</p>
            </div>
          </div>

          <Badge className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono text-[11px] self-start sm:self-auto">
            @google/genai SDK v1.0+
          </Badge>
        </div>

        {/* API Key Input Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-orange-400" />
              Dynamic Gemini API Key
            </label>
            <span className="text-[11px] text-zinc-400">
              ফাঁকা রাখলে স্বয়ংক্রিয়ভাবে সার্ভার এনভায়রনমেন্ট ভেরিয়েবল (<code className="text-orange-300 bg-zinc-800 px-1.5 py-0.5 rounded">GEMINI_API_KEY</code>) ব্যবহৃত হবে।
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={e => {
                  setGeminiApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="h-11 rounded-2xl bg-zinc-800/90 border-zinc-700 text-xs text-white font-mono pr-10 focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              type="button"
              onClick={handleTestKey}
              disabled={isTestingKey}
              variant="outline"
              className="h-11 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white font-bold text-xs shrink-0 flex items-center gap-2"
            >
              {isTestingKey ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>যাচাই হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>API কী টেস্ট করুন</span>
                </>
              )}
            </Button>
          </div>

          {/* Test Diagnostic Result Banner */}
          {testResult && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-300 ${
              testResult.success 
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800 text-rose-200'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>{testResult.success ? 'API Key সচল এবং সক্রিয় রয়েছে!' : 'API সংযোগে সমস্যা পাওয়া গেছে:'}</span>
                  {testResult.success && (
                    <span className="font-mono text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded-md text-emerald-300">
                      Latency: {testResult.latencyMs} ms
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

        {/* Model Selection Dropdown & Detailed Overview */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-orange-400" />
              গ্লোবাল ডিফল্ট জেমিনি মডেল নির্বাচন (Select AI Model)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400">সক্রিয় মডেল:</span>
              <Badge className="bg-orange-950/80 text-orange-400 border border-orange-800/80 font-mono text-[11px] font-bold">
                {isCustomModelActive ? (customModelId || 'Custom Manual') : defaultAiModel}
              </Badge>
            </div>
          </div>

          {/* Categorized Dropdown Select */}
          <div className="relative">
            <select
              value={isCustomModelActive ? '__custom__' : defaultAiModel}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setIsCustomModelActive(true);
                } else {
                  setIsCustomModelActive(false);
                  setDefaultAiModel(val);
                }
                setTestResult(null);
              }}
              className="w-full h-12 rounded-2xl bg-zinc-800/90 border border-zinc-700 hover:border-orange-500/60 focus:border-orange-500 text-white text-xs font-semibold px-4 cursor-pointer outline-none transition-all shadow-inner"
            >
              <optgroup label="⚡ Flash Models (Fast & Conversational - Recommended for eCommerce)">
                {AVAILABLE_GEMINI_MODELS.filter(m => m.category === 'fast').map(model => (
                  <option key={model.id} value={model.id} className="bg-zinc-900 text-white py-1">
                    {model.name} — {model.id} ({model.latencyBadge} • {model.tokenCostBadge}){model.isPopular ? ' ★ RECOMMENDED' : ''}
                  </option>
                ))}
              </optgroup>

              <optgroup label="🧠 Pro & Deep Reasoning Models (Complex Logic & Policy Analysis)">
                {AVAILABLE_GEMINI_MODELS.filter(m => m.category === 'reasoning').map(model => (
                  <option key={model.id} value={model.id} className="bg-zinc-900 text-white py-1">
                    {model.name} — {model.id} ({model.latencyBadge} • {model.tokenCostBadge})
                  </option>
                ))}
              </optgroup>

              <optgroup label="🎨 Multimodal, Audio & Specialized Models (Vision, Speech & Translation)">
                {AVAILABLE_GEMINI_MODELS.filter(m => m.category === 'specialized').map(model => (
                  <option key={model.id} value={model.id} className="bg-zinc-900 text-white py-1">
                    {model.name} — {model.id} ({model.latencyBadge} • {model.tokenCostBadge})
                  </option>
                ))}
              </optgroup>

              <optgroup label="⚙️ Advanced / Custom Preview Model">
                <option value="__custom__" className="bg-zinc-900 text-amber-400 font-bold py-1">
                  ✏️ ম্যানুয়াল কাস্টম মডেল আইডি প্রবেশ করান (Custom Model String)
                </option>
              </optgroup>
            </select>
          </div>

          {/* Active Model Specification Card */}
          {!isCustomModelActive && (() => {
            const current = AVAILABLE_GEMINI_MODELS.find(m => m.id === defaultAiModel) || AVAILABLE_GEMINI_MODELS[0];
            return (
              <div className="p-4 rounded-2xl bg-zinc-800/60 border border-zinc-700/80 space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-700/60">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{current.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                      {current.id}
                    </span>
                    {current.isPopular && (
                      <Badge className="bg-orange-600 text-white text-[9px] font-bold uppercase">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                      ⚡ স্পিড: {current.latencyBadge}
                    </span>
                    <span className="text-amber-300 font-mono text-[11px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                      খরচ: {current.tokenCostBadge}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-[11px] text-zinc-400 font-medium">বিবরণ ও কার্যকারিতা:</span>
                    <p className="text-zinc-200 leading-relaxed text-[11px]">
                      {current.description}
                    </p>
                  </div>
                  <div className="space-y-1 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">উপযুক্ত ক্ষেত্র:</span>
                    <p className="text-orange-400 font-medium text-[11px]">
                      {current.recommendedFor || 'All-Purpose eCommerce Chat'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Custom Model Override Toggle & Input */}
          <div className="p-4 rounded-2xl bg-zinc-800/40 border border-zinc-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isCustomModelActive}
                  onChange={e => setIsCustomModelActive(e.target.checked)}
                  className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                />
                কাস্টম বা প্রিভিউ মডেল আইডি ম্যানুয়ালি এন্টার করুন (Custom Model Override)
              </label>
              {isCustomModelActive && (
                <Badge className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px]">
                  Custom Mode Active
                </Badge>
              )}
            </div>

            {isCustomModelActive && (
              <div className="pt-2 animate-in fade-in duration-200 space-y-2">
                <Input
                  value={customModelId}
                  onChange={e => {
                    setCustomModelId(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="e.g. gemini-3.7-flash or gemini-3.1-pro-preview"
                  className="h-11 rounded-xl bg-zinc-800 border-zinc-700 font-mono text-xs text-white"
                />
                <p className="text-[10px] text-zinc-400">
                  গুগল এআই স্টুডিওর যে কোনো নির্দিষ্ট মডেল স্ট্রিং এখানে সরাসরি প্রবেশ করাতে পারেন।
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Hyperparameter Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-orange-400" />
                টেম্পারেচার (AI Temperature / Creativity)
              </label>
              <span className="font-mono font-bold text-orange-400">{aiTemperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={aiTemperature}
              onChange={e => setAiTemperature(parseFloat(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>0.0 (নিখুঁত ও ফিক্সড প্রাইস)</span>
              <span>0.4 (রিকমেন্ডেড সেলস)</span>
              <span>1.0 (বেশি ক্রিয়েটিভ)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-xs text-zinc-300 block">
              ম্যাক্স আউটপুট টোকেন সীমা (Max Output Tokens)
            </label>
            <select
              value={aiMaxTokens}
              onChange={e => setAiMaxTokens(Number(e.target.value))}
              className="w-full h-10 rounded-xl bg-zinc-800 border border-zinc-700 px-3 text-xs text-white font-mono"
            >
              <option value="512">512 Tokens (খুব দ্রুত ও সংক্ষিপ্ত উত্তর)</option>
              <option value="1024">1024 Tokens (স্ট্যান্ডার্ড কমার্স রেসপন্স)</option>
              <option value="2048">2048 Tokens (দীর্ঘ বিস্তারিত আলোচনা)</option>
              <option value="4096">4096 Tokens (সর্বোচ্চ কনটেন্ট লেন্থ)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Secondary Settings: Announcements, Pricing & Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Announcement & Banner Config */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-orange-950/60 text-orange-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">গ্লোবাল ঘোষণা ব্যানার (Ticker)</h3>
              <p className="text-[11px] text-zinc-400">সকল মার্চেন্টের ড্যাশবোর্ডের শীর্ষে প্রদর্শিত হবে</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              placeholder="ঘোষণা মেসেজ..."
              className="min-h-[100px] rounded-2xl bg-zinc-800 border-zinc-700 text-xs text-white"
            />
          </div>
        </div>

        {/* Pricing & Maintenance Control */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">টোকেন মূল্য ও রক্ষণাবেক্ষণ</h3>
              <p className="text-[11px] text-zinc-400">টোকেন ট্যারিফ এবং সিস্টেম সার্ভিস মোড</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-300">প্রতি ১ লক্ষ টোকেনের মূল্য (টাকা)</label>
              <Input
                type="number"
                value={tokenRatePerLakh}
                onChange={e => setTokenRatePerLakh(Number(e.target.value))}
                className="h-10 rounded-xl bg-zinc-800 border-zinc-700 font-mono text-xs text-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-between p-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/60">
              <div>
                <p className="font-bold text-white">মেইনটেন্যান্স মোড (Maintenance)</p>
                <p className="text-[10px] text-zinc-400">জরুরি কাজের সময় নতুন অর্ডার ও চ্যাট পজ রাখুন</p>
              </div>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={e => setMaintenanceMode(e.target.checked)}
                className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
