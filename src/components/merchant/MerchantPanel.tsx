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
  Package, 
  Tag, 
  Search, 
  X, 
  Zap, 
  Globe, 
  TrendingUp, 
  Sliders, 
  Users
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
import { parseJsonResponse } from '../../lib/safeJson';
import { suggestedShopSlug } from '../../lib/storeSlug';

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

  // Returning from ZiniPay: billing tab is not mounted by default, so verify
  // here (always mounted) then switch the merchant to the billing screen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentState = params.get('payment');
    if (paymentState !== 'verify' && paymentState !== 'cancelled') return;

    setActiveTab('billing');
    const valId = params.get('valId');
    window.history.replaceState({}, '', '/dashboard');

    if (paymentState === 'cancelled') {
      toast.info('পেমেন্ট বাতিল হয়েছে');
      return;
    }
    if (!valId) return;

    let cancelled = false;
    (async () => {
      try {
        toast.info('পেমেন্ট যাচাই হচ্ছে...');
        const res = await fetch('/api/billing/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valId }),
        });
        const data = await parseJsonResponse(res);
        if (cancelled) return;
        if (res.ok && data.success && data.paid) {
          toast.success(`৳${data.amount} পেমেন্ট সফল!`, {
            description: `${Number(data.tokens).toLocaleString()} টোকেন যুক্ত ${data.credited ? 'হয়েছে' : 'হচ্ছে'}।`,
          });
        } else {
          toast.error(data.error || `পেমেন্ট এখনো সম্পন্ন হয়নি (${data.status || 'PENDING'})`);
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || 'পেমেন্ট যাচাই ব্যর্থ');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        const resolved = { ...data, id: docSnap.id };
        if (!resolved.slug) {
          const slug = suggestedShopSlug(resolved);
          resolved.slug = slug;
          setDoc(doc(db, 'businesses', docSnap.id), { slug }, { merge: true }).catch(() => {});
        }
        setBusiness(resolved);
      } else {
        const newId = `biz-${Date.now()}`;
        const initialConfig: BusinessConfig = {
          id: newId,
          ownerId: user.uid,
          name: "আমার অনলাইন শপ",
          slug: suggestedShopSlug({ name: 'আমার অনলাইন শপ', id: newId }),
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
            broadcastingEnabled: true,
            commentToInboxEnabled: true,
            messengerRepliesEnabled: true,
            photoReplyEnabled: true,
            voiceReplyEnabled: true,
            upsellEnabled: true,
            autoOrderEnabled: true,
            reviewImagesEnabled: true,
            faqEnabled: true,
            autoCourierBookingEnabled: true,
            humanHandoverEnabled: true,
            quietHoursEnabled: false
          },
          aiPersona: 'friendly',
          aiLanguage: 'bangla',
          bargainingSensitivity: 60,
          customSystemPrompt: '',
          messengerVerifyToken: `sk_${newId}`,
          verifyToken: `sk_${newId}`,
          status: 'active',
          plan: 'free',
          verificationStatus: 'pending',
          createdAt: serverTimestamp()
        };
        // Show the new store immediately; surface create failures instead of
        // leaving a permanent blank screen.
        setBusiness(initialConfig);
        setDoc(doc(db, 'businesses', newId), initialConfig).catch((err) => {
          console.error('[MerchantPanel] Failed to create initial business:', err);
        });
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

  const isAdmin = profile?.role === 'admin' || profile?.email === 'maraju924@gmail.com' || user?.email === 'maraju924@gmail.com';

  const searchableItems = [
    ...(isAdmin ? [{ id: 'admin-portal', title: 'অ্যাডমিন', icon: Sliders, href: '/admin' }] : []),
    { id: 'analytics', title: 'ওভারভিউ', icon: TrendingUp },
    { id: 'orders', title: 'অর্ডার', icon: Package },
    { id: 'products', title: 'পণ্য', icon: Tag },
    { id: 'customers', title: 'গ্রাহক', icon: Users },
    { id: 'ai-control', title: 'এআই', icon: Sliders },
    { id: 'test-chat', title: 'টেস্ট চ্যাট', icon: Zap },
    { id: 'messenger', title: 'মেসেঞ্জার', icon: Globe },
    { id: 'broadcasting', title: 'ব্রডকাস্ট', icon: Zap },
    { id: 'faqs', title: 'FAQ', icon: Tag },
    { id: 'features', title: 'ফিচার', icon: Sliders },
    { id: 'info', title: 'স্টোর', icon: Tag },
    { id: 'facebook', title: 'পিক্সেল', icon: Globe },
    { id: 'integrations', title: 'কুরিয়ার', icon: Package },
    { id: 'billing', title: 'বিলিং', icon: Sliders },
  ];

  const filteredCommands = searchableItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = orders.filter(o => o.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700 dark:border-zinc-800 dark:border-t-zinc-300" />
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
          {/* Prepaid token wallet alerts */}
          {!business.useOwnApiKey && (business.tokenBalance || 0) <= 0 && activeTab !== 'billing' && (
            <button
              onClick={() => setActiveTab('billing')}
              className="w-full mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-left flex items-center justify-between gap-3"
            >
              <p className="text-sm font-medium text-red-700 dark:text-red-300">টোকেন শেষ</p>
              <span className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium">রিচার্জ</span>
            </button>
          )}
          {!business.useOwnApiKey && (business.tokenBalance || 0) > 0 && (business.tokenBalance || 0) < 50000 && activeTab !== 'billing' && (
            <button
              onClick={() => setActiveTab('billing')}
              className="w-full mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-left flex items-center justify-between gap-3"
            >
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                টোকেন কম ({(business.tokenBalance || 0).toLocaleString()})
              </p>
              <span className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium">রিচার্জ</span>
            </button>
          )}

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
            <MerchantProducts
              business={business}
              onProductsChange={(products) =>
                setBusiness(prev => (prev ? { ...prev, products } : prev))
              }
            />
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
            <MerchantFeatures
              business={business}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onFeaturesChange={(features) =>
                setBusiness(prev => (prev ? { ...prev, features } : prev))
              }
            />
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
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md shadow-xl overflow-hidden"
            >
              <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="খুঁজুন..."
                  className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-white"
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
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{cmd.title}</p>
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
