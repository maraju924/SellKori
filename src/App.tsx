/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { User as FirebaseUser, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Zap, ShieldCheck, LayoutDashboard, LogOut, Megaphone } from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import { Button } from './components/ui/button';
import { LandingPage } from './components/landing/LandingPage';
import { MerchantPanel } from './components/merchant/MerchantPanel';
import { AdminPanel } from './components/admin/AdminPanel';
import { ChatView } from './components/chat/ChatView';

function GlobalBanner() {
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    try {
      return onSnapshot(doc(db, 'system_config', 'public'), (snap) => {
        if (snap.exists()) setAnnouncement(snap.data().globalAnnouncement || null);
      }, (error) => {
        console.error("GlobalBanner Error:", error);
      });
    } catch (e) {
      console.error("GlobalBanner Snapshot Error:", e);
    }
  }, []);

  if (!announcement) return null;

  return (
    <div className="bg-rose-600 text-white py-2 px-4 text-center text-xs font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-500 sticky top-0 z-[1000]">
      <Megaphone className="w-3.5 h-3.5 shrink-0" />
      <span>{announcement}</span>
    </div>
  );
}

function Navbar({ user, profile }: { user: FirebaseUser | null; profile: UserProfile | null }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
    toast.success('লগআউট সম্পন্ন হয়েছে');
  };

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 py-3.5 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2.5 font-black text-2xl tracking-tighter">
          <div className="bg-orange-600 text-white p-2 rounded-2xl shadow-lg shadow-orange-600/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <span className="text-zinc-900 dark:text-white font-extrabold tracking-tight">
            Sell<span className="text-orange-600">Kori</span>
          </span>
        </Link>
        <div className="flex gap-3 items-center">
          {user ? (
            <>
              {profile?.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                    অ্যাডমিন
                  </Button>
                </Link>
              )}
              <Link to="/dashboard">
                <Button size="sm" className="gap-2 font-bold text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md shadow-orange-600/20">
                  <LayoutDashboard className="w-4 h-4" />
                  মার্চেন্ট ড্যাশবোর্ড
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 font-bold text-xs border-zinc-200 dark:border-zinc-700 rounded-xl">
                <LogOut className="w-4 h-4" />
                লগআউট
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 font-black px-6 rounded-xl text-xs">
                লগইন করুন
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
      toast.success('স্বাগতম! সফলভাবে লগইন হয়েছে।');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/cancelled-popup-request') {
        toast.error('পপআপ উইন্ডো বন্ধ করা হয়েছে।', { 
          description: 'লগইন করতে পপআপ উইন্ডোটি খোলা রাখুন বা ব্রাউজার সেটিংসে পপআপ Allow করুন।' 
        });
      } else {
        toast.error(err.message || 'লগইন ব্যর্থ হয়েছে');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-8 py-10 px-4">
      <div className="space-y-4">
        <div className="w-20 h-20 bg-orange-500/10 text-orange-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/10">
          <Zap className="w-10 h-10 fill-current" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">SellKori-তে স্বাগতম</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
          আপনার ফেসবুক মেসেঞ্জার ও অনলাইন স্টোরকে ২৪/৭ অটো সেলস মেশিনে পরিণত করতে লগইন করুন।
        </p>
      </div>

      <Button 
        onClick={handleLogin} 
        className="w-full h-16 gap-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-2 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none font-bold text-base rounded-2xl transition-all active:scale-95"
      >
        <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
        গুগল দিয়ে কন্টিনিউ করুন
      </Button>

      <p className="text-xs text-zinc-400">
        লগইন করার মাধ্যমে আপনি আমাদের সেবা নীতিমালা ও গোপনীয়তা নীতিতে সম্মতি প্রদান করছেন।
      </p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      console.error("Firebase auth or db not initialized");
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (u) {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          const isAdminUser = u.email === 'maraju924@gmail.com';
          if (docSnap.exists()) {
            const existing = docSnap.data() as UserProfile;
            if (isAdminUser && existing.role !== 'admin') {
              existing.role = 'admin';
              await setDoc(docRef, { role: 'admin' }, { merge: true });
            }
            setProfile(existing);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              role: isAdminUser ? 'admin' : 'merchant',
              createdAt: serverTimestamp()
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-12 h-12 rounded-2xl bg-orange-600 animate-spin flex items-center justify-center text-white font-black text-sm shadow-xl shadow-orange-600/30">
          SK
        </div>
        <p className="mt-4 text-xs font-bold text-zinc-400 tracking-wider uppercase">Loading SellKori...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
        <GlobalBanner />
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage user={user} profile={profile} />} />

          {/* Public Login Page */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <>
                  <Navbar user={user} profile={profile} />
                  <main className="max-w-7xl mx-auto p-4 md:p-8">
                    <LoginPage />
                  </main>
                </>
              )
            }
          />

          {/* Public Customer Chat Room */}
          <Route path="/chat/:businessId" element={<ChatView />} />

          {/* Merchant Control Center */}
          <Route
            path="/dashboard/*"
            element={
              user ? (
                <MerchantPanel user={user} profile={profile} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Platform Super Admin Portal */}
          <Route
            path="/admin/*"
            element={
              user && (profile?.role === 'admin' || user.email === 'maraju924@gmail.com') ? (
                <AdminPanel profile={profile} />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" />
      </div>
    </Router>
  );
}
