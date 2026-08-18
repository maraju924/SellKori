import React, { useState } from 'react';
import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  BookOpen, 
  Sparkles 
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
import { BusinessConfig, FAQ } from '../../types';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MerchantFAQsProps {
  business: BusinessConfig;
}

export function MerchantFAQs({ business }: MerchantFAQsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('সাধারণ');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    setEditingFaq(null);
    setQuestion('');
    setAnswer('');
    setCategory('সাধারণ');
    setIsModalOpen(true);
  };

  const openEditModal = (f: FAQ) => {
    setEditingFaq(f);
    setQuestion(f.question);
    setAnswer(f.answer);
    setCategory(f.category || 'সাধারণ');
    setIsModalOpen(true);
  };

  const handleSaveFAQ = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error('প্রশ্ন এবং উত্তর উভয়ই পূরণ করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentFaqs = business.faqs || [];
      let updatedFaqs: FAQ[];

      const faqPayload: FAQ = {
        id: editingFaq ? editingFaq.id : `faq-${Date.now()}`,
        question,
        answer,
        category
      };

      if (editingFaq) {
        updatedFaqs = currentFaqs.map(f => f.id === editingFaq.id ? faqPayload : f);
      } else {
        updatedFaqs = [...currentFaqs, faqPayload];
      }

      await updateDoc(doc(db, 'businesses', business.id), {
        faqs: updatedFaqs
      });

      toast.success(editingFaq ? 'প্রশ্নোত্তর আপডেট হয়েছে!' : 'নতুন প্রশ্নোত্তর যুক্ত হয়েছে!');
      setIsModalOpen(false);
    } catch (e) {
      toast.error('সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    try {
      const updatedFaqs = (business.faqs || []).filter(f => f.id !== faqId);
      await updateDoc(doc(db, 'businesses', business.id), {
        faqs: updatedFaqs
      });
      toast.success('প্রশ্নোত্তর মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('মুছে ফেলা সম্ভব হয়নি');
    }
  };

  const faqs = business.faqs || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              স্টোর পলিসি ও নলেজবেস (FAQs)
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              AI Knowledge Bank
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            ডেলিভারি সময়, রিটার্ন পলিসি ও কমন প্রশ্নের উত্তর যোগ করুন। এআই এগুলো মুখস্থ করে কাস্টমারকে সঠিক উত্তর দেবে।
          </p>
        </div>

        <Button
          onClick={openAddModal}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-2xl h-11 px-5 shadow-md shadow-orange-600/20 shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          নতুন প্রশ্নোত্তর যোগ করুন
        </Button>
      </div>

      {/* FAQs List */}
      {faqs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <h3 className="font-black text-sm text-zinc-800 dark:text-zinc-200">কোনো প্রশ্নোত্তর যুক্ত করা নেই</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            যেমন: "ঢাকার বাইরে কতদিনে ডেলিভারি পাব?" বা "প্রোডাক্টে সমস্যা হলে কি রিটার্ন করা যাবে?" ইত্যাদি প্রশ্ন যোগ করুন।
          </p>
          <Button
            onClick={openAddModal}
            size="sm"
            className="bg-orange-600 text-white font-bold text-xs rounded-xl"
          >
            প্রথম FAQ যুক্ত করুন
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {faqs.map((f) => (
            <div
              key={f.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg text-zinc-600 dark:text-zinc-400">
                    {f.category || 'সাধারণ'}
                  </span>
                </div>
                <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                  {f.question}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {f.answer}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                  className="rounded-xl h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit FAQ Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">
              {editingFaq ? 'প্রশ্নোত্তর এডিট করুন' : 'নতুন প্রশ্নোত্তর যোগ করুন'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              এআই কাস্টমারের এই ধরনের প্রশ্নের উত্তরে এই তথ্যটি ব্যবহার করবে।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">ক্যাটাগরি</label>
              <Input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="যেমন: ডেলিভারি / রিটার্ন / পেমেন্ট"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">সম্ভাব্য প্রশ্ন *</label>
              <Input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="যেমন: ডেলিভারি পেতে কতদিন সময় লাগবে?"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">বটের উত্তর *</label>
              <Textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="যেমন: ঢাকার ভেতরে ২৪-৪৮ ঘণ্টার মধ্যে এবং ঢাকার বাইরে ২-৩ দিনের মধ্যে ডেলিভারি সম্পন্ন হয়।"
                className="min-h-[100px] rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
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
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black px-5"
            >
              {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
