import React from 'react';
import { Link } from 'react-router-dom';
import type { LandingContent } from '../../lib/landingContent';

export function LandingFooter({ content }: { content: LandingContent }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <Link to="/" className="font-heading text-2xl text-white">
              {content.brandName}{content.brandSuffix}
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-400 max-w-sm">{content.footerBlurb}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">প্ল্যাটফর্ম</p>
            <ul className="mt-4 space-y-2 text-sm">
              {content.nav.map((item) => (
                <li key={item.href}><a href={item.href} className="hover:text-white">{item.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">যোগাযোগ</p>
            <ul className="mt-4 space-y-2 text-sm">
              {content.footerEmail ? <li>{content.footerEmail}</li> : null}
              {content.footerPhone ? <li>{content.footerPhone}</li> : null}
              {content.integrations.slice(0, 4).map((item) => (
                <li key={item} className="text-slate-500">{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <p>© {year} {content.footerNote}</p>
        </div>
      </div>
    </footer>
  );
}
