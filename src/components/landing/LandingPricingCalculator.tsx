import React, { useMemo, useState } from 'react';
import type { PublicSiteConfig } from '../../lib/landingContent';
import { formatBnNumber } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingPricingCalculator({ config }: { config: PublicSiteConfig }) {
  const { billing, landing } = config;
  const [messages, setMessages] = useState(800);
  const conversations = Math.max(1, Math.round(messages / Math.max(1, landing.tokensPerConversation)));
  const tokensUsed = messages;
  const cost = useMemo(
    () => (tokensUsed / 100000) * billing.tokenRatePerLakh,
    [tokensUsed, billing.tokenRatePerLakh],
  );
  const orders = Math.round(conversations * (landing.conversionRate / 100));
  const revenue = orders * landing.avgOrderValue;

  return (
    <section id="pricing" className="py-16 md:py-24 bg-white border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-20">
        <SectionHeading eyebrow={landing.pricingEyebrow} title={landing.pricingTitle} subtitle={landing.pricingSubtitle} />
        <div className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">টোকেন</p>
              <p className="mt-2 font-heading text-2xl text-slate-900">৳{formatBnNumber(billing.tokenRatePerLakh)} / ১ লাখ</p>
              <p className="mt-2 text-sm text-slate-600">ট্রায়াল {formatBnNumber(billing.freeTrialTokens)} টোকেন</p>
            </div>
            <div className="border border-slate-200 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">প্ল্যাটফর্ম</p>
              <p className="mt-2 font-heading text-2xl text-slate-900">৳{formatBnNumber(billing.monthlyServerCost)} / মাস</p>
              <p className="mt-2 text-sm text-slate-600">ইনফ্রাস্ট্রাকচার ও হোস্টিং</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
              <span>মাসিক এআই কথোপকথন (আনুমানিক টোকেন)</span>
              <span className="text-slate-900">{formatBnNumber(messages)}</span>
            </div>
            <input
              type="range"
              min={200}
              max={20000}
              step={200}
              value={messages}
              onChange={(event) => setMessages(Number(event.target.value))}
              className="w-full accent-slate-900"
            />
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center border border-slate-200 divide-x divide-slate-200">
              <div className="p-4">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">এআই খরচ</dt>
                <dd className="mt-1 text-slate-900 font-medium">৳{cost.toFixed(0)}</dd>
              </div>
              <div className="p-4">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">আনুমানিক অর্ডার</dt>
                <dd className="mt-1 text-slate-900 font-medium">{formatBnNumber(orders)}</dd>
              </div>
              <div className="p-4">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">গ্রস সেলস</dt>
                <dd className="mt-1 text-slate-900 font-medium">৳{formatBnNumber(revenue)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              হিসাবটি {landing.tokensPerConversation} টোকেন/কথোপকথন, {landing.conversionRate}% কনভার্সন ও ৳{landing.avgOrderValue} গড় অর্ডার ধরে। প্রকৃত খরচ কথোপকথনের দৈর্ঘ্য অনুযায়ী বদলায়।
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
