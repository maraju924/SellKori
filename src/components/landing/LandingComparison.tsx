import React from 'react';
import type { LandingContent } from '../../lib/landingContent';
import { SectionHeading } from './LandingPrimitives';

export function LandingComparison({ content }: { content: LandingContent }) {
  return (
    <section id="comparison" className="py-16 md:py-24 bg-white border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading eyebrow={content.comparisonEyebrow} title={content.comparisonTitle} subtitle={content.comparisonSubtitle} />
        <div className="mt-10 overflow-x-auto border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="p-4 font-medium">বিষয়</th>
                {content.comparisonColumns.map((column) => (
                  <th key={column} className="p-4 font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.comparisonRows.map((row, index) => (
                <tr key={row.feature} className={index % 2 ? 'bg-[#f4f2ee]' : 'bg-white'}>
                  <td className="p-4 font-medium text-slate-900 align-top">{row.feature}</td>
                  <td className="p-4 text-slate-600 align-top">{row.traditional}</td>
                  <td className="p-4 text-slate-600 align-top">{row.buttonBot}</td>
                  <td className="p-4 text-slate-800 align-top">{row.sellkori}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
