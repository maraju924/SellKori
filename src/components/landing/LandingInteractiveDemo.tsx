import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  ShoppingBag, 
  Truck, 
  CreditCard, 
  Tag, 
  Flame,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface DemoMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  productCard?: {
    title: string;
    image: string;
    regularPrice: number;
    offerPrice?: number;
    specs: string[];
  };
  orderSummary?: {
    orderId: string;
    product: string;
    price: number;
    deliveryFee: number;
    total: number;
    customerName: string;
    phone: string;
    address: string;
  };
}

export function LandingInteractiveDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'আসসালামু আলাইকুম! "ঢাকা বুটিক"-এ আপনাকে স্বাগতম। আমাদের এক্সক্লুসিভ কালেকশন দেখতে পারেন। কীভাবে সাহায্য করতে পারি?',
      timestamp: 'Just now',
      productCard: {
        title: 'এক্সক্লুসিভ হ্যান্ডক্রাফটেড প্রিমিয়াম পাঞ্জাবি',
        image: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=600&auto=format&fit=crop&q=80',
        regularPrice: 1250,
        offerPrice: 1150,
        specs: ['১০০% পিউর প্রিমিয়াম কটন', 'সাইজ: M (40), L (42), XL (44)', 'কালার: নেভি ব্লু, মেরুন, অফ-হোয়াইট']
      }
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const quickPrompts = [
    { label: '💰 দাম কত এবং সাইজ আছে?', text: 'পাঞ্জাবিটার রেগুলার দাম কত? আমার ৪২ সাইজ লাগবে।' },
    { label: '🏷️ ভাই ১০০০ টাকায় দেন না! (Bargaining)', text: 'ভাইয়া ১,০০০ টাকায় দেওয়া যাবে? আমি এখনই কনফার্ম করব।' },
    { label: '🚚 ডেলিভারি চার্জ কত ও ক্যাশ অন ডেলিভারি?', text: 'ঢাকার বাহিরে ডেলিভারি চার্জ কত? ক্যাশ অন ডেলিভারি আছে?' },
    { label: '🛍️ ১ পিস অর্ডার করতে চাই', text: 'আমি ১ পিস মেরুন কালার ৪২ সাইজ নিতে চাই। নাম: তানভীর হাসান, ফোন: 01712345678, ঠিকানা: বাড়ি ১২, রোড ৫, মিরপুর-১০, ঢাকা।' },
  ];

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputVal;
    if (!query.trim()) return;

    const userMsg: DemoMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputVal('');
    setIsTyping(true);

    // Dynamic Intelligent Bot Simulation Logic
    setTimeout(() => {
      let botResponse: DemoMessage;
      const lower = query.toLowerCase();

      if (lower.includes('১০০০') || lower.includes('1000') || lower.includes('ডিসকাউন্ট') || lower.includes('কম') || lower.includes('ছাড়')) {
        botResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'ধন্যবাদ আপনার আগ্রহের জন্য! স্যার, পাঞ্জাবিটি ১০০% পিউর অর্গানিক কটন ও প্রিমিয়াম এমব্রয়ডারি করা। কোয়ালিটি বিবেচনা করলে ১,০০০ টাকায় দেওয়া আমাদের পক্ষে সম্ভব নয়। তবে আজকের স্পেশাল ডিল হিসেবে আমি আপনাকে ১০০ টাকা এক্সট্রা ডিসকাউন্ট দিয়ে ১,১৫০ টাকায় দিতে পারব! সাইজ ৪২ (L) এভেইলেবল আছে। আপনি কি অর্ডার কনফার্ম করতে চান?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      } else if (lower.includes('ডেলিভারি') || lower.includes('ক্যাশ অন') || lower.includes('চার্জ') || lower.includes('কতদিনে')) {
        botResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'হ্যাঁ স্যার! সারা বাংলাদেশে ১০০% ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে পেমেন্ট) সুবিধা রয়েছে।\n\n• ঢাকার ভিতরে ডেলিভারি চার্জ: ৳৭০ (২৪-৪৮ ঘণ্টা)\n• ঢাকার বাহিরে ডেলিভারি চার্জ: ৳১৩০ (২-৩ দিন)\n\nঅর্ডার করতে আপনার নাম, মোবাইল নম্বর ও সম্পূর্ণ ঠিকানা জানিয়ে দিন।',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      } else if (lower.includes('01') || lower.includes('মিরপুর') || lower.includes('অর্ডার') || lower.includes('নাম') || lower.includes('তানভীর')) {
        botResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'আলহামদুলিল্লাহ! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে। নিচে আপনার অর্ডারের পূর্ণাঙ্গ ইনভয়েস মেমো দেওয়া হলো। আমাদের প্রতিনিধি ডেলিভারির পূর্বে কুরিয়ার ট্র্যাকিং নম্বর সহ এসএমএস পাঠাবে।',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          orderSummary: {
            orderId: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
            product: 'হ্যান্ডক্রাফটেড প্রিমিয়াম পাঞ্জাবি (সাইজ: ৪২, কালার: মেরুন)',
            price: 1150,
            deliveryFee: 70,
            total: 1220,
            customerName: 'তানভীর হাসান',
            phone: '01712345678',
            address: 'বাড়ি ১২, রোড ৫, মিরপুর-১০, ঢাকা'
          }
        };
      } else if (lower.includes('দাম') || lower.includes('সাইজ') || lower.includes('কালার')) {
        botResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'স্যার, প্রিমিয়াম পাঞ্জাবিটির রেগুলার দাম ১,২৫০ টাকা, তবে বর্তমানে স্পেশাল অফারে ১,১৫০ টাকায় পাচ্ছেন। সাইজ M (40), L (42) ও XL (44) স্টকে রেডি আছে। মেরুন, নেভি ব্লু ও অফ-হোয়াইট—কোন কালারটি আপনার পছন্দ?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          productCard: {
            title: 'এক্সক্লুসিভ হ্যান্ডক্রাফটেড প্রিমিয়াম পাঞ্জাবি',
            image: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=600&auto=format&fit=crop&q=80',
            regularPrice: 1250,
            offerPrice: 1150,
            specs: ['১০০% কটন ফেব্রিক', 'এক্সক্লুসিভ গোল্ডেন বাটন', 'ইনস্ট্যান্ট ক্যাশ অন ডেলিভারি']
          }
        };
      } else {
        botResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: 'জি স্যার! আপনার মেসেজ পেয়েছি। আমাদের স্টোরের যে কোনো প্রোডাক্টের সাইজ, দাম বা অফার সম্পর্কে জানতে পারেন। আপনি কি এই পাঞ্জাবিটির সাইজ ও কালার দেখতে চান?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 900);
  };

  const handleReset = () => {
    setMessages([
      {
        id: '1',
        sender: 'bot',
        text: 'আসসালামু আলাইকুম! "ঢাকা বুটিক"-এ আপনাকে স্বাগতম। আমাদের এক্সক্লুসিভ কালেকশন দেখতে পারেন। কীভাবে সাহায্য করতে পারি?',
        timestamp: 'Just now',
        productCard: {
          title: 'এক্সক্লুসিভ হ্যান্ডক্রাফটেড প্রিমিয়াম পাঞ্জাবি',
          image: 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=600&auto=format&fit=crop&q=80',
          regularPrice: 1250,
          offerPrice: 1150,
          specs: ['১০০% পিউর প্রিমিয়াম কটন', 'সাইজ: M (40), L (42), XL (44)', 'কালার: নেভি ব্লু, মেরুন, অফ-হোয়াইট']
        }
      }
    ]);
  };

  return (
    <section id="demo" className="py-20 md:py-28 relative bg-zinc-50/80 dark:bg-zinc-900/40 border-y border-zinc-200/80 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <Badge className="bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900 px-4 py-1.5 text-xs font-bold rounded-full">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-orange-600 fill-orange-600" />
            লাইভ ইন্টারেক্টিভ সিমুলেটর
          </Badge>
          <h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
            নিচেই কথা বলে টেস্ট করুন <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-600 to-amber-500">
              SellKori AI কতটা স্মার্ট ও বাস্তবসম্মত!
            </span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-base md:text-lg">
            দরদাম করা, সাইজ জানা বা সরাসরি অর্ডার দেওয়া—নিচের বাটনগুলোতে চাপুন অথবা নিজের মতো বাংলায় মেসেজ টাইপ করুন।
          </p>
        </div>

        {/* Demo Chat Card Container */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
          {/* Chat Window Top Bar */}
          <div className="bg-zinc-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-black shadow-md">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-900" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">ঢাকা বুটিক (SellKori AI Salesman)</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Active 24/7
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">খাঁটি বাংলায় স্মার্ট বার্গেনিং ও অটো অর্ডার জেনারেটর</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold gap-1.5 rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              রিসেট চ্যাট
            </Button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="bg-zinc-100 dark:bg-zinc-900/90 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-zinc-500 shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
              টেস্ট প্রম্পট:
            </span>
            {quickPrompts.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q.text)}
                className="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-full hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-all whitespace-nowrap shadow-xs active:scale-95"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="p-4 md:p-6 space-y-4 max-h-[460px] min-h-[380px] overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-orange-600 text-white font-medium rounded-tr-xs'
                        : 'bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Optional Product Card Attachment */}
                  {msg.productCard && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-sm space-y-3">
                      <div className="flex gap-3">
                        <img
                          src={msg.productCard.image}
                          alt={msg.productCard.title}
                          className="w-20 h-20 rounded-xl object-cover border border-zinc-100 dark:border-zinc-800"
                        />
                        <div className="flex-1 space-y-1">
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-white leading-tight">
                            {msg.productCard.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-orange-600">
                              ৳{msg.productCard.offerPrice?.toLocaleString()}
                            </span>
                            {msg.productCard.regularPrice > (msg.productCard.offerPrice || 0) && (
                              <span className="text-xs text-zinc-400 line-through">
                                ৳{msg.productCard.regularPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                          <span className="inline-block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                            ইন স্টক (M, L, XL)
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                        {msg.productCard.specs.map((s, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-orange-500 shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Optional Order Summary Slip Attachment */}
                  {msg.orderSummary && (
                    <div className="bg-linear-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-2 border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 shadow-md space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="w-5 h-5 text-emerald-600" />
                          <span className="font-extrabold text-xs text-emerald-900 dark:text-emerald-200">
                            ইনস্ট্যান্ট অর্ডার স্লিপ
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                          {msg.orderSummary.orderId}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-zinc-500">কাস্টমারের নাম:</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{msg.orderSummary.customerName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500">ফোন নম্বর:</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{msg.orderSummary.phone}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-zinc-500">ডেলিভারি ঠিকানা:</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{msg.orderSummary.address}</p>
                        </div>
                      </div>

                      <div className="border-t border-emerald-200/60 dark:border-emerald-800/60 pt-2 space-y-1 text-xs">
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>প্রোডাক্ট মূল্য:</span>
                          <span className="font-bold">৳{msg.orderSummary.price.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>ডেলিভারি চার্জ:</span>
                          <span className="font-bold">৳{msg.orderSummary.deliveryFee}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-emerald-800 dark:text-emerald-300 border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1">
                          <span>সর্বমোট (ক্যাশ অন ডেলিভারি):</span>
                          <span>৳{msg.orderSummary.total.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 rounded-xl p-2 text-[10px] font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>অটোমেটিক্যালি Steadfast Courier এ বুকিং ও মেটা CAPI পারচেজ ইভেন্ট ফায়ার্ড!</span>
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] text-zinc-400 block px-1">
                    {msg.timestamp}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-2xl flex items-center gap-1.5 shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3.5 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="যেকোনো প্রশ্ন লিখুন (যেমন: ৫ পিসের দাম কত, কুরিয়ার চার্জ কত?)..."
              className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border-none text-xs md:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputVal.trim() || isTyping}
              className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-3 rounded-2xl font-bold text-xs gap-1.5 shadow-md shadow-orange-600/20"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">পাঠান</span>
            </Button>
          </div>
        </div>

        {/* Feature Highlights beneath Demo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto">
          {[
            { title: 'স্মার্ট দরদাম', desc: 'মিনিমাম দামের নিচে কখনো নামবে না' },
            { title: 'ইনস্ট্যান্ট মেমো', desc: 'নাম, ফোন ও ঠিকানা ভ্যালিডেশন' },
            { title: 'কুরিয়ার রেডি', desc: 'Steadfast এ এক ক্লিকে বুকিং' },
            { title: 'মেটা পিক্সেল CAPI', desc: 'সার্ভার সাইড ইভেন্ট ট্র্যাকিং' },
          ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center space-y-0.5">
              <p className="font-extrabold text-xs text-orange-600 dark:text-orange-400">{item.title}</p>
              <p className="text-[11px] text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
