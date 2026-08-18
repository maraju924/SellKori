import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  setDoc, 
  where, 
  orderBy, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
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

interface MerchantPanelProps {
  user: FirebaseUser | null;
  profile: UserProfile | null;
}

export function MerchantPanel({ user, profile }: MerchantPanelProps) {
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isDark, setIsDark] = useState(false);

  // Sync dark theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleToggleTheme = () => {
    setIsDark(prev => !prev);
  };

  // Load business config for current user
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setBusiness(snapshot.docs[0].data() as BusinessConfig);
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
            deliveryChargeOutsideDhaka: 130
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

  // Load orders
  useEffect(() => {
    if (!business?.id) return;
    const ordersQ = query(
      collection(db, 'orders'),
      where('businessId', '==', business.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(ordersQ, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    }, () => {});
  }, [business?.id]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-600 animate-spin flex items-center justify-center text-white font-black text-sm">
          SK
        </div>
        <p className="text-sm font-bold text-zinc-500">মার্চেন্ট প্যানেল লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-zinc-500 text-sm">কোনো স্টোর কনফিগারেশন পাওয়া যায়নি।</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/70 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors pb-20 md:pb-0">
      {/* Top Header */}
      <MerchantHeader
        business={business}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Left Sidebar */}
        <div className="hidden md:block shrink-0">
          <div className="sticky top-[65px] h-[calc(100vh-65px)]">
            <MerchantSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              business={business}
            />
          </div>
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
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
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed top-0 bottom-0 left-0 w-4/5 max-w-xs bg-white dark:bg-zinc-950 z-50 md:hidden shadow-2xl"
              >
                <MerchantSidebar
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  business={business}
                  onClose={() => setIsMobileMenuOpen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Center Content View Area */}
        <main className="flex-1 p-4 md:p-8 min-w-0 overflow-y-auto">
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

      {/* Floating Bottom Nav for Mobile Phone Viewers */}
      <MerchantMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenFullMenu={() => setIsMobileMenuOpen(true)}
      />
    </div>
  );
}
