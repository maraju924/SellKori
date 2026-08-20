import React, { useMemo, useState } from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingInteractiveDemo({ content }: { content: LandingContent }) {
  const { demo } = content;
  const script = useMemo(() => ([
    { from: 'user' as const, text: `${demo.productName} এর দাম কত?` },
    { from: 'bot' as const, text: `${demo.storeName} থেকে ${demo.productName} এখন ${demo.regularPrice} টাকা। চাইলে ছবিও পাঠাতে পারি।` },
    { from: 'user' as const, text: 'একটু কম রাখেন ভাই' },
    { from: 'bot' as const, text: `এই মুহূর্তে ${demo.offerPrice} টাকায় দিতে পারি। এর নিচে যাওয়া যাবে না।` },
    { from: 'user' as const, text: 'অর্ডার করতে চাই, নাম রাকিব, 01712345678, ধানমন্ডি' },
    { from: 'bot' as const, text: `রাকিব, ${demo.productName} — ${demo.offerPrice} টাকা, ঢাকার ভিতর ডেলিভারি। অর্ডারটি কনফার্ম করে ড্যাশবোর্ডে পাঠানো হয়েছে।` },
  ]), [demo]);
  const [step, setStep] = useState(2);

  return (
    <section id="demo" className="py-16 md:py-24 border-y border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-start">
        <SectionHeading
          eyebrow="ডেমো"
          title={`${demo.storeName} ইনবক্সের নমুনা`}
          subtitle="একটি পণ্যের দাম, দরদাম ও অর্ডার — একই কথোপকথনে। এটি সিমুলেশন; লাইভ পেজে আপনার ক্যাটালগ ব্যবহার হয়।"
        />
        <div className="border border-slate-200 bg-[#f4f2ee]">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">{demo.storeName}</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Messenger</p>
          </div>
          <div className="p-4 space-y-3 min-h-[280px]">
            {script.slice(0, step).map((message, index) => (
              <div key={index} className={`max-w-[90%] text-sm leading-relaxed px-3.5 py-2.5 ${message.from === 'user' ? 'ml-auto bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                {message.text}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap gap-2">
            {demo.prompts.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setStep(Math.min(script.length, (index + 1) * 2))}
                className="text-xs px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
