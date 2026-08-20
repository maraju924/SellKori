import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Plus,
  Trash2,
  Power,
  Save,
  RefreshCw,
  KeyRound,
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { parseJsonResponse } from '../../lib/safeJson';

interface PooledKey {
  key: string;
  label: string;
  enabled: boolean;
}

export function AdminAiEngine() {
  const [geminiKeys, setGeminiKeys] = useState<PooledKey[]>([]);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('openrouter/auto');
  const [openAiKey, setOpenAiKey] = useState('');
  const [openAiModel, setOpenAiModel] = useState('gpt-4o-mini');

  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingIdx, setTestingIdx] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'settings'));
        if (snap.exists()) {
          const d = snap.data();
          if (Array.isArray(d.geminiKeys)) {
            setGeminiKeys(d.geminiKeys.map((k: any) => ({
              key: String(k?.key || ''),
              label: String(k?.label || 'Gemini Key'),
              enabled: k?.enabled !== false,
            })).filter((k: PooledKey) => k.key));
          }
          if (d.openRouterKey) setOpenRouterKey(d.openRouterKey);
          if (d.openRouterModel) setOpenRouterModel(d.openRouterModel);
          if (d.openAiKey) setOpenAiKey(d.openAiKey);
          if (d.openAiModel) setOpenAiModel(d.openAiModel);
        }
      } catch (e) {
        console.error('[AdminAiEngine] load error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persist = async (keys: PooledKey[], extra: Record<string, any> = {}) => {
    await setDoc(doc(db, 'system', 'settings'), {
      geminiKeys: keys.map(k => ({ key: k.key.trim(), label: k.label.trim(), enabled: k.enabled })),
      openRouterKey: openRouterKey.trim(),
      openRouterModel: openRouterModel.trim() || 'openrouter/auto',
      openAiKey: openAiKey.trim(),
      openAiModel: openAiModel.trim() || 'gpt-4o-mini',
      ...extra,
    }, { merge: true });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await persist(geminiKeys);
      toast.success('AI ইঞ্জিন পুল সংরক্ষিত হয়েছে!', {
        description: 'পরবর্তী মেসেজ থেকেই নতুন কী-অর্ডার কার্যকর হবে (সর্বোচ্চ ১ মিনিট ক্যাশ)।'
      });
    } catch (e: any) {
      toast.error(e.message || 'সংরক্ষণ ব্যর্থ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddKey = () => {
    const key = newKey.trim();
    if (!key) {
      toast.error('API Key দিন');
      return;
    }
    if (geminiKeys.some(k => k.key === key)) {
      toast.error('এই কী আগেই যুক্ত আছে');
      return;
    }
    setGeminiKeys([...geminiKeys, {
      key,
      label: newLabel.trim() || `Gemini Key ${geminiKeys.length + 1}`,
      enabled: true
    }]);
    setNewKey('');
    setNewLabel('');
    toast.info('তালিকায় যুক্ত হয়েছে — এবার "সব সেভ করুন" চাপুন');
  };

  const handleTestKey = async (idx: number) => {
    setTestingIdx(idx);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKeys[idx].key })
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data.success) {
        setTestResults(prev => ({ ...prev, [idx]: { success: true, message: `সচল! ${data.latencyMs}ms` } }));
      } else {
        setTestResults(prev => ({ ...prev, [idx]: { success: false, message: data.error || 'ব্যর্থ' } }));
      }
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [idx]: { success: false, message: e.message } }));
    } finally {
      setTestingIdx(null);
    }
  };

  const moveKey = (idx: number, dir: -1 | 1) => {
    const next = [...geminiKeys];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setGeminiKeys(next);
    setTestResults({});
  };

  const maskKey = (k: string) => k.length > 12 ? `${k.slice(0, 6)}••••${k.slice(-4)}` : '••••••';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-white">AI ইঞ্জিন ও API পুল</h2>
            <Badge className="bg-emerald-950/60 text-emerald-300 border-none font-bold text-xs">Auto Failover</Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            একাধিক Gemini কী চেইন করুন — একটার ফ্রি লিমিট শেষ হলে পরেরটা স্বয়ংক্রিয়ভাবে চলবে। সব Gemini ব্যর্থ হলে OpenRouter, তারপর OpenAI।
          </p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl h-11 px-6"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সব সেভ করুন'}
        </Button>
      </div>

      {/* Gemini Key Pool */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-2xl bg-blue-950/60 text-blue-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">Gemini কী পুল ({geminiKeys.length} টি)</h3>
            <p className="text-[11px] text-zinc-500">উপরের কী আগে ব্যবহৃত হয় — লিমিট/এররে পরেরটায় রোটেট করে (কোটা হিটে ১৫ মিনিট, ভুল কী-তে ৬ ঘণ্টা কুলডাউন)</p>
          </div>
        </div>

        {geminiKeys.length === 0 && (
          <p className="text-[11px] text-zinc-500 bg-zinc-800/40 rounded-2xl p-3 border border-zinc-800">
            এখনো কোনো কী নেই। ৫-৬টি ফ্রি Gemini কী যোগ করুন — নিজের ব্যবহার সম্পূর্ণ ফ্রি রাখতে পারবেন।
          </p>
        )}

        <div className="space-y-2">
          {geminiKeys.map((k, idx) => (
            <div key={k.key} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl border border-zinc-800 bg-zinc-800/40">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-lg bg-zinc-700 text-zinc-300 flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-white truncate">{k.label}</p>
                  <p className="text-[10px] font-mono text-zinc-500">{maskKey(k.key)}</p>
                </div>
                {testResults[idx] && (
                  <span className={`text-[10px] font-bold flex items-center gap-1 shrink-0 ${testResults[idx].success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResults[idx].success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span className="max-w-[160px] truncate">{testResults[idx].message}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge className={k.enabled ? 'bg-emerald-950/60 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}>
                  {k.enabled ? 'সক্রিয়' : 'বন্ধ'}
                </Badge>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-zinc-400" onClick={() => moveKey(idx, -1)} title="উপরে">
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-zinc-400" onClick={() => moveKey(idx, 1)} title="নিচে">
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-zinc-400" onClick={() => setGeminiKeys(geminiKeys.map((x, i) => i === idx ? { ...x, enabled: !x.enabled } : x))} title="চালু/বন্ধ">
                  <Power className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 rounded-xl text-[10px] font-bold text-blue-400" disabled={testingIdx === idx} onClick={() => handleTestKey(idx)}>
                  {testingIdx === idx ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'টেস্ট'}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-red-400" onClick={() => setGeminiKeys(geminiKeys.filter((_, i) => i !== idx))} title="মুছুন">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 pt-2 border-t border-zinc-800">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="লেবেল (যেমন: Gmail-1)"
            className="rounded-2xl text-xs h-10 bg-zinc-800 border-zinc-700 text-white"
          />
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="AIza... (Gemini API Key)"
            type="password"
            className="rounded-2xl text-xs h-10 font-mono bg-zinc-800 border-zinc-700 text-white"
          />
          <Button onClick={handleAddKey} className="rounded-2xl h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs">
            <Plus className="w-4 h-4 mr-1" /> যোগ করুন
          </Button>
        </div>
      </div>

      {/* Fallback Providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-purple-950/60 text-purple-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">OpenRouter (ফলব্যাক ১)</h3>
              <p className="text-[11px] text-zinc-500">সব Gemini কী ব্যর্থ হলে এটি চলবে</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <label className="font-bold text-zinc-400">API Key</label>
            <Input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="font-mono text-xs h-10 rounded-xl bg-zinc-800 border-zinc-700 text-white"
            />
            <label className="font-bold text-zinc-400">Model</label>
            <Input
              value={openRouterModel}
              onChange={(e) => setOpenRouterModel(e.target.value)}
              placeholder="openrouter/auto"
              className="font-mono text-xs h-10 rounded-xl bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">OpenAI (ফলব্যাক ২)</h3>
              <p className="text-[11px] text-zinc-500">শেষ ভরসা — OpenRouter-ও ব্যর্থ হলে</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <label className="font-bold text-zinc-400">API Key</label>
            <Input
              type="password"
              value={openAiKey}
              onChange={(e) => setOpenAiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="font-mono text-xs h-10 rounded-xl bg-zinc-800 border-zinc-700 text-white"
            />
            <label className="font-bold text-zinc-400">Model</label>
            <Input
              value={openAiModel}
              onChange={(e) => setOpenAiModel(e.target.value)}
              placeholder="gpt-4o-mini"
              className="font-mono text-xs h-10 rounded-xl bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-[11px] text-zinc-400 leading-relaxed space-y-1.5">
        <p className="font-black text-zinc-200 flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-blue-400" /> ফেইলওভার যেভাবে কাজ করে</p>
        <p>১. তালিকার প্রথম সক্রিয় Gemini কী দিয়ে উত্তর তৈরি হয়। কোটা (429) শেষ হলে সেই কী ১৫ মিনিটের জন্য বিশ্রামে যায়, পরের কী সাথে সাথে দায়িত্ব নেয় — কাস্টমার কিছুই টের পায় না।</p>
        <p>২. ভুল/বাতিল কী ৬ ঘণ্টার কুলডাউনে যায়, তাই একটা মরা কী বারবার সময় নষ্ট করে না।</p>
        <p>৩. সব Gemini কী ব্যর্থ হলে OpenRouter, তারপর OpenAI দিয়ে উত্তর যায় (ছবি/ভয়েস তখন টেক্সট-অনলি হয়)।</p>
        <p>৪. ৫-৬টি ফ্রি Gemini কী দিলে দিনে কয়েক হাজার মেসেজ সম্পূর্ণ ফ্রি-তে চালানো যায়।</p>
      </div>
    </div>
  );
}
