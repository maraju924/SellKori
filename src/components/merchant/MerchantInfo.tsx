import React, { useEffect, useState } from 'react';
import { 
  Store, 
  Phone, 
  MapPin, 
  Save, 
  Image as ImageIcon, 
  Globe,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { checkShopSlug } from '../../lib/shopApi';
import { isValidShopSlug, normalizeShopSlug, suggestedShopSlug } from '../../lib/storeSlug';
import { shopPath, shopPublicUrl } from '../../lib/storefront';

interface MerchantInfoProps {
  business: BusinessConfig;
}

export function MerchantInfo({ business }: MerchantInfoProps) {
  const [name, setName] = useState(business.name || '');
  const [description, setDescription] = useState(business.description || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [address, setAddress] = useState(business.address || '');
  const [logoUrl, setLogoUrl] = useState(business.logoUrl || '');
  const [slug, setSlug] = useState(suggestedShopSlug(business));
  const [slugTouched, setSlugTouched] = useState(Boolean(business.slug));
  const [isSaving, setIsSaving] = useState(false);

  // Resync form when the store profile changes from another tab/device
  useEffect(() => {
    setName(business.name || '');
    setDescription(business.description || '');
    setPhone(business.phone || '');
    setAddress(business.address || '');
    setLogoUrl(business.logoUrl || '');
    setSlug(suggestedShopSlug(business));
    setSlugTouched(Boolean(business.slug));
  }, [business.id]);

  const previewShop = { ...business, name, slug: normalizeShopSlug(slug) };
  const publicUrl = typeof window !== 'undefined'
    ? shopPublicUrl(window.location.origin, previewShop)
    : shopPath(previewShop);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('স্টোরের নাম দিন');
      return;
    }
    const cleanSlug = normalizeShopSlug(slug) || suggestedShopSlug({ name, id: business.id });
    if (!isValidShopSlug(cleanSlug)) {
      toast.error('ওয়েবসাইট লিংক ইংরেজি অক্ষর/সংখ্যায় লিখুন, যেমন: myshop');
      return;
    }
    setIsSaving(true);
    try {
      const availability = await checkShopSlug(cleanSlug, business.id);
      if (!availability.ok) {
        toast.error(availability.error || 'এই লিংক ব্যবহার করা যাবে না');
        return;
      }
      await updateDoc(doc(db, 'businesses', business.id), {
        name,
        description,
        phone,
        address,
        logoUrl,
        slug: cleanSlug,
      });
      setSlug(cleanSlug);
      toast.success('স্টোর প্রোফাইল আপডেট হয়েছে!');
    } catch (e) {
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">স্টোর</h2>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white text-xs rounded-lg h-9 px-4"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সেভ হচ্ছে...' : 'সেভ'}
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 max-w-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm font-mono text-zinc-600 dark:text-zinc-400 truncate min-w-0">
          {publicUrl}
        </p>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg text-xs"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success('লিংক কপি হয়েছে');
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" /> কপি
          </Button>
          <a href={shopPath(previewShop)} target="_blank" rel="noreferrer">
            <Button type="button" className="h-9 rounded-lg text-xs bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> খুলুন
            </Button>
          </a>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-xs space-y-6 max-w-3xl">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">স্টোরের নাম *</label>
          <Input
            value={name}
            onChange={e => {
              const next = e.target.value;
              setName(next);
              if (!slugTouched) setSlug(suggestedShopSlug({ name: next, id: business.id, slug: business.slug }));
            }}
            placeholder="যেমন: My Shop"
            className="h-11 rounded-2xl font-bold text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">ওয়েবসাইট লিংক নাম</label>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] font-mono text-zinc-400 shrink-0">
              {typeof window !== 'undefined' ? `${window.location.origin}/` : '/'}
            </span>
            <Input
              value={slug}
              onChange={e => {
                setSlugTouched(true);
                setSlug(normalizeShopSlug(e.target.value));
              }}
              placeholder="myshop"
              className="h-11 rounded-2xl font-mono text-xs"
            />
          </div>
          <p className="text-[11px] font-mono text-zinc-400">{publicUrl}</p>
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
