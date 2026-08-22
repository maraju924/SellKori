import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Save,
  RefreshCw,
  Wallet,
  CheckCircle2,
  Clock,
  BadgeDollarSign
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { db } from '../../lib/firebase';
import { getDocAcrossPanelDbs, listenQueryAcrossPanelDbs } from '../../lib/panelDb';
import { doc, setDoc, collection, query, limit } from 'firebase/firestore';
import { parseJsonResponse } from '../../lib/safeJson';
import { toast } from 'sonner';

export function AdminBillingGateway() {
  const [zinipayApiKey, setZinipayApiKey] = useState('');
  const [tokenRatePerLakh, setTokenRatePerLakh] = useState<number>(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; paymentUrl?: string } | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  const handleTestGateway = async () => {
    if (!zinipayApiKey.trim()) {
      toast.error('আগে ZiniPay API Key দিন');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/billing/test-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: zinipayApiKey.trim() })
      });
      const data = await parseJsonResponse(res);
      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message, paymentUrl: data.paymentUrl });
        toast.success('ZiniPay গেটওয়ে সচল!');
      } else {
        setTestResult({ success: false, message: data.error || 'গেটওয়ে টেস্ট ব্যর্থ' });
        toast.error(data.error || 'গেটওয়ে টেস্ট ব্যর্থ');
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
      toast.error('গেটওয়ে টেস্ট ব্যর্থ');
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocAcrossPanelDbs('system', 'settings');
        if (snap?.exists()) {
          const d = snap.data() || {};
          if (d.zinipayApiKey) setZinipayApiKey(d.zinipayApiKey);
          if (d.tokenRatePerLakh) setTokenRatePerLakh(Number(d.tokenRatePerLakh) || 20);
        }
      } catch (e) {
        console.error('[AdminBilling] load error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Live payment stream (admin has global read access)
  useEffect(() => {
    return listenQueryAcrossPanelDbs<any>(
      (database) => query(collection(database, 'payments'), limit(200)),
      (list) => {
        const sorted = [...list];
        sorted.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        setPayments(sorted);
      },
    );
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        zinipayApiKey: zinipayApiKey.trim(),
        tokenRatePerLakh: Number(tokenRatePerLakh) || 20,
      }, { merge: true });
      toast.success('পেমেন্ট গেটওয়ে সেটিংস সংরক্ষিত!', {
        description: 'মার্চেন্টরা এখন থেকে ZiniPay দিয়ে রিচার্জ করতে পারবে — কী শুধু আপনার কাছেই থাকবে।'
      });
    } catch (e: any) {
      toast.error(e.message || 'সংরক্ষণ ব্যর্থ');
    } finally {
      setIsSaving(false);
    }
  };

  const paidPayments = payments.filter(p => p.status === 'paid');
  const totalRevenue = paidPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pendingCount = payments.filter(p => p.status === 'pending').length;

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
            <h2 className="text-xl md:text-2xl font-black text-white">পেমেন্ট গেটওয়ে ও রেভিনিউ</h2>
            <Badge className="bg-orange-950/60 text-orange-300 border-none font-bold text-xs">ZiniPay (Admin Only)</Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            গেটওয়ে কী শুধু সুপার অ্যাডমিনের কাছে থাকে — মার্চেন্টরা bKash/Nagad/Rocket-এ রিচার্জ করে, টোকেন অটো ক্রেডিট হয়।
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-bold"><BadgeDollarSign className="w-4 h-4 text-emerald-400" /> মোট রেভিনিউ</div>
          <p className="text-2xl font-black text-white mt-1">৳ {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-bold"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> সফল পেমেন্ট</div>
          <p className="text-2xl font-black text-white mt-1">{paidPayments.length} টি</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-bold"><Clock className="w-4 h-4 text-amber-400" /> পেন্ডিং</div>
          <p className="text-2xl font-black text-white mt-1">{pendingCount} টি</p>
        </div>
      </div>

      {/* Gateway Config */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-2xl bg-orange-950/60 text-orange-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">ZiniPay কনফিগারেশন</h3>
            <p className="text-[11px] text-zinc-500">zinipay.com ড্যাশবোর্ড থেকে API Key নিন</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-400">ZiniPay API Key</label>
            <Input
              type="password"
              value={zinipayApiKey}
              onChange={(e) => setZinipayApiKey(e.target.value)}
              placeholder="zini_live_..."
              className="font-mono text-xs h-10 rounded-xl bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-400">টোকেন রেট (৳ প্রতি ১ লাখ টোকেন)</label>
            <Input
              type="number"
              value={tokenRatePerLakh}
              onChange={(e) => setTokenRatePerLakh(Number(e.target.value))}
              className="font-mono text-xs h-10 rounded-xl bg-zinc-800 border-zinc-700 text-white"
            />
            <p className="text-[10px] text-zinc-500">যেমন: ২০ টাকা রেটে কেউ ১০০ টাকা রিচার্জ করলে পাবে ৫,০০,০০০ টোকেন</p>
          </div>
        </div>

        <Button
          onClick={handleTestGateway}
          disabled={isTesting}
          variant="outline"
          className="w-full h-10 rounded-xl font-black text-xs border-orange-900 text-orange-400 hover:bg-orange-950/40"
        >
          {isTesting ? 'টেস্ট ইনভয়েস তৈরি হচ্ছে...' : 'গেটওয়ে টেস্ট করুন (১০৳ টেস্ট ইনভয়েস)'}
        </Button>

        {testResult && (
          <div className={`p-3 rounded-xl text-[11px] font-bold ${
            testResult.success
              ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-900/50'
              : 'bg-red-950/30 text-red-300 border border-red-900/50'
          }`}>
            {testResult.message}
            {testResult.paymentUrl && (
              <a href={testResult.paymentUrl} target="_blank" rel="noreferrer" className="block mt-1 underline text-emerald-400">
                টেস্ট পেমেন্ট পেজ দেখুন →
              </a>
            )}
          </div>
        )}

        <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-900/40 text-[10px] text-zinc-400 leading-relaxed">
          <strong className="text-orange-300">গুরুত্বপূর্ণ:</strong> ZiniPay-র নিয়ম অনুযায়ী redirect ডোমেইন আর আপনার Brand-এর ওয়েবসাইট ডোমেইন এক হতে হবে। zinipay.com ড্যাশবোর্ড → Brands-এ আপনার সাইটের ডোমেইন (যেমন sell-kori.vercel.app) সেট করুন, তারপর সেই Brand-এর API Key এখানে দিন।
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-2xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">সব পেমেন্ট ({payments.length})</h3>
            <p className="text-[11px] text-zinc-500">সব মার্চেন্টের রিচার্জ হিস্ট্রি — লাইভ</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <p className="text-[11px] text-zinc-500 py-6 text-center">এখনো কোনো পেমেন্ট হয়নি</p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-zinc-800 bg-zinc-800/40 text-xs">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-zinc-500 truncate">{p.id}</p>
                  <p className="font-bold text-white">৳ {Number(p.amount || 0).toLocaleString()} → {Number(p.tokens || 0).toLocaleString()} টোকেন</p>
                  <p className="text-[10px] text-zinc-500">
                    {p.businessId} · {p.paymentMethod || '—'} · {p.createdAtMs ? new Date(p.createdAtMs).toLocaleString('bn-BD') : ''}
                  </p>
                </div>
                <Badge className={
                  p.status === 'paid'
                    ? 'bg-emerald-950/60 text-emerald-300'
                    : p.status === 'pending'
                    ? 'bg-amber-950/60 text-amber-300'
                    : 'bg-zinc-800 text-zinc-400'
                }>
                  {p.status === 'paid' ? (p.credited ? 'পেইড ✓' : 'পেইড (ক্রেডিট বাকি)') : p.status === 'pending' ? 'পেন্ডিং' : p.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
