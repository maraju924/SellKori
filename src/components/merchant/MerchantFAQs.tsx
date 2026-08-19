import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  BookOpen, 
  Sparkles,
  Layers,
  Package,
  Globe,
  Search,
  CheckCircle2,
  Tag,
  Truck,
  RotateCcw,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  Filter,
  Info,
  Copy,
  Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '../ui/dialog';
import { BusinessConfig, FAQ, Product } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cleanFirestoreData } from '../../lib/utils';

interface MerchantFAQsProps {
  business: BusinessConfig;
}

const GENERAL_CATEGORIES = [
  'ডেলিভারি ও শিপিং',
  'পেমেন্ট ও ক্যাশ অন ডেলিভারি (COD)',
  'রিটার্ন ও রিফান্ড পলিসি',
  'সাইজ এক্সচেঞ্জ পলিসি',
  'অর্ডার প্রসেস ও ট্র্যাকিং',
  'যোগাযোগ ও সাপোর্ট',
  'অন্যান্য সাধারণ'
];

const PRODUCT_CATEGORIES = [
  'সাইজ, মেজারমেন্ট ও ফিটিংস',
  'ফেব্রিক, কালার ও মেটেরিয়াল কোয়ালিটি',
  'ব্যবহার নির্দেশিকা ও যত্ন (Care Instructions)',
  'ওয়ারেন্টি ও রিপ্লেসমেন্ট গ্যারান্টি',
  'কম্বো, কালার ও ভ্যারিয়েন্ট অফার',
  'অন্যান্য পণ্যভিত্তিক'
];

const PRESET_FAQ_TEMPLATES = [
  {
    name: '🚚 ফুল ডেলিভারি ও সিওডি পলিসি প্যাক (৩টি FAQ)',
    type: 'general' as const,
    category: 'ডেলিভারি ও শিপিং',
    faqs: [
      {
        question: 'ডেলিভারি চার্জ কত এবং কতদিনে পাব?',
        answer: 'ঢাকার ভেতরে ডেলিভারি চার্জ ৮০ টাকা (২৪-৪৮ ঘণ্টার মধ্যে ডেলিভারি) এবং ঢাকার বাইরে ১৩০ টাকা (২-৩ দিনের মধ্যে ডেলিভারি)।',
        category: 'ডেলিভারি ও শিপিং'
      },
      {
        question: 'ক্যাশ অন ডেলিভারি (COD) সুবিধা আছে কি?',
        answer: 'হ্যাঁ, সম্পূর্ণ ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। ডেলিভারিম্যানের কাছ থেকে পণ্য হাতে পেয়ে দেখে টাকা পরিশোধ করতে পারবেন।',
        category: 'পেমেন্ট ও ক্যাশ অন ডেলিভারি (COD)'
      },
      {
        question: 'ডেলিভারির সময় কি পার্সেল খুলে চেক করা যাবে?',
        answer: 'হ্যাঁ, ডেলিভারিম্যানের সামনে পার্সেল খুলে প্রোডাক্ট চেক করে নিতে পারবেন। কোনো সমস্যা দেখলে ডেলিভারিম্যানের কাছেই রিটার্ন করতে পারবেন।',
        category: 'ডেলিভারি ও শিপিং'
      }
    ]
  },
  {
    name: '🔄 সহজ রিটার্ন ও এক্সচেঞ্জ পলিসি প্যাক (২টি FAQ)',
    type: 'general' as const,
    category: 'রিটার্ন ও রিফান্ড পলিসি',
    faqs: [
      {
        question: 'প্রোডাক্টে কোনো সমস্যা থাকলে রিটার্ন করার নিয়ম কি?',
        answer: 'প্রোডাক্ট হাতে পাওয়ার পর কোনো ত্রুটি বা সমস্যা থাকলে ৭ দিনের মধ্যে আমাদের জানালে আমরা ফ্রিতে এক্সচেঞ্জ বা সম্পূর্ণ রিফান্ড করে দেব।',
        category: 'রিটার্ন ও রিফান্ড পলিসি'
      },
      {
        question: 'সাইজ না মিললে কি পরিবর্তন করে নেওয়া যাবে?',
        answer: 'হ্যাঁ, সাইজ আনফিট হলে ৩ দিনের মধ্যে সাইজ এক্সচেঞ্জ করার সুযোগ রয়েছে।',
        category: 'সাইজ এক্সচেঞ্জ পলিসি'
      }
    ]
  },
  {
    name: '🛡️ কোয়ালিটি ও ১০০% অথেনটিক নিশ্চয়তা প্যাক (২টি FAQ)',
    type: 'general' as const,
    category: 'যোগাযোগ ও সাপোর্ট',
    faqs: [
      {
        question: 'ছবির সাথে কি আসল পণ্যের মিল থাকবে?',
        answer: 'আমাদের সব ছবি ১০০% আসল পণ্যের রিয়েল ফটোশুট করা। ছবিতে যা দেখছেন হুবহু সেই কোয়ালিটির প্রোডাক্ট ডেলিভারি পাবেন।',
        category: 'যোগাযোগ ও সাপোর্ট'
      },
      {
        question: 'প্রোডাক্টের কোনো গ্যারান্টি বা ওয়ারেন্টি আছে কি?',
        answer: 'হ্যাঁ, আমাদের প্রতিটি প্রিমিয়াম পণ্যের সাথে অফিসিয়াল কোয়ালিটি গ্যারান্টি এবং নির্দিষ্ট ক্ষেত্রে রিপ্লেসমেন্ট ওয়ারেন্টি প্রযোজ্য।',
        category: 'যোগাযোগ ও সাপোর্ট'
      }
    ]
  }
];

export function MerchantFAQs({ business }: MerchantFAQsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'product'>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  
  // Form State
  const [faqType, setFaqType] = useState<'general' | 'product'>('general');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('ডেলিভারি ও শিপিং');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const products = business.products || [];
  const faqs = business.faqs || [];

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return faqs.filter(f => {
      // Tab filter
      const fType = f.type || (f.productId ? 'product' : 'general');
      if (activeTab === 'general' && fType !== 'general') return false;
      if (activeTab === 'product' && fType !== 'product') return false;

      // Product filter
      if (selectedProductFilter !== 'all' && f.productId !== selectedProductFilter) return false;

      // Category filter
      if (selectedCategoryFilter !== 'all' && f.category !== selectedCategoryFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesQ = f.question.toLowerCase().includes(q);
        const matchesA = f.answer.toLowerCase().includes(q);
        const matchesCat = (f.category || '').toLowerCase().includes(q);
        const matchesProd = (f.productName || '').toLowerCase().includes(q);
        const matchesTags = (f.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesQ && !matchesA && !matchesCat && !matchesProd && !matchesTags) return false;
      }

      return true;
    });
  }, [faqs, activeTab, selectedProductFilter, selectedCategoryFilter, searchTerm]);

  // Counts
  const generalCount = useMemo(() => faqs.filter(f => (f.type || (f.productId ? 'product' : 'general')) === 'general').length, [faqs]);
  const productCount = useMemo(() => faqs.filter(f => (f.type || (f.productId ? 'product' : 'general')) === 'product').length, [faqs]);

  // Open Add Modal
  const openAddModal = (presetType: 'general' | 'product' = 'general', preselectedProductId?: string) => {
    setEditingFaq(null);
    setFaqType(presetType);
    if (presetType === 'product' && preselectedProductId) {
      setSelectedProductId(preselectedProductId);
    } else if (presetType === 'product' && products.length > 0) {
      setSelectedProductId(products[0].id);
    } else {
      setSelectedProductId('');
    }
    setQuestion('');
    setAnswer('');
    setCategory(presetType === 'general' ? GENERAL_CATEGORIES[0] : PRODUCT_CATEGORIES[0]);
    setTagsInput('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (f: FAQ) => {
    setEditingFaq(f);
    const inferredType = f.type || (f.productId ? 'product' : 'general');
    setFaqType(inferredType);
    setSelectedProductId(f.productId || (products[0]?.id || ''));
    setQuestion(f.question);
    setAnswer(f.answer);
    setCategory(f.category || (inferredType === 'general' ? GENERAL_CATEGORIES[0] : PRODUCT_CATEGORIES[0]));
    setTagsInput(f.tags ? f.tags.join(', ') : '');
    setIsModalOpen(true);
  };

  // Save FAQ
  const handleSaveFAQ = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error('অনুগ্রহ করে প্রশ্ন এবং উত্তর উভয়ই পূরণ করুন');
      return;
    }

    if (faqType === 'product' && !selectedProductId) {
      toast.error('অনুগ্রহ করে সংশ্লিষ্ট প্রোডাক্টটি নির্বাচন করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentFaqs = business.faqs || [];
      let updatedFaqs: FAQ[];

      const matchedProduct = faqType === 'product' ? products.find(p => p.id === selectedProductId) : null;
      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const faqPayload: FAQ = {
        id: editingFaq ? editingFaq.id : `faq-${Date.now()}`,
        type: faqType,
        question: question.trim(),
        answer: answer.trim(),
        category: category || (faqType === 'general' ? GENERAL_CATEGORIES[0] : PRODUCT_CATEGORIES[0]),
        isActive: editingFaq?.isActive ?? true
      };

      if (faqType === 'product' && selectedProductId) {
        faqPayload.productId = selectedProductId;
        if (matchedProduct?.name) {
          faqPayload.productName = matchedProduct.name;
        }
      }

      if (parsedTags.length > 0) {
        faqPayload.tags = parsedTags;
      }

      if (editingFaq) {
        updatedFaqs = currentFaqs.map(f => f.id === editingFaq.id ? faqPayload : f);
      } else {
        updatedFaqs = [faqPayload, ...currentFaqs];
      }

      const cleanedFaqs = cleanFirestoreData(updatedFaqs);

      await updateDoc(doc(db, 'businesses', business.id), {
        faqs: cleanedFaqs
      });

      toast.success(editingFaq ? 'প্রশ্নোত্তর সফলভাবে আপডেট করা হয়েছে!' : 'নতুন প্রশ্নোত্তর সফলভাবে যুক্ত হয়েছে!');
      setIsModalOpen(false);
    } catch (e: any) {
      console.error('[Save FAQ Error]', e);
      toast.error(e?.message ? `সংরক্ষণ ব্যর্থ: ${e.message}` : 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete FAQ
  const handleDeleteFAQ = async (faqId: string) => {
    try {
      const updatedFaqs = (business.faqs || []).filter(f => f.id !== faqId);
      const cleanedFaqs = cleanFirestoreData(updatedFaqs);
      await updateDoc(doc(db, 'businesses', business.id), {
        faqs: cleanedFaqs
      });
      toast.success('প্রশ্নোত্তর মুছে ফেলা হয়েছে');
    } catch (e: any) {
      console.error('[Delete FAQ Error]', e);
      toast.error('মুছে ফেলা সম্ভব হয়নি');
    }
  };

  // Apply Preset Pack
  const handleApplyPresetPack = async (pack: typeof PRESET_FAQ_TEMPLATES[0]) => {
    try {
      const currentFaqs = business.faqs || [];
      const newFaqEntries: FAQ[] = pack.faqs.map((f, idx) => ({
        id: `faq-preset-${Date.now()}-${idx}`,
        type: pack.type,
        question: f.question,
        answer: f.answer,
        category: f.category,
        isActive: true
      }));

      const combined = [...newFaqEntries, ...currentFaqs];
      const cleanedFaqs = cleanFirestoreData(combined);
      await updateDoc(doc(db, 'businesses', business.id), {
        faqs: cleanedFaqs
      });

      toast.success(`"${pack.name}" সফলভাবে যুক্ত করা হয়েছে!`);
      setIsPresetModalOpen(false);
    } catch (e: any) {
      console.error('[Preset FAQ Error]', e);
      toast.error('টেমপ্লেট যুক্ত করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-orange-600" />
              স্মার্ট FAQ ও নলেজবেস হাব
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              General + Product-Based
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            স্টোরের সাধারণ পলিসি (ডেলিভারি, রিটার্ন, ক্যাশ অন ডেলিভারি) এবং নির্দিষ্ট প্রোডাক্ট-ভিত্তিক প্রশ্নোত্তর যুক্ত করুন। এআই গ্রাহকের প্রশ্নের ধরন অনুযায়ী তাৎক্ষণিক নিখুঁত উত্তর দেবে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            onClick={() => setIsPresetModalOpen(true)}
            variant="outline"
            className="rounded-2xl h-11 px-4 text-xs font-bold border-orange-200 dark:border-orange-900/60 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-orange-500" />
            স্মার্ট টেমপ্লেট প্যাক
          </Button>

          <Button
            onClick={() => openAddModal('general')}
            className="bg-linear-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-black text-xs rounded-2xl h-11 px-5 shadow-md shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন FAQ যোগ করুন</span>
          </Button>
        </div>
      </div>

      {/* Tabs & Type Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>সব প্রশ্নোত্তর</span>
            <Badge className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] px-1.5 py-0 border-none font-bold">
              {faqs.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>🌐 সাধারণ স্টোর FAQ</span>
            <Badge className={`text-[10px] px-1.5 py-0 border-none font-bold ${activeTab === 'general' ? 'bg-orange-700 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
              {generalCount}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab('product')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'product'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>📦 পণ্য-ভিত্তিক FAQ</span>
            <Badge className={`text-[10px] px-1.5 py-0 border-none font-bold ${activeTab === 'product' ? 'bg-amber-700 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'}`}>
              {productCount}
            </Badge>
          </button>
        </div>

        {/* Quick Add Buttons for Specific Type */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openAddModal('general')}
            className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-xl h-8 px-2.5"
          >
            + সাধারণ FAQ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openAddModal('product')}
            className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl h-8 px-2.5"
          >
            + প্রোডাক্ট FAQ
          </Button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="প্রশ্ন, উত্তর, কি-ওয়ার্ড বা প্রোডাক্ট নাম দিয়ে খুঁজুন..."
            className="pl-9 h-11 rounded-2xl bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-zinc-600"
            >
              মুছুন
            </button>
          )}
        </div>

        {/* Product Filter Dropdown (Active when in 'product' or 'all' tab) */}
        <div>
          <select
            value={selectedProductFilter}
            onChange={e => setSelectedProductFilter(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="all">📦 সব প্রোডাক্টের FAQs</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (৳{p.price})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FAQ Grid Cards */}
      {filteredFaqs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 flex items-center justify-center text-orange-600 mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-black text-base text-zinc-900 dark:text-zinc-100">কোনো প্রশ্নোত্তর পাওয়া যায়নি</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
              {searchTerm 
                ? 'আপনার সার্চ ফিল্টারের সাথে মিলে এমন কোনো FAQ পাওয়া যায়নি।' 
                : 'স্টোরের জন্য সাধারণ পলিসি অথবা নির্দিষ্ট পণ্যের জন্য সাইজ, কোয়ালিটি ও ব্যবহার বিধি সংক্রান্ত FAQ যোগ করুন।'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Button
              onClick={() => setIsPresetModalOpen(true)}
              variant="outline"
              className="rounded-xl text-xs font-bold border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              টেমপ্লেট প্যাক থেকে যোগ করুন
            </Button>
            <Button
              onClick={() => openAddModal('general')}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl px-4"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              সাধারণ FAQ যোগ করুন
            </Button>
            <Button
              onClick={() => openAddModal('product')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl px-4"
            >
              <Package className="w-3.5 h-3.5 mr-1" />
              প্রোডাক্ট FAQ যোগ করুন
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFaqs.map((f) => {
            const isProductFaq = (f.type || (f.productId ? 'product' : 'general')) === 'product';
            const matchedProduct = isProductFaq ? products.find(p => p.id === f.productId) : null;
            const productImage = matchedProduct?.images && matchedProduct.images.length > 0 ? matchedProduct.images[0] : null;

            return (
              <div
                key={f.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-xs hover:border-orange-300 dark:hover:border-orange-900/60 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Top Badge Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isProductFaq ? (
                        <Badge className="bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          পণ্য-ভিত্তিক FAQ
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-50 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          সাধারণ স্টোর পলিসি
                        </Badge>
                      )}

                      <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-lg">
                        {f.category || 'সাধারণ'}
                      </span>
                    </div>

                    {f.tags && f.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {f.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[9px] font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Linked Product Bar (If Product-Based) */}
                  {isProductFaq && (
                    <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 overflow-hidden shrink-0 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center">
                          {productImage ? (
                            <img src={productImage} alt={matchedProduct?.name || 'Product'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {matchedProduct?.name || f.productName || 'সংযুক্ত প্রোডাক্ট'}
                          </div>
                          {matchedProduct && (
                            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono">
                              ৳{matchedProduct.price.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Question */}
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        Q
                      </span>
                      <h4 className="font-black text-xs md:text-sm text-zinc-900 dark:text-white leading-snug">
                        {f.question}
                      </h4>
                    </div>

                    {/* Answer */}
                    <div className="flex items-start gap-2 pl-7">
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 w-full">
                        {f.answer}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium">
                    <Zap className="w-3 h-3 text-orange-500" />
                    এআই রেসপন্সে সক্রিয়
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(f)}
                      className="rounded-xl h-8 px-3 text-xs font-bold"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      এডিট
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFAQ(f.id)}
                      className="rounded-xl h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preset Packs Dialog */}
      <Dialog open={isPresetModalOpen} onOpenChange={setIsPresetModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-zinc-900 dark:text-white">
              <Sparkles className="w-5 h-5 text-orange-600" />
              জনপ্রিয় স্মার্ট FAQ টেমপ্লেট প্যাক
            </DialogTitle>
            <DialogDescription className="text-xs">
              এক ক্লিকেই আপনার স্টোরের জন্য স্ট্যান্ডার্ড ডেলিভারি, ক্যাশ অন ডেলিভারি এবং রিটার্ন পলিসি যুক্ত করুন।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            {PRESET_FAQ_TEMPLATES.map((pack, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3 hover:border-orange-400 transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-zinc-900 dark:text-white">
                    {pack.name}
                  </h4>
                  <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 font-bold text-[10px]">
                    {pack.faqs.length} টি প্রশ্নোত্তর
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs">
                  {pack.faqs.map((pf, pIdx) => (
                    <div key={pIdx} className="text-zinc-600 dark:text-zinc-300 flex items-start gap-1.5">
                      <span className="text-orange-600 font-bold">•</span>
                      <span className="font-semibold">{pf.question}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleApplyPresetPack(pack)}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-8 px-4"
                  >
                    + এই প্যাকটি যুক্ত করুন
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPresetModalOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              বন্ধ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit FAQ Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-orange-600" />
              {editingFaq ? 'প্রশ্নোত্তর এডিট করুন' : 'নতুন প্রশ্নোত্তর যোগ করুন'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              গ্রাহকের সম্ভাব্য প্রশ্ন এবং এআই সেলস এজেন্টের নির্ভুল উত্তর নির্ধারণ করুন।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 1. FAQ Type Switcher (General vs Product) */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                FAQ এর ধরন (Type) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFaqType('general');
                    setCategory(GENERAL_CATEGORIES[0]);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                    faqType === 'general'
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/20'
                      : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <Globe className={`w-5 h-5 ${faqType === 'general' ? 'text-orange-600' : 'text-zinc-400'}`} />
                  <div>
                    <div className="font-black text-xs">🌐 সাধারণ স্টোর FAQ</div>
                    <div className="text-[10px] text-zinc-500">ডেলিভারি, পেমেন্ট, রিটার্ন ও পলিসি</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFaqType('product');
                    setCategory(PRODUCT_CATEGORIES[0]);
                    if (!selectedProductId && products.length > 0) {
                      setSelectedProductId(products[0].id);
                    }
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                    faqType === 'product'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20'
                      : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <Package className={`w-5 h-5 ${faqType === 'product' ? 'text-amber-600' : 'text-zinc-400'}`} />
                  <div>
                    <div className="font-black text-xs">📦 পণ্য-ভিত্তিক FAQ</div>
                    <div className="text-[10px] text-zinc-500">নির্দিষ্ট প্রডাক্টের সাইজ, কোয়ালিটি ও যত্ন</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Product Selector (Only if Product FAQ) */}
            {faqType === 'product' && (
              <div className="space-y-2 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60">
                <label className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  কোন প্রোডাক্টের জন্য এই FAQ? *
                </label>

                {products.length === 0 ? (
                  <p className="text-xs text-rose-600 font-bold">
                    প্রথমে "প্রোডাক্টস" সেকশন থেকে প্রোডাক্ট যুক্ত করুন।
                  </p>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 text-xs font-bold text-zinc-900 dark:text-white"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — মূল্য: ৳{p.price}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 3. Category Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                ক্যাটাগরি *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
              >
                {(faqType === 'general' ? GENERAL_CATEGORIES : PRODUCT_CATEGORIES).map((cat, idx) => (
                  <option key={idx} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Question Input */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>গ্রাহকের সম্ভাব্য প্রশ্ন (Customer Question) *</span>
                <span className="text-[10px] text-zinc-400 font-normal">যেমন: কাস্টমার যেভাবে প্রশ্ন করতে পারে</span>
              </label>
              <Input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={
                  faqType === 'general'
                    ? 'যেমন: ডেলিভারি পেতে কতদিন সময় লাগবে?'
                    : 'যেমন: এই শার্টটির কাপড় কি ধোয়ার পর কালার উঠবে?'
                }
                className="h-10 rounded-xl text-xs font-semibold"
              />
            </div>

            {/* 5. Answer Input */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>এআই বা বটের চূড়ান্ত উত্তর (Bot Response) *</span>
                <span className="text-[10px] text-zinc-400 font-normal">এআই কাস্টমারকে হুবহু বা মার্জিত ভাষায় এই উত্তর দেবে</span>
              </label>
              <Textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder={
                  faqType === 'general'
                    ? 'যেমন: ঢাকার ভেতরে ২৪-৪৮ ঘণ্টার মধ্যে এবং ঢাকার বাইরে ২-৩ দিনের মধ্যে ডেলিভারি সম্পন্ন হয়।'
                    : 'যেমন: আমাদের প্রিমিয়াম কটন ফেব্রিকের কালার ১০০% পাকা এবং দীর্ঘস্থায়ী। সাধারণ ওয়াশে কোনো কালার উঠবে না।'
                }
                className="min-h-[100px] rounded-xl text-xs leading-relaxed"
              />
            </div>

            {/* 6. Tags / Keywords */}
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>সার্চ কিওয়ার্ড / ট্যাগস (ঐচ্ছিক)</span>
                <span className="text-[10px] text-zinc-400 font-normal">কমা (,) দিয়ে আলাদা করুন</span>
              </label>
              <Input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="যেমন: delivery, cod, size, color, guarantee"
                className="h-10 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              বাতিল
            </Button>
            <Button
              onClick={handleSaveFAQ}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black px-6"
            >
              {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
