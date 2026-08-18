import React from 'react';
import { BarChart3, Package, Bot, Terminal, Menu } from 'lucide-react';

interface MerchantMobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenFullMenu: () => void;
}

export function MerchantMobileNav({
  activeTab,
  setActiveTab,
  onOpenFullMenu
}: MerchantMobileNavProps) {
  const quickTabs = [
    { id: 'analytics', label: 'ওভারভিউ', icon: BarChart3 },
    { id: 'orders', label: 'অর্ডার', icon: Package },
    { id: 'ai-control', label: 'এআই ব্রেন', icon: Bot },
    { id: 'test-chat', label: 'সিমুলেটর', icon: Terminal },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-200/80 dark:border-zinc-800 px-3 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      {quickTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              isActive
                ? 'text-orange-600 dark:text-orange-400 font-extrabold scale-105'
                : 'text-zinc-500 dark:text-zinc-400 font-medium'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}

      {/* Full Menu Bottom Trigger */}
      <button
        onClick={onOpenFullMenu}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-zinc-500 dark:text-zinc-400 font-medium hover:text-orange-600 transition-colors"
      >
        <Menu className="w-5 h-5 stroke-2" />
        <span className="text-[10px] tracking-tight">সব মেন্যু</span>
      </button>
    </div>
  );
}
