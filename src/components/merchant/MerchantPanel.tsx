import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  setDoc, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Plus, 
  Bot, 
  Package, 
  Tag, 
  Search, 
  X, 
  Zap, 
  Globe, 
  TrendingUp, 
  Sliders, 
  Share2 
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { BusinessConfig, Order, UserProfile } from '../../types';

import { MerchantHeader } from './MerchantHeader';
import { MerchantSidebar } from './MerchantSidebar';
import { MerchantMobileNav } from './MerchantMobileNav';
import { MerchantOverview } from './MerchantOverview';
import { MerchantOrders } from './MerchantOrders';
import { MerchantProducts } from './MerchantProducts';
import { MerchantCRM } from './MerchantCRM';
import { MerchantAIControl } from './MerchantAIControl';
import { MerchantTestChat } from './MerchantTestChat';
import { MerchantBilling } from './MerchantBilling';
import { MerchantMessengerLive } from './MerchantMessengerLive';
import { MerchantIntegrations } from './MerchantIntegrations';
import { MerchantBroadcasting } from './MerchantBroadcasting';
import { MerchantFAQs } from './MerchantFAQs';
import { MerchantFeatures } from './MerchantFeatures';
import { MerchantInfo } from './MerchantInfo';
import { toast } from 'sonner';

interface MerchantPanelProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
}

export function MerchantPanel({ user, profile }: MerchantPanelProps) {
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isDark, setIsDark] = useState(false);
  const navigate = useNavigate();

  // Sync dark theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Global Command + K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load business config for current user
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as BusinessConfig;
        // Always use the Firestore document ID for writes. Using `data.id`
        // when it differs from the doc path makes updateDoc a no-op / not-found
        // — product edits look like they save but never persist.
        setBusiness({ ...data, id: docSnap.id });
      } else {
        const newId = `biz-${Date.now()}`;
        const initialConfig: BusinessConfig = {
          id: newId,
          ownerId: user.uid,
          name: "আমার অনলাইন শপ",
          description: "একটি বিশ্বস্ত ও আধুনিক অনলাইন শপ।",
          walletBalance: 0,
          tokenBalance: 100000,
          totalTokensUsed: 0,
          products: [],
          faqs: [],
          facebookConfig: { pixelId: '', accessToken: '', testEventCode: '' },
          courierConfig: {
            deliveryChargeInsideDhaka: 70,
            deliveryChargeOutsideDhaka: 130,
            autoBooking: true
          },
          features: {
            aiEnabled: true,
            orderTrackingEnabled: true,
            proactiveNotificationsEnabled: true,
            chatSummaryEnabled: true,
            negotiationEnabled: true,
            imageDisplayEnabled: true,
            inventoryEnabled: true,
            analyticsEnabled: true,
            invoicingEnabled: true,
            broadcastingEnabled: true
          },
          aiPersona: 'friendly',
          aiLanguage: 'bangla',
          bargainingSensitivity: 60,
          customSystemPrompt: '',
          messengerVerifyToken: Math.random().toString(36).substring(2, 15),
          status: 'active',
          plan: 'free',
          verificationStatus: 'pending',
          createdAt: serverTimestamp()
        };
        setDoc(doc(db, 'businesses', newId), initialConfig);
      }
      setLoading(false);
    });
  }, [user]);

  // Load orders (fallback without orderBy if composite index is missing)
  useEffect(() => {
    if (!business?.id) return;

    const applySnap = (snap: { docs: { id: string; data: () => any }[] }) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      list.sort((a: any, b: any) => {
        const ta = a.createdAtMs || a.createdAt?.toMillis?.() || Date.parse(a.createdAt || '') || 0;
        const tb = b.createdAtMs || b.createdAt?.toMillis?.() || Date.parse(b.createdAt || '') || 0;
        return tb - ta;
      });
      setOrders(list);
    };

    const withOrder = query(
      collection(db, 'orders'),
      where('businessId', '==', business.id),
      orderBy('createdAt', 'desc')
    );
    let unsubFallback: (() => void) | null = null;
    const unsub = onSnapshot(withOrder, applySnap, () => {
      const withoutOrder = query(
        collection(db, 'orders'),
        where('businessId', '==', business.id)
      );
      unsubFallback = onSnapshot(withoutOrder, applySnap, (err) => {
        console.error('[Orders load failed]', err);
      });
    });
    return () => {
      unsub();
      unsubFallback?.();
    };
  }, [business?.id]);

  const isAdmin = profile?.role === 'admin' || user?.email === 'maraju924@gmail.com';

  const searchableItems = [
    ...(isAdmin ? [{ id: 'admin-portal', title: 'সুপার অ্যাডমিন পোর্টাল', desc: 'মার্চেন্ট ভেরিফিকেশন ও সিস্টেম কন্ট্রোল', icon: Sliders, href: '/admin' }] : []),
    { id: 'analytics', title: 'ওভারভিউ ও অ্যানালিটিক্স', desc: 'দৈনিক সেলস গ্রাফ ও মোট বিক্রয়', icon: TrendingUp },
    { id: 'orders', title: 'অর্ডার তালিকা ও মেমো', desc: 'গ্রাহকের অর্ডার ও কুরিয়ার ট্র্যাকিং', icon: Package },
    { id: 'products', title: 'পণ্য ক্যাটালগ ও মূল্য সীমা', desc: 'প্রোডাক্ট যোগ ও মিনিমাম প্রাইজ লক', icon: Tag },
    { id: 'ai-control', title: 'এআই সেলস ব্রেন', desc: 'পারসোনা, ভাষা ও বার্গেইনিং সেন্সিটিভিটি', icon: Bot },
    { id: 'test-chat', title: 'লাইভ চ্যাট সিমুলেটর', desc: 'এআই-এর সাথে কথা বলে টেস্ট করুন', icon: Zap },
    { id: 'facebook', title: 'মেটা পিক্সেল ও CAPI', desc: 'কনভার্সন এপিআই ও ইভেন্ট সেটআপ', icon: Globe },
    { id: 'billing', title: 'টোকেন ওয়ালেট ও রিচার্জ', desc: 'এআই ব্যালেন্স ও পেমেন্ট হিস্ট্রি', icon: Sliders },
  ];

  const filteredCommands = searchableItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-3xl bg-orange-600 animate-spin flex items-center justify-center text-white font-black text-sm shadow-xl shadow-orange-600/30">
          SK
        </div>
        <p className="text-xs font-black tracking-widest text-zinc-500 uppercase">SellKori OS Initializing...</p>
      </div>
    );
  }

  if (!business) return null;

  return (
    <div className="min-h-screen bg-zinc-100/60 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors pb-24 md:pb-0">
      {/* Software Top App Bar */}
      <MerchantHeader
        business={business}
        profile={profile}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenCommandSearch={() => setIsCommandOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Left ERP Sidebar */}
        <div className="hidden md:block shrink-0">
          <div className="sticky top-[57px] h-[calc(100vh-57px)]">
            <MerchantSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              business={business}
              profile={profile}
            />
          </div>
        </div>

        {/* Mobile Android M3 Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed top-0 bottom-0 left-0 w-4/5 max-w-xs bg-white dark:bg-zinc-950 z-50 md:hidden shadow-2xl rounded-r-3xl overflow-hidden flex flex-col"
              >
                <div className="sheet-handle md:hidden" />
                <MerchantSidebar
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  business={business}
                  profile={profile}
                  onClose={() => setIsMobileMenuOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Center Content Workspace */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 min-w-0">
          {activeTab === 'analytics' && (
            <MerchantOverview
              business={business}
              orders={orders}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'orders' && (
            <MerchantOrders business={business} orders={orders} />
          )}

          {activeTab === 'products' && (
            <MerchantProducts business={business} />
          )}

          {activeTab === 'customers' && (
            <MerchantCRM business={business} orders={orders} />
          )}

          {activeTab === 'ai-control' && (
            <MerchantAIControl business={business} />
          )}

          {activeTab === 'test-chat' && (
            <MerchantTestChat business={business} />
          )}

          {activeTab === 'messenger' && (
            <MerchantMessengerLive business={business} />
          )}

          {activeTab === 'broadcasting' && (
            <MerchantBroadcasting business={business} />
          )}

          {activeTab === 'faqs' && (
            <MerchantFAQs business={business} />
          )}

          {activeTab === 'features' && (
            <MerchantFeatures business={business} />
          )}

          {activeTab === 'info' && (
            <MerchantInfo business={business} />
          )}

          {activeTab === 'facebook' && (
            <MerchantIntegrations business={business} />
          )}

          {activeTab === 'integrations' && (
            <MerchantIntegrations business={business} />
          )}

          {activeTab === 'billing' && (
            <MerchantBilling business={business} />
          )}
        </main>
      </div>

      {/* Android Native Floating Action Button (FAB) on Mobile */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <button
          onClick={() => {
            if (activeTab === 'products') {
              // Trigger product modal
              const btn = document.getElementById('add-product-btn');
              if (btn) btn.click();
            } else {
              setActiveTab('test-chat');
            }
          }}
          className="w-14 h-14 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-2xl shadow-orange-600/50 native-ripple active:scale-95 transition-transform"
          aria-label="Action Button"
        >
          {activeTab === 'products' ? (
            <Plus className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <Bot className="w-6 h-6 stroke-[2.2]" />
          )}
        </button>
      </div>

      {/* Android M3 Bottom Navigation Bar */}
      <MerchantMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenFullMenu={() => setIsMobileMenuOpen(true)}
        pendingOrdersCount={pendingCount}
      />

      {/* Command + K Search Modal */}
      <AnimatePresence>
        {isCommandOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="সেলকরি সফটওয়্যার কমান্ড খুঁজুন..."
                  className="flex-1 bg-transparent text-xs sm:text-sm font-medium outline-none text-zinc-900 dark:text-white"
                />
                <button
                  onClick={() => setIsCommandOpen(false)}
                  className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                {filteredCommands.map((cmd: any) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        if (cmd.href) {
                          navigate(cmd.href);
                        } else {
                          setActiveTab(cmd.id);
                        }
                        setIsCommandOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-orange-50 dark:hover:bg-orange-950/40 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-orange-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-zinc-900 dark:text-white">{cmd.title}</p>
                        <p className="text-[10px] text-zinc-500">{cmd.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
