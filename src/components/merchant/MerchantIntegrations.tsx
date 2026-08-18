import React, { useState } from 'react';
import { 
  Truck, 
  Globe, 
  Save, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Key, 
  Sparkles,
  Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantIntegrationsProps {
  business: BusinessConfig;
}

export function MerchantIntegrations({ business }: MerchantIntegrationsProps) {
  const [steadfastApiKey, setSteadfastApiKey] = useState(business.courierConfig?.steadfastApiKey || '');
  const [steadfastSecretKey, setSteadfastSecretKey] = useState(business.courierConfig?.steadfastSecretKey || '');
  
  const [pixelId, setPixelId] = useState(business.facebookConfig?.pixelId || '');
  const [capiAccessToken, setCapiAccessToken] = useState(business.facebookConfig?.accessToken || '');
  const [testEventCode, setTestEventCode] = useState(business.facebookConfig?.testEventCode || '');
  
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        courierConfig: {
          ...(business.courierConfig || {}),
          steadfastApiKey,
          steadfastSecretKey,
        },
        facebookConfig: {
          ...(business.facebookConfig || {}),
          pixelId,
          accessToken: capiAccessToken,
          testEventCode,
          capiEnabled: Boolean(pixelId && capiAccessToken)
        }
      });
      toast.success('ইন্টিগ্রেশন সেটিংস সংরক্ষিত হয়েছে!', {
        description: 'স্টেডফাস্ট ও মেটা CAPI সিঙ্ক সক্রিয় হয়েছে।'
      });
    } catch (e) {
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              কুরিয়ার ও মেটা CAPI ইন্টিগ্রেশন
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Direct API Connections
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            ১-ক্লিকে পার্সেল বুকিং এবং ফেসবুক বিজ্ঞাপনের কনভারশন নির্ভুল ট্র্যাকিং নিশ্চিত করুন।
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Steadfast Courier Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-zinc-900 dark:text-white">Steadfast Courier API</h3>
                <p className="text-[11px] text-zinc-500">স্টেডফাস্ট ড্যাশবোর্ড থেকে এপিআই কি দিন</p>
              </div>
            </div>
            {steadfastApiKey && (
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                সক্রিয়
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Steadfast API Key</label>
              <Input
                value={steadfastApiKey}
                onChange={e => setSteadfastApiKey(e.target.value)}
                placeholder="যেমন: stdf_live_..."
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Steadfast Secret Key</label>
              <Input
                type="password"
                value={steadfastSecretKey}
                onChange={e => setSteadfastSecretKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Facebook Meta Pixel & CAPI Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-zinc-900 dark:text-white">Meta Pixel & Conversions API (CAPI)</h3>
                <p className="text-[11px] text-zinc-500">iOS 14+ কনভারশন ট্র্যাকিং নিশ্চিত করতে</p>
              </div>
            </div>
            {pixelId && (
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                সক্রিয়
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Meta Pixel ID</label>
              <Input
                value={pixelId}
                onChange={e => setPixelId(e.target.value)}
                placeholder="যেমন: 1049283748291..."
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Conversions API Access Token</label>
              <Input
                type="password"
                value={capiAccessToken}
                onChange={e => setCapiAccessToken(e.target.value)}
                placeholder="EAA..."
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Test Event Code (ঐচ্ছিক)</label>
              <Input
                value={testEventCode}
                onChange={e => setTestEventCode(e.target.value)}
                placeholder="TEST..."
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
