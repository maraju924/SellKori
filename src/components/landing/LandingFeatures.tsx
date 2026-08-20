import React from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingFeatures({ content }: { content: LandingContent }) {
  return (
    <section id="features" className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading eyebrow={content.featuresEyebrow} title={content.featuresTitle} subtitle={content.featuresSubtitle} />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 border border-slate-200">
          {content.features.map((feature) => (
            <article key={feature.title} className="bg-[#f4f2ee] p-6 sm:p-7">
              <h3 className="font-heading text-xl text-slate-900">{feature.title}</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{feature.description}</p>
              <ul className="mt-5 space-y-2">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="text-sm text-slate-700 flex gap-2">
                    <span className="mt-2 h-px w-3 bg-slate-400 shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
