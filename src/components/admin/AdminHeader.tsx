import React from 'react';
import { 
  ShieldCheck, 
  ArrowRight,
  Menu,
  Server,
  Zap,
  Activity
} from 'lucide-react';
import { Button } from '../ui/button';
import { UserProfile } from '../../types';
import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  profile: UserProfile | null;
  onOpenMobileMenu?: () => void;
}

export function AdminHeader({ profile, onOpenMobileMenu }: AdminHeaderProps) {
  return (
    <header className="bg-zinc-950/95 backdrop-blur-xl text-white border-b border-zinc-800/90 px-3 sm:px-6 py-2.5 sm:py-3.5 sticky top-0 z-40 no-select pt-safe">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              aria-label="Open Navigation Drawer"
              className="md:hidden w-10 h-10 rounded-2xl flex items-center justify-center bg-zinc-900 text-zinc-200 native-ripple active:bg-orange-500/20 active:text-orange-400"
            >
              <Menu className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-600/30 shrink-0">
            <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-sm sm:text-base font-black tracking-tight leading-tight truncate">
                SellKori Admin Portal
              </h2>
              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Root Live
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate hidden xs:block">
              প্ল্যাটফর্ম সুপার অ্যাডমিন • {profile?.email || 'maraju924@gmail.com'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/dashboard">
            <Button
              size="sm"
              className="text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-md shadow-orange-600/20 native-ripple px-3 py-1.5 min-h-[36px]"
            >
              <span className="hidden sm:inline">মার্চেন্ট ড্যাশবোর্ড</span>
              <span className="sm:hidden">মার্চেন্ট</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
