import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Bot, 
  Menu, 
  X, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  User, 
  LayoutDashboard,
  LogOut
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { auth } from '../../lib/firebase';
import { signOut, User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../../types';

interface LandingNavbarProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
}

export function LandingNavbar({ user, profile }: LandingNavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navLinks = [
    { label: 'ফিচারসমূহ', href: '#features' },
    { label: 'লাইভ এআই ডেমো', href: '#demo' },
    { label: 'পার্থক্য', href: '#comparison' },
    { label: 'কীভাবে কাজ করে', href: '#how-it-works' },
    { label: 'প্রাইসিং ও খরচ', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-sm border-b border-zinc-200/80 dark:border-zinc-800' 
        : 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-900'
    }`}>
      {/* Top Banner */}
      <div className="bg-linear-to-r from-orange-600 via-amber-600 to-orange-500 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2">
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold">অফার</span>
        <span>আজই জয়েন করলে পাচ্ছেন <strong>১০,০০০ ফ্রি এআই টোকেন</strong> ট্রায়াল ব্যালেন্স!</span>
        <a href="#pricing" className="underline hover:text-white/80 hidden sm:inline text-[11px] font-bold">বিস্তারিত দেখুন →</a>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-2xl tracking-tighter text-zinc-900 dark:text-white">
                  Sell<span className="text-orange-600">Kori</span>
                </span>
                <span className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border border-orange-200 dark:border-orange-900">
                  AI 2.5
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium -mt-1 tracking-tight">AI Messenger Salesman</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((item, idx) => (
              <a
                key={idx}
                href={item.href}
                className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {profile?.role === 'admin' && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm" className="font-bold text-xs">
                      অ্যাডমিন
                    </Button>
                  </Link>
                )}
                <Link to="/dashboard">
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs gap-1.5 rounded-xl shadow-md shadow-orange-600/20">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    মার্চেন্ট প্যানেল
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="rounded-xl border-zinc-200 text-xs font-semibold hover:text-rose-600"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="font-bold text-xs text-zinc-700 dark:text-zinc-300 hover:text-orange-600">
                    লগইন
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="sm" className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:scale-102">
                    ফ্রি ট্রায়াল শুরু করুন
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex sm:hidden items-center gap-2">
            <Link to="/login">
              <Button size="sm" className="bg-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">
                শুরু করুন
              </Button>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-4 pt-2 pb-6 space-y-3 shadow-xl">
          <div className="flex flex-col space-y-2">
            {navLinks.map((item, idx) => (
              <a
                key={idx}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl font-bold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-2">
            {user ? (
              <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full bg-orange-600 text-white font-bold rounded-xl">
                  মার্চেন্ট প্যানেলে যান
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button className="w-full bg-orange-600 text-white font-bold rounded-xl shadow-md">
                    গুগল দিয়ে ফ্রি একাউন্ট খুলুন
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
