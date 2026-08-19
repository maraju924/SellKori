import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  RefreshCw, 
  Zap, 
  Terminal, 
  CheckCircle2, 
  ShoppingBag, 
  User,
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { BusinessConfig, Message } from '../../types';
import { getAIResponse } from '../../lib/gemini';
import { toast } from 'sonner';
import {
  mergeOrderData,
  extractBdPhone,
  buildCustomerContext,
  shouldPlaceOrder,
  saveConfirmedOrder,
  CollectedOrderInfo,
} from '../../lib/chatOrder';

interface MerchantTestChatProps {
  business: BusinessConfig;
}

export function MerchantTestChat({ business }: MerchantTestChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `আসসালামু আলাইকুম! ${business.name || 'আমাদের শপে'} আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে চান?`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSummary, setChatSummary] = useState('');
  const [collected, setCollected] = useState<CollectedOrderInfo>({});
  const [orderPlacedId, setOrderPlacedId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const liveCollected = mergeOrderData(collected, {
        phone: extractBdPhone(textToSend) || collected.phone,
      });
      const historyStr = [...messages, userMsg]
        .slice(-24)
        .map(m => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`)
        .join('\n');

      const recentOrderNote = orderPlacedId
        ? `সাম্প্রতিক টেস্ট অর্ডার ইতিমধ্যে কনফার্ম (ID: ${orderPlacedId})। আবার অর্ডার নিতে বলবেন না।`
        : '';

      const aiResponse = await getAIResponse(
        textToSend,
        historyStr,
        business,
        buildCustomerContext(liveCollected, recentOrderNote || 'Sandbox test mode'),
        undefined,
        undefined,
        chatSummary
      );

      const nextCollected = mergeOrderData(liveCollected, {
        ...aiResponse.order_data,
        product_name: aiResponse.order_data?.product_name || aiResponse.product_name || liveCollected.product_name,
        phone: extractBdPhone(textToSend) || aiResponse.order_data?.phone || liveCollected.phone,
      });
      setCollected(nextCollected);

      if (aiResponse.summary) {
        setChatSummary(aiResponse.summary);
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: aiResponse.reply,
        timestamp: Date.now(),
        aiMetadata: aiResponse
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (shouldPlaceOrder(aiResponse, nextCollected, Boolean(orderPlacedId))) {
        const saved = await saveConfirmedOrder({
          business,
          collected: nextCollected,
          productName: nextCollected.product_name || aiResponse.product_name,
          sessionId: `test-${business.id}`,
          source: 'Test chat simulator',
        });
        if (saved) {
          setOrderPlacedId(saved.id);
          toast.success(`সিমুলেটরে টেস্ট অর্ডার তৈরি হয়েছে!`, {
            description: `অর্ডার পেইজে গিয়ে আপনি এই ইনভয়েসটি দেখতে পারেন।`
          });
        }
      }
    } catch (e) {
      toast.error('এআই রেসপন্স তৈরিতে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `আসসালামু আলাইকুম! ${business.name || 'আমাদের শপে'} আপনাকে স্বাগতম। আপনি কোন পণ্যটি সম্পর্কে জানতে চান?`,
        timestamp: Date.now()
      }
    ]);
    setChatSummary('');
    setCollected({});
    setOrderPlacedId('');
    toast.success('চ্যাট সিমুলেটর রিসেট করা হয়েছে');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">
              লাইভ চ্যাট সিমুলেটর ও স্যান্ডবক্স
            </h2>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-none font-bold text-xs">
              Live Sandbox
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            আপনার বটের সাথে কথা বলুন, দামাদামি করুন এবং অর্ডার মেমো তৈরীর প্রক্রিয়া যাচাই করুন।
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleResetChat}
          className="rounded-2xl text-xs font-bold border-zinc-200 dark:border-zinc-700 h-10 px-4"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          রিসেট চ্যাট
        </Button>
      </div>

      {/* Simulator Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl shadow-xs overflow-hidden flex flex-col h-[580px]">
        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
            >
              <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold px-1">
                {msg.role === 'user' ? (
                  <>
                    <span>আপনি (কাস্টমার)</span>
                    <User className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-orange-500" />
                    <span>{business.name || 'SellKori AI'}</span>
                  </>
                )}
              </div>

              <div
                className={`p-4 rounded-2xl max-w-[85%] sm:max-w-[75%] text-xs md:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-linear-to-r from-orange-600 to-amber-500 text-white font-medium rounded-tr-none shadow-md shadow-orange-600/10'
                    : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700 rounded-tl-none shadow-xs font-medium'
                }`}
              >
                {msg.content}

                {msg.role === 'assistant' && (msg.aiMetadata?.show_product_image || msg.aiMetadata?.show_review_images) && (() => {
                  const matched = business.products?.find(p =>
                    p.name.toLowerCase().includes((msg.aiMetadata?.product_name || '').toLowerCase())
                  ) || business.products?.[0];
                  if (!matched) return null;
                  const productImgs = msg.aiMetadata?.show_product_image ? (matched.images || []).slice(0, 4) : [];
                  const reviewImgs = msg.aiMetadata?.show_review_images ? (matched.reviewImages || []).slice(0, 4) : [];
                  if (!productImgs.length && !reviewImgs.length) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700 space-y-2">
                      {productImgs.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {productImgs.map((img, idx) => (
                            <img key={idx} src={img} alt={matched.name} className="rounded-xl w-full h-20 object-cover" referrerPolicy="no-referrer" />
                          ))}
                        </div>
                      )}
                      {reviewImgs.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> কাস্টমার রিভিউ
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {reviewImgs.map((img, idx) => (
                              <img key={`r-${idx}`} src={img} alt="review" className="rounded-xl w-full h-20 object-cover border border-amber-200" referrerPolicy="no-referrer" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Event Badge preview */}
              {msg.aiMetadata?.event_name && (
                <div className="flex items-center gap-1.5 pl-1">
                  <Badge variant="outline" className="text-[10px] font-mono border-orange-200 text-orange-600 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30">
                    <Zap className="w-3 h-3 mr-1" />
                    Meta CAPI Event: {msg.aiMetadata.event_name}
                  </Badge>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
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
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-zinc-400 shrink-0">দ্রুত টেস্ট করুন:</span>
          {[
            'দাম কত? কিছু ডিসকাউন্ট দিবেন?',
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

        {/* Input Bar */}
        <div className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="বটের সাথে কাস্টমার হিসেবে কথা বলুন..."
            className="h-11 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-xs"
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="h-11 w-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shrink-0 shadow-md shadow-orange-600/20"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
