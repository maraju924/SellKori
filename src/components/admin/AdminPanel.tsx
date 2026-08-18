import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, BusinessConfig } from '../../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { AdminOverview } from './AdminOverview';
import { AdminMerchants } from './AdminMerchants';
import { AdminSystemSettings } from './AdminSystemSettings';
import { AdminLogsTelemetry } from './AdminLogsTelemetry';

interface AdminPanelProps {
  profile: UserProfile | null;
}

export function AdminPanel({ profile }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [merchants, setMerchants] = useState<BusinessConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'businesses'), (snap) => {
      setMerchants(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessConfig)));
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 flex flex-col">
      {/* Admin Top Header */}
      <AdminHeader
        profile={profile}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Admin Desktop Sidebar */}
        <div className="hidden md:block shrink-0">
          <div className="sticky top-[60px] h-[calc(100vh-60px)]">
            <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
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
                className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 md:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed top-0 bottom-0 left-0 w-4/5 max-w-xs bg-zinc-950 z-50 md:hidden shadow-2xl border-r border-zinc-800"
              >
                <AdminSidebar
                  activeTab={activeTab}
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsMobileMenuOpen(false);
                  }}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Admin Content Screen */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 min-w-0 overflow-y-auto">
          {activeTab === 'overview' && (
            <AdminOverview merchants={merchants} />
          )}

          {activeTab === 'merchants' && (
            <AdminMerchants merchants={merchants} />
          )}

          {activeTab === 'settings' && (
            <AdminSystemSettings />
          )}

          {activeTab === 'logs' && (
            <AdminLogsTelemetry />
          )}
        </main>
      </div>
    </div>
  );
}
