import React, { useState } from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingFAQ({ content }: { content: LandingContent }) {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="py-16 md:py-24 bg-white border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16">
        <SectionHeading eyebrow={content.faqEyebrow} title={content.faqTitle} />
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {content.faqs.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={faq.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  className="w-full text-left py-5 flex items-start justify-between gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-medium text-slate-900">{faq.q}</span>
                  <span className="text-slate-400 text-lg leading-none mt-0.5">{isOpen ? '–' : '+'}</span>
                </button>
                {isOpen ? (
                  <p className="pb-5 text-sm text-slate-600 leading-relaxed max-w-2xl">{faq.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
