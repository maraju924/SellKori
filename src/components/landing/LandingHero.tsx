import React from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { FormalButton } from './LandingPrimitives';

export function LandingHero({ content }: { content: LandingContent }) {
  return (
    <section className="pt-12 sm:pt-16 md:pt-24 pb-12 md:pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{content.heroEyebrow}</p>
          <h1 className="mt-4 font-heading text-[2.05rem] sm:text-5xl md:text-[3.35rem] font-semibold tracking-tight leading-[1.12] text-slate-900">
            {content.heroHeadline}
            <span className="block mt-2 font-normal text-slate-600">{content.heroHeadlineAccent}</span>
          </h1>
          <p className="mt-6 text-[15px] sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
            {content.heroSubheadline}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <FormalButton href="/login">{content.primaryCta}</FormalButton>
            <FormalButton href="#demo" variant="outline">{content.secondaryCta}</FormalButton>
          </div>
          <ul className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-6 text-sm text-slate-500">
            {content.trustItems.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-px w-4 bg-slate-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
          {content.stats.map((stat) => (
            <div key={stat.label} className="bg-[#f4f2ee] px-4 sm:px-6 py-6">
              <p className="font-heading text-2xl sm:text-3xl text-slate-900">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{stat.label}</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
