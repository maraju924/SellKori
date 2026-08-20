import React from 'react';
import { 
  BarChart3, 
  Store, 
  Settings, 
  Terminal, 
  Users, 
  ShieldCheck, 
  Database,
  Activity
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function AdminSidebar({ activeTab, setActiveTab }: AdminSidebarProps) {
  const menuItems = [
    { id: 'overview', label: 'প্ল্যাটফর্ম ওভারভিউ', icon: BarChart3, badge: 'Live' },
    { id: 'merchants', label: 'মার্চেন্ট ডিরেক্টরি', icon: Store },
    { id: 'ai-engine', label: 'AI ইঞ্জিন ও API পুল', icon: Database, badge: 'Failover' },
    { id: 'billing', label: 'পেমেন্ট গেটওয়ে ও রেভিনিউ', icon: ShieldCheck, badge: 'ZiniPay' },
    { id: 'settings', label: 'সিস্টেম ও এপিআই সেটিংস', icon: Settings },
    { id: 'logs', label: 'লাইভ লগস ও টেলিমিতি', icon: Terminal, badge: 'Stream' },
  ];

  return (
    <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 h-full flex flex-col justify-between p-4 transition-colors">
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-3">
          অ্যাডমিন নেভিগেশন
        </h3>

        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-linear-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/25'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/50 space-y-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5 text-zinc-200 font-bold text-[11px]">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          Cloud Run Cluster
        </div>
        <p className="text-[10px]">Region: asia-east1</p>
      </div>
    </aside>
  );
}
