import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, BusinessConfig } from '../../types';
import { collection, onSnapshot, type Firestore } from 'firebase/firestore';
import {
  firestoreDatabaseLabel,
  getPanelFirestoreDbs,
  setPanelWriteDb,
} from '../../lib/firebase';
import {
  firestoreErrorMessage,
  reconcileMultiDbSnapshots,
  type DatabaseSnapshotState,
} from '../../lib/panelFirestore';

import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { AdminMobileNav } from './AdminMobileNav';
import { AdminOverview } from './AdminOverview';
import { AdminMerchants } from './AdminMerchants';
import { AdminSystemSettings } from './AdminSystemSettings';
import { AdminLogsTelemetry } from './AdminLogsTelemetry';
import { AdminAiEngine } from './AdminAiEngine';
import { AdminBillingGateway } from './AdminBillingGateway';
import { AdminLanding } from './AdminLanding';

interface AdminPanelProps {
  profile: UserProfile | null;
}

export function AdminPanel({ profile }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [merchants, setMerchants] = useState<BusinessConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const dbs = getPanelFirestoreDbs();
    const states: DatabaseSnapshotState<BusinessConfig>[] = dbs.map(() => ({ status: 'pending' }));

    const unsubs = dbs.map((database, index) =>
      onSnapshot(
        collection(database, 'businesses'),
        (snap) => {
          states[index] = {
            status: 'ready',
            docs: snap.docs.map((d) => ({
              id: d.id,
              data: { ...d.data(), id: d.id } as BusinessConfig,
              databaseId: firestoreDatabaseLabel(database),
            })),
          };
          applyAdminSnapshots(dbs, states, setMerchants, setLoadError, setLoading);
        },
        (err) => {
          console.error('[AdminPanel] businesses snapshot failed:', err);
          states[index] = { status: 'error', error: firestoreErrorMessage(err) };
          applyAdminSnapshots(dbs, states, setMerchants, setLoadError, setLoading);
        },
      ),
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const pendingMerchantsCount = merchants.filter(m => m.verificationStatus === 'pending' || m.status === 'suspended').length;

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 flex flex-col pb-24 md:pb-0 transition-colors">
      {/* Admin Top Header */}
      <AdminHeader
        profile={profile}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Admin Desktop Sidebar */}
        <div className="hidden md:block shrink-0">
          <div className="sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto no-scrollbar">
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
                className="fixed top-0 bottom-0 left-0 w-4/5 max-w-xs bg-zinc-950 z-50 md:hidden shadow-2xl border-r border-zinc-800 rounded-r-3xl overflow-hidden flex flex-col"
              >
                <div className="sheet-handle md:hidden" />
                <div className="flex-1 overflow-y-auto">
                  <AdminSidebar
                    activeTab={activeTab}
                    setActiveTab={(tab) => {
                      setActiveTab(tab);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Admin Content Screen */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 min-w-0">
          {loadError && (
            <div className="mb-4 rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
              ডাটাবেস থেকে মার্চেন্ট লিস্ট আসছে না: {loadError}
            </div>
          )}
          {loading && merchants.length === 0 && !loadError && (
            <p className="mb-4 text-xs text-zinc-500">ডাটাবেস থেকে মার্চেন্ট লোড হচ্ছে...</p>
          )}
          {activeTab === 'overview' && (
            <AdminOverview merchants={merchants} />
          )}

          {activeTab === 'merchants' && (
            <AdminMerchants merchants={merchants} />
          )}

          {activeTab === 'ai-engine' && (
            <AdminAiEngine />
          )}

          {activeTab === 'billing' && (
            <AdminBillingGateway />
          )}

          {activeTab === 'landing' && (
            <AdminLanding />
          )}

          {activeTab === 'settings' && (
            <AdminSystemSettings />
          )}

          {activeTab === 'logs' && (
            <AdminLogsTelemetry />
          )}
        </main>
      </div>

      {/* Admin Mobile Bottom App Bar */}
      <AdminMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingMerchantsCount={pendingMerchantsCount}
      />
    </div>
  );
}

function applyAdminSnapshots(
  dbs: Firestore[],
  states: DatabaseSnapshotState<BusinessConfig>[],
  setMerchants: (rows: BusinessConfig[]) => void,
  setLoadError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
) {
  const result = reconcileMultiDbSnapshots(states);
  if (!result.ready) return;

  const counts = states.map((state) => (state.status === 'ready' ? state.docs.length : 0));
  const richest = counts.reduce((best, count, index) => (count > counts[best] ? index : best), 0);
  if (states[richest]?.status === 'ready' && counts[richest] > 0) {
    setPanelWriteDb(dbs[richest]);
  }

  setMerchants(result.docs.map((row) => row.data));
  setLoadError(result.error);
  setLoading(false);
}
