import React, { useState } from 'react';
import { 
  Store, 
  Phone, 
  MapPin, 
  Save, 
  Image as ImageIcon, 
  Globe 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantInfoProps {
  business: BusinessConfig;
}

export function MerchantInfo({ business }: MerchantInfoProps) {
  const [name, setName] = useState(business.name || '');
  const [description, setDescription] = useState(business.description || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [address, setAddress] = useState(business.address || '');
  const [logoUrl, setLogoUrl] = useState(business.logoUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('স্টোরের নাম দিন');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        name,
        description,
        phone,
        address,
        logoUrl
      });
      toast.success('স্টোর প্রোফাইল আপডেট হয়েছে!');
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
              স্টোর প্রোফাইল ও পরিচিতি
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Merchant Identity
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার অনলাইন শপের নাম, লোগো এবং পরিচিতি যা এআই কাস্টমারদের সাথে শেয়ার করবে।
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'প্রোফাইল সেভ করুন'}
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-xs space-y-6 max-w-3xl">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">স্টোরের নাম *</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="যেমন: ফ্যাশন হাউজ বিডি"
            className="h-11 rounded-2xl font-bold text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">অফিসিয়াল ফোন নম্বর</label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="h-11 rounded-2xl text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">লোগো বা ইমেজ ইউআরএল (Logo URL)</label>
            <Input
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="h-11 rounded-2xl text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">স্টোর বা শোরুমের ঠিকানা</label>
          <Input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="যেমন: লেভেল ৪, যমুনা ফিউচার পার্ক, ঢাকা"
            className="h-11 rounded-2xl text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">স্টোরের সংক্ষিপ্ত পরিচিতি (About Shop)</label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="আমরা সেরা মানের প্রিমিয়াম ক্লথিং সরবরাহ করি..."
            className="min-h-[100px] rounded-2xl text-xs leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
