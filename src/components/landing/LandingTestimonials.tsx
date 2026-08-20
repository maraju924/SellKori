import React from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingTestimonials({ content }: { content: LandingContent }) {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading eyebrow={content.testimonialsEyebrow} title={content.testimonialsTitle} />
        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {content.testimonials.map((item) => (
            <figure key={item.name} className="border-t border-slate-300 pt-6">
              <blockquote className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-6">
                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500 mt-1">{item.role} · {item.store}</p>
                <p className="text-xs text-slate-700 mt-2">{item.result}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
