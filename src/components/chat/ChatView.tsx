import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Bot, 
  Send, 
  Store, 
  ShoppingBag, 
  Zap, 
  CheckCircle2, 
  MapPin, 
  Phone,
  Truck,
  ShieldCheck,
  User
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig, Message, Order } from '../../types';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAIResponse } from '../../lib/gemini';
import { toast } from 'sonner';

export function ChatView() {
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
  const [chatSummary, setChatSummary] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!businessId) return;
    const fetchBiz = async () => {
      try {
        const snap = await getDoc(doc(db, 'businesses', businessId));
        if (snap.exists()) {
          const data = snap.data() as BusinessConfig;
          setBusiness(data);
          setMessages([
            {
              id: 'init-msg',
              role: 'assistant',
              content: `আসসালামু আলাইকুম! ${data.name || 'আমাদের শপে'} আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে বা অর্ডার করতে চান?`,
              timestamp: Date.now()
            }
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchBiz();
  }, [businessId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isSending || !business) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const historyStr = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
      const aiResponse = await getAIResponse(
        textToSend,
        historyStr,
        business,
        'Public Customer Chat Session',
        undefined,
        undefined,
        chatSummary
      );

      if (aiResponse.summary) {
        setChatSummary(aiResponse.summary);
      }

      const assistantMsg: Message = {
        id: `ast-${Date.now() + 1}`,
        role: 'assistant',
        content: aiResponse.reply,
        timestamp: Date.now(),
        aiMetadata: aiResponse
      };

      setMessages(prev => [...prev, assistantMsg]);

      // If customer completed order placement
      if (aiResponse.event_name === 'Purchase' && !aiResponse.need_more_info) {
        const orderId = `ord-${Date.now()}`;
        const qty = parseInt(aiResponse.order_data.quantity) || 1;
        const matchedProduct = business.products?.find(p => 
          p.name.toLowerCase().includes((aiResponse.product_name || '').toLowerCase())
        );
        const unitPrice = aiResponse.order_data.negotiated_price
          ? Number(aiResponse.order_data.negotiated_price.replace(/[^0-9]/g, ''))
          : (matchedProduct?.price || 1000);

        const newOrder: any = {
          id: orderId,
          businessId: business.id,
          merchantId: business.ownerId,
          sessionId: sessionId,
          customerName: aiResponse.order_data.name || 'সম্মানিত গ্রাহক',
          phone: aiResponse.order_data.phone || '',
          address: aiResponse.order_data.address || '',
          quantity: qty,
          productName: aiResponse.product_name || matchedProduct?.name || 'পণ্য',
          unitPrice,
          totalPrice: unitPrice * qty,
          status: 'pending',
          paymentStatus: 'unpaid',
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'orders', orderId), newOrder);
        toast.success('আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!', {
          description: 'খুব দ্রুত আমাদের প্রতিনিধি আপনার সাথে যোগাযোগ করবে।'
        });
      }
    } catch (e) {
      toast.error('দুঃখিত, কোনো একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="w-10 h-10 rounded-2xl bg-orange-600 animate-spin flex items-center justify-center text-white font-black text-xs">
          SK
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 text-center space-y-4">
        <Store className="w-12 h-12 text-zinc-300 mx-auto" />
        <h2 className="text-lg font-black text-zinc-800">স্টোর খুঁজে পাওয়া যায়নি</h2>
        <p className="text-xs text-zinc-500 max-w-sm">ইউআরএলটি সঠিক কিনা যাচাই করুন অথবা আমাদের হোমপেইজে যান।</p>
        <Link to="/">
          <Button className="bg-orange-600 text-white rounded-xl text-xs font-bold">হোমপেইজে যান</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 font-sans">
      <div className="w-full max-w-2xl h-screen sm:h-[650px] bg-white dark:bg-zinc-900 sm:rounded-3xl shadow-xl flex flex-col border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
        {/* Chat Store Header */}
        <div className="bg-linear-to-r from-orange-600 to-amber-500 p-4 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-lg border border-white/30">
              {business.logoUrl ? (
                <img src={business.logoUrl} alt={business.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                business.name?.slice(0, 1) || 'S'
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-sm md:text-base leading-tight">{business.name}</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              </div>
              <p className="text-[11px] text-orange-100 flex items-center gap-1">
                <Bot className="w-3 h-3" />
                সেলকরি এআই সেলস এজেন্ট (সক্রিয়)
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <Badge className="bg-white/20 text-white border-none font-bold text-[10px] backdrop-blur-xs">
              ১০০% ক্যাশ অন ডেলিভারি
            </Badge>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold px-1">
                {msg.role === 'user' ? (
                  <>
                    <span>আপনি</span>
                    <User className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-orange-500" />
                    <span>{business.name}</span>
                  </>
                )}
              </div>

              <div
                className={`p-4 rounded-2xl max-w-[85%] text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-linear-to-r from-orange-600 to-amber-500 text-white font-medium rounded-tr-none shadow-md shadow-orange-600/10'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700 rounded-tl-none shadow-xs font-medium'
                }`}
              >
                {msg.content}

                {/* Optional Product Image & Gallery Display */}
                {msg.role === 'assistant' && msg.aiMetadata?.show_product_image && (() => {
                  const matched = business.products?.find(p => 
                    p.name.toLowerCase().includes((msg.aiMetadata?.product_name || '').toLowerCase())
                  );
                  if (!matched || !matched.images || matched.images.length === 0) return null;

                  return (
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>{matched.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {matched.images.slice(0, 4).map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={matched.name}
                            className="rounded-xl w-full h-24 object-cover border border-zinc-200 dark:border-zinc-700"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-start gap-2">
              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-2.5 flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          <span className="text-[10px] font-bold text-zinc-400 shrink-0">কমন প্রশ্ন:</span>
          {[
            'পণ্যটির দাম কত?',
            'ঢাকার ভেতরে ডেলিভারি চার্জ কত?',
            'আমি ১ পিস অর্ডার করতে চাই',
            'ক্যাশ অন ডেলিভারি আছে?'
          ].map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-[11px] font-bold px-3 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl whitespace-nowrap hover:border-orange-400 hover:text-orange-600 transition-all shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Bottom Input Box */}
        <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2 shrink-0">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="আপনার প্রশ্ন বা অর্ডার লিখুন..."
            className="h-11 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-xs"
          />
          <Button
            onClick={() => handleSend()}
            disabled={isSending || !input.trim()}
            className="h-11 w-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-md shadow-orange-600/20"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
