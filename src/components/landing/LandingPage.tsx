import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../../types';
import { usePublicConfig } from '../../lib/usePublicConfig';
import { LandingNavbar } from './LandingNavbar';
import { LandingHero } from './LandingHero';
import { LandingInteractiveDemo } from './LandingInteractiveDemo';
import { LandingFeatures } from './LandingFeatures';
import { LandingComparison } from './LandingComparison';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingPricingCalculator } from './LandingPricingCalculator';
import { LandingTestimonials } from './LandingTestimonials';
import { LandingFAQ } from './LandingFAQ';
import { LandingFooter } from './LandingFooter';
import { FormalButton } from './LandingPrimitives';

interface LandingPageProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
}

export function LandingPage({ user, profile }: LandingPageProps) {
  const { config } = usePublicConfig();
  const { landing } = config;

  return (
    <div className="min-h-screen bg-[#f4f2ee] text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {config.maintenanceMode ? (
        <div className="bg-slate-800 text-white text-center text-xs sm:text-sm py-2 px-4">
          প্ল্যাটফর্মে নির্ধারিত রক্ষণাবেক্ষণ চলছে। সেবা সাময়িকভাবে সীমিত থাকতে পারে।
        </div>
      ) : null}

      <LandingNavbar user={user} profile={profile} config={config} />
      <LandingHero content={landing} />
      <LandingInteractiveDemo content={landing} />
      <LandingFeatures content={landing} />
      <LandingComparison content={landing} />
      <LandingHowItWorks content={landing} />
      <LandingPricingCalculator config={config} />
      <LandingTestimonials content={landing} />
      <LandingFAQ content={landing} />

      <section className="py-16 md:py-24 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{landing.ctaEyebrow}</p>
          <h2 className="mt-4 font-heading text-3xl sm:text-4xl md:text-5xl font-semibold max-w-2xl leading-tight">
            {landing.ctaTitle}
          </h2>
          <p className="mt-5 max-w-xl text-slate-300 leading-relaxed">{landing.ctaSubtitle}</p>
          <div className="mt-8">
            <FormalButton href="/login" variant="onDark">
              {landing.primaryCta}
            </FormalButton>
          </div>
        </div>
      </section>

      <LandingFooter content={landing} />
    </div>
  );
}
