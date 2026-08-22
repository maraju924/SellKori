import React, { useState } from 'react';
import { Menu, Sun, Moon, Copy, Check, Store, ShieldCheck, Search, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
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
    toast.success('লিংক কপি হয়েছে');
    setTimeout(() => setCopied(false), 2000);
  };

  const tokenBalance = business.tokenBalance || 0;
  const isLowToken = tokenBalance < 5000;

  return (
    <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40 pt-safe">
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-2.5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            aria-label="মেনু"
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt=""
                className="w-8 h-8 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
            )}
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {business.name || 'স্টোর'}
            </h1>
          </div>
        </div>

        <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
          <button
            onClick={() => onOpenCommandSearch?.()}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs"
          >
            <span className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5" />
              খুঁজুন
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isAdmin && (
            <Link to="/admin">
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs rounded-lg px-2.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">অ্যাডমিন</span>
              </Button>
            </Link>
          )}

          <button
            onClick={() => onNavigateTab('billing')}
            className={`h-8 px-2.5 rounded-lg border text-xs font-medium ${
              isLowToken
                ? 'border-rose-200 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200'
            }`}
          >
            {tokenBalance >= 1000 ? `${(tokenBalance / 1000).toFixed(tokenBalance % 1000 === 0 ? 0 : 1)}k` : tokenBalance}
          </button>

          <button
            onClick={handleCopyChatLink}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'কপি' : 'লিংক'}
          </button>

          <button
            onClick={() => window.open(shopPath(business), '_blank')}
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-200 dark:border-zinc-800"
            title="ওয়েবসাইট"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleTheme}
            aria-label="থিম"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
