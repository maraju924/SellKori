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
  Bot,
  Globe,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData } from '../../lib/utils';

interface MerchantMessengerLiveProps {
  business: BusinessConfig;
}

export function MerchantMessengerLive({ business }: MerchantMessengerLiveProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSpecificWebhook, setCopiedSpecificWebhook] = useState(false);
  const [pageAccessToken, setPageAccessToken] = useState(business.pageAccessToken || '');
  const [pageId, setPageId] = useState(business.pageId || business.facebookPageId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Canonical Webhook URLs
  const standardWebhookUrl = `${window.location.origin}/api/webhook`;
  const specificWebhookUrl = `${window.location.origin}/api/webhook/${business.id}`;
  const verifyToken = business.messengerVerifyToken || 'sellkori_verify_token';

  useEffect(() => {
    if (!business.id) return;
    const logsQ = query(
      collection(db, 'messenger_logs'),
      where('businessId', '==', business.id),
      orderBy('timestamp', 'desc'),
      limit(25)
    );

    return onSnapshot(logsQ, (snap) => {
      setLiveLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [business.id]);

  const copyToClipboard = (text: string, type: 'token' | 'webhook' | 'specific_webhook') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === 'webhook') {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedSpecificWebhook(true);
      setTimeout(() => setCopiedSpecificWebhook(false), 2000);
    }
    toast.success('ক্লিপবোর্ডে কপি হয়েছে!');
  };

  const handleSaveMessengerConfig = async () => {
    setIsSaving(true);
    try {
      const payload = cleanFirestoreData({
        pageAccessToken: pageAccessToken.trim(),
        pageId: pageId.trim(),
        facebookPageId: pageId.trim(),
        messengerVerifyToken: verifyToken
      });

      await updateDoc(doc(db, 'businesses', business.id), payload);
      toast.success('ফেসবুক মেসেঞ্জার ক্রেডেনশিয়ালস সংরক্ষিত হয়েছে!');
    } catch (e: any) {
      console.error('Messenger config save failed:', e);
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  // Self-diagnostic test for Webhook Handshake
  const handleTestWebhookHandshake = async () => {
    setIsTestingWebhook(true);
    setTestStatus(null);
    try {
      const challengeTest = `test_challenge_${Date.now()}`;
      const testUrl = `${standardWebhookUrl}?hub.mode=subscribe&hub.challenge=${challengeTest}&hub.verify_token=${encodeURIComponent(verifyToken)}`;
      
      const res = await fetch(testUrl);
      const text = await res.text();

      if (res.status === 200 && text === challengeTest) {
        setTestStatus({
          success: true,
          message: 'ওয়েবহুক এন্ডপয়েন্ট সম্পূর্ণ সক্রিয় এবং মেটা হ্যান্ডশেক সফলভাবে যাচাই হয়েছে (HTTP 200 OK)!'
        });
        toast.success('ওয়েবহুক কানেকশন রেডি!');
      } else {
        setTestStatus({
          success: false,
          message: `সার্ভার রেসপন্স কোড: ${res.status}. রেসপন্স: ${text}`
        });
        toast.error('ওয়েবহুক যাচাই ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setTestStatus({
        success: false,
        message: `নেটওয়ার্ক এরর: ${err.message}`
      });
      toast.error('ওয়েবহুক টেস্ট করতে সমস্যা হয়েছে');
    } finally {
      setIsTestingWebhook(false);
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
              ফেসবুক মেসেঞ্জার অটোমেশন ও ওয়েবহুক
            </h2>
            <Badge className="bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Meta Graph API Active
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার ফেসবুক পেইজের মেসেঞ্জারে স্বয়ংক্রিয় এআই সেলসম্যান যুক্ত করতে নিচের নির্দেশনাবলী অনুসরণ করুন।
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestWebhookHandshake}
            disabled={isTestingWebhook}
            className="rounded-2xl text-xs font-bold h-11 px-4 border-zinc-200 dark:border-zinc-700"
          >
            {isTestingWebhook ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-orange-500" />
                টেস্ট হচ্ছে...
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                ওয়েবহুক টেস্ট করুন
              </>
            )}
          </Button>

          <Button
            onClick={handleSaveMessengerConfig}
            disabled={isSaving}
            className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 text-white font-black text-xs rounded-2xl h-11 px-6 shadow-md shadow-orange-600/20 active:scale-95 transition-transform shrink-0"
          >
            {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
          </Button>
        </div>
      </div>

      {/* Webhook Test Diagnostic Result */}
      {testStatus && (
        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in duration-200 ${
          testStatus.success 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {testStatus.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-bold">{testStatus.success ? 'ওয়েবহুক স্ট্যাটাস: ওকে (OK)' : 'ওয়েবহুক টেস্ট ব্যর্থ'}</span>
            <p className="text-[11px] opacity-90">{testStatus.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook Connection Guide Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white">মেটা ডেভেলপার ওয়েবহুক কনফিগারেশন</h3>
              <p className="text-[11px] text-zinc-500">developers.facebook.com এর Webhooks সেকশনে নিচের তথ্যগুলো দিন</p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Standard Callback URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Callback URL (কপিকরুন এবং ফেসবুকে পেস্ট করুন)
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">প্রস্তুত</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={standardWebhookUrl}
                  className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-[11px] h-10 rounded-xl select-all font-semibold"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(standardWebhookUrl, 'webhook')}
                  className="rounded-xl shrink-0 h-10 px-3 bg-zinc-50 dark:bg-zinc-800"
                >
                  {copiedWebhook ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Verify Token */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Verify Token (যাচাইকরণ টোকেন)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={verifyToken}
                  className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-[11px] h-10 rounded-xl select-all font-semibold"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(verifyToken, 'token')}
                  className="rounded-xl shrink-0 h-10 px-3 bg-zinc-50 dark:bg-zinc-800"
                >
                  {copiedToken ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                * মেটা ডেভেলপারে <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono font-bold text-orange-600">{verifyToken}</code> অথবা আপনার যেকোনো কাস্টম টোকেন ব্যবহার করতে পারেন।
              </p>
            </div>

            {/* Step by step info banner */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                মেটা ডেভেলপার সেটআপ ধাপ:
              </span>
              <ol className="list-decimal pl-4 space-y-0.5 text-[10px] text-amber-800 dark:text-amber-300">
                <li>Facebook App ➔ <strong>Messenger</strong> ➔ <strong>Webhooks</strong> ➔ <strong>Edit Callback URL</strong> এ যান।</li>
                <li>উপরে দেওয়া <strong>Callback URL</strong> ও <strong>Verify Token</strong> দিয়ে <strong>Verify and Save</strong> এ ক্লিক করুন।</li>
                <li>Webhooks ফিল্ডে <strong>messages</strong> এবং <strong>messaging_postbacks</strong> সাবস্ক্রাইব করুন।</li>
              </ol>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3.5">
            <div className="space-y-1.5">
              <label className="font-bold text-xs text-zinc-700 dark:text-zinc-300">
                Facebook Page Access Token (Page Token)
              </label>
              <Input
                type="password"
                value={pageAccessToken}
                onChange={e => setPageAccessToken(e.target.value)}
                placeholder="EAA..."
                className="font-mono text-xs h-10 rounded-xl"
              />
              <p className="text-[10px] text-zinc-500">মেসেঞ্জার এআই থেকে কাস্টমারকে স্বয়ংক্রিয় রিপ্লাই পাঠানোর জন্য পেইজ এক্সেস টোকেন প্রয়োজন।</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-xs text-zinc-700 dark:text-zinc-300">
                Facebook Page ID
              </label>
              <Input
                value={pageId}
                onChange={e => setPageId(e.target.value)}
                placeholder="যেমন: 104928374829102"
                className="font-mono text-xs h-10 rounded-xl"
              />
              <p className="text-[10px] text-zinc-500">আপনার ফেসবুক পেইজের অ্যাবাউট (About) সেকশন থেকে Page ID কপি করে পেস্ট করুন।</p>
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

            <div className="space-y-3 mt-4 max-h-[420px] overflow-y-auto pr-1">
              {liveLogs.length === 0 ? (
                <div className="text-center py-12 space-y-2.5 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl p-4">
                  <MessageCircle className="w-9 h-9 text-zinc-300 dark:text-zinc-700 mx-auto" />
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">এখনো কোনো লাইভ মেসেঞ্জার ইভেন্ট আসেনি</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    ফেসবুক ডেভেলপার ড্যাশবোর্ডে Callback URL ভেরিফাই করে আপনার পেইজে একটি মেসেজ পাঠিয়ে দেখুন। সাথে সাথে এখানে রিয়েল-টাইম লগ প্রদর্শিত হবে।
                  </p>
                </div>
              ) : (
                liveLogs.map(log => (
                  <div key={log.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl text-xs space-y-1.5 border border-zinc-100 dark:border-zinc-800/80">
                    <div className="flex justify-between font-bold text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1 font-mono">
                        <User className="w-3 h-3 text-orange-500" />
                        Sender ID: {log.senderId || 'FB User'}
                      </span>
                      <span>{formatLogTimestamp(log.timestamp)}</span>
                    </div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{log.message}</p>
                    {log.reply && (
                      <div className="pt-1">
                        <p className="text-[11px] text-orange-600 dark:text-orange-400 font-bold pl-2.5 border-l-2 border-orange-500 leading-snug">
                          🤖 {log.reply}
                        </p>
                      </div>
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
