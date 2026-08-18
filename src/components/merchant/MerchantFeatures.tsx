import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Bot, 
  FileText, 
  MessageSquare, 
  Lock, 
  Sparkles, 
  Layers, 
  Save 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BusinessConfig, BusinessFeatures } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantFeaturesProps {
  business: BusinessConfig;
}

export function MerchantFeatures({ business }: MerchantFeaturesProps) {
  const [features, setFeatures] = useState<BusinessFeatures>(business.features || {
    aiEnabled: true,
    orderTrackingEnabled: true,
    proactiveNotificationsEnabled: true,
    chatSummaryEnabled: true,
    negotiationEnabled: true,
    imageDisplayEnabled: true,
    inventoryEnabled: true,
    analyticsEnabled: true,
    invoicingEnabled: true,
    broadcastingEnabled: true
  });
  const [isSaving, setIsSaving] = useState(false);

  const toggleFeature = (key: keyof BusinessFeatures) => {
    setFeatures(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        features
      });
      toast.success('ফিচার কনফিগারেশন সংরক্ষিত হয়েছে!');
    } catch (e) {
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  const featureList = [
    {
      key: 'aiEnabled' as keyof BusinessFeatures,
      title: 'এআই অটো-রিপ্লাই ইঞ্জিন',
      desc: 'কাস্টমারের প্রতিটি মেসেজে স্বয়ংক্রিয় এআই রিপ্লাই প্রদান করবে।'
    },
    {
      key: 'negotiationEnabled' as keyof BusinessFeatures,
      title: 'স্মার্ট দরদাম ও ডিসকাউন্ট নেগোসিয়েশন',
      desc: 'Min Price পর্যন্ত কাস্টমারের সাথে স্মার্টলি দরদাম করবে।'
    },
    {
      key: 'invoicingEnabled' as keyof BusinessFeatures,
      title: 'অর্ডার মেমো ও ডিজিটাল ইনভয়েস',
      desc: 'অর্ডার কনফার্মেশনের সাথে সাথে অটোমেটিক মেমো জেনারেট করবে।'
    },
    {
      key: 'imageDisplayEnabled' as keyof BusinessFeatures,
      title: 'চ্যাটে পণ্যের ছবি প্রদর্শন',
      desc: 'কাস্টমার জানতে চাইলে পণ্যের ছবি চ্যাটে সরাসরি পাঠাবে।'
    },
    {
      key: 'orderTrackingEnabled' as keyof BusinessFeatures,
      title: 'লাইভ পার্সেল ট্র্যাকিং সুবিধা',
      desc: 'কাস্টমার তার অর্ডারের ট্র্যাকিং আইডি চাইলে এআই তা জানিয়ে দেবে।'
    },
    {
      key: 'broadcastingEnabled' as keyof BusinessFeatures,
      title: 'মেসেঞ্জার ব্রডকাস্টিং মডিউল',
      desc: 'গ্রাহকদের কাছে ডিসকাউন্ট ও অফার প্রচার করার সুযোগ সক্রিয় রাখে।'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              ফিচার সুইচবোর্ড ও কন্ট্রোল
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              System Modules
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার প্রয়োজন অনুযায়ী নির্দিষ্ট এআই ফিচার চালু অথবা সাময়িকভাবে বন্ধ রাখুন।
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

      {/* Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {featureList.map(feat => {
          const isEnabled = features[feat.key] !== false;
          return (
            <div
              key={feat.key}
              onClick={() => toggleFeature(feat.key)}
              className={`p-5 rounded-3xl border cursor-pointer transition-all flex items-start justify-between gap-4 ${
                isEnabled
                  ? 'bg-white dark:bg-zinc-900 border-orange-500/30 ring-1 ring-orange-500/10 shadow-xs'
                  : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 opacity-60'
              }`}
            >
              <div className="space-y-1">
                <h4 className="font-black text-sm text-zinc-900 dark:text-white">{feat.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{feat.desc}</p>
              </div>

              <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 mt-1 ${
                isEnabled ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5 ${
                  isEnabled ? 'right-0.5' : 'left-0.5'
                }`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
