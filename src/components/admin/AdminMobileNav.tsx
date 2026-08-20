import React from 'react';
import { BarChart3, Store, Settings, Terminal, Database, CreditCard } from 'lucide-react';

interface AdminMobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingMerchantsCount?: number;
}

export function AdminMobileNav({
  activeTab,
  setActiveTab,
  pendingMerchantsCount = 0
}: AdminMobileNavProps) {
  const navItems = [
    { id: 'overview', label: 'ওভারভিউ', icon: BarChart3 },
    { id: 'merchants', label: 'মার্চেন্ট', icon: Store, badge: pendingMerchantsCount > 0 ? pendingMerchantsCount : undefined },
    { id: 'ai-engine', label: 'AI পুল', icon: Database },
    { id: 'billing', label: 'বিলিং', icon: CreditCard },
    { id: 'settings', label: 'সেটিংস', icon: Settings },
    { id: 'logs', label: 'টেলিমিতি', icon: Terminal },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-800/90 px-3 py-1.5 flex items-center justify-around shadow-2xl pb-safe no-select">
      {navItems.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center py-1 relative native-ripple"
            aria-label={tab.label}
          >
            <div
              className={`px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center relative ${
                isActive
                  ? 'bg-linear-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-zinc-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-zinc-950">
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-bold mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-orange-400' : 'text-zinc-500'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
