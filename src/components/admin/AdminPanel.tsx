import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    return onSnapshot(collection(db, 'businesses'), (snap) => {
      setMerchants(snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessConfig)));
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 flex flex-col">
      {/* Admin Top Header */}
      <AdminHeader profile={profile} />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Left Admin Sidebar */}
        <div className="hidden md:block shrink-0">
          <div className="sticky top-[65px] h-[calc(100vh-65px)]">
            <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>

        {/* Admin Content Screen */}
        <main className="flex-1 p-4 md:p-8 min-w-0 overflow-y-auto">
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
