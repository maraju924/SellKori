import React, { useEffect, useMemo, useState } from 'react';
import {
  Send,
  Clock,
  MessageSquare,
  Save,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { BusinessConfig, BroadcastingCampaign, BroadcastAudience } from '../../types';
import { toast } from 'sonner';
import { isFeatureEnabled } from '../../lib/featureFlags';
import { parseJsonResponse } from '../../lib/safeJson';
import {
  DEFAULT_COMMENT_INBOX_MESSAGE,
  DEFAULT_COMMENT_KEYWORDS,
  DEFAULT_COMMENT_PUBLIC_REPLY,
  parseCommentKeywords
} from '../../lib/outreach';
import { db } from '../../lib/firebase';
import { listenQueryAcrossPanelDbs } from '../../lib/panelDb';
import {
  collection,
  doc,
  query,
  setDoc,
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { cleanFirestoreData } from '../../lib/utils';

interface MerchantBroadcastingProps {
  business: BusinessConfig;
}

interface PreviewStats {
  eligibleCount: number;
  skippedOutsideWindow: number;
  skippedNoPsid: number;
  truncated: boolean;
  totalCustomers: number;
}

const AUDIENCES: { id: BroadcastAudience; label: string; desc: string }[] = [
  { id: 'all', label: 'সকল গ্রাহক', desc: '২৪ ঘণ্টায় চ্যাট করা সবাই' },
  { id: 'hot_leads', label: 'হট লিড', desc: 'কথা বলেছে, এখনো কেনেনি' },
  { id: 'buyers', label: 'সফল ক্রেতা', desc: 'আগে অর্ডার করেছে' }
];

export function MerchantBroadcasting({ business }: MerchantBroadcastingProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<BroadcastAudience>('all');
  const [isSending, setIsSending] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewStats | null>(null);
  const [campaigns, setCampaigns] = useState<BroadcastingCampaign[]>([]);

  const broadcastingOn = isFeatureEnabled(business.features, 'broadcastingEnabled');
  const commentOn = isFeatureEnabled(business.features, 'commentToInboxEnabled');
  const messengerOn = isFeatureEnabled(business.features, 'messengerRepliesEnabled');

  const [keywordsText, setKeywordsText] = useState(
    Array.isArray(business.commentToInboxKeywords)
      ? business.commentToInboxKeywords.join(', ')
      : String(business.commentToInboxKeywords || DEFAULT_COMMENT_KEYWORDS.join(', '))
  );
  const [inboxMessage, setInboxMessage] = useState(
    business.commentInboxMessage || DEFAULT_COMMENT_INBOX_MESSAGE
  );
  const [publicReply, setPublicReply] = useState(
    business.commentPublicReply || DEFAULT_COMMENT_PUBLIC_REPLY
  );
  const [savingComment, setSavingComment] = useState(false);

  useEffect(() => {
    if (!business.id) return;
    return listenQueryAcrossPanelDbs<BroadcastingCampaign>(
      (database) => query(
        collection(database, 'broadcasts'),
        where('businessId', '==', business.id),
        limit(40)
      ),
      (rows) => {
        const sorted = [...rows];
        sorted.sort((a, b) => ((b as any).createdAtMs || 0) - ((a as any).createdAtMs || 0));
        setCampaigns(sorted);
      },
    );
  }, [business.id]);

  useEffect(() => {
    setPreview(null);
  }, [targetAudience]);

  const keywordCount = useMemo(() => parseCommentKeywords(keywordsText).length, [keywordsText]);

  const fetchPreview = async (silent = false) => {
    if (!broadcastingOn || !messengerOn) return;
    setIsPreviewing(true);
    try {
      const res = await fetch('/api/broadcast/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          targetAudience
        })
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'প্রিভিউ নেওয়া যায়নি');
      }
      setPreview({
        eligibleCount: data.eligibleCount || 0,
        skippedOutsideWindow: data.skippedOutsideWindow || 0,
        skippedNoPsid: data.skippedNoPsid || 0,
        truncated: Boolean(data.truncated),
        totalCustomers: data.totalCustomers || 0
      });
      if (!silent) {
        toast.success(`${data.eligibleCount || 0} জন ২৪ ঘণ্টার উইন্ডোতে পাবে`);
      }
    } catch (e: any) {
      toast.error(e.message || 'প্রিভিউ ব্যর্থ');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastingOn) {
      toast.error('ব্রডকাস্ট বন্ধ আছে');
      return;
    }
    if (!messengerOn) {
      toast.error('মেসেঞ্জার আউটবাউন্ড রিপ্লাই বন্ধ আছে');
      return;
    }
    if (!message.trim()) {
      toast.error('ক্যাম্পেইনের মেসেজ লিখুন');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          ownerId: business.ownerId,
          title: title.trim() || 'মেসেঞ্জার অফার',
          message: message.trim(),
          targetAudience
        })
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ব্রডকাস্ট পাঠানো যায়নি');
      }
      toast.success(`${data.sentCount || 0} জনের ইনবক্সে মেসেজ গেছে`, {
        description: data.skippedOutsideWindow
          ? `${data.skippedOutsideWindow} জন ২৪ ঘণ্টার বাইরে থাকায় স্কিপ।`
          : 'ফেসবুক ২৪-ঘণ্টা পলিসি মেনে পাঠানো হয়েছে।'
      });
      setTitle('');
      setMessage('');
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || 'ব্রডকাস্ট ব্যর্থ হয়েছে');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveCommentSettings = async () => {
    if (!business.id) return;
    setSavingComment(true);
    try {
      await setDoc(
        doc(db, 'businesses', business.id),
        cleanFirestoreData({
          commentToInboxKeywords: parseCommentKeywords(keywordsText),
          commentInboxMessage: inboxMessage.trim() || DEFAULT_COMMENT_INBOX_MESSAGE,
          commentPublicReply: publicReply.trim() || DEFAULT_COMMENT_PUBLIC_REPLY,
          updatedAt: serverTimestamp()
        }),
        { merge: true }
      );
      toast.success('কমেন্ট-টু-ইনবক্স সেটিংস সেভ হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'সেভ করা যায়নি');
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">ব্রডকাস্ট</h2>
        {!broadcastingOn && (
          <span className="text-xs text-rose-600">বন্ধ</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">ক্যাম্পেইন নাম</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="যেমন: উইকেন্ড স্পেশাল ফ্রি ডেলিভারি অফার"
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">টার্গেট অডিয়েন্স</label>
            <div className="grid grid-cols-3 gap-3">
              {AUDIENCES.map(aud => (
                <button
                  key={aud.id}
                  type="button"
                  onClick={() => setTargetAudience(aud.id)}
                  className={`p-3 rounded-2xl text-left border transition-all ${
                    targetAudience === aud.id
                      ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/30 text-orange-950 dark:text-orange-200'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <p className="font-bold text-xs">{aud.label}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{aud.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">মেসেজ কন্টেন্ট *</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="যেমন: প্রিয়{{name}}, আমাদের নতুন কালেকশনে পাচ্ছেন ২০% ফ্ল্যাট ছাড়! স্টক শেষ হওয়ার আগেই অর্ডার করুন।"
              className="min-h-[120px] rounded-2xl text-xs leading-relaxed"
            />
            <p className="text-[10px] text-zinc-400">নাম বসাতে <code>{'{{name}}'}</code> ব্যবহার করতে পারেন।</p>
          </div>

          {preview && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 space-y-1">
              <p>{preview.eligibleCount} জন এখনই পাবে</p>
              <p className="font-medium text-zinc-500">
                {preview.skippedOutsideWindow} জন ২৪ ঘণ্টার বাইরে · {preview.skippedNoPsid} জনের মেসেঞ্জার আইডি নেই
                {preview.truncated ? ' · এক রানে সর্বোচ্চ ৮০ জন' : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchPreview(false)}
              disabled={isPreviewing || !broadcastingOn || !messengerOn}
              className="h-11 rounded-2xl font-black text-xs"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isPreviewing ? 'animate-spin' : ''}`} />
              {isPreviewing ? 'গণনা হচ্ছে...' : 'কতজন পাবে দেখুন'}
            </Button>
            <Button
              onClick={handleSendBroadcast}
              disabled={isSending || !broadcastingOn || !messengerOn}
              className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 text-white font-black text-xs rounded-2xl h-11 shadow-md shadow-orange-600/20"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {isSending ? 'পাঠানো হচ্ছে...' : 'আসল ব্রডকাস্ট পাঠান'}
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-2 text-sm">
          <h4 className="font-semibold text-zinc-900 dark:text-white">২৪ ঘণ্টা</h4>
          <p className="text-zinc-500 text-xs">গত ২৪ ঘণ্টায় চ্যাট করা গ্রাহকই পাবে।</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">কমেন্ট-টু-ইনবক্স</h3>
          <span className={`text-xs ${commentOn ? 'text-emerald-600' : 'text-zinc-400'}`}>
            {commentOn ? 'চালু' : 'বন্ধ'}
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">ট্রিগার কিওয়ার্ড ({keywordCount}টি)</label>
          <Textarea
            value={keywordsText}
            onChange={e => setKeywordsText(e.target.value)}
            className="min-h-[72px] rounded-2xl text-xs"
            placeholder="দাম, প্রাইস, price, inbox, ইনবক্স"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">প্রাইভেট ইনবক্স মেসেজ</label>
            <Textarea
              value={inboxMessage}
              onChange={e => setInboxMessage(e.target.value)}
              className="min-h-[96px] rounded-2xl text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">পাবলিক কমেন্ট রিপ্লাই</label>
            <Input
              value={publicReply}
              onChange={e => setPublicReply(e.target.value)}
              className="h-10 rounded-xl text-xs"
            />
            <p className="text-[10px] text-zinc-400">খালি রাখলে পাবলিক রিপ্লাই যাবে না, শুধু ইনবক্স খুলবে।</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleSaveCommentSettings}
          disabled={savingComment}
          className="rounded-2xl h-10 text-xs font-black bg-orange-600 hover:bg-orange-500 text-white"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {savingComment ? 'সেভ হচ্ছে...' : 'কমেন্ট সেটিংস সেভ'}
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <h3 className="font-black text-sm">সাম্প্রতিক ক্যাম্পেইন</h3>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-xs text-zinc-400">এখনো কোনো আসল ব্রডকাস্ট পাঠানো হয়নি।</p>
        ) : (
          <div className="space-y-2">
            {campaigns.slice(0, 8).map(camp => (
              <div
                key={camp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-zinc-100 dark:border-zinc-800 px-4 py-3"
              >
                <div>
                  <p className="text-xs font-black text-zinc-900 dark:text-white">{camp.title}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{camp.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="border-none bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold">
                  {camp.sentCount || 0} পাঠানো
                  </Badge>
                  {(camp.failedCount || 0) > 0 && (
                    <Badge className="border-none bg-rose-100 text-rose-700 text-[10px] font-bold">
                      {camp.failedCount} ব্যর্থ
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
