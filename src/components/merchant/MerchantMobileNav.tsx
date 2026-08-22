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
    { id: 'analytics', label: 'হোম', icon: BarChart3 },
    { id: 'orders', label: 'অর্ডার', icon: Package, badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined },
    { id: 'products', label: 'পণ্য', icon: Tag },
    { id: 'ai-control', label: 'এআই', icon: Bot },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 px-1 py-1 flex items-center justify-around pb-safe">
      {navItems.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center py-1.5 relative"
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`} />
              {tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 bg-zinc-900 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-0.5 ${isActive ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}

      <button
        onClick={onOpenFullMenu}
        className="flex-1 flex flex-col items-center justify-center py-1.5"
      >
        <LayoutGrid className="w-5 h-5 text-zinc-400" />
        <span className="text-[10px] text-zinc-400 mt-0.5">মেনু</span>
      </button>
    </nav>
  );
}
