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
  Sparkles,
  Zap,
  TrendingUp,
  Layers
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BusinessConfig } from '../../types';

interface MerchantSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  business: BusinessConfig;
  onClose?: () => void;
}

export function MerchantSidebar({
  activeTab,
  setActiveTab,
  business,
  onClose
}: MerchantSidebarProps) {
  const menuGroups = [
    {
      group: 'মূল পর্যবেক্ষণ',
      items: [
        { id: 'analytics', label: 'ওভারভিউ ও অ্যানালিটিক্স', icon: BarChart3, badge: 'Live' },
      ]
    },
    {
      group: 'ব্যবসা ও বিক্রয়',
      items: [
        { id: 'orders', label: 'অর্ডার ও কুরিয়ার', icon: Package },
        { id: 'products', label: 'পণ্য ও দরদামের সীমা', icon: Tag },
        { id: 'customers', label: 'কাস্টমার CRM ও লিডস', icon: Users },
        { id: 'info', label: 'স্টোর প্রোফাইল', icon: Store },
      ]
    },
    {
      group: 'এআই ও অটোমেশন',
      items: [
        { id: 'ai-control', label: 'এআই ব্রেন ও দরদাম', icon: Bot, isHighlighted: true },
        { id: 'test-chat', label: 'লাইভ চ্যাট সিমুলেটর', icon: Terminal },
        { id: 'messenger', label: 'মেসেঞ্জার কানেক্ট', icon: MessageCircle },
        { id: 'broadcasting', label: 'অফার ব্রডকাস্টিং', icon: Megaphone },
        { id: 'faqs', label: 'স্টোর পলিসি ও নলেজবেস', icon: HelpCircle },
        { id: 'features', label: 'ফিচার কন্ট্রোল', icon: ShieldCheck },
      ]
    },
    {
      group: 'ইন্টিগ্রেশন ও বিলিং',
      items: [
        { id: 'facebook', label: 'মেটা পিক্সেল ও CAPI', icon: Globe },
        { id: 'integrations', label: 'কুরিয়ার ও এপিআই', icon: Truck },
        { id: 'billing', label: 'টোকেন ও বিলিং', icon: CreditCard, badge: 'Recharge' },
      ]
    }
  ];

  return (
    <aside className="w-full md:w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200/80 dark:border-zinc-800/80 h-full flex flex-col justify-between overflow-y-auto scrollbar-none transition-colors">
      <div className="p-4 space-y-6">
        {/* Mobile Header Close */}
        <div className="flex md:hidden justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xs">
              SK
            </div>
            <span className="font-black text-sm text-zinc-900 dark:text-white">মার্চেন্ট মেন্যু</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="w-5 h-5 text-zinc-500" />
          </Button>
        </div>

        {/* Categorized Menu Groups */}
        <div className="space-y-5">
          {menuGroups.map((grp, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3">
                {grp.group}
              </h3>
              <div className="space-y-1">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (onClose) onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 text-left ${
                        isActive
                          ? 'bg-linear-to-r from-orange-600 to-amber-500 text-white shadow-md shadow-orange-600/25 scale-101'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.isHighlighted ? 'text-orange-500' : 'text-zinc-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.badge === 'Live'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Token Card in Sidebar */}
      <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 m-3 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            এআই কোটা
          </span>
          <span className="text-[10px] font-mono font-black text-orange-600 dark:text-orange-400">
            {(business.tokenBalance || 0).toLocaleString()} টোকেন
          </span>
        </div>

        {/* Simple Progress Bar */}
        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-orange-500 to-amber-400 rounded-full"
            style={{ width: `${Math.min(100, Math.max(10, ((business.tokenBalance || 0) / 100000) * 100))}%` }}
          />
        </div>

        <button
          onClick={() => {
            setActiveTab('billing');
            if (onClose) onClose();
          }}
          className="w-full text-center text-[10px] font-black text-orange-600 dark:text-orange-400 hover:underline pt-0.5 block"
        >
          + ইনস্ট্যান্ট টোকেন রিচার্জ করুন
        </button>
      </div>
    </aside>
  );
}
