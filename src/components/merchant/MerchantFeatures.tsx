import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Save,
  Search,
  Power,
  Clock3,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Moon
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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
        toast.success('সেভ হয়েছে');
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">ফিচার</h2>
          <span className="text-xs text-zinc-400">
            {aiLive ? 'এআই চালু' : quietNow ? 'নীরব সময়' : 'এআই বন্ধ'} · {stats.on}/{stats.total}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => patch({ aiEnabled: features.aiEnabled === false }, false)}
            variant="outline"
            className="h-9 px-3 rounded-lg text-xs"
          >
            <Power className="w-4 h-4 mr-1.5" />
            {features.aiEnabled === false ? 'এআই চালু' : 'এআই বন্ধ'}
          </Button>
          <Button
            type="button"
            onClick={() => persist(features, false)}
            disabled={isSaving}
            className="h-9 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white text-xs"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'সেভ...' : 'সেভ'}
          </Button>
        </div>
      </div>
      {lastSavedAt && (
        <p className="text-xs text-zinc-400">
          {new Date(lastSavedAt).toLocaleTimeString('bn-BD')}
        </p>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="খুঁজুন..."
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
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {group.title}
              </h3>
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
            <h3 className="font-semibold text-sm">নীরব সময়</h3>
          </div>
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
            <h3 className="font-semibold text-sm">অফলাইন মেসেজ</h3>
          </div>
          <Textarea
            value={features.offlineMessage || ''}
            onChange={e => setFeatures(prev => ({ ...prev, offlineMessage: e.target.value }))}
            onBlur={() => persist(featuresRef.current, true)}
            placeholder="ধন্যবাদ! আমাদের টিম শীঘ্রই উত্তর দিবে।"
            className="min-h-[96px] rounded-2xl text-xs"
          />
        </div>
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
      className={`p-3.5 rounded-xl border ${
        on
          ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onToggle} className="text-left flex-1 min-w-0">
          <h4 className="font-medium text-sm text-zinc-900 dark:text-white">{feat.title}</h4>
        </button>
        <button type="button" onClick={onToggle} aria-pressed={on} aria-label={feat.title}>
          <Toggle on={on} />
        </button>
      </div>
      {onJump && (
        <button
          type="button"
          onClick={onJump}
          className="mt-2 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          সেটিংস
        </button>
      )}
    </div>
  );
}
