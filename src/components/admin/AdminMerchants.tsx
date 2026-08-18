import React, { useState } from 'react';
import { 
  Store, 
  Search, 
  Zap, 
  ShieldAlert, 
  ShieldCheck, 
  Plus, 
  Minus, 
  Edit3, 
  Coins,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '../ui/dialog';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { toast } from 'sonner';

interface AdminMerchantsProps {
  merchants: BusinessConfig[];
}

export function AdminMerchants({ merchants }: AdminMerchantsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMerchant, setSelectedMerchant] = useState<BusinessConfig | null>(null);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<number>(100000);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const filteredMerchants = merchants.filter(m => {
    const matchesSearch =
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone?.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = async (merchant: BusinessConfig) => {
    const newStatus = merchant.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateDoc(doc(db, 'businesses', merchant.id), {
        status: newStatus
      });
      toast.success(newStatus === 'active' ? 'মার্চেন্ট অ্যাকাউন্ট সক্রিয় করা হয়েছে!' : 'মার্চেন্ট অ্যাকাউন্ট স্থগিত করা হয়েছে');
    } catch (e) {
      toast.error('স্ট্যাটাস পরিবর্তন সম্ভব হয়নি');
    }
  };

  const handleAdjustTokens = async (isAddition: boolean) => {
    if (!selectedMerchant || tokenAmount <= 0) return;

    setIsAdjusting(true);
    try {
      const delta = isAddition ? tokenAmount : -tokenAmount;
      await updateDoc(doc(db, 'businesses', selectedMerchant.id), {
        tokenBalance: increment(delta)
      });
      toast.success(`টোকেন ${isAddition ? 'যোগ' : 'কর্তন'} সফল হয়েছে!`, {
        description: `মার্চেন্ট: ${selectedMerchant.name}, পরিবর্তন: ${delta.toLocaleString()}`
      });
      setIsTokenModalOpen(false);
    } catch (e) {
      toast.error('টোকেন আপডেট ব্যর্থ হয়েছে');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-black">মার্চেন্ট ডিরেক্টরি ও টোকেন কন্ট্রোল</h2>
            <p className="text-xs text-zinc-400">সকল স্টোরের অ্যাকাউন্ট স্থিতি, টোকেন ক্রেডিট ও ভেরিফিকেশন</p>
          </div>
          <span className="text-xs font-bold text-zinc-400">মোট স্টোর: {merchants.length} টি</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="স্টোরের নাম, আইডি বা ফোন দিয়ে খুঁজুন..."
              className="pl-9 h-11 rounded-2xl bg-zinc-800 border-zinc-700 text-xs text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
            {[
              { id: 'all', label: 'সব মার্চেন্ট' },
              { id: 'active', label: 'সক্রিয়' },
              { id: 'suspended', label: 'স্থগিত' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  statusFilter === tab.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Merchants Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 font-bold uppercase">
              <tr>
                <th className="py-3.5 px-4">স্টোর পরিচিতি</th>
                <th className="py-3.5 px-4">প্ল্যান</th>
                <th className="py-3.5 px-4">টোকেন ব্যালেন্স</th>
                <th className="py-3.5 px-4">স্ট্যাটাস</th>
                <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredMerchants.map(m => (
                <tr key={m.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-950/60 text-orange-400 flex items-center justify-center font-black">
                        {m.name?.slice(0, 1) || 'S'}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{m.name || 'অজ্ঞাত স্টোর'}</p>
                        <p className="font-mono text-[11px] text-zinc-500">ID: {m.id.slice(0, 12)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold uppercase text-orange-400 bg-orange-950/40 px-2.5 py-1 rounded-lg border border-orange-900/50">
                      {m.plan || 'Free'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-white">
                    {(m.tokenBalance || 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      m.status === 'suspended'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                    }`}>
                      {m.status || 'Active'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedMerchant(m);
                        setIsTokenModalOpen(true);
                      }}
                      className="rounded-xl h-8 text-xs font-bold border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" />
                      টোকেন রিচার্জ
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(m)}
                      className={`rounded-xl h-8 text-xs font-bold ${
                        m.status === 'suspended'
                          ? 'text-emerald-400 hover:bg-emerald-950/40'
                          : 'text-rose-400 hover:bg-rose-950/40'
                      }`}
                    >
                      {m.status === 'suspended' ? 'সক্রিয় করুন' : 'স্থগিত করুন'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Tokens Modal */}
      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              টোকেন ব্যালেন্স এডজাস্ট করুন
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              মার্চেন্ট: <strong className="text-white">{selectedMerchant?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-300">টোকেনের পরিমাণ</label>
              <Input
                type="number"
                value={tokenAmount}
                onChange={e => setTokenAmount(Number(e.target.value))}
                className="h-11 rounded-xl bg-zinc-800 border-zinc-700 font-mono font-bold text-sm text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => handleAdjustTokens(false)}
              disabled={isAdjusting}
              className="border-rose-800 text-rose-400 bg-rose-950/40 hover:bg-rose-900 rounded-xl text-xs font-bold"
            >
              <Minus className="w-3.5 h-3.5 mr-1" />
              টোকেন কর্তন করুন
            </Button>
            <Button
              onClick={() => handleAdjustTokens(true)}
              disabled={isAdjusting}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black px-5"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              টোকেন যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
