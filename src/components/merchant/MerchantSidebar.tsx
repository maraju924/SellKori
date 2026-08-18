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
  Zap,
  ChevronRight,
  ExternalLink,
  Sliders
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
      group: 'সুপার অ্যাডমিন পোর্টাল',
      items: [
        { id: 'admin-portal', label: 'প্ল্যাটফর্ম অ্যাডমিন কন্ট্রোল', icon: ShieldCheck, badge: 'Root', isExternalRoute: true, href: '/admin' }
      ]
    }] : []),
    {
      group: 'মূল ড্যাশবোর্ড',
      items: [
        { id: 'analytics', label: 'ওভারভিউ ও অ্যানালিটিক্স', icon: BarChart3, badge: 'Live' },
      ]
    },
    {
      group: 'কমার্স ও ইনভেন্টরি',
      items: [
        { id: 'orders', label: 'অর্ডার ও ডেলিভারি ট্র্যাকিং', icon: Package },
        { id: 'products', label: 'পণ্য ক্যাটালগ ও মূল্য সীমা', icon: Tag },
        { id: 'customers', label: 'গ্রাহক সিআরএম ও লিডস', icon: Users },
        { id: 'info', label: 'স্টোর প্রোফাইল ও ব্র্যান্ডিং', icon: Store },
      ]
    },
    {
      group: 'এআই ও অটোমেশন ইঞ্জিন',
      items: [
        { id: 'ai-control', label: 'এআই সেলস ব্রেন ও দরদাম', icon: Bot, isHighlighted: true },
        { id: 'test-chat', label: 'লাইভ চ্যাট সিমুলেটর', icon: Terminal },
        { id: 'messenger', label: 'ফেসবুক মেসেঞ্জার ওয়েবহুক', icon: MessageCircle },
        { id: 'broadcasting', label: 'টার্গেটেড ব্রডকাস্টিং', icon: Megaphone },
        { id: 'faqs', label: 'পলিসি ও নলেজবেস', icon: HelpCircle },
        { id: 'features', label: 'সিস্টেম ফিচার সুইচ', icon: ShieldCheck },
      ]
    },
    {
      group: 'ইন্টিগ্রেশন ও ওয়ালেট',
      items: [
        { id: 'facebook', label: 'মেটা পিক্সেল ও CAPI', icon: Globe },
        { id: 'integrations', label: 'কুরিয়ার ও এপিআই গেটওয়ে', icon: Truck },
        { id: 'billing', label: 'টোকেন ওয়ালেট ও বিলিং', icon: CreditCard, badge: 'Recharge' },
      ]
    }
  ];

  return (
    <aside className="w-full md:w-72 bg-white dark:bg-zinc-950 md:border-r border-zinc-200/80 dark:border-zinc-800/80 h-full flex flex-col justify-between overflow-y-auto scrollbar-none transition-colors no-select">
      <div className="p-4 space-y-5">
        {/* Android Native Drawer Top Profile Header */}
        <div className="flex md:hidden justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-orange-600/30">
              SK
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white leading-tight">
                {business.name || 'মার্চেন্ট প্যানেল'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold">SellKori Native App</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 native-ripple"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categorized Enterprise Menu */}
        <div className="space-y-4">
          {menuGroups.map((grp, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 py-0.5">
                {grp.group}
              </h4>
              <div className="space-y-0.5">
                {grp.items.map((item: any) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  if (item.isExternalRoute && item.href) {
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        onClick={() => {
                          if (onClose) onClose();
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all native-ripple text-left bg-zinc-900 dark:bg-zinc-800 text-orange-400 hover:bg-zinc-800 border border-zinc-700/80 shadow-xs mb-1.5"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-orange-500 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-orange-600 text-white">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (onClose) onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all native-ripple text-left ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20 scale-[1.01]'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.isHighlighted ? 'text-orange-500' : 'text-zinc-500'}`} />
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

      {/* Floating Quota Card */}
      <div className="p-3.5 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/50 m-3 rounded-2xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            এআই টোকেন কোটা
          </span>
          <span className="text-[10px] font-mono font-black text-orange-600 dark:text-orange-400">
            {(business.tokenBalance || 0).toLocaleString()}
          </span>
        </div>

        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-orange-500 to-amber-400 rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(8, ((business.tokenBalance || 0) / 100000) * 100))}%` }}
          />
        </div>

        <button
          onClick={() => {
            setActiveTab('billing');
            if (onClose) onClose();
          }}
          className="w-full py-1 text-center text-[10px] font-black text-orange-600 dark:text-orange-400 hover:underline block"
        >
          + টোকেন প্যাক রিচার্জ
        </button>
      </div>
    </aside>
  );
}
