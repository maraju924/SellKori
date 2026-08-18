import React from 'react';
import { BarChart3, Package, Tag, Bot, LayoutGrid } from 'lucide-react';

interface MerchantMobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenFullMenu: () => void;
  pendingOrdersCount?: number;
}

export function MerchantMobileNav({
  activeTab,
  setActiveTab,
  onOpenFullMenu,
  pendingOrdersCount = 0
}: MerchantMobileNavProps) {
  const navItems = [
    { id: 'analytics', label: 'ওভারভিউ', icon: BarChart3 },
    { id: 'orders', label: 'অর্ডার', icon: Package, badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined },
    { id: 'products', label: 'পণ্য', icon: Tag },
    { id: 'ai-control', label: 'এআই ব্রেন', icon: Bot },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-200/90 dark:border-zinc-800/90 px-2 py-1.5 flex items-center justify-around shadow-2xl pb-safe no-select">
      {navItems.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center py-1 relative native-ripple"
          >
            <div
              className={`px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center relative ${
                isActive
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[2.2]" />
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-bold mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* Android M3 Native Apps / More Sheet Button */}
      <button
        onClick={onOpenFullMenu}
        className="flex-1 flex flex-col items-center justify-center py-1 relative native-ripple"
      >
        <div className="px-4 py-1 rounded-full text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
          <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
        </div>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mt-0.5 tracking-tight">
          সব মেন্যু
        </span>
      </button>
    </nav>
  );
}
