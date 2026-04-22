/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cn } from './lib/utils';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { 
  MessageCircle, 
  MessageSquare,
  ShoppingCart,
  Settings, 
  Package, 
  HelpCircle, 
  Send, 
  User, 
  Bot, 
  ShoppingBag,
  Store,
  Plus,
  Trash2,
  LayoutDashboard,
  LogOut,
  Facebook,
  Zap,
  ShieldCheck,
  ShieldAlert,
  Users,
  Terminal,
  BarChart3,
  Globe,
  FileDigit,
  CreditCard,
  Truck,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Info,
  Mic,
  Megaphone,
  History,
  Menu,
  X,
  TrendingUp,
  FileText,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from './components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Badge } from './components/ui/badge';
import { ScrollArea } from './components/ui/scroll-area';
import { Label } from './components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism.css';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { getAIResponse } from './lib/gemini';
import { db, auth } from './lib/firebase';
import { trackEvent } from './lib/analytics';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  updateDoc,
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { BusinessConfig, Message, Product, FAQ, UserProfile, Order, Customer, SystemConfig, BusinessFeatures, BroadcastingCampaign } from './types';

const DEFAULT_BUSINESS_ID = 'main-store';

function GlobalBanner() {
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      console.error("Firestore 'db' is not initialized.");
      return;
    }
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
      <Megaphone className="w-3 h-3" />
      {announcement}
    </div>
  );
}

function MessengerLogs({ businessId, ownerId }: { businessId: string, ownerId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !ownerId) return;
    setError(null);
    // Simple query - security rules handle the rest
    const q = query(
      collection(db, 'system_logs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter locally for the specific businessId
      setLogs(allLogs.filter((l: any) => l.businessId === businessId || l.businessId === 'unknown'));
    }, (err) => {
      console.error('Logs Sync Error:', err);
      setError(`ডাটা লোড হতে সমস্যা হচ্ছে: ${err.message}`);
    });
    return unsubscribe;
  }, [businessId, ownerId]);

  if (error) {
    return <div className="p-8 text-center text-rose-500 text-[10px] font-medium italic">{error}</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-400 text-xs italic">
        কোন অ্যাক্টিভিটি পাওয়া যায়নি। মেসেঞ্জারে একটি মেসেজ দিয়ে টেস্ট করুন।
      </div>
    );
  }

  return (
    <>
      {logs.map((log) => (
        <div key={log.id} className="p-3 text-xs flex gap-3 items-start hover:bg-zinc-50 transition-colors">
          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
            log.status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
            log.status === 'error' ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'
          }`} />
          <div className="space-y-1 flex-1">
            <div className="flex justify-between items-center">
              <span className={`font-bold uppercase text-[9px] ${
                log.status === 'success' ? 'text-emerald-600' : 
                log.status === 'error' ? 'text-rose-600' : 'text-indigo-600'
              }`}>{log.type}</span>
              <span className="text-zinc-400 text-[9px]">
                {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : 'Just now'}
              </span>
            </div>
            <p className="text-zinc-700 leading-tight font-medium">{log.detail}</p>
          </div>
        </div>
      ))}
    </>
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
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              role: u.email === 'maraju924@gmail.com' ? 'admin' : 'merchant',
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

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
        <GlobalBanner />
        <Navbar user={user} profile={profile} />
        <main className="max-w-7xl mx-auto p-4 md:p-8">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/chat/:businessId" element={<ChatView />} />
            <Route path="/dashboard/*" element={<MerchantDashboard user={user} profile={profile} />} />
            <Route path="/admin/*" element={<AdminPanel user={user} profile={profile} />} />
          </Routes>
        </main>
        <Toaster position="top-center" />
      </div>
    </Router>
  );
}

function Navbar({ user, profile }: { user: FirebaseUser | null, profile: UserProfile | null }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md px-4 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 font-black text-2xl tracking-tighter">
          <div className="bg-brand-orange text-white p-1.5 rounded-xl shadow-lg shadow-brand-orange/20">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <span className="text-brand-black">Sell<span className="text-brand-orange">Kori</span></span>
        </Link>
        <div className="flex gap-4 items-center">
          {user ? (
            <>
              {profile?.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    অ্যাডমিন
                  </Button>
                </Link>
              )}
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2 font-medium">
                  <LayoutDashboard className="w-4 h-4" />
                  ড্যাশবোর্ড
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 font-medium border-zinc-200">
                <LogOut className="w-4 h-4" />
                লগআউট
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white shadow-lg shadow-brand-orange/20 font-bold px-6">
                লগইন করুন
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function LandingPage() {
  return (
    <div className="space-y-32 py-10">
      {/* Hero Section */}
      <section className="relative text-center space-y-10 max-w-5xl mx-auto py-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-brand-orange/5 blur-[120px] rounded-full -z-10" />
        
        <div className="flex justify-center">
          <Badge className="bg-brand-orange/10 text-brand-orange border-brand-orange/20 px-6 py-2 rounded-full text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-1000">
            ভবিষ্যতের ই-কমার্স এখনই
          </Badge>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black text-brand-black tracking-tight leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-700">
          চ্যাটকে রূপান্তরিত করুন <br />
          <span className="text-brand-orange">বিক্রিতে</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-zinc-500 max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000">
          অ্যাডভান্সড এআই মেসেনঞ্জার বট যা আপনার ব্যবসার জন্য স্বয়ংক্রিয়ভাবে বিক্রয় বৃদ্ধি করে এবং পিক্সেল ইভেন্ট ট্র্যাক করে।
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6 animate-in fade-in slide-in-from-bottom-16 duration-1000">
          <Link to="/login">
            <Button size="lg" className="h-16 px-10 text-xl bg-brand-orange hover:bg-brand-orange/90 shadow-xl shadow-brand-orange/20 font-black rounded-2xl">
              ফ্রি ট্রায়াল শুরু করুন
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="h-16 px-10 text-xl border-zinc-200 rounded-2xl font-bold bg-white">
            ডেমো দেখুন
          </Button>
        </div>

        {/* Hero Image / Mockup */}
        <div className="mt-20 relative px-4">
          <div className="max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-8 border-white animate-in zoom-in duration-1000">
            <img 
              src="https://picsum.photos/seed/tech/1200/675" 
              alt="Dashboard Preview" 
              className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">আপনার ব্যবসার জন্য যা কিছু থাকছে</h2>
          <p className="text-zinc-500 text-lg">আধুনিক সব ফিচারের সমন্বয়ে তৈরি সেলকরি</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: <Bot className="w-10 h-10 text-brand-orange" />, 
              title: "স্মার্ট এআই এজেন্ট", 
              desc: "বাংলায় কাস্টমারের প্রশ্নের উত্তর দেওয়া এবং প্রোডাক্ট সাজেস্ট করার জন্য ২৪/৭ নিয়োজিত থাকবে।" 
            },
            { 
              icon: <Globe className="w-10 h-10 text-brand-orange" />, 
              title: "ফুল পিক্সেল ইন্টিগ্রেশন", 
              desc: "ফেসবুক পিক্সেল এবং সি-এপিআই (CAPI) এর মাধ্যমে আপনার বিজ্ঞাপনের কনভারশন ট্র্যাক করুন নিখুঁতভাবে।" 
            },
            { 
              icon: <ShieldCheck className="w-10 h-10 text-brand-orange" />, 
              title: "শক্তিশালী ড্যাশবোর্ড", 
              desc: "মার্চেন্টদের জন্য একটি কমপ্লিট ড্যাশবোর্ড যেখানে অর্ডার ম্যানেজমেন্ট থেকে শুরু করে অ্যানালিটিক্স সবই পাবেন এক জায়গায়।" 
            }
          ].map((feat, i) => (
            <Card key={i} className="border-none shadow-xl shadow-zinc-200/50 bg-white group hover:-translate-y-2 transition-transform duration-300 rounded-3xl overflow-hidden">
              <CardContent className="pt-10 pb-10 px-8 space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-brand-orange/5 flex items-center justify-center group-hover:bg-brand-orange group-hover:text-white transition-colors duration-300">
                  {feat.icon}
                </div>
                <h3 className="text-2xl font-black">{feat.title}</h3>
                <p className="text-zinc-500 leading-relaxed text-base">{feat.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Stats/Social Proof */}
      <section className="bg-brand-black text-white rounded-[40px] p-12 md:p-24 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/20 blur-[100px] rounded-full" />
        <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-6xl font-black leading-tight">আপনার সেলস বৃদ্ধি হবে চোখের সামনে</h2>
            <p className="text-zinc-400 text-xl leading-relaxed">
              হাজার হাজার মার্চেন্ট ইতিমধ্যে সেলকরি ব্যবহার করে তাদের কাস্টমার সাপোর্ট এবং সেলস অটোমেশন নিশ্চিত করেছেন।
            </p>
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="space-y-1">
                <div className="text-4xl font-black text-brand-orange">৮৫%</div>
                <div className="text-sm text-zinc-500 uppercase tracking-widest font-bold">অটোমেশন রেট</div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-black text-brand-orange">২.৫ গুণ</div>
                <div className="text-sm text-zinc-500 uppercase tracking-widest font-bold">বিক্রয় বৃদ্ধি</div>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl space-y-6">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(i => <Zap key={i} className="w-5 h-5 fill-brand-orange text-brand-orange" />)}
            </div>
            <p className="text-xl italic font-medium leading-relaxed">
              "সেলকরি ইন্টিগ্রেট করার পর থেকে আমার আর এক্সট্রা কাস্টমার কেয়ার লোক রাখতে হয়নি। এআই একাই সব সামলাচ্ছে এবং সঠিক ভাবে অর্ডার কনফার্ম করছে।"
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-orange" />
              <div>
                <div className="font-bold">রাকিব আহমেদ</div>
                <div className="text-sm text-zinc-500">সিইও, রাকিব স্টোর</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t pt-20 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-6 max-w-sm">
            <Link to="/" className="flex items-center gap-2 font-black text-3xl tracking-tighter">
              <span className="text-brand-black">Sell<span className="text-brand-orange">Kori</span></span>
            </Link>
            <p className="text-zinc-500">আপনার ই-কমার্স ব্যবসার বিক্রয় বৃদ্ধির সবচেয়ে নির্ভরযোগ্য সঙ্গী।</p>
            <div className="flex gap-4">
              <Button variant="ghost" size="icon" className="rounded-full bg-zinc-100"><Facebook className="w-5 h-5 text-zinc-600" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full bg-zinc-100"><MessageCircle className="w-5 h-5 text-zinc-600" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <h4 className="font-bold uppercase text-xs tracking-widest text-zinc-400">কোম্পানি</h4>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/" className="hover:text-brand-orange transition-colors">আমাদের সম্পর্কে</Link></li>
                <li><Link to="/" className="hover:text-brand-orange transition-colors">প্রাইসিং</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold uppercase text-xs tracking-widest text-zinc-400">রিসোর্স</h4>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/" className="hover:text-brand-orange transition-colors">ডকুমেন্টেশন</Link></li>
                <li><Link to="/" className="hover:text-brand-orange transition-colors">ব্লগ</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold uppercase text-xs tracking-widest text-zinc-400">লিগ্যাল</h4>
              <ul className="space-y-2 text-sm font-medium">
                <li><Link to="/" className="hover:text-brand-orange transition-colors">প্রাইভেসি পলিসি</Link></li>
                <li><Link to="/" className="hover:text-brand-orange transition-colors">টার্মস অ্যান্ড কন্ডিশন</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-20 pt-8 border-t text-center text-sm text-zinc-400">
          © ২০২৪ সেলকরি। সর্বস্বত্ব সংরক্ষিত।
        </div>
      </footer>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'লগইন ব্যর্থ হয়েছে');
      console.error('Login error:', err);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-10 py-10">
      <div className="space-y-4">
        <div className="w-20 h-20 bg-brand-orange/10 text-brand-orange rounded-[2rem] flex items-center justify-center mx-auto mb-6">
          <Zap className="w-10 h-10 fill-current" />
        </div>
        <h2 className="text-4xl font-black text-brand-black tracking-tight">আবারও স্বাগতম</h2>
        <p className="text-zinc-500 text-lg">আপনার এআই সেলস এজেন্ট কন্ট্রোল করতে লগইন করুন</p>
      </div>
      <Button onClick={handleLogin} className="w-full h-16 gap-3 bg-white text-zinc-900 border-2 border-zinc-100 hover:bg-zinc-50 shadow-xl shadow-zinc-100/50 font-bold text-lg rounded-2xl transition-all active:scale-95">
        <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
        গুগল দিয়ে কন্টিনিউ করুন
      </Button>
      <p className="text-sm text-zinc-400">লগইন করার মাধ্যমে আপনি আমাদের শর্ত ও প্রাইভেসি পলিসিতে সম্মতি দিচ্ছেন।</p>
    </div>
  );
}

function Sidebar({ items, activeTab, setActiveTab, onClose }: { items: { id: string, label: string, icon: any }[], activeTab: string, setActiveTab: (id: string) => void, onClose?: () => void }) {
  return (
    <div className="w-full md:w-64 border-r bg-white h-full md:h-[calc(100vh-4rem)] md:sticky md:top-16 flex flex-col p-4 gap-2">
      <div className="flex md:hidden justify-between items-center mb-6 px-2">
        <span className="font-bold text-lg">Menu</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-6 h-6" />
        </Button>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            setActiveTab(item.id);
            if (onClose) onClose();
          }}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all w-full text-left",
            activeTab === item.id 
              ? "bg-indigo-50 text-indigo-600 shadow-sm" 
              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-600" : "text-zinc-400")} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MerchantDashboard({ user, profile }: { user: FirebaseUser | null, profile: UserProfile | null }) {
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analytics');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!business?.id) return;
    const q = query(
      collection(db, 'orders'),
      where('businessId', '==', business.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });
  }, [business?.id]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'businesses'), where('ownerId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setBusiness(snapshot.docs[0].data() as BusinessConfig);
      } else {
        // Create initial config
        const newId = `biz-${Date.now()}`;
        const initial: BusinessConfig = {
          id: newId,
          ownerId: user.uid,
          name: "My Store",
          description: "একটি বিশ্বস্ত অনলাইন শপ।",
          products: [],
          faqs: [],
          facebookConfig: { pixelId: '', accessToken: '', testEventCode: '' },
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
          customSystemPrompt: '',
          messengerVerifyToken: Math.random().toString(36).substring(2, 15),
          status: 'active',
          plan: 'free',
          verificationStatus: 'pending',
          createdAt: serverTimestamp()
        };
        setDoc(doc(db, 'businesses', newId), initial);
      }
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !business) return;
    // Log dashboard access for debugging
    const logDashboardOpen = async () => {
      try {
        await addDoc(collection(db, 'system_logs'), {
          businessId: business.id,
          ownerId: business.ownerId,
          type: 'DASHBOARD_LIVE',
          detail: 'মার্চেন্ট ড্যাশবোর্ড সফলভাবে ওপেন হয়েছে।',
          status: 'success',
          timestamp: serverTimestamp()
        });
      } catch (e) {}
    };
    logDashboardOpen();
  }, [user, business]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading Dashboard...</div>;
  if (!business) return <div className="h-screen flex items-center justify-center">No business found.</div>;

  if (business.status === 'suspended') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-rose-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">অ্যাকাউন্ট সাময়িকভাবে স্থগিত (Suspended)</h2>
          <p className="text-zinc-500 max-w-md">আপনার অ্যাকাউন্টটি নীতিমালার কারণে বা অন্য কোনো সমস্যার জন্য স্থগিত করা হয়েছে। বিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = 'mailto:support@example.com'}>অ্যাডমিনকে ইমেইল করুন</Button>
      </div>
    );
  }

  const menuItems = [
    { id: 'analytics', label: 'Analytics', icon: Globe },
    { id: 'info', label: 'Store Info', icon: Store },
    { id: 'test-chat', label: 'Test Chat', icon: Terminal },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'customers', label: 'CRM', icon: User },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    { id: 'ai', label: 'AI Prompt', icon: Bot },
    { id: 'features', label: 'Feature Management', icon: ShieldCheck },
    { id: 'integrations', label: 'Integrations', icon: Settings },
    { id: 'facebook', label: 'Pixel & CAPI', icon: Globe },
    { id: 'messenger', label: 'Messenger', icon: MessageCircle },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 -mt-8 -mx-4 md:-mx-8 min-h-[calc(100vh-4rem)] relative">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar items={menuItems} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white md:hidden"
          >
            <Sidebar 
              items={menuItems} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              onClose={() => setIsMobileMenuOpen(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              className="md:hidden" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Merchant Panel</h1>
              <p className="text-sm text-zinc-500">Manage {business.name}</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-2">
            <Badge variant="secondary" className="gap-1 px-3 py-1">
              <Globe className="w-3 h-3" />
              Public Chat: /chat/{business.id}
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="analytics" className="mt-0">
            <AnalyticsDashboard business={business} orders={orders} />
          </TabsContent>

          <TabsContent value="info" className="mt-0">
            <BusinessInfoManager business={business} />
          </TabsContent>

          <TabsContent value="test-chat" className="mt-0">
            <TestChat business={business} />
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <OrderManager business={business} />
          </TabsContent>

          <TabsContent value="customers" className="mt-0">
            <CRMManager business={business} />
          </TabsContent>

          <TabsContent value="broadcasting" className="mt-0">
             <BroadcastingManager business={business} />
          </TabsContent>

          <TabsContent value="products" className="mt-0">
            <ProductManager business={business} />
          </TabsContent>

          <TabsContent value="integrations" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CourierConfig business={business} />
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-0">
            <ProductManager business={business} />
          </TabsContent>

          <TabsContent value="faqs" className="mt-0">
            <FAQManager business={business} />
          </TabsContent>

          <TabsContent value="ai" className="mt-0">
            <AIPromptManager business={business} />
          </TabsContent>

          <TabsContent value="features" className="mt-0">
            <FeatureManager business={business} />
          </TabsContent>

          <TabsContent value="facebook" className="mt-0">
            <FacebookConfigManager business={business} />
          </TabsContent>

          <TabsContent value="messenger" className="mt-0">
            <MessengerConnect business={business} setBusiness={setBusiness} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProductManager({ business }: { business: BusinessConfig }) {
  const [newProduct, setNewProduct] = useState<Partial<Product>>({});
  const [imageUrls, setImageUrls] = useState<string>('');

  const save = async (products: Product[]) => {
    await setDoc(doc(db, 'businesses', business.id), { ...business, products });
  };

  const add = () => {
    if (!newProduct.name || !newProduct.price) return;
    
    // Split by newline or comma to handle multiple URLs
    const images = imageUrls.split(/[\n,]/).map(url => url.trim()).filter(url => url.length > 0);

    const p: Product = { 
      id: Date.now().toString(), 
      name: newProduct.name, 
      price: Number(newProduct.price), 
      minPrice: newProduct.minPrice ? Number(newProduct.minPrice) : undefined,
      description: newProduct.description || '',
      images: images,
      stockCount: Number(newProduct.stockCount) || 0
    };
    save([...business.products, p]);
    setNewProduct({});
    setImageUrls('');
    toast.success('প্রোডাক্ট সফলভাবে যোগ করা হয়েছে');
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <Card className="md:col-span-1 border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-indigo-600 text-white">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Plus className="w-6 h-6" />
            নতুন প্রোডাক্ট
          </CardTitle>
          <CardDescription className="text-indigo-100">আপনার স্টোরে নতুন প্রোডাক্ট যোগ করুন।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label className="font-bold text-zinc-700">নাম (Product Name)</Label>
            <Input placeholder="প্রোডাক্টের নাম লিখুন" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="h-12 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-zinc-700">দাম (Price)</Label>
              <Input type="number" placeholder="৳ দাম" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-zinc-700">সর্বনিম্ন দাম (Min Price)</Label>
              <Input type="number" placeholder="৳ বারগেইনিং দাম" value={newProduct.minPrice || ''} onChange={e => setNewProduct({...newProduct, minPrice: e.target.value})} className="h-12 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-zinc-700">স্টক পরিমাণ (Stock Count)</Label>
            <Input type="number" placeholder="কতগুলো আইটেম আছে?" value={newProduct.stockCount || ''} onChange={e => setNewProduct({...newProduct, stockCount: e.target.value})} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-zinc-700">ছবির লিঙ্ক (Image URLs - একটির বেশি হলে নতুন লাইনে লিখুন)</Label>
            <Textarea 
              placeholder="https://example.com/image1.jpg\nhttps://example.com/image2.jpg" 
              value={imageUrls} 
              onChange={e => setImageUrls(e.target.value)} 
              className="h-32 rounded-xl text-xs font-mono"
            />
            <p className="text-[10px] text-zinc-400 italic font-medium">* আপনি যত খুশি লিঙ্ক দিতে পারেন, প্রতিটি আলাদা লাইনে দিন।</p>
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-zinc-700">বিস্তারিত (Description)</Label>
            <Textarea placeholder="প্রোডাক্ট সম্পর্কে কিছু বিস্তারিত লিখুন..." value={newProduct.description || ''} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="h-24 rounded-xl" />
          </div>
          <Button onClick={add} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-100">
            প্রোডাক্ট সেভ করুন
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 border-none shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl font-bold">প্রোডাক্ট লিস্ট</CardTitle>
              <CardDescription>আপনার শপের সকল প্রোডাক্ট এখানে দেখতে পারবেন।</CardDescription>
            </div>
            <Badge variant="secondary" className="px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-100">
              Total {business.products.length} Items
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 border-none">
                  <TableHead className="rounded-tl-2xl">ছবি (Gallery)</TableHead>
                  <TableHead>নাম ও কোয়ালিটি</TableHead>
                  <TableHead>দাম (৳)</TableHead>
                  <TableHead>মিনিমাম (৳)</TableHead>
                  <TableHead className="text-right rounded-tr-2xl">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {business.products.map(p => (
                  <TableRow key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <TableCell>
                      <div className="flex -space-x-4 overflow-hidden p-1">
                        {p.images && p.images.length > 0 ? (
                          p.images.slice(0, 3).map((img, i) => (
                            <div key={i} className="relative inline-block border-2 border-white rounded-xl shadow-sm overflow-hidden w-12 h-12 bg-white">
                              <img src={img} alt={`${p.name} ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              {i === 2 && p.images.length > 3 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                                  +{p.images.length - 3}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center border-2 border-white shadow-sm">
                            <Package className="w-5 h-5 text-zinc-300" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-zinc-900">{p.name}</div>
                      <div className="text-[10px] text-zinc-400 font-medium truncate max-w-[150px]">
                        {p.description || 'No description provided'}
                      </div>
                    </TableCell>
                    <TableCell className="font-extrabold text-indigo-600">৳{p.price}</TableCell>
                    <TableCell className="text-zinc-500 font-medium">{p.minPrice ? `৳${p.minPrice}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          if (confirm('আপনি কি এই প্রোডাক্টটি মুছে ফেলতে চান?')) {
                            save(business.products.filter(x => x.id !== p.id));
                          }
                        }} 
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {business.products.length === 0 && (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-zinc-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-10 h-10 text-zinc-300" />
              </div>
              <h3 className="text-lg font-bold text-zinc-400 italic">আপনার স্টোরে এখনও কোনো প্রোডাক্ট নেই।</h3>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AIPromptManager({ business }: { business: BusinessConfig }) {
  const [prompt, setPrompt] = useState(business.customSystemPrompt || '');
  const save = async () => {
    await setDoc(doc(db, 'businesses', business.id), { ...business, customSystemPrompt: prompt });
    toast.success('AI Prompt updated');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom AI System Prompt</CardTitle>
        <CardDescription>Define how your AI should behave. Use Markdown for better structure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg overflow-hidden bg-zinc-50 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 border-b text-xs font-mono text-zinc-500">
            <Bot className="w-3 h-3" />
            SYSTEM_PROMPT.md
          </div>
          <div className="max-h-[500px] overflow-auto">
            <Editor
              value={prompt}
              onValueChange={code => setPrompt(code)}
              highlight={code => highlight(code, languages.markdown, 'markdown')}
              padding={20}
              className="font-mono text-sm min-h-[300px] outline-none"
              style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              }}
            />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-zinc-500">
            Tip: Include product details and brand voice instructions.
          </p>
          <Button onClick={save} className="gap-2">
            <Zap className="w-4 h-4" />
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FacebookConfigManager({ business }: { business: BusinessConfig }) {
  const [config, setConfig] = useState(business.facebookConfig || { pixelId: '', accessToken: '', testEventCode: '' });
  const [verifyToken, setVerifyToken] = useState(business.messengerVerifyToken || '');

  const save = async () => {
    await setDoc(doc(db, 'businesses', business.id), { 
      ...business, 
      facebookConfig: config,
      messengerVerifyToken: verifyToken 
    });
    toast.success('Facebook config updated');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facebook & Messenger Configuration</CardTitle>
        <CardDescription>Configure your Pixel, CAPI, and Messenger Webhook settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pixel ID</Label>
            <Input value={config.pixelId} onChange={e => setConfig({...config, pixelId: e.target.value})} placeholder="1234567890" />
          </div>
          <div className="space-y-2">
            <Label>Messenger Verify Token</Label>
            <Input value={verifyToken} onChange={e => setVerifyToken(e.target.value)} placeholder="myVerifyToken123" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Page Access Token (CAPI & Messenger)</Label>
          <Input type="password" value={config.accessToken} onChange={e => setConfig({...config, accessToken: e.target.value})} />
          <p className="text-xs text-zinc-500">Required for both Conversions API and Messenger replies</p>
        </div>

        <div className="space-y-2">
          <Label>Test Event Code (Optional)</Label>
          <Input placeholder="TEST12345" value={config.testEventCode || ''} onChange={e => setConfig({...config, testEventCode: e.target.value})} />
          <p className="text-xs text-zinc-500">Use this to test events in Facebook Events Manager</p>
        </div>
        
        <Button onClick={save} className="w-full md:w-auto">Save Config</Button>
      </CardContent>
    </Card>
  );
}

function BusinessInfoManager({ business }: { business: BusinessConfig }) {
  const [name, setName] = useState(business.name || '');
  const [description, setDescription] = useState(business.description || '');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), {
        name,
        description
      });
      toast.success('ব্যবসার তথ্য আপডেট করা হয়েছে');
    } catch (err: any) {
      toast.error('আপডেট করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5 text-indigo-600" />
          ব্যবসার তথ্য (Business Information)
        </CardTitle>
        <CardDescription>আপনার স্টোরের নাম এবং সাধারণ তথ্য এখানে দিন যা আপনার কাস্টমারদের সাথে কথা বলার সময় AI ব্যবহার করবে।</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>স্টোরের নাম (Store Name)</Label>
          <Input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="আপনার স্টোরের নাম লিখুন" 
          />
        </div>
        <div className="space-y-2">
          <Label>ব্যবসার তথ্য/বিবরণ (Business Info/Description)</Label>
          <Textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            placeholder="আপনার ব্যবসা সম্পর্কে কিছু বলুন (যেমন: কি কি প্রোডাক্ট বিক্রি করেন, ডেলিভারি টাইম কতদিন লাগে, ইত্যাদি)"
            className="h-32"
          />
          <p className="text-[10px] text-zinc-400 italic">
            * এই তথ্যটি AI ব্যবহার করে আপনার কাস্টমারদের উত্তর দেওয়ার জন্য।
          </p>
        </div>
        <Button onClick={save} disabled={loading} className="w-full bg-indigo-600">
          {loading ? 'সেভ হচ্ছে...' : 'তথ্য সেভ করুন'}
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminPanel({ user, profile }: { user: FirebaseUser | null, profile: UserProfile | null }) {
  const [businesses, setBusinesses] = useState<BusinessConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const q = query(collection(db, 'businesses'));
    return onSnapshot(q, (snapshot) => {
      setBusinesses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BusinessConfig)));
      setLoading(false);
    });
  }, [profile]);

  if (profile?.role !== 'admin') return <div className="p-20 text-center">Access Denied</div>;
  if (loading) return <div className="p-20 text-center">Loading Admin Panel...</div>;

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'merchants', label: 'Merchants', icon: User },
    { id: 'system', label: 'System Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 -mt-8 -mx-4 md:-mx-8 min-h-[calc(100vh-4rem)] relative">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar items={menuItems} activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white md:hidden"
          >
            <Sidebar 
              items={menuItems} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              onClose={() => setIsMobileMenuOpen(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            size="icon" 
            className="md:hidden" 
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Panel</h1>
            <p className="text-sm text-zinc-500">Platform-wide management and monitoring</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm bg-indigo-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-80">Total Merchants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{businesses.length}</div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-emerald-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-80">Active Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{businesses.filter(b => b.facebookConfig?.accessToken).length}</div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-amber-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-80">Verified Businesses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{businesses.filter(b => b.verificationStatus === 'verified').length}</div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-rose-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-80">Suspended</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{businesses.filter(b => b.status === 'suspended').length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Merchants</CardTitle>
                <CardDescription>Latest businesses joined the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Owner ID</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.map((biz) => (
                      <TableRow key={biz.id}>
                        <TableCell className="font-medium">{biz.name}</TableCell>
                        <TableCell className="text-xs text-zinc-500 font-mono">{biz.ownerId}</TableCell>
                        <TableCell>{biz.products.length}</TableCell>
                        <TableCell>
                          <Badge variant={biz.facebookConfig?.accessToken ? "default" : "secondary"}>
                            {biz.facebookConfig?.accessToken ? "Connected" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Manage</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merchants" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Merchant Management</CardTitle>
                <CardDescription>Control access, verification, and subscription status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verification</TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.map((biz) => (
                      <TableRow key={biz.id}>
                        <TableCell>
                          <div className="font-medium">{biz.name}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{biz.id}</div>
                        </TableCell>
                        <TableCell>
                          <select 
                            className="bg-transparent text-xs font-medium outline-none"
                            value={biz.plan}
                            onChange={(e) => updateDoc(doc(db, 'businesses', biz.id), { plan: e.target.value })}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className="cursor-pointer"
                            variant={biz.status === 'active' ? 'default' : 'destructive'}
                            onClick={() => updateDoc(doc(db, 'businesses', biz.id), { status: biz.status === 'active' ? 'suspended' : 'active' })}
                          >
                            {biz.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <select 
                            className="bg-transparent text-xs outline-none"
                            value={biz.verificationStatus}
                            onChange={(e) => updateDoc(doc(db, 'businesses', biz.id), { verificationStatus: e.target.value })}
                          >
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => toast.info(`Viewing ${biz.name}`)}>View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="mt-0">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SystemSettings() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [zinipayApiKey, setZinipayApiKey] = useState('');
  const [zinipayMerchantId, setZinipayMerchantId] = useState('');
  const [globalAnnouncement, setGlobalAnnouncement] = useState('');
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'system_config', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SystemConfig;
        setGeminiApiKey(data.geminiApiKey || '');
        setZinipayApiKey(data.zinipayApiKey || '');
        setZinipayMerchantId(data.zinipayMerchantId || '');
        setGlobalAnnouncement(data.globalAnnouncement || '');
        setDefaultSystemPrompt(data.defaultSystemPrompt || '');
      }
      setLoading(false);
    }, (error) => {
      console.error("SystemSettings Error:", error);
      setLoading(false);
    });
  }, []);

  const saveConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Save full config for admin
      await setDoc(doc(db, 'system_config', 'config'), {
        geminiApiKey,
        zinipayApiKey,
        zinipayMerchantId,
        globalAnnouncement,
        defaultSystemPrompt,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'unknown'
      }, { merge: true });

      // Save public config for everyone
      await setDoc(doc(db, 'system_config', 'public'), {
        globalAnnouncement,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success('System configuration updated');
    } catch (err: any) {
      toast.error('Failed to update config: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Platform Settings</CardTitle>
        <CardDescription>Manage master API keys and core infrastructure configuration</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={saveConfig} className="space-y-6">
          <div className="space-y-6">
            <div className="p-4 border rounded-xl bg-zinc-50 space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Bot className="w-5 h-5" />
                <h3 className="font-bold">AI Infrastructure</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gemini_key">Gemini API Key</Label>
                  <div className="relative">
                    <Input 
                      id="gemini_key"
                      type="password"
                      placeholder="AI Studio / Google Cloud API Key" 
                      value={geminiApiKey} 
                      onChange={e => setGeminiApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <div className="absolute right-3 top-2.5 text-zinc-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="default_prompt">Default System Prompt</Label>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] h-7 gap-1"
                      onClick={() => setDefaultSystemPrompt(`# মাস্টার সেলস গাইডলাইন (SaaS AI eCommerce)

তুমি একজন অত্যন্ত বিচক্ষণ, বিনয়ী এবং দক্ষ সেলস অ্যাসিস্ট্যান্ট। তোমার মূল লক্ষ্য হলো কাস্টমারকে সন্তুষ্ট রাখা এবং সর্বোচ্চ বিক্রয় নিশ্চিত করা।

## ১. দরদাম ও ডিসকাউন্ট পলিসি (Bargaining Rules) - CRITICAL
কাস্টমাররা প্রায়ই ডিসকাউন্ট বা দরদাম (Bargaining) করতে চাইবে। সেক্ষেত্রে নিচের নিয়মগুলো অক্ষরে অক্ষরে পালন করো:
- **প্রাইস কোটেশন:** সবসময় প্রোডাক্টের 'price' (রেগুলার দাম) দিয়ে কথা শুরু করবে।
- **ডিসকাউন্ট রিকোয়েস্ট:** কাস্টমার যদি ডিসকাউন্ট চায়, তবে সরাসরি দাম না কমিয়ে প্রথমে প্রোডাক্টের কোয়ালিটি এবং ইউনিকনেস হাইলাইট করো।
- **স্টেপ-বাই-স্টেপ নেগোসিয়েশন:** কাস্টমার জেদ করলে ধাপে ধাপে দাম কমাও (যেমন- প্রথমে ২০-৫০ টাকা ছাড়)। 
- **সর্বনিম্ন সীমা (Minimum Price):** প্রতিটি প্রোডাক্টের একটি 'minPrice' (সর্বনিম্ন দাম) আছে। কাস্টমারকে মোটেও বুঝতে দিবে না যে তোমার কাছে কোনো সর্বনিম্ন দাম আছে। কোনো অবস্থাতেই 'minPrice'-এর নিচে দাম কমিয়ে রাজি হবে না। 

## ২. কথা বলার ধরন (Tone & Voice)
- ভাষা: কাস্টমার যে ভাষায় কথা বলবে (বাংলা/ইংরেজি), তুমিও সেই ভাষায় কথা বলো। তবে ডিফল্ট হিসেবে সুন্দর প্রমিত বাংলা ব্যবহার করো।
- সম্বোধন: কাস্টমারকে "স্যার/ম্যাম" বা "আপনি" বলে সম্মান দিয়ে কথা বলবে।
- স্মার্টনেস: চ্যাট এমনভাবে করবে যেন মনে হয় কোনো রক্ত-মাংসের মানুষ বিক্রয় করার চেষ্টা করছে।

## ৩. কনফার্মেশন রুলস
- সব তথ্য (নাম, ফোন, ঠিকানা, পরিমাণ) না পাওয়া পর্যন্ত 'need_more_info: true' রাখবে।
- ফোন নম্বর অবশ্যই ১১ ডিজিটের হতে হবে।
- অর্ডার শেষ করার আগে একবার সব ডিটেইলস সামারি আকারে জানাবে।`)}
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      Load Master Template
                    </Button>
                  </div>
                  <Textarea 
                    id="default_prompt"
                    placeholder="Enter default system prompt for new merchants..." 
                    value={defaultSystemPrompt} 
                    onChange={e => setDefaultSystemPrompt(e.target.value)}
                    className="h-48 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-xl bg-rose-50 border-rose-100 space-y-4">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <Megaphone className="w-5 h-5" />
                <h3 className="font-bold">Platform Announcement</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement">Announcement Text</Label>
                <Textarea 
                  id="announcement"
                  placeholder="Type an announcement for all merchants..." 
                  value={globalAnnouncement} 
                  onChange={e => setGlobalAnnouncement(e.target.value)}
                  className="h-20"
                />
                <p className="text-[10px] text-zinc-500 italic">* This will be displayed as a priority banner for all users.</p>
              </div>
            </div>

            <div className="p-4 border rounded-xl bg-zinc-50 space-y-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold">Online Payment (Zinipay)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zinipay_key">Zinipay API Key</Label>
                  <Input 
                    id="zinipay_key"
                    type="password"
                    placeholder="Enter Zinipay API Key" 
                    value={zinipayApiKey} 
                    onChange={e => setZinipayApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zinipay_merchant">Zinipay Merchant ID</Label>
                  <Input 
                    id="zinipay_merchant"
                    placeholder="Enter Zinipay Merchant ID" 
                    value={zinipayMerchantId} 
                    onChange={e => setZinipayMerchantId(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                * Note: Changing this key will affect all online payments across the platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-xl bg-zinc-50">
                <h3 className="font-medium text-sm mb-2">Messenger Webhooks</h3>
                <div className="flex items-center gap-2 text-emerald-600 text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Endpoints Active
                </div>
              </div>
              <div className="p-4 border rounded-xl bg-zinc-50">
                <h3 className="font-medium text-sm mb-2">Database Status</h3>
                <div className="flex items-center gap-2 text-emerald-600 text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Firestore Connected
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px]">
              {saving ? 'Saving...' : 'Update Settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ChatView() {
  const { businessId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSummary, setChatSummary] = useState('');
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem('chat_session_id');
    if (saved) return saved;
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chat_session_id', id);
    return id;
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!businessId || !sessionId) return;
    
    // Fetch existing summary and info if any
    const customerRef = doc(db, 'customers', `${businessId}_${sessionId}`);
    getDoc(customerRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setChatSummary(data.chatSummary || '');
      }
    });

    const docRef = doc(db, 'businesses', businessId);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        const biz = snap.data() as BusinessConfig;
        setBusiness(biz);
        trackEvent(biz.id, 'page_view', { page: 'chat' }, biz.ownerId);
      }
    });

    // Fetch recent orders for this customer session
    const ordersQ = query(
      collection(db, 'orders'),
      where('businessId', '==', businessId),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    
    return onSnapshot(ordersQ, (snap) => {
      setRecentOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    }, (error) => {
      console.error("Orders Listener Error:", error);
    });
  }, [businessId, sessionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || !business || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    trackEvent(business.id, 'chat_message_sent', { role: 'user' }, business.ownerId);

    try {
      if (business.status === 'suspended') {
        const assistantMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: 'দুঃখিত, এই শপটি বর্তমানে সাময়িকভাবে বন্ধ আছে। পরে আবার চেষ্টা করুন।', 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      if (business.features?.aiEnabled === false) {
        const assistantMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: 'বর্তমানে আমাদের এআই সার্ভিসটি বন্ধ আছে। অনুগ্রহ করে পরে যোগাযোগ করুন।', 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      const chatHistory = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
      const orderContext = (business.features?.orderTrackingEnabled !== false && recentOrders.length > 0) 
        ? `Customer Recent Orders: ${recentOrders.map(o => `Product: ${o.productName}, Status: ${o.status}${o.courierStatus ? ` (Courier: ${o.courierStatus})` : ''}, Date: ${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : 'Recent'}${o.courierTrackingId ? `, Tracking ID: ${o.courierTrackingId}` : ''}`).join(' | ')}`
        : 'No recent orders found.';

      const currentSummary = business.features?.chatSummaryEnabled !== false ? chatSummary : undefined;
      const aiResponse = await getAIResponse(textToSend, chatHistory, business, orderContext, undefined, undefined, currentSummary);
      
      const newSummaryValue = aiResponse.summary || chatSummary;
      if (business.features?.chatSummaryEnabled !== false) {
        setChatSummary(newSummaryValue);
      }
      
      // Update customer record with summary and last interaction
      await setDoc(doc(db, 'customers', `${business.id}_${sessionId}`), {
        id: sessionId,
        businessId: business.id,
        businessOwnerId: business.ownerId,
        name: aiResponse.order_data.name || 'Anonymous Customer',
        phone: aiResponse.order_data.phone || '',
        address: aiResponse.order_data.address || '',
        chatSummary: business.features?.chatSummaryEnabled !== false ? newSummaryValue : '',
        lastInteraction: serverTimestamp(),
        leadScore: aiResponse.confidence * 100,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiResponse.reply, timestamp: Date.now(), aiMetadata: aiResponse };
      setMessages(prev => [...prev, assistantMsg]);

      trackEvent(business.id, 'chat_message_received', { 
        intent: aiResponse.intent,
        event: aiResponse.event_name,
        stage: aiResponse.conversation_stage
      }, business.ownerId);

      if (aiResponse.event_name === 'Purchase' && !aiResponse.need_more_info) {
        const product = business.products.find(p => p.name.toLowerCase() === aiResponse.product_name.toLowerCase()) || 
                      business.products.find(p => p.name.toLowerCase().includes(aiResponse.product_name.toLowerCase()));
        
        const unitPrice = aiResponse.order_data.negotiated_price 
          ? Number(aiResponse.order_data.negotiated_price.replace(/[^0-9]/g, '')) 
          : (product?.price || 0);
          
        const qty = Number(aiResponse.order_data.quantity) || 1;
        const totalPrice = unitPrice * qty;

        await addDoc(collection(db, 'orders'), {
          merchantId: business.ownerId,
          businessId: business.id,
          sessionId: sessionId,
          customerName: aiResponse.order_data.name,
          phone: aiResponse.order_data.phone,
          address: aiResponse.order_data.address,
          quantity: qty,
          productName: aiResponse.product_name,
          unitPrice,
          totalPrice,
          eventName: aiResponse.event_name,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        trackEvent(business.id, 'order_completed', { 
          product: aiResponse.product_name,
          quantity: qty,
          totalPrice
        }, business.ownerId);
        toast.success('অর্ডার সফলভাবে গ্রহণ করা হয়েছে!');
      }

      // Send Facebook Event (CAPI)
      if (business.facebookConfig?.pixelId && business.facebookConfig?.accessToken) {
        const product = business.products.find(p => p.name.toLowerCase().includes(aiResponse.product_name.toLowerCase()));
        
        fetch('/api/fb-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pixelId: business.facebookConfig.pixelId,
            accessToken: business.facebookConfig.accessToken,
            eventName: aiResponse.event_name,
            eventData: {
              value: aiResponse.event_name === 'Purchase' ? (product?.price || 0) : 0,
              currency: 'BDT',
              content_name: aiResponse.product_name || 'General Query',
              content_category: 'Product',
              conversation_stage: aiResponse.conversation_stage
            },
            userData: {
              ph: aiResponse.order_data.phone ? [aiResponse.order_data.phone] : [],
              fn: aiResponse.order_data.name ? [aiResponse.order_data.name] : [],
            },
            testEventCode: business.facebookConfig.testEventCode
          })
        }).then(res => res.json())
          .then(data => console.log('FB CAPI Response:', data))
          .catch(err => console.error('FB CAPI Fetch Error:', err));
      }
    } catch (err) {
      toast.error('AI error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!business) return <div className="text-center py-20">Loading Chat...</div>;

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-160px)] flex flex-col bg-white rounded-2xl shadow-xl border overflow-hidden">
      <div className="bg-indigo-600 p-4 text-white flex items-center gap-3">
        <Bot className="w-6 h-6" />
        <div><h2 className="font-bold">{business.name} Assistant</h2><p className="text-xs opacity-80">Active</p></div>
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-zinc-100 text-zinc-800 rounded-tl-none'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
              
              {msg.aiMetadata?.show_product_image && msg.aiMetadata.product_name && (
                <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide animate-out fade-out zoom-out-95 duration-500 delay-150">
                  {(() => {
                    const productName = msg.aiMetadata.product_name;
                    const product = business.products.find(p => p.name.toLowerCase().includes(productName.toLowerCase()));
                    if (!product || !product.images || product.images.length === 0) return null;
                    return product.images.map((img, i) => (
                      <div key={i} className="relative min-w-[200px] w-[200px] aspect-square rounded-2xl overflow-hidden border shadow-sm bg-white shrink-0">
                        <img 
                          src={img} 
                          alt={product.name} 
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" 
                          referrerPolicy="no-referrer" 
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-[10px] font-bold truncate">{product.name}</p>
                          <p className="text-indigo-200 text-xs font-black">৳{product.price}</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
              
              {msg.aiMetadata?.recommendations && msg.aiMetadata.recommendations.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {msg.aiMetadata.recommendations.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => handleSend(`${rec.name} সম্পর্কে আরও জানতে চাই`)}
                      className="text-left bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm p-2 rounded-xl text-xs transition-all max-w-[200px]"
                    >
                      <div className="font-bold text-indigo-600 mb-0.5 line-clamp-1">{rec.name}</div>
                      <div className="text-[10px] text-zinc-500 line-clamp-2">{rec.reason}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-zinc-50 flex gap-2">
        <Input placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
        <Button onClick={handleSend} disabled={isLoading} className="bg-indigo-600"><Send className="w-5 h-5" /></Button>
      </div>
    </div>
  );
}

function generateInvoice(order: Order, business: BusinessConfig) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text(business.name, 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Invoice / Order Summary', 105, 30, { align: 'center' });
  
  // Order Info
  doc.text(`Order ID: ${order.id}`, 20, 50);
  doc.text(`Date: ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString()}`, 20, 55);
  doc.text(`Status: ${order.status.toUpperCase()}`, 20, 60);
  
  // Customer Info
  doc.text('Bill To:', 20, 75);
  doc.text(order.customerName, 20, 80);
  doc.text(order.phone, 20, 85);
  doc.text(order.address, 20, 90);
  
  // Table
  const unitPrice = order.unitPrice || business.products.find(p => p.name.toLowerCase() === order.productName.toLowerCase())?.price || 0;
  const total = order.totalPrice || (unitPrice * order.quantity);

  autoTable(doc, {
    startY: 100,
    head: [['Product', 'Quantity', 'Price', 'Total']],
    body: [
      [order.productName, order.quantity, `${unitPrice} TK`, `${total} TK`]
    ],
  });
  
  doc.save(`invoice-${order.id}.pdf`);
}

function OrderManager({ business }: { business: BusinessConfig }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Order>>({});
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('businessId', '==', business.id),
      where('merchantId', '==', business.ownerId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });
  }, [business.id, business.ownerId]);

  const updateStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
      toast.success('Order status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), editFormData);
      toast.success('অর্ডার আপডেট করা হয়েছে');
      setSelectedOrder(null);
      setIsEditing(false);
    } catch (err) {
      toast.error('আপডেট করতে ব্যর্থ হয়েছে');
    }
  };

  const bookSteadfast = async (order: Order) => {
    if (!business.steadfastApiKey) {
      toast.error('Please configure SteadFast API first');
      return;
    }
    toast.loading('Booking with SteadFast...');
    try {
      const response = await axios.post('/api/steadfast/book', {
        apiKey: business.steadfastApiKey,
        secretKey: business.steadfastSecretKey,
        order
      });
      await updateDoc(doc(db, 'orders', order.id), {
        courierTrackingId: response.data.tracking_code,
        courierStatus: 'booked'
      });
      toast.dismiss();
      toast.success('Booked with SteadFast!');
    } catch (err) {
      toast.dismiss();
      toast.error('SteadFast booking failed');
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast.success('অর্ডার মুছে ফেলা হয়েছে');
      setIsDeleting(null);
    } catch (err) {
      toast.error('মুছে ফেলতে সমস্যা হয়েছে');
    }
  };

  const downloadInvoice = (order: Order) => {
    const doc = new jsPDF();
    
    // Add Business Logo / Name
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(business.name || 'Your Store', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('INVOICE / RECEIPT', 14, 30);
    
    // Order Details
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Invoice No: ${order.id.slice(-8).toUpperCase()}`, 140, 22);
    doc.text(`Date: ${order.createdAt?.toDate()?.toLocaleDateString() || new Date().toLocaleDateString()}`, 140, 28);
    
    // Customer Info
    doc.setFontSize(14);
    doc.text('Bill To:', 14, 45);
    doc.setFontSize(10);
    doc.text(`${order.customerName}`, 14, 52);
    doc.text(`${order.phone}`, 14, 57);
    doc.text(`${order.address || 'N/A'}`, 14, 62, { maxWidth: 80 });
    
    // Table
    autoTable(doc, {
      startY: 75,
      head: [['Product', 'Quantity', 'Price', 'Total']],
      body: [
        [
          order.productName, 
          order.quantity.toString(), 
          `TK ${order.totalPrice / order.quantity}`, 
          `TK ${order.totalPrice}`
        ]
      ],
      headStyles: { fillColor: [79, 70, 229] },
      margin: { top: 75 }
    });
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text(`Total Amount: TK ${order.totalPrice}`, 140, finalY + 10);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Thank you for shopping with us!', 14, finalY + 30);
    
    doc.save(`invoice_${order.customerName.replace(/\s+/g, '_')}.pdf`);
    toast.success('ইনভয়েস ডাউনলোড হচ্ছে...');
  };

  if (loading) return <div className="p-8 text-center text-zinc-500">অর্ডার লোড হচ্ছে...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>View and manage customer orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer & Address</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="text-[10px] text-zinc-500">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Pending...'}
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-zinc-900">{order.customerName}</div>
                    <div className="text-xs text-indigo-600 font-medium">{order.phone}</div>
                    <div className="text-[10px] text-zinc-500 max-w-[200px] mt-1 leading-tight line-clamp-2">
                       {order.address || 'ঠিকানা পাওয়া যায়নি'}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-zinc-700">{order.productName}</TableCell>
                  <TableCell className="font-bold">{order.quantity}</TableCell>
                  <TableCell className="font-bold text-indigo-600">
                    {order.totalPrice ? `${order.totalPrice} TK` : (
                      (() => {
                        const product = business.products.find(p => p.name.toLowerCase() === order.productName.toLowerCase());
                        return product ? `${product.price * order.quantity} TK` : 'Calculated...';
                      })()
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'outline'} className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      {order.paymentStatus || 'unpaid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <select 
                        value={order.status || 'pending'} 
                        onChange={(e) => updateStatus(order.id, e.target.value as any)}
                        className="text-[10px] border rounded-lg p-1 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {order.courierTrackingId && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-indigo-200 text-indigo-600">
                          ID: {order.courierTrackingId}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setIsEditing(false); }} className="text-zinc-400 hover:text-indigo-600">
                        <Globe className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedOrder(order); setIsEditing(true); setEditFormData(order); }} className="text-zinc-400 hover:text-amber-600">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => downloadInvoice(order)} className="text-zinc-400 hover:text-indigo-600" title="Download Invoice">
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => bookSteadfast(order)} disabled={!!order.courierTrackingId} className="text-zinc-400 hover:text-indigo-600">
                        <Truck className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setIsDeleting(order.id)} className="text-zinc-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {orders.length === 0 && (
            <div className="text-center py-20">
               <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-zinc-300" />
               </div>
               <p className="text-zinc-500">এখনও কোনো অর্ডার আসেনি।</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View/Edit Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'অর্ডার এডিট করুন' : 'অর্ডারের বিস্তারিত'}</DialogTitle>
            <DialogDescription>অর্ডার আইডি: {selectedOrder?.id}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>কাস্টমারের নাম</Label>
                {isEditing ? (
                  <Input value={editFormData.customerName || ''} onChange={e => setEditFormData({...editFormData, customerName: e.target.value})} />
                ) : (
                  <div className="p-2 bg-zinc-50 rounded-lg text-sm">{selectedOrder?.customerName}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>মোবাইল নম্বর</Label>
                {isEditing ? (
                  <Input value={editFormData.phone || ''} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                ) : (
                  <div className="p-2 bg-zinc-50 rounded-lg text-sm">{selectedOrder?.phone}</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>ঠিকানা</Label>
              {isEditing ? (
                <Textarea value={editFormData.address || ''} onChange={e => setEditFormData({...editFormData, address: e.target.value})} />
              ) : (
                <div className="p-2 bg-zinc-50 rounded-lg text-sm whitespace-pre-wrap">{selectedOrder?.address}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>পণ্য</Label>
                {isEditing ? (
                  <Input value={editFormData.productName || ''} onChange={e => setEditFormData({...editFormData, productName: e.target.value})} />
                ) : (
                  <div className="p-2 bg-zinc-50 rounded-lg text-sm">{selectedOrder?.productName}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>পরিমাণ (Qty)</Label>
                {isEditing ? (
                  <Input type="number" value={editFormData.quantity || 1} onChange={e => setEditFormData({...editFormData, quantity: Number(e.target.value)})} />
                ) : (
                  <div className="p-2 bg-zinc-50 rounded-lg text-sm">{selectedOrder?.quantity}</div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>বন্ধ করুন</Button>
            {isEditing && (
              <Button onClick={handleUpdateOrder} className="bg-indigo-600">পরিবর্তন সেভ করুন</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!isDeleting} onOpenChange={(open) => !open && setIsDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">অর্ডার মুছে ফেলতে চান?</DialogTitle>
            <DialogDescription>এটি পুনরায় ফিরে পাওয়া সম্ভব হবে না।</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsDeleting(null)}>না, থাক</Button>
            <Button variant="destructive" onClick={() => isDeleting && deleteOrder(isDeleting)}>হ্যাঁ, মুছে দিন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerCRM({ business }: { business: BusinessConfig }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'customers'),
      where('businessId', '==', business.id),
      where('businessOwnerId', '==', business.ownerId),
      orderBy('leadScore', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setLoading(false);
    });
  }, [business.id, business.ownerId]);

  const getScoreColor = (score: number) => {
    if (score > 80) return 'bg-green-100 text-green-700';
    if (score > 50) return 'bg-blue-100 text-blue-700';
    return 'bg-zinc-100 text-zinc-700';
  };

  if (loading) return <div>Loading CRM...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads (80+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {customers.filter(c => c.leadScore > 80).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Broadcast Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-indigo-600" size="sm">
              <Megaphone className="w-4 h-4 mr-2" /> New Broadcast
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Profiles & Lead Scoring</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Lead Score</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-zinc-500">{customer.phone || 'No phone'}</div>
                    {customer.chatSummary && (
                      <div className="mt-1 p-2 bg-zinc-50 rounded text-[10px] text-zinc-600 line-clamp-2 italic">
                        "{customer.chatSummary}"
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getScoreColor(customer.leadScore)}>
                      {Math.round(customer.leadScore)}
                    </Badge>
                  </TableCell>
                  <TableCell>{customer.totalOrders || 0}</TableCell>
                  <TableCell>৳{customer.totalSpent || 0}</TableCell>
                  <TableCell className="text-xs">
                    {customer.lastInteraction?.toDate ? customer.lastInteraction.toDate().toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => customer.chatSummary && toast.info('Conversation Summary', { description: customer.chatSummary })}
                    >
                      View Summary
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsDashboard({ business, orders }: { business: BusinessConfig, orders: Order[] }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business.id) return;
    const q = query(collection(db, 'analytics'), where('businessId', '==', business.id), orderBy('timestamp', 'desc'), limit(1000));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        ...d.data(),
        timestamp: d.data().timestamp?.toDate() || new Error('No date')
      })).filter(d => !(d.timestamp instanceof Error));
      setEvents(data);
      setLoading(false);
    });
  }, [business.id]);

  // Derive stats for graphs
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const stats = last7Days.map(date => {
    const dayOrders = orders.filter(o => o.createdAt?.toDate()?.toISOString()?.split('T')[0] === date);
    const dayLeads = events.filter(e => e.timestamp?.toISOString()?.split('T')[0] === date);
    return {
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      sales: dayOrders.reduce((acc, o) => acc + (o.totalPrice || 0), 0),
      leads: dayLeads.length,
      orders: dayOrders.length
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-6">
          <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Total Sales</p>
          <h3 className="text-3xl font-black mb-2">৳ {orders.reduce((acc, o) => acc + (o.totalPrice || 0), 0).toLocaleString()}</h3>
          <div className="text-[10px] bg-white/20 w-fit px-2 py-0.5 rounded-full flex items-center gap-1">
             <TrendingUp className="w-3 h-3" /> +12.5% This Month
          </div>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl p-6 bg-white border border-zinc-100">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Active Leads</p>
          <h3 className="text-3xl font-black text-zinc-900">{events.length}</h3>
          <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-2">
            <Plus className="w-3 h-3" /> 56 new today
          </p>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl p-6 bg-white border border-zinc-100">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Orders</p>
          <h3 className="text-3xl font-black text-zinc-900">{orders.length}</h3>
          <p className="text-[10px] text-zinc-500 font-medium italic mt-2">
            Conversion Rate: 8.5%
          </p>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl p-6 bg-white border border-zinc-100">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Avg. Return</p>
          <h3 className="text-3xl font-black text-zinc-900">৳ 2.4k</h3>
          <p className="text-[10px] text-zinc-500 font-medium italic mt-2">
            Per customer value
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-xl rounded-3xl p-8 bg-white overflow-hidden relative">
          <div className="flex justify-between items-center mb-8">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              সাপ্তাহিক সেলস রিপোর্ট
            </CardTitle>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-none font-bold">Last 7 Days</Badge>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af', fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af', fontWeight: 600}} />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                  cursor={{stroke: '#4f46e5', strokeWidth: 1}}
                />
                <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl p-8 bg-white">
          <div className="flex justify-between items-center mb-8">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-xl">
                 <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              লিডস ও অর্ডার ট্রেন্ড
            </CardTitle>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af', fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#9ca3af', fontWeight: 600}} />
                <Tooltip 
                   contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={4} dot={{r: 4, fill: '#10b981', strokeWidth: 0}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={4} dot={{r: 4, fill: '#f59e0b', strokeWidth: 0}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CRMManager({ business }: { business: BusinessConfig }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business.id) return;
    const q = query(collection(db, 'customers'), where('businessId', '==', business.id), orderBy('lastInteraction', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
      setLoading(false);
    });
  }, [business.id]);

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'Hot': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Warm': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-zinc-50 text-zinc-600 border-zinc-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-black text-zinc-900">CRM & Lead Management</h2>
           <p className="text-zinc-500 font-medium">কাস্টমারদের সেগমেন্টেশন এবং লিড স্কোর ট্র্যাক করুন</p>
        </div>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50 border-none">
              <TableHead className="font-bold py-4 pl-6">কাস্টমার</TableHead>
              <TableHead className="font-bold">লিড স্কোর</TableHead>
              <TableHead className="font-bold">সেগমেন্ট</TableHead>
              <TableHead className="font-bold">সর্বশেষ কথা</TableHead>
              <TableHead className="font-bold pr-6 text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                <TableCell className="py-4 pl-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                      {customer.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{customer.name}</p>
                      <p className="text-xs text-zinc-500 font-medium">{customer.phone || 'No Phone'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="w-full max-w-[100px] h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${customer.leadScore > 70 ? 'bg-emerald-500' : customer.leadScore > 30 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                      style={{ width: `${customer.leadScore}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 mt-1 block">{customer.leadScore}% Confidence</span>
                </TableCell>
                <TableCell>
                  <Badge className={`font-bold border px-3 py-1 rounded-lg ${getSegmentColor(customer.segment)}`}>
                    {customer.segment}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-zinc-500 font-medium">
                  {customer.lastInteraction?.toDate()?.toLocaleString()}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button variant="ghost" size="icon" className="rounded-xl hover:bg-indigo-50 hover:text-indigo-600">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center text-zinc-400 font-medium italic">
                  এখনো কোনো কাস্টমার ডাটা নেই। চ্যাট শুরু হলে এখানে দেখা যাবে।
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function BroadcastingManager({ business }: { business: BusinessConfig }) {
  const [campaigns, setCampaigns] = useState<BroadcastingCampaign[]>([]);
  const [newCampaign, setNewCampaign] = useState<Partial<BroadcastingCampaign>>({ targetSegment: 'All' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!business.id) return;
    const q = query(collection(db, 'broadcasting_campaigns'), where('businessId', '==', business.id), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setCampaigns(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as BroadcastingCampaign)));
      setLoading(false);
    });
  }, [business.id]);

  const createCampaign = async () => {
    if (!newCampaign.title || !newCampaign.message) return;
    const camp: any = {
      ...newCampaign,
      businessId: business.id,
      status: 'draft',
      sentCount: 0,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'broadcasting_campaigns'), camp);
    setNewCampaign({ targetSegment: 'All' });
    toast.success('ক্যাম্পেইন ড্রাফট হিসেবে সেভ হয়েছে');
  };

  return (
    <div className="grid md:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-700">
      <Card className="md:col-span-1 border-none shadow-xl rounded-3xl p-6 h-fit bg-gradient-to-b from-white to-zinc-50">
        <CardTitle className="text-xl font-black mb-6">Create Campaign</CardTitle>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-bold">Campaign Title</Label>
            <Input 
              placeholder="e.g. Eid Discount Offer" 
              value={newCampaign.title || ''} 
              onChange={e => setNewCampaign({...newCampaign, title: e.target.value})}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Target Segment</Label>
            <Select 
              value={newCampaign.targetSegment} 
              onValueChange={(val: any) => setNewCampaign({...newCampaign, targetSegment: val})}
            >
              <SelectTrigger className="h-12 rounded-xl">
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Customers</SelectItem>
                <SelectItem value="Hot">Hot Leads Only</SelectItem>
                <SelectItem value="Warm">Warm Leads</SelectItem>
                <SelectItem value="Cold">Cold Leads</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Message</Label>
            <Textarea 
              placeholder="আপনার কাস্টমারদের জন্য মেসেজটি লিখুন..." 
              value={newCampaign.message || ''}
              onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
              className="h-32 rounded-xl"
            />
          </div>
          <Button onClick={createCampaign} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl">
            Save Campaign
          </Button>
        </div>
      </Card>

      <Card className="md:col-span-2 border-none shadow-xl rounded-3xl overflow-hidden p-8">
        <CardTitle className="text-xl font-black mb-6">Recent Campaigns</CardTitle>
        <div className="space-y-4">
          {campaigns.map(c => (
            <div key={c.id} className="p-5 border border-zinc-100 rounded-2xl bg-zinc-50/50 hover:bg-white hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-zinc-900">{c.title}</h4>
                  <p className="text-xs text-zinc-400 font-medium">{c.createdAt?.toDate()?.toLocaleString()}</p>
                </div>
                <Badge className={c.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-none' : 'bg-amber-50 text-amber-600 border-none font-bold'}>
                   {c.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-zinc-600 line-clamp-2 my-3 font-medium">
                {c.message}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                <div className="flex gap-4">
                    <div className="text-xs font-bold text-zinc-400">Target: <span className="text-zinc-900">{c.targetSegment}</span></div>
                    <div className="text-xs font-bold text-zinc-400">Reach: <span className="text-zinc-900">{c.sentCount}</span></div>
                </div>
                <Button size="sm" variant="outline" className="rounded-lg h-8 px-4 font-bold" onClick={() => toast.info('Broadcasting requires App Review approval.')}>
                  Send Now
                </Button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && !loading && (
            <div className="py-20 text-center text-zinc-400 font-medium italic">
                কোনো ক্যাম্পেইন পাওয়া যায়নি।
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function MessengerConnect({ business, setBusiness }: { business: BusinessConfig, setBusiness: (b: BusinessConfig) => void }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Initialize FB SDK App ID
  useEffect(() => {
    if (business.facebookAppId) {
      (window as any).FB_APP_ID = business.facebookAppId;
      // Re-init if SDK already loaded
      if (typeof (window as any).FB !== 'undefined') {
        (window as any).FB.init({
          appId      : business.facebookAppId,
          cookie     : true,
          xfbml      : true,
          version    : 'v18.0'
        });
      }
    }
  }, [business.facebookAppId]);

  const connectFacebook = () => {
    setIsConnecting(true);
    if (typeof (window as any).FB === 'undefined') {
      toast.error("Facebook SDK loading... please wait or refresh.", {
        description: "Make sure you have added the FB SDK to your index.html"
      });
      setIsConnecting(false);
      return;
    }

    (window as any).FB.login((response: any) => {
      if (response.authResponse) {
        (window as any).FB.api('/me/accounts', (accounts: any) => {
          if (accounts.data && accounts.data.length > 0) {
            toast.success(`${accounts.data.length}টি পেজ পাওয়া গিয়েছে!`, {
              description: "আপনার পছন্দের পেজটির টোকেন নিচে সেভ করুন।"
            });
            console.log("Available Pages:", accounts.data);
          } else {
            toast.error("কোনো পেজ পাওয়া যায়নি। আপনার কি পেজ ক্রিয়েট করা আছে?");
          }
          setIsConnecting(false);
        });
      } else {
        toast.error("ফেসবুক কানেকশন বাতিল করা হয়েছে।");
        setIsConnecting(false);
      }
    }, { scope: 'pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata,public_profile' });
  };

  const updateField = async (field: string, val: string) => {
    // If we're updating verifyToken, also update messengerVerifyToken for compatibility
    const updateData: any = { [field]: val };
    if (field === 'messengerVerifyToken' || field === 'verifyToken') {
      updateData.messengerVerifyToken = val;
      updateData.verifyToken = val;
    }
    
    await updateDoc(doc(db, 'businesses', business.id), updateData);
    toast.success('মেসেঞ্জার সেটিংস সফলভাবে সেভ হয়েছে');
  };

  const copyUrl = () => {
    const url = `${window.location.origin}/api/webhook/${business.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Webhook URL কপি করা হয়েছে!', { description: url });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-700 rounded-[2.5rem] p-10 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <Badge className="bg-white/20 text-white border-none mb-6 backdrop-blur-md px-4 py-1 text-xs uppercase tracking-widest font-bold">
            Live Messenger AI
          </Badge>
          <h2 className="text-4xl font-extrabold mb-4 tracking-tight leading-tight">
            আপনার ফেসবুক স্টোরকে <br/><span className="text-indigo-200">AI এর শক্তিতে</span> বড় করুন।
          </h2>
          <p className="text-indigo-100 text-lg mb-8 leading-relaxed opacity-90">
            এই সেটিংসটি সম্পন্ন করলে আপনার AI বটটি স্বয়ংক্রিয়ভাবে মেসেঞ্জারের সব রিপ্লাই দিবে এবং কাস্টমারের অর্ডার কনফার্ম করবে।
          </p>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={connectFacebook} 
              disabled={isConnecting}
              className="bg-white text-indigo-600 hover:bg-zinc-100 h-14 px-8 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">কানেক্ট হচ্ছে...</span>
              ) : (
                <span className="flex items-center gap-2">
                  <Facebook className="w-5 h-5" /> 
                  মেসেঞ্জার কানেক্ট করুন
                </span>
              )}
            </Button>
            <Button 
              onClick={() => setShowSetupGuide(true)}
              variant="outline" 
              className="border-white/30 text-white hover:bg-white/10 h-14 px-8 rounded-2xl font-medium backdrop-blur-sm"
            >
              সেটআপ গাইড
            </Button>
          </div>
        </div>

        {/* Setup Guide Dialog */}
        <Dialog open={showSetupGuide} onOpenChange={setShowSetupGuide}>
          <DialogContent className="max-w-2xl sm:max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Info className="w-6 h-6 text-indigo-500" />
                মেসেঞ্জার বট সেটআপ গাইড
              </DialogTitle>
              <DialogDescription>
                আপনার ফেসবুক পেজে AI বট চালু করতে নিচের ধাপগুলো অনুসরণ করুন।
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">১</span>
                  ফেসবুক অ্যাপ ক্রিয়েট করুন
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                  <li><a href="https://developers.facebook.com/" target="_blank" className="text-indigo-600 underline">Facebook Developers</a> ড্যাশবোর্ডে গিয়ে একটি নতুন অ্যাপ ক্রিয়েট করুন।</li>
                  <li>অ্যাপ টাইপ হিসেবে <strong>Business</strong> বা <strong>Consumer</strong> সিলেক্ট করুন।</li>
                  <li>অ্যাপ ক্রিয়েট করার পর সেখান থেকে আপনার <strong>App ID</strong> টি কপি করে আমাদের ড্যাশবোর্ডে দিন।</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">২</span>
                  ফেসবুক লগইন প্রোডাক্ট যুক্ত করুন (খুবই গুরুত্বপূর্ণ)
                </h3>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 space-y-3">
                  <p className="font-bold">অপশনটি খুঁজে না পেলে এই ধাপটি অনুসরণ করুন:</p>
                  <ul className="list-decimal pl-5 space-y-2">
                    <li>ড্যাশবোর্ডের বাম পাশের মেনু থেকে <strong>Add Product</strong> এ ক্লিক করুন অথবা নিচে স্ক্রোল করে <strong>Facebook Login</strong> খুজে বের করুন।</li>
                    <li><strong>Set up</strong> বাটনে ক্লিক করে এটি যুক্ত করুন এবং প্ল্যাটফর্ম হিসেবে <strong>Web</strong> সিলেক্ট করুন।</li>
                    <li>এখন বাম পাশে মেনুতে <strong>Facebook Login → Settings</strong> এ যান।</li>
                    <li>সেখানে <strong>"Login with JavaScript SDK"</strong> অপশনটি খুজে পাবেন, সেটি <strong>YES</strong> করে দিন।</li>
                    <li>নিচে <strong>Allowed Domains for the JavaScript SDK</strong> বক্সে এই সাইটের URL টি দিয়ে সেভ করুন।</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">৩</span>
                  মেসেঞ্জার প্রোডাক্ট এড করুন
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                  <li>আপনার ফেসবুক অ্যাপ ড্যাশবোর্ড থেকে <strong>Messenger</strong> প্রোডাক্টটি সেটাপ করুন।</li>
                  <li><strong>App Settings → Basic</strong> থেকে আপনার ডোমেইনটি (এই সাইটের URL) হোয়াইটলিস্ট করুন।</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">৩</span>
                  ওয়েবহুক (Webhook) কনফিগারেশন
                </h3>
                <p className="text-sm text-zinc-600">মেসেঞ্জার সেটিংসের Webhook সেকশনে গিয়ে নিচের তথ্যগুলো দিন:</p>
                <div className="bg-zinc-50 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-500 uppercase">Callback URL</span>
                    <code className="bg-white px-2 py-1 rounded border shadow-sm text-indigo-600">{window.location.origin}/api/webhook/{business.id}</code>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-500 uppercase">Verify Token</span>
                    <code className="bg-white px-2 py-1 rounded border shadow-sm text-indigo-600 font-bold">{business.messengerVerifyToken || business.verifyToken || 'chatbyraju'}</code>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 italic bg-white/50 p-2 rounded border border-dashed border-zinc-200">
                  * আপনি নিজের টোকেন না দিলে ডিফল্ট হিসেবে <strong>chatbyraju</strong> ব্যবহার করুন।
                </p>
                <p className="text-xs text-rose-600 bg-rose-50 p-4 rounded-xl border-2 border-rose-200 animate-pulse font-bold flex items-start gap-2 shadow-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>
                    গুরত্বপূর্ণ: শুধুমাত্র ভেরিফাই করলেই হবে না। ফেসবুক ড্যাশবোর্ডে "Webhook fields" টেবিল থেকে অবশ্যই "messages" এবং "messaging_postbacks" ফিল্ড দুটি "Subscribe" বাটনে ক্লিক করে অন করুন। (আপনার স্ক্রিনশটে এগুলো Unsubscribed দেখাচ্ছে)।
                  </span>
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">৪</span>
                  পেজ এক্সেস টোকেন
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-600">
                  <li>আপনার ফেসবুক পেজটি কানেক্ট করে একটি <strong>Generate Token</strong> এ ক্লিক করে টোকেনটি কপি করুন।</li>
                  <li>সেই টোকেনটি আমাদের ড্যাশবোর্ডের <strong>Page Access Token</strong> ঘরে বসিয়ে সেভ করুন।</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowSetupGuide(false)} className="w-full sm:w-auto">বন্ধ করুন</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-white opacity-5 rounded-full blur-3xl pointer-events-none" />
        <MessageCircle className="absolute -right-16 -bottom-16 w-80 h-80 text-white/10 -rotate-12 pointer-events-none" />
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden group">
            <div className="h-1.5 bg-indigo-500 w-0 group-hover:w-full transition-all duration-500" />
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <ShieldCheck className="w-6 h-6 text-indigo-500" />
                মেসেঞ্জার কনফিগারেশন
              </CardTitle>
              <CardDescription>ফেসবুক ডেভেলপার ড্যাশবোর্ড থেকে আপনার টোকেনগুলো এখানে দিন।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold text-zinc-700">Page Access Token</Label>
                  {business.pageAccessToken && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] h-6 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      onClick={async () => {
                        try {
                          console.log('[Connection] Fetching page info...');
                          const res = await axios.get(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${business.pageAccessToken}`);
                          if (res.data.name && res.data.id) {
                            // Update multiple fields locally
                            const updates = {
                              pageName: res.data.name,
                              facebookPageId: res.data.id
                            };
                            
                            // Apply updates to the business object
                            const updatedBusiness = { ...business, ...updates };
                            setBusiness(updatedBusiness);
                            
                            // Persist to DB immediately
                            await setDoc(doc(db, 'businesses', business.id), updatedBusiness, { merge: true });
                            
                            toast.success(`Connected to ${res.data.name} (ID: ${res.data.id})`);
                          } else {
                            toast.error("Could not fetch page details. Check token permissions.");
                          }
                        } catch (err: any) {
                          console.error('[Messenger Connection Error]', err.response?.data || err.message);
                          toast.error(err.response?.data?.error?.message || "Invalid token or connection error");
                        }
                      }}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Verify & Fetch Name
                    </Button>
                  )}
                </div>
                <div className="relative group">
                  <Input 
                    type="password"
                    value={business.pageAccessToken || ''} 
                    onChange={e => updateField('pageAccessToken', e.target.value)}
                    placeholder="EAA..." 
                    className="h-12 pl-4 pr-12 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white transition-all shadow-inner"
                  />
                  <div className="absolute right-4 top-3.5 text-zinc-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs text-zinc-400 italic">Page Settings → Messenger → Access Tokens এ এটি পাবেন।</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-zinc-700">Facebook App ID</Label>
                  <Input 
                    value={business.facebookAppId || ''} 
                    onChange={e => updateField('facebookAppId', e.target.value)}
                    placeholder="1234567890..." 
                    className="h-12 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white shadow-inner"
                  />
                  <p className="text-[10px] text-zinc-400">ফেসবুক ডেভেলপার ড্যাশবোর্ড থেকে আপনার অ্যাপ আইডি দিন।</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-zinc-700">Verify Token</Label>
                  <Input 
                    value={business.messengerVerifyToken || business.verifyToken || ''} 
                    onChange={e => updateField('messengerVerifyToken', e.target.value)}
                    placeholder="chatbyraju" 
                    className="h-12 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white shadow-inner font-mono text-indigo-600"
                  />
                  <p className="text-[10px] text-zinc-400">ওয়েবহুক ভেরিফাই করার জন্য এটি আপনার ইচ্ছামতো দিন। (যেমন: <strong>chatbyraju</strong>)</p>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-zinc-700">Connected Page Name</Label>
                    <div className="relative">
                      <Input 
                        disabled
                        value={business.pageName || 'Not Connected'} 
                        className={`h-12 rounded-xl border-none font-medium shadow-inner pr-10 ${business.pageName ? 'bg-emerald-50 text-emerald-900' : 'bg-zinc-100 text-zinc-500'}`}
                      />
                      {business.pageName && (
                        <div className="absolute right-3 top-3.5 text-emerald-600">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-zinc-700">Facebook Page ID</Label>
                    <Input 
                      value={business.facebookPageId || ''} 
                      onChange={e => updateField('facebookPageId', e.target.value)}
                      placeholder="পেজ আইডি (অটোমেটিক আসবে)" 
                      className="h-12 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white shadow-inner font-mono text-xs"
                    />
                    <p className="text-[10px] text-zinc-400">বট রিপ্লাই দেওয়ার জন্য এটি অত্যন্ত জরুরি।</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden mt-6">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-3">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-500" />
                  Messenger Activity Log
                </div>
                <div className="flex items-center gap-2">
                  {!window.location.hostname.includes('google.com') && (
                    <Badge variant="destructive" className="animate-pulse text-[9px] px-2 py-0 h-5">Outdated System</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] bg-white text-zinc-400">Real-time</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
                <MessengerLogs businessId={business.id} ownerId={business.ownerId} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Webhook Instructions */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white h-full">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                Webhook সেটআপ
              </CardTitle>
              <CardDescription>বট চালু করতে নিচের ইউআরএলটি ফেসবুক ওয়েবহুকে ব্যবহার করুন।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-5 bg-zinc-50 rounded-[1.5rem] border border-zinc-100 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-12 translate-x-12" />
                <Label className="text-[10px] uppercase font-bold tracking-widest text-indigo-500 flex items-center gap-2">
                  Facebook Callback URL (Copy this) <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] font-mono text-indigo-700 break-all bg-white p-3 rounded-lg border border-indigo-100 shadow-inner">
                    {window.location.origin}/api/webhook/{business.id}
                  </code>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={copyUrl}
                    className="shrink-0 bg-white hover:bg-zinc-50 border shadow-sm rounded-lg"
                  >
                    <Copy className="w-4 h-4 text-zinc-600" />
                  </Button>
                </div>
              </div>

              <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl space-y-3">
                <h4 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  কেন রিপ্লাই দিচ্ছে না? (চেকলিস্ট)
                </h4>
                <ul className="space-y-2 text-[11px] text-rose-600 font-medium">
                  <li className="flex gap-2">
                    <span className="shrink-0">১.</span>
                    <span>ইউআরএল ভেরিফাই করার পর <b>Add Subscriptions</b> বাটনে ক্লিক করে <b>messages</b> ফিল্ডটি অন করেছেন? (এটি না করলে মেসেজ আসবে না)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0">২.</span>
                    <span>আপনার অ্যাপ যদি <b>Live Mode</b> এ থাকে, তবে ফেসবুক থেকে <b>pages_messaging</b> পারমিশনটি Approve করাতে হবে। (নতুবা শুধু আপনি ছাড়া কেউ রিপ্লাই পাবে না)</span>
                  </li>
                </ul>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full bg-white text-rose-600 border-rose-200 hover:bg-rose-100 text-[10px] font-bold h-8"
                  onClick={async () => {
                    if (!business) return;
                    try {
                      const res = await fetch('/api/test-connection', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ businessId: business.id, ownerId: business.ownerId })
                      });
                      if (res.ok) alert('Test signal sent! Check Activity Log.');
                    } catch (e) {
                      alert('Failed to send test signal.');
                    }
                  }}
                >
                  সিস্টেম টেস্ট করুন (যদি লগ না আসে)
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-500" />
                  মাথায় রাখবেন:
                </h4>
                <div className="space-y-3">
                  {[
                    "Webhook সাবস্ক্রিপশনে messages এবং messaging_postbacks অন রাখুন।",
                    "আপনার অ্যাপটি Live মোডে থাকলে পারমিশনগুলো অ্যাপ রিভিউ করাতে হবে।",
                    "আপনার ডোমেইনটি Facebook Apps সেটিংসে হোয়াইটলিস্ট করে নিন।"
                  ].map((text, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        {i + 1}
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-medium">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureManager({ business }: { business: BusinessConfig }) {
  const [features, setFeatures] = useState<BusinessFeatures>(business.features || {
    aiEnabled: true,
    orderTrackingEnabled: true,
    proactiveNotificationsEnabled: true,
    chatSummaryEnabled: true,
    negotiationEnabled: true,
    imageDisplayEnabled: true
  });
  const [loading, setLoading] = useState(false);

  const toggle = (key: keyof BusinessFeatures) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'businesses', business.id), { features });
      toast.success('ফিচার সেটিংস আপডেট করা হয়েছে');
    } catch (err: any) {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const FeatureItem = ({ icon: Icon, title, description, id, enabled }: any) => (
    <div className={cn(
      "p-4 rounded-2xl border transition-all flex items-start gap-4",
      enabled ? "bg-indigo-50/30 border-indigo-100" : "bg-white border-zinc-100 opacity-60"
    )}>
      <div className={cn("p-3 rounded-xl", enabled ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-400")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 space-y-1">
        <h4 className="font-bold text-sm tracking-tight">{title}</h4>
        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      </div>
      <button 
        onClick={() => toggle(id)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          enabled ? "bg-indigo-600" : "bg-zinc-200"
        )}
      >
        <span className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          enabled ? "translate-x-6" : "translate-x-1"
        )} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: 'aiEnabled', icon: Bot, title: 'AI চ্যাটবট (AI Chatbot)', description: 'আপনার কাস্টমারদের সাথে কথা বলার জন্য AI সক্রিয় রাখুন।' },
          { id: 'orderTrackingEnabled', icon: Truck, title: 'অর্ডার ট্র্যাকিং (Order Tracking)', description: 'AI কাস্টমারকে তাদের অর্ডারের খবর বা ট্র্যাকিং আপডেট জানাতে পারবে।' },
          { id: 'proactiveNotificationsEnabled', icon: Megaphone, title: 'অটোমেটিক নোটিফিকেশন (Follow-up)', description: 'ডেলিভারিতে সমস্যা হলে AI নিজে থেকে কাস্টমারকে নক দিবে।' },
          { id: 'chatSummaryEnabled', icon: History, title: 'চ্যাট সামারি (Chat Summary)', description: 'বিগত কথোপকথন মনে রেখে আরও নিখুঁত উত্তর দিবে।' },
          { id: 'negotiationEnabled', icon: CreditCard, title: 'দামাদামি সুবিধা (Price Negotiation)', description: 'কাস্টমার দামাদামি করলে নির্দিষ্ট সীমা পর্যন্ত AI ছাড় দিতে পারবে।' },
          { id: 'imageDisplayEnabled', icon: Globe, title: 'প্রোডাক্ট ছবি প্রদর্শন (Product Images)', description: 'কথার ফাঁকে ফাঁকে প্রাসঙ্গিক প্রোডাক্টের ছবি স্বয়ংক্রিয়ভাবে দেখাবে।' }
        ].map(item => (
          <FeatureItem 
            key={item.id}
            id={item.id} 
            enabled={(features as any)[item.id]} 
            icon={item.icon} 
            title={item.title} 
            description={item.description} 
          />
        ))}
      </div>
      
      <Card className="border-indigo-100 bg-indigo-50/20 rounded-3xl">
        <CardContent className="py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-indigo-900 font-medium">
            পরিবর্তনগুলো কার্যকর করতে অবশ্যই নিচে বাটনে ক্লিক করুন।
          </div>
          <Button onClick={save} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 px-8 rounded-xl h-12">
            {loading ? 'সেভ হচ্ছে...' : 'সেটিংস সেভ করুন'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CourierConfig({ business }: { business: BusinessConfig }) {
  const [apiKey, setApiKey] = useState(business.steadfastApiKey || '');
  const [secretKey, setSecretKey] = useState(business.steadfastSecretKey || '');

  const save = async () => {
    await updateDoc(doc(db, 'businesses', business.id), {
      steadfastApiKey: apiKey,
      steadfastSecretKey: secretKey
    });
    toast.success('SteadFast credentials saved');
  };

  return (
    <Card className="border-none shadow-sm rounded-3xl bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-indigo-600" /> SteadFast Courier
        </CardTitle>
        <CardDescription>Integrate with SteadFast for automated booking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter SteadFast API Key" className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Secret Key</Label>
          <Input value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="Enter SteadFast Secret Key" className="rounded-xl" />
        </div>
        <Button onClick={save} className="w-full bg-indigo-600 rounded-xl py-6">Save Credentials</Button>
      </CardContent>
    </Card>
  );
}

function FAQManager({ business }: { business: BusinessConfig }) {
  const [faqs, setFaqs] = useState<FAQ[]>(business.faqs || []);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newProductId, setNewProductId] = useState<string>('general');

  const addFAQ = async () => {
    if (!newQuestion || !newAnswer) return;
    const faq: FAQ = { 
      id: Date.now().toString(), 
      question: newQuestion, 
      answer: newAnswer,
      productId: newProductId === 'general' ? undefined : newProductId
    };
    const updated = [...faqs, faq];
    await updateDoc(doc(db, 'businesses', business.id), { faqs: updated });
    setFaqs(updated);
    setNewQuestion('');
    setNewAnswer('');
    setNewProductId('general');
    toast.success('FAQ যোগ করা হয়েছে');
  };

  const removeFAQ = async (id: string) => {
    const updated = faqs.filter(f => f.id !== id);
    await updateDoc(doc(db, 'businesses', business.id), { faqs: updated });
    setFaqs(updated);
    toast.success('FAQ মুছে ফেলা হয়েছে');
  };

  const getProductName = (productId?: string) => {
    if (!productId || productId === 'general') return 'সাধারন (General)';
    return business.products.find(p => p.id === productId)?.name || 'অজানা প্রোডাক্ট';
  };

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-sm rounded-3xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold">নতুন FAQ যোগ করুন</CardTitle>
          <CardDescription>বট এই প্রশ্নগুলোর উত্তর দিতে পারবে। প্রতিটি প্রোডাক্টের জন্য আলাদা FAQ সেট করা যাবে।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>প্রোডাক্ট সিলেক্ট করুন (মার্কেটিং/সাধারন হলে General রাখুন)</Label>
              <select 
                value={newProductId} 
                onChange={e => setNewProductId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-zinc-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="general">সাধারণ / জেনারেল FAQ (সকলের জন্য)</option>
                {business.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>সাধারণ প্রশ্ন (Question)</Label>
              <Input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="উদা: ডেলিভারি চার্জ কত?" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>উত্তর (Answer)</Label>
              <Textarea value={newAnswer} onChange={e => setNewAnswer(e.target.value)} placeholder="উদা: ঢাকা সিটির ভেতরে ৬০ টাকা..." className="rounded-xl" />
            </div>
          </div>
          <Button onClick={addFAQ} className="w-full bg-indigo-600 rounded-xl py-6">FAQ সেভ করুন</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {faqs.map((faq) => (
          <Card key={faq.id} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group">
            <CardContent className="p-5 flex justify-between items-start gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[9px] py-0 px-1 bg-indigo-50 text-indigo-600 border-indigo-100">
                    {getProductName(faq.productId)}
                  </Badge>
                </div>
                <div className="font-bold text-sm text-zinc-900 line-clamp-2">Q: {faq.question}</div>
                <div className="text-xs text-zinc-500 line-clamp-3 leading-relaxed">A: {faq.answer}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeFAQ(faq.id)} className="shrink-0 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {faqs.length === 0 && (
        <div className="p-12 text-center bg-white rounded-3xl border-2 border-dashed border-zinc-100">
          <HelpCircle className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm italic">এখনও কোনো FAQ যোগ করা হয়নি।</p>
        </div>
      )}
    </div>
  );
}

function TestChat({ business }: { business: BusinessConfig }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSummary, setChatSummary] = useState('');
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [sessionId] = useState(() => `preview_${Date.now()}`);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!business.id) return;
    const ordersQ = query(
      collection(db, 'orders'),
      where('businessId', '==', business.id),
      where('sessionId', '==', sessionId),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    return onSnapshot(ordersQ, (snap) => {
      setRecentOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });
  }, [business.id, sessionId]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (business.features?.aiEnabled === false) {
        const assistantMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: 'বটের ফিচারটি বর্তমানে বন্ধ আছে। (AI features are disabled)', 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }

      const chatHistory = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n');
      const orderContext = (business.features?.orderTrackingEnabled !== false && recentOrders.length > 0) 
        ? `Customer Recent Orders: ${recentOrders.map(o => `Product: ${o.productName}, Status: ${o.status}${o.courierStatus ? ` (Courier: ${o.courierStatus})` : ''}, Date: ${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : 'Recent'}${o.courierTrackingId ? `, Tracking ID: ${o.courierTrackingId}` : ''}`).join(' | ')}`
        : 'No recent orders found.';

      const currentSummary = business.features?.chatSummaryEnabled !== false ? chatSummary : undefined;
      const aiResponse = await getAIResponse(textToSend, chatHistory, business, orderContext, undefined, undefined, currentSummary);
      
      if (business.features?.chatSummaryEnabled !== false) {
        const newSummary = aiResponse.summary || chatSummary;
        setChatSummary(newSummary);
      }
      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: aiResponse.reply, 
        timestamp: Date.now(), 
        aiMetadata: aiResponse 
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Simulate order placement in Test Chat
      if (aiResponse.event_name === 'Purchase' && !aiResponse.need_more_info) {
        // Create actual order in Firestore for Test Chat
        const product = business.products.find(p => p.name.toLowerCase().includes(aiResponse.product_name.toLowerCase()));
        const unitPrice = aiResponse.order_data.negotiated_price 
          ? Number(aiResponse.order_data.negotiated_price.replace(/[^0-9]/g, '')) 
          : (product?.price || 0);

        const orderId = `test-ord-${Date.now()}`;
        const qty = parseInt(aiResponse.order_data.quantity) || 1;
        const newOrder: any = {
          businessId: business.id,
          merchantId: business.ownerId,
          sessionId: sessionId,
          customerName: aiResponse.order_data.name,
          phone: aiResponse.order_data.phone,
          address: aiResponse.order_data.address,
          quantity: qty,
          productName: aiResponse.product_name || 'General Product',
          unitPrice,
          totalPrice: unitPrice * qty,
          status: 'pending',
          paymentStatus: 'unpaid',
          createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'orders', orderId), newOrder);

        toast.success(`অর্ডার সফলভাবে গ্রহণ করা হয়েছে: ${aiResponse.product_name}`, {
          description: `গ্রাহক: ${aiResponse.order_data.name}, ফোন: ${aiResponse.order_data.phone}`
        });
      }
    } catch (err) {
      toast.error('AI error in Test Chat');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden flex flex-col h-[500px] md:h-[650px] max-h-[calc(100vh-12rem)]">
      <CardHeader className="bg-zinc-50 border-b py-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              Chatbot Simulator
            </CardTitle>
            <CardDescription>Test your AI personality and ordering flow</CardDescription>
          </div>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-100">
            Sandbox Mode
          </Badge>
        </div>
      </CardHeader>
      
      <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50 min-h-0">
        <div className="space-y-6 max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="text-sm text-zinc-500 font-medium">আপনার বটের সাথে চ্যাট শুরু করুন। <br/>যেমন: "দাম কত?" বা "অর্ডার করতে চাই"</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={cn(
                  "max-w-[85%] p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-indigo-600 text-white rounded-tr-none" 
                    : "bg-white text-zinc-800 border rounded-tl-none font-medium"
                )}>
                  {msg.content}
                </div>
              </div>
              
              {/* Image Preview for Test Chat */}
              {msg.role === 'assistant' && msg.aiMetadata?.product_name && msg.aiMetadata?.show_product_image && (
                (() => {
                  const product = business.products.find(p => p.name.toLowerCase().includes(msg.aiMetadata!.product_name.toLowerCase()));
                  if (product && product.images && product.images.length > 0) {
                    return (
                      <div className="flex justify-start animate-in fade-in zoom-in-95 duration-300">
                        <div className="rounded-2xl overflow-hidden border bg-white shadow-sm max-w-[250px]">
                          <img 
                            src={product.images[0]} 
                            alt={product.name} 
                            className="w-full aspect-square object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="p-3 border-t">
                            <p className="font-bold text-xs">{product.name}</p>
                            <p className="text-indigo-600 font-bold text-xs">{product.price} BDT</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              {/* Recommendations in Test Chat */}
              {msg.aiMetadata?.recommendations && msg.aiMetadata.recommendations.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 pl-2">
                  {msg.aiMetadata.recommendations.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => handleSend(`${rec.name} সম্পর্কে জানতে চাই`)}
                      className="text-left bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm p-3 rounded-2xl text-xs transition-all max-w-[200px]"
                    >
                      <div className="font-bold text-indigo-600 mb-1 line-clamp-1">{rec.name}</div>
                      <div className="text-[10px] text-zinc-500 line-clamp-2">{rec.reason}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Order Data Feedback */}
              {msg.role === 'assistant' && msg.aiMetadata?.event_name && (
                <div className="flex justify-start">
                  <Badge variant="outline" className="text-[10px] gap-1.5 py-0 border-indigo-100 bg-white text-indigo-500">
                    <Zap className="w-3 h-3" /> Event: {msg.aiMetadata.event_name}
                    {msg.aiMetadata.conversation_stage && ` (${msg.aiMetadata.conversation_stage})`}
                  </Badge>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl px-4 py-2 flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 bg-white border-t border-zinc-100 flex gap-3">
        <Input 
          className="rounded-xl h-12 bg-zinc-50 border-none px-4 focus-visible:ring-indigo-500"
          placeholder="বটের সাথে কথা বলুন..." 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleSend()} 
        />
        <Button 
          onClick={() => handleSend()} 
          disabled={isLoading} 
          className="bg-indigo-600 hover:bg-indigo-700 w-12 h-12 rounded-xl"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </Card>
  );
}

