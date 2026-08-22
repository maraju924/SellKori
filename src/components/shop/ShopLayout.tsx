import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  MapPin,
  MessageCircle,
  PackageSearch,
  Phone,
  Search,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BusinessConfig } from '../../types';
import { fetchShop } from '../../lib/shopApi';
import { asProductList } from '../../lib/productCatalog';
import { shopPath } from '../../lib/storefront';
import { ShopCartProvider, useShopCart } from './ShopCartContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface ShopOutletContext {
  business: BusinessConfig;
  search: string;
  setSearch: (value: string) => void;
}

function injectPixel(pixelId: string) {
  const w = window as any;
  if (!pixelId || w.fbq) return;
  // eslint-disable-next-line
  (function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return;
    const n: any = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  w.fbq('init', pixelId);
  w.fbq('track', 'PageView');
}

function ShopHeader({ business, search, setSearch }: {
  business: BusinessConfig;
  search: string;
  setSearch: (value: string) => void;
}) {
  const { itemCount } = useShopCart();
  const base = shopPath(business.id);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="flex items-center gap-2.5 py-2.5">
          <Link to={base} className="flex items-center gap-2 min-w-0 shrink-0">
            {business.logoUrl ? (
              <img src={business.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-zinc-200" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 hidden xs:block sm:block">
              <p className="font-black text-sm text-zinc-900 truncate max-w-[140px] sm:max-w-[220px]">
                {business.name}
              </p>
              <p className="text-[10px] text-zinc-500 truncate">অনলাইন শপ · ক্যাশ অন ডেলিভারি</p>
            </div>
          </Link>

          <form
            className="flex-1 min-w-0"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="পণ্য খুঁজুন..."
                className="h-10 pl-9 rounded-xl bg-zinc-50 border-zinc-200 text-sm"
              />
            </div>
          </form>

          <Link to={shopPath(business.id, 'track')} className="hidden sm:flex">
            <Button variant="ghost" className="h-10 rounded-xl text-xs font-bold">
              <PackageSearch className="w-4 h-4 mr-1.5" />
              ট্র্যাক
            </Button>
          </Link>
          <Link to={`/chat/${business.id}`} className="hidden sm:flex">
            <Button variant="ghost" className="h-10 rounded-xl text-xs font-bold">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              চ্যাট
            </Button>
          </Link>
          <Link to={shopPath(business.id, 'cart')} className="relative">
            <Button className="h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3">
              <ShoppingBag className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline">কার্ট</span>
            </Button>
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-zinc-900 text-white text-[10px] font-black flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function ShopFooter({ business }: { business: BusinessConfig }) {
  const inside = business.courierConfig?.deliveryChargeInsideDhaka || 70;
  const outside = business.courierConfig?.deliveryChargeOutsideDhaka || 130;
  return (
    <footer className="mt-12 border-t border-zinc-200 bg-white pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8 text-sm">
        <div>
          <p className="font-black text-zinc-900">{business.name}</p>
          <p className="mt-2 text-zinc-500 leading-relaxed">
            {business.description || 'ক্যাশ অন ডেলিভারিতে অর্ডার করুন। প্রশ্ন থাকলে চ্যাটে লিখুন।'}
          </p>
        </div>
        <div className="space-y-2 text-zinc-600">
          {business.phone && (
            <a href={`tel:${business.phone}`} className="flex items-center gap-2 hover:text-orange-600">
              <Phone className="w-4 h-4" /> {business.phone}
            </a>
          )}
          {business.address && (
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {business.address}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> ঢাকা ৳{inside} · ঢাকার বাইরে ৳{outside}
          </p>
        </div>
        <div className="space-y-2">
          <Link to={shopPath(business.id, 'track')} className="block font-bold text-zinc-800 hover:text-orange-600">অর্ডার ট্র্যাক করুন</Link>
          <Link to={`/chat/${business.id}`} className="block font-bold text-zinc-800 hover:text-orange-600">এআই সেলস চ্যাট</Link>
          <p className="text-xs text-zinc-400 pt-2">পেমেন্ট: ক্যাশ অন ডেলিভারি</p>
        </div>
      </div>
    </footer>
  );
}

function ShopMobileNav({ businessId }: { businessId: string }) {
  const { itemCount } = useShopCart();
  const items = [
    { to: shopPath(businessId), label: 'হোম', icon: Home, end: true },
    { to: `${shopPath(businessId)}#products`, label: 'পণ্য', icon: LayoutGrid },
    { to: shopPath(businessId, 'cart'), label: 'কার্ট', icon: ShoppingBag, badge: itemCount },
    { to: shopPath(businessId, 'track'), label: 'ট্র্যাক', icon: PackageSearch },
    { to: `/chat/${businessId}`, label: 'চ্যাট', icon: MessageCircle },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 pb-safe">
      <div className="grid grid-cols-5">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${
                  isActive ? 'text-orange-600' : 'text-zinc-500'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
              {item.badge ? (
                <span className="absolute top-1 right-1/4 min-w-4 h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function ShopFrame({ business }: { business: BusinessConfig }) {
  const [search, setSearch] = useState('');
  const ctx = useMemo<ShopOutletContext>(() => ({ business, search, setSearch }), [business, search]);

  return (
    <div className="min-h-screen bg-[#f7f5f2] text-zinc-900">
      <ShopHeader business={business} search={search} setSearch={setSearch} />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5">
        <Outlet context={ctx} />
      </main>
      <ShopFooter business={business} />
      <ShopMobileNav businessId={business.id} />
    </div>
  );
}

export function ShopLayout() {
  const { businessId } = useParams<{ businessId: string }>();
  const [business, setBusiness] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!businessId) {
      setMissing(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchShop(businessId)
      .then((shop) => {
        if (cancelled) return;
        if (!shop) {
          setMissing(true);
          return;
        }
        setBusiness({ ...shop, products: asProductList(shop.products) });
        document.title = `${shop.name} — অনলাইন শপ`;
        const pixelId = String(shop.facebookPixelId || shop.facebookConfig?.pixelId || '');
        if (pixelId) injectPixel(pixelId);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
          toast.error('স্টোর লোড করা যায়নি');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f5f2] flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center">
          <Store className="w-6 h-6" />
        </div>
        <p className="mt-3 text-xs tracking-widest uppercase text-zinc-400">দোকান খুলছে...</p>
      </div>
    );
  }

  if (missing || !business || !businessId) {
    return (
      <div className="min-h-screen bg-[#f7f5f2] flex flex-col items-center justify-center px-6 text-center">
        <Store className="w-10 h-10 text-zinc-400" />
        <h1 className="mt-4 text-xl font-black">দোকানটি পাওয়া যায়নি</h1>
        <p className="mt-2 text-sm text-zinc-500">লিংকটি ভুল হতে পারে, অথবা স্টোরটি এখন বন্ধ আছে।</p>
        <Link to="/" className="mt-6 text-sm font-bold text-orange-600">SellKori হোমে যান</Link>
      </div>
    );
  }

  return (
    <ShopCartProvider businessId={businessId}>
      <ShopFrame business={business} />
    </ShopCartProvider>
  );
}
