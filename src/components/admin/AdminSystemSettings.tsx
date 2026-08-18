import React, { useState } from 'react';
import { 
  Settings, 
  Save, 
  Sparkles, 
  ShieldAlert, 
  Radio, 
  Globe, 
  CreditCard,
  Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export function AdminSystemSettings() {
  const [announcement, setAnnouncement] = useState('স্বাগতম সেলকরি এআই প্ল্যাটফর্মে! নতুন জেমিনি ২.৫ ফ্ল্যাশ ইঞ্জিন এখন লাইভ।');
  const [tokenRatePerLakh, setTokenRatePerLakh] = useState<number>(20);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        announcement,
        tokenRatePerLakh: Number(tokenRatePerLakh),
        maintenanceMode,
        updatedAt: Date.now()
      }, { merge: true });
      toast.success('সিস্টেম গ্লোবাল সেটিংস সংরক্ষিত হয়েছে!');
    } catch (e) {
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black">
              সিস্টেম ও এপিআই সেটিংস
            </h2>
            <Badge className="bg-orange-950/60 text-orange-400 border-none font-bold text-xs">
              Global Config
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            প্ল্যাটফর্মের নোটিশ বার্তা, টোকেন প্রাইজ ও সিস্টেম মোড নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
        </Button>
      </div>

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
