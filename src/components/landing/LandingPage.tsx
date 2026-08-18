import React from 'react';
import { LandingNavbar } from './LandingNavbar';
import { LandingHero } from './LandingHero';
import { LandingInteractiveDemo } from './LandingInteractiveDemo';
import { LandingComparison } from './LandingComparison';
import { LandingFeatures } from './LandingFeatures';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingPricingCalculator } from './LandingPricingCalculator';
import { LandingTestimonials } from './LandingTestimonials';
import { LandingFAQ } from './LandingFAQ';
import { LandingFooter } from './LandingFooter';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../../types';

interface LandingPageProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
}

export function LandingPage({ user, profile }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-orange-500 selection:text-white">
      {/* 1. Sticky Navigation Header */}
      <LandingNavbar user={user} profile={profile} />

      {/* 2. Hero Section with Glows, Dynamic Pitch & App Mockup */}
      <LandingHero />

      {/* 3. Live Interactive AI Chat Simulation Sandbox */}
      <LandingInteractiveDemo />

      {/* 4. Feature Highlights & Deep Technical Modules */}
      <LandingFeatures />

      {/* 5. Direct Comparison: Traditional Selling vs SellKori AI */}
      <LandingComparison />

      {/* 6. Step-by-Step 4-Step Process Guide */}
      <LandingHowItWorks />

      {/* 7. Transparent Pricing, Token Economy & Interactive ROI Calculator */}
      <LandingPricingCalculator />

      {/* 8. Verified Merchant Testimonials & Real Case Studies */}
      <LandingTestimonials />

      {/* 9. In-Depth FAQ Accordion */}
      <LandingFAQ />

      {/* 10. High-Impact Final Call To Action Banner */}
      <section className="py-16 md:py-24 relative overflow-hidden bg-zinc-900 text-white">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-4 py-1.5 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>কোনো ক্রেডিট কার্ড ছাড়াই শুরু করুন</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
            আজই আপনার ফেসবুক মেসেঞ্জারকে <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-amber-300">
              ২৪/৭ অটো সেলস মেশিনে রূপান্তর করুন
            </span>
          </h2>

          <p className="text-zinc-300 text-base md:text-xl max-w-2xl mx-auto leading-relaxed">
            দেরিতে রিপ্লাইয়ের কারণে আর একটিও কাস্টমার হারাবেন না। এখনই সাইন আপ করে ফ্রিতে শুরু করুন।
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-14 md:h-16 px-10 text-base md:text-lg bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl shadow-xl shadow-orange-500/30 transition-transform active:scale-95">
                ফ্রি ট্রায়াল শুরু করুন (১০,০০০ টোকেন)
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 11. Complete Rich Footer */}
      <LandingFooter />
    </div>
  );
}
