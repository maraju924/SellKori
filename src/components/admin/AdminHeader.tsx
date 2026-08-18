import React from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Zap, 
  Globe, 
  Layers,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { UserProfile } from '../../types';
import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  profile: UserProfile | null;
}

export function AdminHeader({ profile }: AdminHeaderProps) {
  return (
    <header className="bg-zinc-900 text-white border-b border-zinc-800 px-4 md:px-8 py-3.5 sticky top-0 z-40">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-orange-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black tracking-tight leading-none">
                SellKori Admin Portal
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                System Live
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              সুপার অ্যাডমিন প্ল্যাটফর্ম কন্ট্রোল ও টেলিমিতি
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button
              size="sm"
              variant="outline"
              className="text-xs font-bold border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded-xl"
            >
              মার্চেন্ট ড্যাশবোর্ডে যান
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
