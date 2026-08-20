import React from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingHowItWorks({ content }: { content: LandingContent }) {
  return (
    <section id="how-it-works" className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading eyebrow={content.stepsEyebrow} title={content.stepsTitle} subtitle={content.stepsSubtitle} />
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {content.steps.map((step, index) => (
            <li key={step.title} className="border-t border-slate-300 pt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {String(index + 1).padStart(2, '0')} · {step.tag}
              </p>
              <h3 className="mt-3 font-heading text-xl text-slate-900">{step.title}</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
