import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { UserProfile } from '../../types';
import type { PublicSiteConfig } from '../../lib/landingContent';

interface LandingNavbarProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  config: PublicSiteConfig;
}

export function LandingNavbar({ user, profile, config }: LandingNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { landing } = config;
  const topLine = config.globalAnnouncement || landing.promo;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const logout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <header className={`sticky top-0 z-50 ${isScrolled ? 'bg-[#f4f2ee]/95 backdrop-blur-md border-b border-slate-200' : 'bg-[#f4f2ee] border-b border-transparent'}`}>
      {topLine ? (
        <div className="border-b border-slate-200 bg-slate-900 text-slate-100">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-2 text-center text-[11px] sm:text-xs tracking-wide">
            {topLine}
          </p>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 md:h-[4.25rem]">
          <Link to="/" className="min-w-0">
            <span className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
              {landing.brandName}
              <span className="font-normal">{landing.brandSuffix}</span>
            </span>
            <span className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">
              {landing.tagline}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7">
            {landing.nav.map((item) => (
              <a key={item.href} href={item.href} className="text-[13px] text-slate-600 hover:text-slate-900">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <>
                {profile?.role === 'admin' ? (
                  <Link to="/admin" className="text-[13px] text-slate-600 hover:text-slate-900">অ্যাডমিন</Link>
                ) : null}
                <Link to="/dashboard" className="h-9 px-4 inline-flex items-center rounded-md bg-slate-900 text-white text-[13px]">
                  ড্যাশবোর্ড
                </Link>
                <button type="button" onClick={logout} className="text-[13px] text-slate-500 hover:text-slate-900">
                  প্রস্থান
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-[13px] text-slate-600 hover:text-slate-900">প্রবেশ</Link>
                <Link to="/login" className="h-9 px-4 inline-flex items-center rounded-md bg-slate-900 text-white text-[13px]">
                  {landing.primaryCta}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-slate-700"
            aria-label="মেনু"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="lg:hidden border-t border-slate-200 bg-[#f4f2ee] px-4 py-4 space-y-1">
          {landing.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-2.5 text-sm text-slate-700 border-b border-slate-100"
            >
              {item.label}
            </a>
          ))}
          <Link
            to={user ? '/dashboard' : '/login'}
            onClick={() => setOpen(false)}
            className="mt-3 flex h-11 items-center justify-center rounded-md bg-slate-900 text-white text-sm"
          >
            {user ? 'ড্যাশবোর্ড' : landing.primaryCta}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
