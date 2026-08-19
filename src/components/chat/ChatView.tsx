import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Headphones,
  LockKeyhole,
  PackageCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  User,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

import { Button } from '../ui/button';
import type { BusinessConfig, Message, Product } from '../../types';
import { db } from '../../lib/firebase';
import { getAIResponse } from '../../lib/gemini';
import { isFeatureEnabled, mergeFeatures, shouldRunAi } from '../../lib/featureFlags';
import {
  buildCustomerContext,
  type CollectedOrderInfo,
  extractBdPhone,
  fetchClientIp,
  maybeAutoBookSteadfast,
  mergeOrderData,
  saveConfirmedOrder,
  shouldPlaceOrder,
} from '../../lib/chatOrder';
import {
  clearChatSession,
  loadChatSession,
  saveChatSession,
} from '../../lib/chatSession';

const MAX_MESSAGE_LENGTH = 1_000;

function messageId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function welcomeMessage(businessName?: string): Message {
  return {
    id: messageId('welcome'),
    role: 'assistant',
    content: `আসসালামু আলাইকুম! ${businessName || 'আমাদের শপে'} আপনাকে স্বাগতম। পণ্য, দাম, ডেলিভারি বা অর্ডার—যেকোনো বিষয়ে আমি সাহায্য করতে পারি।`,
    timestamp: Date.now(),
  };
}

function messageTime(timestamp: number) {
  return new Intl.DateTimeFormat('bn-BD', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

function findProduct(products: Product[] | undefined, productName?: string) {
  const wanted = productName?.trim().toLocaleLowerCase();
  if (!wanted) return undefined;
  return products?.find((product) => {
    const name = product.name.trim().toLocaleLowerCase();
    return name === wanted || name.includes(wanted) || wanted.includes(name);
  });
}

export function ChatView() {
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatSummary, setChatSummary] = useState('');
  const [collected, setCollected] = useState<CollectedOrderInfo>({});
  const [orderPlacedId, setOrderPlacedId] = useState('');
  const [sendError, setSendError] = useState('');
  const [retryText, setRetryText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined' || !businessId) return messageId('session');
    const key = `sellkori_session_${businessId}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = messageId('session');
    localStorage.setItem(key, created);
    return created;
  });

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    let active = true;
    const fetchBusiness = async () => {
      try {
        const snap = await getDoc(doc(db, 'businesses', businessId));
        if (!active) return;
        if (!snap.exists()) {
          setBusiness(null);
          return;
        }

        const data = snap.data() as BusinessConfig;
        const resolvedBusiness = { ...data, id: data.id || snap.id || businessId };
        setBusiness(resolvedBusiness);

        const restored = loadChatSession(localStorage, businessId);
        let restoredCollected = restored.collected;
        let restoredSummary = restored.summary;
        let restoredOrderId = restored.orderPlacedId;

        // One-time compatibility with sessions created by the previous chat UI.
        if (!restored.messages.length) {
          try {
            const legacy = JSON.parse(localStorage.getItem(`sellkori_mem_${businessId}`) || '{}');
            restoredCollected = legacy.collected || restoredCollected;
            restoredSummary = legacy.summary || restoredSummary;
            restoredOrderId = legacy.orderPlacedId || restoredOrderId;
          } catch {
            // Invalid legacy data is safe to ignore.
          }
        }

        setCollected(restoredCollected);
        setChatSummary(restoredSummary);
        setOrderPlacedId(restoredOrderId);
        setMessages(restored.messages.length
          ? restored.messages
          : [welcomeMessage(resolvedBusiness.name)]);
      } catch (error) {
        console.error('Unable to load public chat:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchBusiness();
    return () => {
      active = false;
    };
  }, [businessId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? 'smooth' : 'auto',
      block: 'end',
    });
  }, [messages, isSending, sendError]);

  useEffect(() => {
    if (!businessId || !business || !messages.length) return;
    try {
      saveChatSession(localStorage, businessId, {
        messages,
        summary: chatSummary,
        collected,
        orderPlacedId,
      });
    } catch {
      // Storage can be unavailable in private browsing; chat remains usable.
    }
  }, [businessId, business, messages, chatSummary, collected, orderPlacedId]);

  const quickPrompts = useMemo(() => {
    const product = business?.products?.find((item) => item.isAvailable !== false && (item.stock ?? 1) > 0);
    return [
      ...(product ? [`${product.name} সম্পর্কে জানতে চাই`] : ['পণ্যগুলো দেখতে চাই']),
      'ডেলিভারি চার্জ কত?',
      'ক্যাশ অন ডেলিভারি আছে?',
      'আমি অর্ডার করতে চাই',
    ];
  }, [business?.products]);

  const orderProgress = useMemo(() => {
    const fields = [
      { label: 'পণ্য', complete: Boolean(collected.product_name) },
      { label: 'নাম', complete: Boolean(collected.name) },
      { label: 'ফোন', complete: Boolean(collected.phone) },
      { label: 'ঠিকানা', complete: Boolean(collected.address) },
    ];
    return { fields, complete: fields.filter((field) => field.complete).length };
  }, [collected]);

  const aiOnline = business ? shouldRunAi(business.features) : false;

  const sendMessage = async (text: string, appendUserMessage = true) => {
    const cleanText = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!cleanText || isSending || !business) return;

    setSendError('');
    setRetryText('');
    setInput('');

    const userMessage: Message = {
      id: messageId('user'),
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
      deliveryStatus: 'sent',
    };
    const conversation = appendUserMessage ? [...messages, userMessage] : messages;
    if (appendUserMessage) setMessages(conversation);

    if (!shouldRunAi(business.features)) {
      const offline = mergeFeatures(business.features).offlineMessage
        || 'ধন্যবাদ! আমাদের সাপোর্ট টিম শীঘ্রই আপনার মেসেজের উত্তর দেবে।';
      setMessages((previous) => [...previous, {
        id: messageId('assistant'),
        role: 'assistant',
        content: offline,
        timestamp: Date.now(),
      }]);
      return;
    }

    setIsSending(true);
    try {
      const liveCollected = mergeOrderData(collected, {
        phone: extractBdPhone(cleanText) || collected.phone,
      });
      const history = conversation
        .slice(-24)
        .map((message) => `${message.role === 'user' ? 'Customer' : 'Assistant'}: ${message.content}`)
        .join('\n');
      const recentOrderNote = orderPlacedId
        ? `সাম্প্রতিক অর্ডার ইতিমধ্যে কনফার্ম হয়েছে (ID: ${orderPlacedId})। একই অর্ডার আবার নিতে বলবেন না।`
        : 'Public Customer Chat Session';

      const aiResponse = await getAIResponse(
        cleanText,
        history,
        business,
        buildCustomerContext(liveCollected, recentOrderNote),
        undefined,
        undefined,
        chatSummary,
      );

      if (aiResponse.errorCode) {
        throw new Error(aiResponse.errorCode);
      }

      const nextCollected = mergeOrderData(liveCollected, {
        ...aiResponse.order_data,
        product_name: aiResponse.order_data?.product_name
          || aiResponse.product_name
          || liveCollected.product_name,
        phone: extractBdPhone(cleanText)
          || aiResponse.order_data?.phone
          || liveCollected.phone,
      });
      setCollected(nextCollected);
      if (aiResponse.summary) setChatSummary(aiResponse.summary);
      setMessages((previous) => [...previous, {
        id: messageId('assistant'),
        role: 'assistant',
        content: aiResponse.reply,
        timestamp: Date.now(),
        aiMetadata: aiResponse,
      }]);

      let placedId = orderPlacedId;
      if (
        isFeatureEnabled(business.features, 'autoOrderEnabled')
        && shouldPlaceOrder(aiResponse, nextCollected, Boolean(orderPlacedId))
      ) {
        const saved = await saveConfirmedOrder({
          business,
          collected: nextCollected,
          productName: nextCollected.product_name || aiResponse.product_name,
          sessionId,
          clientIp: await fetchClientIp(),
          source: 'Public chat',
        });
        if (saved) {
          placedId = saved.id;
          setOrderPlacedId(saved.id);
          await maybeAutoBookSteadfast(business, saved.id, false);
          toast.success('অর্ডার সফলভাবে গ্রহণ করা হয়েছে', {
            description: `অর্ডার রেফারেন্স: ${saved.id}`,
          });
        }
      }

      // Keep the legacy memory fresh for older deployed clients.
      try {
        localStorage.setItem(`sellkori_mem_${businessId}`, JSON.stringify({
          collected: nextCollected,
          summary: aiResponse.summary || chatSummary,
          orderPlacedId: placedId,
        }));
      } catch {
        // Local persistence is optional.
      }
    } catch (error) {
      console.error('Chat response failed:', error);
      setRetryText(cleanText);
      setSendError('এই মুহূর্তে উত্তর পাঠানো যাচ্ছে না। আপনার মেসেজটি সংরক্ষিত আছে—আবার চেষ্টা করুন।');
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleReset = () => {
    if (!businessId || !business) return;
    const confirmed = window.confirm('এই ডিভাইস থেকে কথোপকথন ও সংরক্ষিত অর্ডার তথ্য মুছে ফেলবেন?');
    if (!confirmed) return;
    clearChatSession(localStorage, businessId);
    setMessages([welcomeMessage(business.name)]);
    setChatSummary('');
    setCollected({});
    setOrderPlacedId('');
    setSendError('');
    setRetryText('');
    toast.success('নতুন কথোপকথন শুরু হয়েছে');
  };

  const resizeComposer = (target: HTMLTextAreaElement) => {
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f4f5f7] p-0 sm:p-6">
        <div className="mx-auto flex h-[100dvh] max-w-3xl animate-pulse flex-col overflow-hidden bg-white sm:h-[min(760px,calc(100dvh-3rem))] sm:rounded-[28px] sm:border sm:border-zinc-200 sm:shadow-2xl">
          <div className="h-20 bg-zinc-900" />
          <div className="flex-1 space-y-5 p-6">
            <div className="h-20 w-2/3 rounded-2xl bg-zinc-100" />
            <div className="ml-auto h-14 w-1/2 rounded-2xl bg-zinc-100" />
            <div className="h-24 w-3/4 rounded-2xl bg-zinc-100" />
          </div>
          <div className="m-4 h-16 rounded-2xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  if (!business || loadError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 p-6 text-center">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/50">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <Store className="h-7 w-7 text-zinc-400" />
          </div>
          <h1 className="text-xl font-extrabold text-zinc-900">
            {loadError ? 'চ্যাট লোড করা যায়নি' : 'স্টোর খুঁজে পাওয়া যায়নি'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {loadError
              ? 'ইন্টারনেট সংযোগ যাচাই করে পেজটি আবার লোড করুন।'
              : 'লিংকটি সঠিক কিনা যাচাই করুন অথবা হোমপেজে ফিরে যান।'}
          </p>
          {loadError ? (
            <Button onClick={() => window.location.reload()} className="mt-6 w-full rounded-xl bg-zinc-900 text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> আবার চেষ্টা করুন
            </Button>
          ) : (
            <Link to="/" className="mt-6 block">
              <Button className="w-full rounded-xl bg-zinc-900 text-white">হোমপেজে যান</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_top_left,#fff7ed,transparent_35%),#f4f5f7] p-0 sm:p-6">
      <section
        aria-label={`${business.name} কাস্টমার চ্যাট`}
        className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white sm:h-[min(760px,calc(100dvh-3rem))] sm:rounded-[28px] sm:border sm:border-zinc-200/80 sm:shadow-[0_24px_80px_-28px_rgba(24,24,27,0.35)]"
      >
        <header className="relative shrink-0 overflow-hidden bg-zinc-950 px-4 pb-4 pt-safe text-white sm:px-6 sm:py-5">
          <div className="absolute -right-12 -top-20 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-lg">
                {business.logoUrl ? (
                  <img src={business.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-black">
                    {business.name?.slice(0, 1) || 'S'}
                  </div>
                )}
                <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${aiOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-extrabold sm:text-lg">{business.name}</h1>
                  {business.verificationStatus === 'verified' && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 fill-sky-500 text-white" aria-label="ভেরিফায়েড স্টোর" />
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-300 sm:text-xs">
                  {aiOnline ? <Bot className="h-3.5 w-3.5 text-orange-400" /> : <Headphones className="h-3.5 w-3.5 text-amber-400" />}
                  {aiOnline ? 'AI সহকারী অনলাইনে' : 'সাপোর্ট টিম আপনার মেসেজ নেবে'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              title="কথোপকথন মুছুন"
              aria-label="কথোপকথন মুছুন"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        {(orderPlacedId || orderProgress.complete > 0) && (
          <div className="shrink-0 border-b border-zinc-100 bg-white px-4 py-2.5 sm:px-6">
            {orderPlacedId ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <PackageCheck className="h-4 w-4" />
                অর্ডার গ্রহণ করা হয়েছে
                <span className="ml-auto font-mono text-[10px] font-medium text-zinc-500">{orderPlacedId}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-[11px] font-bold text-zinc-600">অর্ডার তথ্য</span>
                <div className="flex flex-1 items-center gap-1.5">
                  {orderProgress.fields.map((field) => (
                    <span
                      key={field.label}
                      title={field.label}
                      className={`h-1.5 flex-1 rounded-full ${field.complete ? 'bg-emerald-500' : 'bg-zinc-200'}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-zinc-400">{orderProgress.complete}/৪</span>
              </div>
            )}
          </div>
        )}

        <div
          className="momentum-scroll flex-1 overflow-y-auto bg-[#f7f7f8] px-4 py-5 sm:px-6 sm:py-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="space-y-5">
            {messages.map((message) => {
              const product = message.role === 'assistant'
                ? findProduct(business.products, message.aiMetadata?.product_name)
                : undefined;
              const productImages = product
                && isFeatureEnabled(business.features, 'imageDisplayEnabled')
                && message.aiMetadata?.show_product_image
                ? (product.images || []).slice(0, 3)
                : [];
              const reviewImages = product
                && isFeatureEnabled(business.features, 'reviewImagesEnabled')
                && message.aiMetadata?.show_review_images
                ? (product.reviewImages || []).slice(0, 3)
                : [];

              return (
                <article
                  key={message.id}
                  className={`flex gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    message.role === 'user'
                      ? 'bg-zinc-200 text-zinc-600'
                      : 'bg-zinc-950 text-orange-400 shadow-sm'
                  }`}>
                    {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`max-w-[82%] sm:max-w-[74%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-3 text-[13px] font-medium leading-6 sm:text-sm ${
                      message.role === 'user'
                        ? 'rounded-tr-md bg-zinc-950 text-white shadow-sm'
                        : 'rounded-tl-md border border-zinc-200/80 bg-white text-zinc-800 shadow-sm'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>

                      {(productImages.length > 0 || reviewImages.length > 0) && product && (
                        <div className="mt-3 border-t border-zinc-100 pt-3">
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-zinc-700">
                            {reviewImages.length ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <ShoppingBag className="h-3.5 w-3.5 text-orange-600" />}
                            {reviewImages.length ? 'কাস্টমার রিভিউ' : product.name}
                          </div>
                          <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                            {[...productImages, ...reviewImages].map((image, index) => (
                              <img
                                key={`${image}-${index}`}
                                src={image}
                                alt={reviewImages.includes(image) ? `${product.name} কাস্টমার রিভিউ` : product.name}
                                className="h-32 w-32 shrink-0 snap-start rounded-xl border border-zinc-200 object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] font-medium text-zinc-400 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <span>{messageTime(message.timestamp)}</span>
                      {message.role === 'user' && <Check className="h-3 w-3" aria-label="পাঠানো হয়েছে" />}
                    </div>
                  </div>
                </article>
              );
            })}

            {isSending && (
              <div className="flex items-start gap-2.5" aria-label="সহকারী উত্তর লিখছে">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-orange-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-md border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sendError && (
              <div role="alert" className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center">
                <p className="text-xs font-medium leading-5 text-rose-700">{sendError}</p>
                <button
                  type="button"
                  onClick={() => sendMessage(retryText, false)}
                  disabled={isSending}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 underline decoration-rose-300 underline-offset-4 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> আবার চেষ্টা করুন
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-200/70 bg-white">
          {messages.length <= 4 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1 pt-3 sm:px-6">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="group flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {prompt}
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
            className="px-3 pb-safe pt-3 sm:px-5"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5 shadow-inner transition-within focus-within:border-orange-300 focus-within:ring-4 focus-within:ring-orange-500/10">
              <label htmlFor="chat-message" className="sr-only">আপনার মেসেজ</label>
              <textarea
                ref={textareaRef}
                id="chat-message"
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  resizeComposer(event.target);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
                disabled={isSending}
                placeholder="আপনার প্রশ্ন বা অর্ডার লিখুন…"
                className="max-h-[120px] min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-base leading-5 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 sm:text-sm"
              />
              <Button
                type="submit"
                aria-label="মেসেজ পাঠান"
                disabled={isSending || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-xl bg-orange-600 p-0 text-white shadow-md shadow-orange-600/20 hover:bg-orange-700 disabled:shadow-none"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-medium text-zinc-400">
              <LockKeyhole className="h-3 w-3" />
              ব্যক্তিগত তথ্য সুরক্ষিত রাখুন · AI-এর উত্তর যাচাই করে সিদ্ধান্ত নিন
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

