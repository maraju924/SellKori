import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Key, 
  RefreshCw,
  Send,
  User,
  Bot
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantMessengerLiveProps {
  business: BusinessConfig;
}

export function MerchantMessengerLive({ business }: MerchantMessengerLiveProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [pageAccessToken, setPageAccessToken] = useState(business.pageAccessToken || '');
  const [pageId, setPageId] = useState(business.pageId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);

  const webhookUrl = `${window.location.origin}/api/messenger/webhook`;
  const verifyToken = business.messengerVerifyToken || 'sellkori_verify_token';

  useEffect(() => {
    if (!business.id) return;
    const logsQ = query(
      collection(db, 'messenger_logs'),
      where('businessId', '==', business.id),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    return onSnapshot(logsQ, (snap) => {
      setLiveLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [business.id]);

  const copyToClipboard = (text: string, type: 'token' | 'webhook') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
    toast.success('ক্লিপবোর্ডে কপি হয়েছে!');
  };

  const handleSaveMessengerConfig = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        pageAccessToken,
        pageId
      });
      toast.success('মেসেঞ্জার ক্রেডেনশিয়ালস সংরক্ষিত হয়েছে!');
    } catch (e) {
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  const formatLogTimestamp = (ts: any): string => {
    if (!ts) return 'Just now';
    if (typeof ts === 'string') return ts;
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
    if (ts.toDate && typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleTimeString();
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toLocaleTimeString();
    }
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              ফেসবুক মেসেঞ্জার অটোমেশন
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Official Meta Graph API
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার ফেসবুক পেইজের মেসেঞ্জারের সাথে SellKori AI বট ইন্টিগ্রেশন করুন।
          </p>
        </div>

        <Button
          onClick={handleSaveMessengerConfig}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20"
        >
          {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook Connection Guide Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">মেটা ডেভেলপার ওয়েবহুক সেটআপ</h3>
              <p className="text-[11px] text-zinc-500">Facebook Developer App এ এই তথ্যগুলো পেস্ট করুন</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Callback URL (Webhook URL)</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-[11px] h-10 rounded-xl"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="rounded-xl shrink-0 h-10 px-3"
                >
                  {copiedWebhook ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Verify Token</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={verifyToken}
                  className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-[11px] h-10 rounded-xl"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(verifyToken, 'token')}
                  className="rounded-xl shrink-0 h-10 px-3"
                >
                  {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Page Access Token</label>
              <Input
                type="password"
                value={pageAccessToken}
                onChange={e => setPageAccessToken(e.target.value)}
                placeholder="EAA..."
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">Facebook Page ID</label>
              <Input
                value={pageId}
                onChange={e => setPageId(e.target.value)}
                placeholder="104928374829..."
                className="font-mono text-xs h-10 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Live Conversation Stream / Logs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white">লাইভ মেসেঞ্জার লগস</h3>
                  <p className="text-[11px] text-zinc-500">পেইজে আসা কাস্টমার মেসেজ ও এআই রিপ্লাই</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto pr-1">
              {liveLogs.length === 0 ? (
                <div className="text-center py-10 space-y-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl">
                  <MessageCircle className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">এখনো কোনো লাইভ মেসেঞ্জার রিকোয়েস্ট আসেনি</p>
                  <p className="text-[10px] text-zinc-400">ওয়েবহুক সংযুক্ত করার পর কাস্টমার মেসেজ আসলে এখানে রিয়েল-টাইম লগ দেখাবে।</p>
                </div>
              ) : (
                liveLogs.map(log => (
                  <div key={log.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-[10px] text-zinc-400">
                      <span>Sender: {log.senderId || 'FB User'}</span>
                      <span>{formatLogTimestamp(log.timestamp)}</span>
                    </div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{log.message}</p>
                    {log.reply && (
                      <p className="text-[11px] text-orange-600 dark:text-orange-400 font-bold pl-2 border-l-2 border-orange-500">
                        {log.reply}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
