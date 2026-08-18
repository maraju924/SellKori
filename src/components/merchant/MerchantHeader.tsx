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
  CreditCard,
  Plus
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';
import { toast } from 'sonner';

interface MerchantHeaderProps {
  business: BusinessConfig;
  onOpenMobileMenu: () => void;
  onNavigateTab: (tabId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function MerchantHeader({
  business,
  onOpenMobileMenu,
  onNavigateTab,
  isDark,
  onToggleTheme
}: MerchantHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyChatLink = () => {
    const url = `${window.location.origin}/chat/${business.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('পাবলিক চ্যাট লিংক কপি হয়েছে!', {
      description: 'কাস্টমারদের এই লিংকটি ফেসবুকে বা বায়োতে দিতে পারেন।'
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const tokenBalance = business.tokenBalance || 0;
  const isLowToken = tokenBalance < 5000;

  return (
    <header className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 md:px-8 py-3.5 sticky top-0 z-40 transition-colors">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Mobile Menu Trigger + Store Info */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenMobileMenu}
            className="md:hidden rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="w-10 h-10 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-xs hidden sm:block"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-600/20 hidden sm:flex">
                <Store className="w-5 h-5" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-zinc-900 dark:text-white leading-none">
                  {business.name || 'আমার স্টোর'}
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  এআই সক্রিয়
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 hidden sm:block">
                প্ল্যান: <strong className="uppercase text-orange-600 dark:text-orange-400">{business.plan || 'Free Trial'}</strong> • আইডি: {business.id.slice(0, 10)}
              </p>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Token Balance Indicator Pill */}
          <button
            onClick={() => onNavigateTab('billing')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all active:scale-95 ${
              isLowToken
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 animate-pulse'
                : 'bg-orange-50/80 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/60 text-orange-800 dark:text-orange-300 hover:border-orange-400'
            }`}
          >
            <div className="w-6 h-6 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="text-left leading-tight hidden xs:block">
              <span className="text-[10px] font-bold uppercase opacity-80 block">টোকেন ব্যালেন্স</span>
              <span className="text-xs font-black font-mono">
                {tokenBalance.toLocaleString()}
              </span>
            </div>
            <Plus className="w-3.5 h-3.5 text-orange-600 shrink-0 ml-0.5" />
          </button>

          {/* Copy Public Chat Link Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyChatLink}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 rounded-xl border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>কপি হয়েছে</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-orange-600" />
                <span>পাবলিক চ্যাট লিংক</span>
                <Copy className="w-3 h-3 text-zinc-400" />
              </>
            )}
          </Button>

          {/* Theme Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="rounded-xl w-9 h-9 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-orange-600"
            title="থিম পরিবর্তন"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-zinc-700" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
