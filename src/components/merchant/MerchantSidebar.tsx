import React from 'react';
import {
  BarChart3,
  Package,
  Tag,
  Users,
  Bot,
  Terminal,
  MessageCircle,
  Megaphone,
  HelpCircle,
  ShieldCheck,
  Globe,
  Truck,
  CreditCard,
  Store,
  X,
} from 'lucide-react';
import { BusinessConfig, UserProfile } from '../../types';
import { Link } from 'react-router-dom';

interface MerchantSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  business: BusinessConfig;
  profile?: UserProfile | null;
  onClose?: () => void;
}

export function MerchantSidebar({
  activeTab,
  setActiveTab,
  business,
  profile,
  onClose
}: MerchantSidebarProps) {
  const isAdmin = profile?.role === 'admin' || profile?.email === 'maraju924@gmail.com';

  const menuGroups = [
    ...(isAdmin ? [{
      group: 'অ্যাডমিন',
      items: [
        { id: 'admin-portal', label: 'অ্যাডমিন', icon: ShieldCheck, isExternalRoute: true, href: '/admin' }
      ]
    }] : []),
    {
      group: '',
      items: [
        { id: 'analytics', label: 'ওভারভিউ', icon: BarChart3 },
        { id: 'orders', label: 'অর্ডার', icon: Package },
        { id: 'products', label: 'পণ্য', icon: Tag },
        { id: 'customers', label: 'গ্রাহক', icon: Users },
        { id: 'info', label: 'স্টোর', icon: Store },
      ]
    },
    {
      group: 'এআই',
      items: [
        { id: 'ai-control', label: 'এআই', icon: Bot },
        { id: 'test-chat', label: 'টেস্ট চ্যাট', icon: Terminal },
        { id: 'messenger', label: 'মেসেঞ্জার', icon: MessageCircle },
        { id: 'broadcasting', label: 'ব্রডকাস্ট', icon: Megaphone },
        { id: 'faqs', label: 'FAQ', icon: HelpCircle },
        { id: 'features', label: 'ফিচার', icon: ShieldCheck },
      ]
    },
    {
      group: 'সেটিংস',
      items: [
        { id: 'facebook', label: 'পিক্সেল', icon: Globe },
        { id: 'integrations', label: 'কুরিয়ার', icon: Truck },
        { id: 'billing', label: 'বিলিং', icon: CreditCard },
      ]
    }
  ];

  return (
    <aside className="w-full md:w-56 bg-white dark:bg-zinc-950 md:border-r border-zinc-200 dark:border-zinc-800 h-full flex flex-col overflow-y-auto">
      <div className="p-3 space-y-4">
        <div className="flex md:hidden justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <p className="font-semibold text-sm truncate">{business.name || 'স্টোর'}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {menuGroups.map((grp, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              {grp.group ? (
                <h4 className="text-[11px] font-medium text-zinc-400 px-2.5 pb-1">{grp.group}</h4>
              ) : null}
              {grp.items.map((item: any) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                if (item.isExternalRoute && item.href) {
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      onClick={() => onClose?.()}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <Icon className="w-4 h-4 text-zinc-500" />
                      {item.label}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      onClose?.();
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? '' : 'text-zinc-500'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
