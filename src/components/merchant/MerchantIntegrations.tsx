import React, { useEffect, useState } from 'react';
import { 
  Truck, 
  Globe, 
  Save, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Key, 
  Sparkles,
  Zap,
  Radio
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData } from '../../lib/utils';
import { parseJsonResponse } from '../../lib/safeJson';

interface MerchantIntegrationsProps {
  business: BusinessConfig;
}

export function MerchantIntegrations({ business }: MerchantIntegrationsProps) {
  const [steadfastApiKey, setSteadfastApiKey] = useState(business.courierConfig?.steadfastApiKey || '');
  const [steadfastSecretKey, setSteadfastSecretKey] = useState(business.courierConfig?.steadfastSecretKey || '');
  const [autoBooking, setAutoBooking] = useState(business.courierConfig?.autoBooking !== false);
  const [insideDhaka, setInsideDhaka] = useState(business.courierConfig?.deliveryChargeInsideDhaka || 70);
  const [outsideDhaka, setOutsideDhaka] = useState(business.courierConfig?.deliveryChargeOutsideDhaka || 130);
  
  const [pixelId, setPixelId] = useState(business.facebookConfig?.pixelId || '');
  const [capiAccessToken, setCapiAccessToken] = useState(business.facebookConfig?.accessToken || '');
  const [testEventCode, setTestEventCode] = useState(business.facebookConfig?.testEventCode || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingCapi, setIsTestingCapi] = useState(false);
  const [capiTestResult, setCapiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Resync local form when the business snapshot updates while this tab is open
  useEffect(() => {
    setSteadfastApiKey(business.courierConfig?.steadfastApiKey || '');
    setSteadfastSecretKey(business.courierConfig?.steadfastSecretKey || '');
    setAutoBooking(business.courierConfig?.autoBooking !== false);
    setInsideDhaka(business.courierConfig?.deliveryChargeInsideDhaka || 70);
    setOutsideDhaka(business.courierConfig?.deliveryChargeOutsideDhaka || 130);
    setPixelId(business.facebookConfig?.pixelId || '');
    setCapiAccessToken(business.facebookConfig?.accessToken || '');
    setTestEventCode(business.facebookConfig?.testEventCode || '');
  }, [business.id]);

  const handleTestCapi = async () => {
    if (!pixelId.trim() || !capiAccessToken.trim()) {
      toast.error('আগে Pixel ID ও CAPI Access Token দিয়ে সেভ করুন');
      return;
    }
    setIsTestingCapi(true);
    setCapiTestResult(null);
    try {
      const res = await fetch('/api/capi/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          pixelId: pixelId.trim(),
          accessToken: capiAccessToken.trim(),
          testEventCode: testEventCode.trim() || undefined
        })
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data.success) {
        setCapiTestResult({ success: true, message: `টেস্ট ইভেন্ট সফলভাবে পিক্সেলে পৌঁছেছে! (events_received: ${data.eventsReceived ?? 1})${testEventCode ? ' — Events Manager → Test Events ট্যাবে দেখুন।' : ''}` });
        toast.success('CAPI সংযোগ সফল!');
      } else {
        setCapiTestResult({ success: false, message: data.error || 'CAPI টেস্ট ব্যর্থ' });
        toast.error(data.error || 'CAPI টেস্ট ব্যর্থ');
      }
    } catch (e: any) {
      setCapiTestResult({ success: false, message: e.message });
      toast.error('CAPI টেস্ট ব্যর্থ');
    } finally {
      setIsTestingCapi(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = cleanFirestoreData({
        courierConfig: {
          ...(business.courierConfig || {}),
          steadfastApiKey,
          steadfastSecretKey,
          autoBooking,
          deliveryChargeInsideDhaka: Number(insideDhaka) || 70,
          deliveryChargeOutsideDhaka: Number(outsideDhaka) || 130,
        },
        facebookConfig: {
          ...(business.facebookConfig || {}),
          pixelId,
          accessToken: capiAccessToken,
          testEventCode,
          capiEnabled: Boolean(pixelId && capiAccessToken)
        }
      });

      await updateDoc(doc(db, 'businesses', business.id), payload);
      toast.success('ইন্টিগ্রেশন সেটিংস সংরক্ষিত হয়েছে!', {
        description: 'স্টেডফাস্ট ও মেটা CAPI সিঙ্ক সক্রিয় হয়েছে।'
      });
    } catch (e: any) {
      console.error('[Save Integrations Error]', e);
      toast.error(e?.message ? `সংরক্ষণ ব্যর্থ: ${e.message}` : 'সংরক্ষণ ব্যর্থ হয়েছে');
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">ঢাকার ভিতরে চার্জ (৳)</label>
                <Input
                  type="number"
                  value={insideDhaka}
                  onChange={e => setInsideDhaka(Number(e.target.value))}
                  className="font-mono text-xs h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">ঢাকার বাইরে চার্জ (৳)</label>
                <Input
                  type="number"
                  value={outsideDhaka}
                  onChange={e => setOutsideDhaka(Number(e.target.value))}
                  className="font-mono text-xs h-10 rounded-xl"
                />
              </div>
            </div>
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={autoBooking}
                onChange={e => setAutoBooking(e.target.checked)}
                className="mt-0.5 accent-orange-600"
              />
              <span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">অর্ডার কনফার্ম হলে অটো স্টেডফাস্ট বুকিং</span>
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  মেসেঞ্জার/চ্যাটে অর্ডার কনফার্ম হলে পার্সেল নিজে থেকেই স্টেডফাস্টে পাঠানো হবে। ড্যাশবোর্ডের বাটনও আসল API কল করে।
                </span>
              </span>
            </label>
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

            <Button
              onClick={handleTestCapi}
              disabled={isTestingCapi}
              variant="outline"
              className="w-full h-10 rounded-xl font-black text-xs border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Radio className="w-3.5 h-3.5 mr-1.5" />
              {isTestingCapi ? 'টেস্ট ইভেন্ট পাঠানো হচ্ছে...' : 'CAPI সংযোগ টেস্ট করুন'}
            </Button>

            {capiTestResult && (
              <div className={`p-3 rounded-xl text-[11px] font-bold ${
                capiTestResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50'
              }`}>
                {capiTestResult.message}
              </div>
            )}

            <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[10px] text-zinc-500 leading-relaxed">
              <strong className="text-indigo-700 dark:text-indigo-300">অটো ফানেল ট্র্যাকিং:</strong> সেটআপ সম্পন্ন হলে মেসেঞ্জার চ্যাটের প্রতিটি ধাপ স্বয়ংক্রিয়ভাবে পিক্সেলে যাবে — Lead (অ্যাড থেকে মেসেজ), ViewContent (পণ্য জানতে চাওয়া), AddToCart, InitiateCheckout (ঠিকানা/ফোন দেওয়া) এবং Purchase (আসল টাকার অংকসহ অর্ডার)। এতে ফেসবুক শিখে যায় কোন ধরনের মানুষ আসলে কেনে, ফলে অ্যাডের রেজাল্ট ও ROAS অনেক ভালো হয়।
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
