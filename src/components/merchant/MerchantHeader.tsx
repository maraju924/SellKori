import React, { useState } from 'react';
import { 
  Menu, 
  Sun, 
  Moon, 
  Globe, 
  Zap, 
  Copy, 
  Check, 
  Store, 
  Sparkles, 
  ShieldCheck,
  Search,
  Bell,
  Command,
  ExternalLink,
  ChevronDown,
  Plus
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BusinessConfig, UserProfile } from '../../types';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { shopPath, shopPublicUrl } from '../../lib/storefront';

interface MerchantHeaderProps {
  business: BusinessConfig;
  profile?: UserProfile | null;
  onOpenMobileMenu: () => void;
  onNavigateTab: (tabId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenCommandSearch?: () => void;
}

export function MerchantHeader({
  business,
  profile,
  onOpenMobileMenu,
  onNavigateTab,
  isDark,
  onToggleTheme,
  onOpenCommandSearch
}: MerchantHeaderProps) {
  const [copied, setCopied] = useState(false);
  const isAdmin = profile?.role === 'admin' || profile?.email === 'maraju924@gmail.com';

  const handleCopyChatLink = () => {
    const url = shopPublicUrl(window.location.origin, business);
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('ওয়েবসাইট লিংক কপি হয়েছে!', {
      description: 'গ্রাহকরা এই লিংক থেকে পণ্য দেখে ক্যাশ অন ডেলিভারিতে অর্ডার করতে পারবে।'
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const tokenBalance = business.tokenBalance || 0;
  const isLowToken = tokenBalance < 5000;

  return (
    <header className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 sticky top-0 z-40 transition-colors no-select pt-safe">
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 max-w-7xl mx-auto">
        {/* Left: Mobile Android App Bar or Desktop Workspace Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Android Native Menu Ripple Button */}
          <button
            onClick={onOpenMobileMenu}
            aria-label="Open Navigation Drawer"
            className="md:hidden w-10 h-10 rounded-2xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 native-ripple active:bg-orange-500/10 active:text-orange-600 transition-colors"
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Business Brand Avatar / Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-600/20 shrink-0">
                <Store className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <h1 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight truncate leading-tight">
                  {business.name || 'আমার অনলাইন শপ'}
                </h1>
                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden xs:inline">এআই অনলাইন</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate hidden sm:block">
                SellKori Enterprise OS • প্ল্যান: <strong className="uppercase text-orange-600 dark:text-orange-400">{business.plan || 'Free Trial'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Center: Desktop Global Quick Search Bar (Cmd+K style) */}
        <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
          <button
            onClick={() => onOpenCommandSearch?.()}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs hover:border-orange-400/80 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>অর্ডার, প্রোডাক্ট বা সেটিংস খুঁজুন...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">⌘K</kbd>
          </button>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Admin Switch Button for Platform Owner */}
          {isAdmin && (
            <Link to="/admin">
              <Button
                size="sm"
                className="gap-1.5 text-xs font-black bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-700 dark:border-zinc-600 rounded-2xl shadow-xs px-3"
              >
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <span className="hidden sm:inline">অ্যাডমিন প্যানেল</span>
                <span className="sm:hidden">অ্যাডমিন</span>
              </Button>
            </Link>
          )}

          {/* Token Indicator Pill with Native Android Tap feel */}
          <button
            onClick={() => onNavigateTab('billing')}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl border transition-all native-ripple ${
              isLowToken
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 animate-pulse'
                : 'bg-orange-50/90 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900/60 text-orange-800 dark:text-orange-300'
            }`}
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
            </div>
            <div className="text-left leading-none">
              <span className="text-[9px] font-bold uppercase opacity-75 hidden sm:block">টোকেন</span>
              <span className="text-xs font-black font-mono tracking-tight">
                {tokenBalance >= 1000 ? `${(tokenBalance / 1000).toFixed(tokenBalance % 1000 === 0 ? 0 : 1)}k` : tokenBalance}
              </span>
            </div>
            <Plus className="w-3 h-3 text-orange-600 ml-0.5 shrink-0" />
          </button>

          <button
            onClick={handleCopyChatLink}
            title="গ্রাহকদের জন্য ওয়েবসাইট লিংক"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors native-ripple"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-orange-600" />
                <span>ওয়েবসাইট</span>
                <Copy className="w-3 h-3 text-zinc-400" />
              </>
            )}
          </button>

          <button
            onClick={() => window.open(shopPath(business), '_blank')}
            className="sm:hidden w-9 h-9 rounded-2xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 native-ripple"
            title="ওয়েবসাইট প্রিভিউ"
          >
            <ExternalLink className="w-4 h-4 text-orange-600" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle Theme"
            className="w-9 h-9 rounded-2xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-orange-600 transition-colors native-ripple"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
          </button>
        </div>
      </div>
    </header>
  );
}
