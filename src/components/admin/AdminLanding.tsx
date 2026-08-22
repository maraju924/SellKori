import React, { useEffect, useState } from 'react';
import { Layout, Save, RotateCcw } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../../lib/firebase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { DEFAULT_LANDING_CONTENT, sanitizeLandingContent } from '../../lib/landingContent';

export function AdminLanding() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [brandName, setBrandName] = useState(DEFAULT_LANDING_CONTENT.brandName);
  const [brandSuffix, setBrandSuffix] = useState(DEFAULT_LANDING_CONTENT.brandSuffix);
  const [tagline, setTagline] = useState(DEFAULT_LANDING_CONTENT.tagline);
  const [promo, setPromo] = useState(DEFAULT_LANDING_CONTENT.promo);
  const [heroHeadline, setHeroHeadline] = useState(DEFAULT_LANDING_CONTENT.heroHeadline);
  const [heroHeadlineAccent, setHeroHeadlineAccent] = useState(DEFAULT_LANDING_CONTENT.heroHeadlineAccent);
  const [heroSubheadline, setHeroSubheadline] = useState(DEFAULT_LANDING_CONTENT.heroSubheadline);
  const [primaryCta, setPrimaryCta] = useState(DEFAULT_LANDING_CONTENT.primaryCta);
  const [footerEmail, setFooterEmail] = useState(DEFAULT_LANDING_CONTENT.footerEmail);
  const [footerPhone, setFooterPhone] = useState(DEFAULT_LANDING_CONTENT.footerPhone);
  const [freeTrialTokens, setFreeTrialTokens] = useState(100000);
  const [monthlyServerCost, setMonthlyServerCost] = useState(1000);
  const [jsonText, setJsonText] = useState(JSON.stringify(DEFAULT_LANDING_CONTENT, null, 2));

  const applyLanding = (landing: typeof DEFAULT_LANDING_CONTENT) => {
    setBrandName(landing.brandName);
    setBrandSuffix(landing.brandSuffix);
    setTagline(landing.tagline);
    setPromo(landing.promo);
    setHeroHeadline(landing.heroHeadline);
    setHeroHeadlineAccent(landing.heroHeadlineAccent);
    setHeroSubheadline(landing.heroSubheadline);
    setPrimaryCta(landing.primaryCta);
    setFooterEmail(landing.footerEmail);
    setFooterPhone(landing.footerPhone);
    setJsonText(JSON.stringify(landing, null, 2));
  };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'system_config', 'public'));
        if (snap.exists()) {
          const data = snap.data() || {};
          if (data.freeTrialTokens) setFreeTrialTokens(Number(data.freeTrialTokens));
          if (data.monthlyServerCost) setMonthlyServerCost(Number(data.monthlyServerCost));
          const landing = sanitizeLandingContent(data.landing || {});
          applyLanding(landing);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const composedLanding = () => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('ল্যান্ডিং JSON সঠিক নয়');
    }
    return sanitizeLandingContent({
      ...parsed,
      brandName,
      brandSuffix,
      tagline,
      promo,
      heroHeadline,
      heroHeadlineAccent,
      heroSubheadline,
      primaryCta,
      footerEmail,
      footerPhone,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const landing = composedLanding();
      await setDoc(doc(db, 'system_config', 'public'), {
        landing,
        freeTrialTokens: Number(freeTrialTokens),
        monthlyServerCost: Number(monthlyServerCost),
        updatedAt: Date.now(),
        updatedBy: 'Admin Landing',
      }, { merge: true });
      applyLanding(landing);
      toast.success('পাবলিক ল্যান্ডিং আপডেট হয়েছে');
    } catch (error: any) {
      toast.error(error.message || 'সেভ ব্যর্থ');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-zinc-400 text-sm p-8">ল্যান্ডিং কনটেন্ট লোড হচ্ছে…</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-black">পাবলিক ল্যান্ডিং পেজ</h2>
          </div>
          <p className="text-xs text-zinc-500 mt-1">হোমপেজের লেখা, মূল্য ও সেকশন এখান থেকে বদলাবে — API `/api/public/config` দিয়ে পেজ ডায়নামিক হবে।</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl text-xs" onClick={() => applyLanding(DEFAULT_LANDING_CONTENT)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> ডিফল্ট
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold" disabled={isSaving} onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1" /> {isSaving ? 'সেভ হচ্ছে…' : 'প্রকাশ করুন'}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="ব্র্যান্ড" value={brandName} onChange={setBrandName} />
        <Field label="সাফিক্স" value={brandSuffix} onChange={setBrandSuffix} />
        <Field label="ট্যাগলাইন" value={tagline} onChange={setTagline} />
        <Field label="প্রাইমারি বাটন" value={primaryCta} onChange={setPrimaryCta} />
        <Field label="ইমেইল" value={footerEmail} onChange={setFooterEmail} />
        <Field label="ফোন" value={footerPhone} onChange={setFooterPhone} />
        <Field label="ফ্রি ট্রায়াল টোকেন" value={String(freeTrialTokens)} onChange={(v) => setFreeTrialTokens(Number(v) || 0)} />
        <Field label="মাসিক প্ল্যাটফর্ম ফি (৳)" value={String(monthlyServerCost)} onChange={(v) => setMonthlyServerCost(Number(v) || 0)} />
      </div>

      <div className="space-y-3">
        <Field label="প্রোমো / টপ বার ({freeTrial} ব্যবহার করা যাবে)" value={promo} onChange={setPromo} />
        <Field label="হিরো শিরোনাম" value={heroHeadline} onChange={setHeroHeadline} />
        <Field label="হিরো দ্বিতীয় লাইন" value={heroHeadlineAccent} onChange={setHeroHeadlineAccent} />
        <label className="block text-xs text-zinc-400 space-y-1.5">
          <span>হিরো বিবরণ</span>
          <Textarea value={heroSubheadline} onChange={(e) => setHeroSubheadline(e.target.value)} className="min-h-24 bg-zinc-900 border-zinc-700 text-white text-sm" />
        </label>
      </div>

      <label className="block text-xs text-zinc-400 space-y-1.5">
        <span>সম্পূর্ণ ল্যান্ডিং JSON (ফিচার, FAQ, টেস্টিমোনিয়াল, ডেমো, তুলনা)</span>
        <Textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="min-h-[320px] font-mono text-[11px] bg-zinc-950 border-zinc-800 text-zinc-200"
        />
      </label>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-zinc-400 space-y-1.5">
      <span>{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white h-10" />
    </label>
  );
}
