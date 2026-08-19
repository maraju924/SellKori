import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Power,
  Clock3,
  MessageSquare,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Radio,
  Moon
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig, BusinessFeatures } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData } from '../../lib/utils';
import {
  BooleanFeatureKey,
  countEnabled,
  FEATURE_CATALOG,
  FEATURE_GROUPS,
  FEATURE_PRESETS,
  FeatureDefinition,
  isQuietHoursNow,
  mergeFeatures,
  shouldRunAi
} from '../../lib/featureFlags';

interface MerchantFeaturesProps {
  business: BusinessConfig;
  onNavigateTab?: (tab: string) => void;
  onFeaturesChange?: (features: BusinessFeatures) => void;
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          on ? 'left-5.5 translate-x-0 right-0.5 left-auto' : 'left-0.5'
        }`}
        style={{ left: on ? 'auto' : 2, right: on ? 2 : 'auto' }}
      />
    </div>
  );
}

export function MerchantFeatures({ business, onNavigateTab, onFeaturesChange }: MerchantFeaturesProps) {
  const [features, setFeatures] = useState<BusinessFeatures>(() => mergeFeatures(business.features));
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const savingRef = useRef(false);
  const featuresRef = useRef(features);
  featuresRef.current = features;

  useEffect(() => {
    setFeatures(mergeFeatures(business.features));
  }, [business.features]);

  const stats = countEnabled(features);
  const aiLive = shouldRunAi(features);
  const quietNow = isQuietHoursNow(features);

  const persist = async (next: BusinessFeatures, silent = false) => {
    if (!business?.id || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        features: cleanFirestoreData(next),
        updatedAt: serverTimestamp()
      };
      if (typeof next.autoCourierBookingEnabled === 'boolean') {
        payload.courierConfig = {
          ...(business.courierConfig || {}),
          autoBooking: next.autoCourierBookingEnabled !== false
        };
      }
      await setDoc(doc(db, 'businesses', business.id), payload, { merge: true });
      onFeaturesChange?.(next);
      setLastSavedAt(Date.now());
      if (!silent) {
        toast.success('কন্ট্রোল সেন্টার আপডেট হয়েছে', {
          description: 'মেসেঞ্জার, অর্ডার ও এআই এই মুহূর্তে নতুন নিয়ম মানবে।'
        });
      }
    } catch (e: any) {
      console.error('[Feature switchboard save]', e);
      toast.error(e?.message ? `সংরক্ষণ ব্যর্থ: ${e.message}` : 'সেটিংস সেভ করা যায়নি');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const patch = (partial: Partial<BusinessFeatures>, silent = true) => {
    const next = mergeFeatures({ ...featuresRef.current, ...partial });
    setFeatures(next);
    onFeaturesChange?.(next);
    void persist(next, silent);
  };

  const toggle = (key: BooleanFeatureKey) => {
    const current = mergeFeatures(features);
    patch({ [key]: current[key] === false }, true);
  };

  const applyPreset = (id: string) => {
    const preset = FEATURE_PRESETS.find(p => p.id === id);
    if (!preset) return;
    patch(preset.patch, false);
    toast.message(`${preset.title} চালু করা হয়েছে`);
  };

  const filteredCatalog = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return FEATURE_CATALOG;
    return FEATURE_CATALOG.filter(f =>
      f.title.toLowerCase().includes(q) ||
      f.desc.toLowerCase().includes(q) ||
      f.impact.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-zinc-950 via-zinc-900 to-orange-950 text-white p-6 md:p-8 shadow-xl">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 text-orange-200 border-white/10 font-bold text-[10px] uppercase tracking-wider">
                Command Center
              </Badge>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full ${
                aiLive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${aiLive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {aiLive ? 'এআই অনলাইন' : quietNow ? 'নীরব সময় চলছে' : 'এআই অফলাইন'}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              ফিচার সুইচবোর্ড ও কন্ট্রোল
            </h2>
            <p className="text-xs md:text-sm text-zinc-300 max-w-xl leading-relaxed">
              এখান থেকে এআই, অর্ডার, ছবি, কুরিয়ার, ব্রডকাস্ট ও নীরব সময় — সবকিছু এক জায়গায় চালু/বন্ধ করুন। পরিবর্তন সাথে সাথে লাইভ সিস্টেমে প্রয়োগ হয়।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3 min-w-[120px]">
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">মডিউল লাইভ</div>
              <div className="text-2xl font-black text-white">{stats.on}<span className="text-sm text-zinc-400">/{stats.total}</span></div>
            </div>
            <Button
              type="button"
              onClick={() => patch({ aiEnabled: features.aiEnabled === false }, false)}
              className={`h-12 px-5 rounded-2xl font-black text-xs ${
                features.aiEnabled === false
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <Power className="w-4 h-4 mr-1.5" />
              {features.aiEnabled === false ? 'এআই চালু করুন' : 'এআই কিল সুইচ'}
            </Button>
            <Button
              type="button"
              onClick={() => persist(features, false)}
              disabled={isSaving}
              className="h-12 px-5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? 'সেভ হচ্ছে...' : 'সব সেটিংস সেভ'}
            </Button>
          </div>
        </div>
        {lastSavedAt && (
          <p className="relative z-10 mt-4 text-[11px] text-zinc-400 font-medium">
            শেষ আপডেট {new Date(lastSavedAt).toLocaleTimeString('bn-BD')}
          </p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="মডিউল খুঁজুন — দরদাম, ছবি, কুরিয়ার, ব্রডকাস্ট..."
            className="pl-9 h-11 rounded-2xl bg-white dark:bg-zinc-900 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FEATURE_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="h-11 px-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[11px] font-black hover:border-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
              title={preset.desc}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'এআই রিপ্লাই', on: features.aiEnabled !== false && features.messengerRepliesEnabled !== false, icon: Bot },
          { label: 'অটো অর্ডার', on: features.autoOrderEnabled !== false, icon: CheckCircle2 },
          { label: 'কুরিয়ার অটো-বুক', on: features.autoCourierBookingEnabled !== false, icon: Radio },
          { label: 'নীরব সময়', on: features.quietHoursEnabled === true, icon: Moon }
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.on ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/50' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-zinc-500">{card.label}</div>
              <div className={`text-sm font-black ${card.on ? 'text-emerald-600' : 'text-zinc-400'}`}>{card.on ? 'সক্রিয়' : 'বন্ধ'}</div>
            </div>
          </div>
        ))}
      </div>

      {FEATURE_GROUPS.map(group => {
        const items = filteredCatalog.filter(f => f.group === group.id);
        if (items.length === 0) return null;
        return (
          <section key={group.id} className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                {group.title}
              </h3>
              <p className="text-[11px] text-zinc-500">{group.hint}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map(feat => (
                <FeatureCard
                  key={feat.key}
                  feat={feat}
                  on={features[feat.key] !== false}
                  onToggle={() => toggle(feat.key)}
                  onJump={feat.tab && onNavigateTab ? () => onNavigateTab(feat.tab!) : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-orange-500" />
            <h3 className="font-black text-sm">নীরব সময় শিডিউল (বাংলাদেশ সময়)</h3>
          </div>
          <p className="text-[11px] text-zinc-500">
            চালু থাকলে এই সময়ে এআই অফলাইন মেসেজ দিবে এবং নতুন অর্ডার নেবে না।
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-600">শুরু</label>
              <Input
                type="time"
                value={features.quietHoursStart || '22:00'}
                onChange={e => patch({ quietHoursStart: e.target.value || '22:00' })}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-600">শেষ</label>
              <Input
                type="time"
                value={features.quietHoursEnd || '08:00'}
                onChange={e => patch({ quietHoursEnd: e.target.value || '08:00' })}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          {quietNow && (
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              এখন নীরব সময় চলছে
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-500" />
            <h3 className="font-black text-sm">অফলাইন / নীরব মেসেজ</h3>
          </div>
          <p className="text-[11px] text-zinc-500">
            এআই বন্ধ বা নীরব সময়ে কাস্টমার এই মেসেজটি পাবে (মেসেঞ্জার রিপ্লাই চালু থাকলে)।
          </p>
          <Textarea
            value={features.offlineMessage || ''}
            onChange={e => setFeatures(prev => ({ ...prev, offlineMessage: e.target.value }))}
            onBlur={() => persist(featuresRef.current, true)}
            placeholder="ধন্যবাদ! আমাদের টিম শীঘ্রই উত্তর দিবে।"
            className="min-h-[96px] rounded-2xl text-xs"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-dashed border-orange-300/70 dark:border-orange-900 bg-orange-50/40 dark:bg-orange-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-black text-sm text-zinc-900 dark:text-white">সিস্টেম কীভাবে মানবে</h4>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed mt-1">
              এই সুইচগুলো মেসেঞ্জার ওয়েবহুক, টেস্ট চ্যাট, ব্রডকাস্ট, স্টেডফাস্ট অটো-বুক এবং স্টক কাটার লজিক সরাসরি কন্ট্রোল করে। শুধু সেভ নয় — বন্ধ মানে সত্যিই বন্ধ।
            </p>
          </div>
        </div>
        {onNavigateTab && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onNavigateTab('test-chat')}
            className="rounded-2xl text-xs font-black h-10"
          >
            টেস্ট চ্যাটে যাচাই করুন
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FeatureCard({
  feat,
  on,
  onToggle,
  onJump
}: {
  key?: React.Key;
  feat: FeatureDefinition;
  on: boolean;
  onToggle: () => void;
  onJump?: () => void;
}): React.ReactElement {
  return (
    <div
      className={`p-4 rounded-3xl border transition-all ${
        on
          ? 'bg-white dark:bg-zinc-900 border-orange-500/25 shadow-xs'
          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onToggle} className="text-left flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-sm text-zinc-900 dark:text-white">{feat.title}</h4>
            {feat.danger && (
              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-none text-[9px] font-black">
                MASTER
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{feat.desc}</p>
          <p className="text-[10px] font-bold text-orange-700/80 dark:text-orange-400/80">{feat.impact}</p>
        </button>
        <button type="button" onClick={onToggle} aria-pressed={on} aria-label={feat.title} className="mt-0.5">
          <Toggle on={on} />
        </button>
      </div>
      {onJump && (
        <button
          type="button"
          onClick={onJump}
          className="mt-3 text-[11px] font-black text-zinc-500 hover:text-orange-600 inline-flex items-center gap-1"
        >
          <Sliders className="w-3 h-3" />
          সম্পর্কিত সেটিংস
        </button>
      )}
    </div>
  );
}
