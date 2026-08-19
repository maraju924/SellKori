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
  AlertCircle,
  Terminal,
  Zap,
  Activity,
  CheckCheck,
  ChevronRight,
  ShieldAlert,
  Play,
  Cpu,
  Clock,
  Flame,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData } from '../../lib/utils';
import { parseJsonResponse } from '../../lib/safeJson';

interface MerchantMessengerLiveProps {
  business: BusinessConfig;
}

export function MerchantMessengerLive({ business }: MerchantMessengerLiveProps) {
  const [activeTab, setActiveTab] = useState<'setup' | 'simulator' | 'logs'>('setup');
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSpecificWebhook, setCopiedSpecificWebhook] = useState(false);
  
  const [pageAccessToken, setPageAccessToken] = useState(business.pageAccessToken || '');
  const [pageId, setPageId] = useState(business.pageId || business.facebookPageId || '');
  const [verifyToken, setVerifyToken] = useState(
    business.messengerVerifyToken || business.verifyToken || `sk_${business.id}` || 'sellkori_verify_token'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  
  // Handshake diagnostic
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<{ success: boolean; message: string; code?: number } | null>(null);

  // Meta Token validation diagnostic
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{ success: boolean; message: string; page?: any; subscribed?: boolean } | null>(null);

  useEffect(() => {
    setPageAccessToken(business.pageAccessToken || '');
    setPageId(business.pageId || business.facebookPageId || '');
    setVerifyToken(business.messengerVerifyToken || business.verifyToken || `sk_${business.id}` || 'sellkori_verify_token');
  }, [business.id, business.pageAccessToken, business.pageId, business.facebookPageId, business.messengerVerifyToken, business.verifyToken]);

  // AI Simulator
  const [simulatedMessage, setSimulatedMessage] = useState('আপনাদের কাছে কি টি-শার্ট আছে? দাম কত?');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    success: boolean;
    reply?: string;
    error?: string;
    latencyMs?: number;
    model?: string;
  } | null>(null);

  // Canonical Webhook URLs
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const standardWebhookUrl = `${origin}/api/webhook`;
  const specificWebhookUrl = `${origin}/api/webhook/${business.id}`;

  // Live stream for Messenger logs
  useEffect(() => {
    if (!business.id) return;
    const logsQ = query(
      collection(db, 'messenger_logs'),
      where('businessId', '==', business.id),
      orderBy('timestamp', 'desc'),
      limit(35)
    );

    const unsubscribe = onSnapshot(logsQ, (snap) => {
      setLiveLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('Messenger logs snapshot error:', err);
    });

    return () => unsubscribe();
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

  const persistMessengerConfig = async () => {
    const payload = cleanFirestoreData({
      pageAccessToken: pageAccessToken.trim(),
      accessToken: pageAccessToken.trim(),
      pageId: pageId.trim(),
      facebookPageId: pageId.trim(),
      messengerVerifyToken: verifyToken.trim(),
      verifyToken: verifyToken.trim()
    });
    await updateDoc(doc(db, 'businesses', business.id), payload);
  };

  const handleSaveMessengerConfig = async () => {
    if (!verifyToken.trim()) {
      toast.error('Verify Token খালি রাখা যাবে না');
      return;
    }
    setIsSaving(true);
    try {
      await persistMessengerConfig();
      if (pageAccessToken.trim()) {
        try {
          const subRes = await fetch('/api/messenger/subscribe-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageAccessToken: pageAccessToken.trim() })
          });
          const subData = await parseJsonResponse(subRes);
          if (subRes.ok && subData.page?.id && !pageId) setPageId(subData.page.id);
          if (subRes.ok && subData.needsManualSubscribe && subData.manualSubscribeHint) {
            toast.info(subData.manualSubscribeHint, { duration: 12000 });
          } else if (subRes.ok && subData.subscribed) {
            toast.success('সেটিংস সেভ হয়েছে এবং পেজ ওয়েবহুকে সাবস্ক্রাইব করা হয়েছে!');
          } else {
            toast.success('সেটিংস সেভ হয়েছে। পেজ সাবস্ক্রাইব করতে টোকেন টেস্ট করুন।');
          }
        } catch {
          toast.success('সেটিংস সেভ হয়েছে!');
        }
      } else {
        toast.success('ফেসবুক মেসেঞ্জার ক্রেডেনশিয়ালস সফলভাবে সংরক্ষিত হয়েছে!');
      }
    } catch (e: any) {
      console.error('Messenger config save failed:', e);
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে: ' + (e.message || 'Error'));
    } finally {
      setIsSaving(false);
    }
  };

  const probeHandshake = async (callbackUrl: string) => {
    const challengeTest = `sk_challenge_${Date.now()}`;
    const testUrl = `${callbackUrl}?hub.mode=subscribe&hub.challenge=${encodeURIComponent(challengeTest)}&hub.verify_token=${encodeURIComponent(verifyToken.trim())}`;
    const res = await fetch(testUrl, { cache: 'no-store' });
    const text = await res.text();
    const body = text.replace(/^\uFEFF/, '').trim();
    return {
      ok: res.status === 200 && body === challengeTest,
      status: res.status,
      body: body.slice(0, 180),
      url: callbackUrl
    };
  };

  // Self-diagnostic test for Webhook Handshake
  const handleTestWebhookHandshake = async () => {
    setIsTestingWebhook(true);
    setWebhookStatus(null);
    try {
      const specific = await probeHandshake(specificWebhookUrl);
      if (specific.ok) {
        setWebhookStatus({
          success: true,
          code: 200,
          message: 'স্টোর-নির্দিষ্ট Callback URL মেটার মতোই challenge ফেরত দিচ্ছে (HTTP 200)। Verify and Save এখন কাজ করবে।'
        });
        toast.success('ওয়েবহুক হ্যান্ডশেক সফল!');
        return;
      }

      const globalProbe = await probeHandshake(standardWebhookUrl);
      if (globalProbe.ok) {
        setWebhookStatus({
          success: true,
          code: 200,
          message: 'গ্লোবাল Callback URL হ্যান্ডশেক সফল। Meta-তে এই URL অথবা স্টোর-নির্দিষ্ট URL দিতে পারেন।'
        });
        toast.success('ওয়েবহুক সক্রিয় ও প্রস্তুত!');
        return;
      }

      setWebhookStatus({
        success: false,
        code: specific.status || globalProbe.status,
        message: `হ্যান্ডশেক ব্যর্থ (HTTP ${specific.status}). সার্ভার বলেছে: ${specific.body || 'খালি রেসপন্স'}। Callback URL ও Verify Token হুবহু কপি করে Verify and Save চাপুন।`
      });
      toast.error('ওয়েবহুক যাচাই ব্যর্থ হয়েছে');
    } catch (err: any) {
      setWebhookStatus({
        success: false,
        message: `নেটওয়ার্ক এরর: ${err.message}`
      });
      toast.error('ওয়েবহুক টেস্ট করতে সমস্যা হয়েছে');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Test Page Access Token against Meta Graph API
  const handleTestToken = async () => {
    if (!pageAccessToken.trim()) {
      toast.error('অনুগ্রহ করে আগে Page Access Token প্রদান করুন');
      return;
    }

    setIsTestingToken(true);
    setTokenStatus(null);
    try {
      const res = await fetch('/api/messenger/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageAccessToken: pageAccessToken.trim() })
      });

      const data = await parseJsonResponse(res);
      if (res.ok && data.success) {
        const subscribed = data.subscribed !== false;
        if (!subscribed && data.needsManualSubscribe && data.manualSubscribeHint) {
          setTokenStatus({
            success: true,
            subscribed: false,
            message: data.manualSubscribeHint,
            page: data.page
          });
          if (data.page?.id && data.page.id !== pageId) {
            setPageId(data.page.id);
          }
          toast.success('টোকেন বৈধ! শুধু একবার ম্যানুয়াল সাবস্ক্রিপশন লাগবে (নির্দেশনা দেখুন)');
          return;
        }
        setTokenStatus({
          success: true,
          subscribed,
          message: subscribed
            ? `টোকেন বৈধ এবং পেজ ওয়েবহুকে সাবস্ক্রাইব হয়েছে! পেইজ: "${data.page?.name}" (ID: ${data.page?.id})`
            : `টোকেন বৈধ, কিন্তু পেজ সাবস্ক্রাইব হয়নি: ${data.subscribeError || 'Messenger permission চেক করুন'}। পেইজ: "${data.page?.name}"`,
          page: data.page
        });
        if (data.page?.id && data.page.id !== pageId) {
          setPageId(data.page.id);
          toast.info(`Page ID স্বয়ংক্রিয়ভাবে (${data.page.id}) পূরণ করা হয়েছে!`);
        }
        toast.success(subscribed ? 'টোকেন যাচাই ও পেজ সাবস্ক্রাইব সফল!' : 'টোকেন বৈধ, সাবস্ক্রাইব আবার চেষ্টা করুন');
      } else {
        setTokenStatus({
          success: false,
          message: data.error || 'টোকেনটি অবৈধ বা মেয়াদের বাইরে।'
        });
        toast.error(data.error || 'টোকেন যাচাই ব্যর্থ');
      }
    } catch (e: any) {
      setTokenStatus({
        success: false,
        message: 'সার্ভার সংযোগে ত্রুটি: ' + e.message
      });
      toast.error('টোকেন টেস্ট ব্যর্থ');
    } finally {
      setIsTestingToken(false);
    }
  };

  // Run Simulated Test Message
  const handleSimulateMessage = async () => {
    if (!simulatedMessage.trim()) return;
    setIsSimulating(true);
    setSimulationResult(null);

    try {
      const res = await fetch('/api/messenger/simulate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          message: simulatedMessage.trim(),
          senderId: 'Simulated_Customer_' + Math.floor(Math.random() * 1000)
        })
      });

      const data = await parseJsonResponse(res);
      if (res.ok && data.success) {
        setSimulationResult({
          success: true,
          reply: data.reply,
          latencyMs: data.latencyMs,
          model: data.model
        });
        toast.success('এআই উত্তর সফলভাবে তৈরি হয়েছে!');
      } else {
        setSimulationResult({
          success: false,
          error: data.error || 'এআই উত্তর তৈরিতে ত্রুটি হয়েছে।'
        });
        toast.error(data.error || 'সিমুলেশন ব্যর্থ');
      }
    } catch (e: any) {
      setSimulationResult({
        success: false,
        error: e.message || 'সার্ভার রেসপন্স দেয়নি'
      });
      toast.error('সিমুলেশন রিকোয়েস্ট ব্যর্থ');
    } finally {
      setIsSimulating(false);
    }
  };

  const formatLogTimestamp = (ts: any): string => {
    if (!ts) return 'Just now';
    if (typeof ts === 'string') return ts;
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
    if (ts.toDate && typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return 'Just now';
  };

  const isConfigComplete = !!(pageAccessToken && (pageId || business.pageId || business.facebookPageId));
  const webhookReady = webhookStatus?.success === true;
  const tokenReady = tokenStatus?.success === true;
  const lastIncoming = liveLogs.find((log) => log.status === 'received' || log.status === 'replied');
  const lastReply = liveLogs.find((log) => log.status === 'replied');
  const lastError = liveLogs.find((log) => log.status === 'error');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              ফেসবুক মেসেঞ্জার অটোমেশন ও এআই সেলসম্যান
            </h2>
            {tokenReady ? (
              <Badge className="bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                Meta Graph API সংযুক্ত
              </Badge>
            ) : (
              <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold text-xs">
                Meta Graph API অপেক্ষমাণ
              </Badge>
            )}
            {webhookReady ? (
              <Badge className="bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs">
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                ওয়েবহুক ভেরিফাইড
              </Badge>
            ) : isConfigComplete ? (
              <Badge className="bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                টোকেন আছে — ওয়েবহুক টেস্ট করুন
              </Badge>
            ) : (
              <Badge className="bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                টোকেন ও পেইজ আইডি দিন
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            পেইজে আসা মেসেজের স্বয়ংক্রিয় এআই উত্তর, প্রোডাক্ট কার্ড এবং অর্ডার গ্রহণ। মেটা Configure Webhooks-এ নিচের Callback URL ও Verify Token হুবহু পেস্ট করুন — ভেরিফাই ব্যর্থ হলে মেসেজ আসবেও না, যাবেও না।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestWebhookHandshake}
            disabled={isTestingWebhook}
            className="rounded-2xl text-xs font-bold h-11 px-4 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isTestingWebhook ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-orange-500" />
                টেস্ট হচ্ছে...
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                সার্ভার ওয়েবহুক টেস্ট
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

      {/* 4-Step Health Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            webhookReady
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
              : webhookStatus
                ? 'bg-red-50 dark:bg-red-950/60 text-red-600'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
          }`}>
            <Globe className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 font-bold">সার্ভার ওয়েবহুক</p>
            <p className={`text-xs font-black truncate ${
              webhookReady ? 'text-emerald-600 dark:text-emerald-400' : webhookStatus ? 'text-red-600' : 'text-zinc-400'
            }`}>
              {webhookReady ? 'হ্যান্ডশেক সফল' : webhookStatus ? 'ভেরিফাই ব্যর্থ' : 'টেস্ট করুন'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            pageAccessToken 
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600' 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
          }`}>
            <Key className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 font-bold">পেজ টোকেন</p>
            <p className={`text-xs font-black truncate ${
              tokenReady ? 'text-blue-600 dark:text-blue-400' : pageAccessToken ? 'text-amber-600' : 'text-zinc-400'
            }`}>
              {tokenReady
                ? (tokenStatus?.subscribed === false ? 'টোকেন বৈধ, সাবস্ক্রাইব বাকি' : 'যাচাই ও সাবস্ক্রাইবড')
                : pageAccessToken ? 'সেভ আছে — টেস্ট করুন' : 'অনুপস্থিত'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            pageId || business.pageId || business.facebookPageId
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
          }`}>
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 font-bold">ফেসবুক পেজ আইডি</p>
            <p className={`text-xs font-black font-mono truncate ${
              pageId || business.pageId || business.facebookPageId 
                ? 'text-purple-600 dark:text-purple-400' 
                : 'text-zinc-400'
            }`}>
              {pageId || business.pageId || business.facebookPageId || 'সেট করা হয়নি'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500 font-bold">এআই মডেল ব্রেন</p>
            <p className="text-xs font-black text-orange-600 dark:text-orange-400 truncate">
              {business.selectedAiModel || 'gemini-3.7-flash'}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
              {lastError
                ? `শেষ ত্রুটি: ${String(lastError.error || 'unknown').slice(0, 48)}`
                : lastReply
                  ? `শেষ রিপ্লাই ${formatLogTimestamp(lastReply.timestamp)}`
                  : lastIncoming
                    ? `শেষ ইনকামিং ${formatLogTimestamp(lastIncoming.timestamp)}`
                    : 'এখনো লাইভ মেসেজ আসেনি'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('setup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'setup'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Key className="w-4 h-4" />
          ১. সেটআপ ও ক্রেডেনশিয়ালস
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'simulator'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Play className="w-4 h-4 text-orange-500" />
          ২. এআই সেলসম্যান সিমুলেটর ও লাইভ টেস্ট
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'logs'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-500" />
          ৩. রিয়েল-টাইম মেসেঞ্জার লগস ({liveLogs.length})
        </button>
      </div>

      {/* TAB 1: Setup & Meta Configuration */}
      {activeTab === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Webhook URLs & Tokens */}
          <div className="lg:col-span-7 space-y-6">
            {/* Meta Webhook Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white">মেটা ডেভেলপার ড্যাশবোর্ড কানেকশন</h3>
                  <p className="text-[11px] text-zinc-500">developers.facebook.com এর Messenger Webhooks সেকশনে নিচের তথ্যগুলো দিন</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                {/* Specific Store Webhook URL */}
                <div className="space-y-1.5 p-3.5 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      আপনার স্টোর-নির্দিষ্ট Callback URL (সর্বাধিক সুপারিশকৃত)
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100% আইসোলেটেড</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      readOnly
                      value={specificWebhookUrl}
                      className="bg-white dark:bg-zinc-800 font-mono text-[11px] h-10 rounded-xl select-all font-semibold text-zinc-800 dark:text-zinc-200"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(specificWebhookUrl, 'specific_webhook')}
                      className="rounded-xl shrink-0 h-10 px-3 bg-white dark:bg-zinc-800 border-orange-200 dark:border-orange-800"
                    >
                      {copiedSpecificWebhook ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-orange-600" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    * এই লিঙ্কটি ব্যবহার করলে মেটা থেকে আসা মেসেজ সরাসরি এই স্টোরের ডাটাবেজেই প্রসেস হবে।
                  </p>
                </div>

                {/* Standard Global Webhook URL */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">
                      অথবা গ্লোবাল Callback URL
                    </label>
                    <span className="text-[10px] text-zinc-500 font-medium">মাল্টি-টেন্যান্ট</span>
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
                    Verify Token (যাচাইকরণ টোকেন) — হুবহু এইটাই মেটায় দিন
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={verifyToken}
                      onChange={e => setVerifyToken(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-[11px] h-10 rounded-xl select-all font-semibold text-orange-600 dark:text-orange-400"
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
                    Meta ➔ Messenger ➔ Webhooks ➔ Edit Callback URL-এ <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono font-bold text-orange-600">{verifyToken || '…'}</code> পেস্ট করুন। আগে সার্ভার শুধু কয়েকটা ফিক্সড টোকেন মানত বলে Configure webhooks ৪০৩ দিত — এখন আপনার স্টোর টোকেন এবং challenge দুটোই গ্রহণ করে।
                  </p>
                </div>
              </div>

              {/* Webhook Test Diagnostic Result */}
              {webhookStatus && (
                <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in duration-200 ${
                  webhookStatus.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                  {webhookStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-bold">{webhookStatus.success ? 'সার্ভার হ্যান্ডশেক সফল' : 'হ্যান্ডশেক ব্যর্থ'}</span>
                    <p className="text-[11px] opacity-90">{webhookStatus.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Page Token & Page ID Card */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-900 dark:text-white">ফেসবুক পেইজ অথেনটিকেশন</h3>
                    <p className="text-[11px] text-zinc-500">মেসেঞ্জার এআই স্বয়ংক্রিয় রিপ্লাই পাঠানোর জন্য পেইজ এক্সেস টোকেন</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestToken}
                  disabled={isTestingToken || !pageAccessToken.trim()}
                  className="rounded-xl text-xs font-bold h-9 px-3 border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  {isTestingToken ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      যাচাই হচ্ছে...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      টোকেন টেস্ট করুন
                    </>
                  )}
                </Button>
              </div>

              {/* Token Validation Result */}
              {tokenStatus && (
                <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  tokenStatus.success
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                  {tokenStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">{tokenStatus.success ? 'ফেসবুক ভ্যালিডেশন সফল!' : 'টোকেন এরর'}</p>
                    <p className="text-[11px] mt-0.5">{tokenStatus.message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>Facebook Page Access Token (পেইজ টোকেন)</span>
                    <span className="text-[10px] text-zinc-400 font-normal">Never expires টোকেন সুপারিশকৃত</span>
                  </label>
                  <Input
                    type="password"
                    value={pageAccessToken}
                    onChange={e => setPageAccessToken(e.target.value)}
                    placeholder="EAAG..."
                    className="font-mono text-xs h-10 rounded-xl"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Facebook Graph API Explorer বা App Dashboard থেকে <strong>pages_messaging</strong> পারমিশনসহ টোকেন জেনারেট করুন।
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Facebook Page ID (পেইজ আইডি)
                  </label>
                  <Input
                    value={pageId}
                    onChange={e => setPageId(e.target.value)}
                    placeholder="যেমন: 104928374829102"
                    className="font-mono text-xs h-10 rounded-xl"
                  />
                  <p className="text-[10px] text-zinc-500">
                    আপনার ফেসবুক পেইজের About ➔ Page transparency থেকে Page ID কপি করে পেস্ট করুন।
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Step-by-Step Instructions & Checklist */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white">মেটা ডেভেলপার সেটআপ গাইডলাইন</h3>
                  <p className="text-[11px] text-zinc-500">৩ মিনিটে ফেসবুক মেসেঞ্জার অটোমেশন চালু করুন</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">১</span>
                    <span>মেটা ডেভেলপারে প্রবেশ করুন</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pl-7">
                    <a 
                      href="https://developers.facebook.com/apps" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-orange-600 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      developers.facebook.com/apps
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    &nbsp;এ গিয়ে আপনার বিজনেস অ্যাপটি ওপেন করুন।
                  </p>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">২</span>
                    <span>ওয়েবহুক ভেরিফাই করুন</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pl-7">
                    <strong>Messenger</strong> ➔ <strong>Webhooks</strong> ➔ <strong>Edit Callback URL</strong>। Callback URL হিসেবে বামের <strong>স্টোর-নির্দিষ্ট URL</strong> পেস্ট করুন (HTTPS লাগবে)। Verify Token বক্সে উপরের টোকেনটি হুবহু পেস্ট করে <strong>Verify and Save</strong> চাপুন। সার্ভার <code className="font-mono">hub.challenge</code> প্লেইন টেক্সটে ফেরত দেয় — HTML/JSON নয়।
                  </p>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">৩</span>
                    <span>ইভেন্ট সাবস্ক্রাইব করুন</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pl-7">
                    Webhooks ফিল্ডে <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">messages</code>, <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">messaging_postbacks</code> এবং কমেন্ট-টু-ইনবক্সের জন্য <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">feed</code> এ টিক দিয়ে সাবস্ক্রাইব করুন। তারপর বামে <strong>টোকেন টেস্ট করুন</strong> চাপলে সার্ভার পেজটিকে অ্যাপে সাবস্ক্রাইব করার চেষ্টা করবে — না হলে মেসেজ রিসিভ হবে না।
                  </p>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">৪</span>
                    <span>পেজ সাবস্ক্রিপশন সম্পন্ন করুন</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pl-7">
                    Messenger ➔ <strong>App Settings</strong> ➔ <strong>Generate Tokens</strong> থেকে আপনার পেজটি সিলেক্ট করে <strong>Subscribe</strong> বাটনে চাপুন।
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 space-y-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                <p className="font-black text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  মেসেজ আসছে না / যাচ্ছে না — কেন?
                </p>
                <ul className="list-disc pl-4 space-y-1 leading-relaxed">
                  <li>Configure webhooks ভেরিফাই না হলে মেটা ইভেন্ট পাঠায় না — আগে <strong>সার্ভার ওয়েবহুক টেস্ট</strong> সবুজ করুন।</li>
                  <li>পেজ Access Token-এ <code className="font-mono">pages_messaging</code> না থাকলে উত্তর পাঠানো যায় না।</li>
                  <li>পেজটি অ্যাপে Subscribe না থাকলে রিসিভ হয় না — <strong>টোকেন টেস্ট করুন</strong> অটো-সাবস্ক্রাইব করে।</li>
                  <li>Page ID স্টোর সেটিংসের সাথে না মিললে বট অন্য দোকানে খুঁজে পায় না।</li>
                </ul>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveMessengerConfig}
                  disabled={isSaving}
                  className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-xs rounded-2xl h-11"
                >
                  {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সেভ করুন'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI Salesman Simulator */}
      {activeTab === 'simulator' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-zinc-900 dark:text-white">
                  এআই সেলসম্যান লাইভ সিমুলেটর (Instant Test)
                </h3>
                <p className="text-xs text-zinc-500">
                  ফেসবুকে মেসেজ না পাঠিয়েও আপনার স্টোরের ক্যাটালগ ও FAQ অনুযায়ী বট কীভাবে উত্তর দেয় তা এখনই টেস্ট করুন।
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input & Controls */}
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  কাস্টমারের প্রশ্ন বা বার্তা:
                </label>
                <div className="relative">
                  <textarea
                    rows={4}
                    value={simulatedMessage}
                    onChange={e => setSimulatedMessage(e.target.value)}
                    placeholder="যেমন: এই শার্টটির প্রাইস কত? ডেলিভারি চার্জ কত?"
                    className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3.5 text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Sample Queries */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-zinc-500">নমুনা প্রশ্ন নির্বাচন করুন:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'আপনাদের ডেলিভারি চার্জ কত এবং কতদিন লাগে?',
                    'আমি ২ পিস নিলে কত ছাড় পাওয়া যাবে?',
                    'ক্যাশ অন ডেলিভারি দেওয়া যাবে?',
                    'আমি এই প্রোডাক্টটি কিনতে চাই, কিভাবে অর্ডার করবো?'
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSimulatedMessage(sample)}
                      className="text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-zinc-700 dark:text-zinc-300 hover:text-orange-600 px-3 py-1.5 rounded-xl transition-colors text-left"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSimulateMessage}
                disabled={isSimulating || !simulatedMessage.trim()}
                className="w-full bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 text-white font-black text-xs rounded-2xl h-11 shadow-md shadow-orange-600/20 active:scale-98 transition-transform"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    এআই প্রসেসিং হচ্ছে...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    টেস্ট মেসেজ পাঠান ও উত্তর দেখুন
                  </>
                )}
              </Button>
            </div>

            {/* AI Response Inspector */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 min-h-[220px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <Bot className="w-4 h-4 text-orange-500" />
                      এআই সেলসম্যান রেসপন্স
                    </span>
                    {simulationResult?.latencyMs && (
                      <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        {simulationResult.latencyMs}ms ({simulationResult.model})
                      </span>
                    )}
                  </div>

                  <div className="pt-3">
                    {isSimulating ? (
                      <div className="py-10 text-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                        <p className="text-xs text-zinc-500">আপনার প্রোডাক্ট তালিকা ও FAQ অ্যানালাইজ করা হচ্ছে...</p>
                      </div>
                    ) : simulationResult ? (
                      simulationResult.success ? (
                        <div className="space-y-3">
                          <div className="p-3.5 bg-white dark:bg-zinc-900 border border-orange-200/60 dark:border-orange-950 rounded-2xl text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed shadow-xs">
                            <p className="font-medium whitespace-pre-wrap">{simulationResult.reply}</p>
                          </div>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            সিমুলেশন সফল! এটি আপনার মেসেঞ্জার লাইভ লগেও সংরক্ষিত হয়েছে।
                          </p>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-700 dark:text-red-300 space-y-1">
                          <p className="font-bold flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            এআই উত্তর দিতে পারেনি
                          </p>
                          <p className="text-[11px]">{simulationResult.error}</p>
                        </div>
                      )
                    ) : (
                      <div className="py-12 text-center text-xs text-zinc-400 space-y-1">
                        <MessageCircle className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
                        <p>বাম পাশের বক্সে প্রশ্ন লিখে "টেস্ট মেসেজ পাঠান" এ ক্লিক করুন।</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Real-Time Messenger Live Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-zinc-900 dark:text-white">
                  রিয়েল-টাইম মেসেঞ্জার লাইভ স্ট্রিম
                </h3>
                <p className="text-xs text-zinc-500">
                  ফেসবুক পেজে কাস্টমারদের পাঠানো মেসেজ ও এআই সেলসম্যানের স্বয়ংক্রিয় উত্তরের লাইভ ফিড
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                লাইভ লিসেনিং
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {liveLogs.length === 0 ? (
              <div className="text-center py-16 space-y-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl p-6">
                <MessageCircle className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">এখনো কোনো লাইভ মেসেঞ্জার ইভেন্ট আসেনি</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    ১. "সেটআপ ও ক্রেডেনশিয়ালস" ট্যাবে গিয়ে Callback URL ও Page Token সংরক্ষণ করুন।<br />
                    ২. ফেসবুকে আপনার পেইজে একটি মেসেজ পাঠিয়ে দেখুন অথবা "সিমুলেটর" ট্যাব থেকে টেস্ট মেসেজ পাঠান।
                  </p>
                </div>
              </div>
            ) : (
              liveLogs.map((log) => {
                const isError = log.status === 'error';
                const isReplied = log.status === 'replied';

                return (
                  <div 
                    key={log.id} 
                    className={`p-4 rounded-2xl text-xs space-y-2 border transition-all ${
                      isError 
                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/80 dark:border-red-900/60' 
                        : isReplied
                          ? 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-800'
                          : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40'
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[10px] text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-mono text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                          <User className="w-3 h-3 text-orange-500" />
                          Sender ID: {log.senderId || 'FB User'}
                        </span>
                        {log.pageId && (
                          <span className="font-mono text-zinc-500">
                            Page ID: {log.pageId}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {log.latencyMs ? (
                          <span className="text-zinc-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            {log.latencyMs}ms
                          </span>
                        ) : null}
                        <span className="text-zinc-500">{formatLogTimestamp(log.timestamp)}</span>
                      </div>
                    </div>

                    {/* Customer Message */}
                    <div className="flex items-start gap-2 pt-0.5">
                      <span className="text-zinc-400 font-bold shrink-0">কাস্টমার:</span>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                        {log.message}
                      </p>
                    </div>

                    {/* Bot Reply */}
                    {log.reply && (
                      <div className="mt-2 p-3 bg-white dark:bg-zinc-900/80 border border-orange-100 dark:border-orange-950/80 rounded-xl space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                          <Bot className="w-3.5 h-3.5" />
                          এআই সেলসম্যানের উত্তর:
                        </div>
                        <p className="text-xs text-zinc-800 dark:text-zinc-200 pl-4 border-l-2 border-orange-500 whitespace-pre-wrap leading-relaxed">
                          {log.reply}
                        </p>
                      </div>
                    )}

                    {/* Error display */}
                    {log.error && (
                      <div className="mt-2 p-2.5 bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-[11px] flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                        <div>
                          <span className="font-bold">ত্রুটি: </span>
                          <span>{log.error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
