import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BadgeCheck, MessageCircle, Shield, Truck } from 'lucide-react';
import { filterShopProducts, shopCategorySummaries, shopPath } from '../../lib/storefront';
import { absoluteUrl, shopSeoDescription, shopSeoTitle } from '../../lib/productSeo';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { ShopProductCard } from './ShopProductCard';
import { ShopCategoryGrid } from './ShopCategoryGrid';
import type { ShopOutletContext } from './ShopLayout';
import { Link } from 'react-router-dom';

export function ShopHome() {
  const { business, search } = useOutletContext<ShopOutletContext>();
  const products = business.products || [];
  const categories = useMemo(() => shopCategorySummaries(products), [products]);
  const visible = useMemo(
    () => filterShopProducts(products, search),
    [products, search]
  );
  const inside = business.courierConfig?.deliveryChargeInsideDhaka || 70;
  const outside = business.courierConfig?.deliveryChargeOutsideDhaka || 130;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  useDocumentMeta({
    title: shopSeoTitle(business),
    description: shopSeoDescription(business),
    url: absoluteUrl(origin, shopPath(business)),
    image: business.logoUrl,
    type: 'website',
  });

  return (
    <div className="space-y-8">
      <section className="bg-zinc-900 text-white rounded-3xl p-6 sm:p-8 overflow-hidden relative">
        <div className="relative z-10 max-w-xl space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300">অনলাইন শপ</p>
          <h1 className="text-2xl sm:text-4xl font-black leading-tight">{business.name}</h1>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {business.description || 'পণ্য দেখুন, কার্টে রাখুন, ক্যাশ অন ডেলিভারিতে অর্ডার করুন। প্রশ্ন থাকলে চ্যাটে লিখুন।'}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full">
              <Truck className="w-3.5 h-3.5" /> COD সারা দেশে
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full">
              <Shield className="w-3.5 h-3.5" /> ঢাকা ৳{inside} · বাইরে ৳{outside}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded-full">
              <BadgeCheck className="w-3.5 h-3.5" /> {visible.length} টি পণ্য
            </span>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-10 w-48 h-48 rounded-full bg-orange-600/30 blur-2xl" />
      </section>

      {categories.length > 0 && !search && (
        <section id="categories" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-black">ক্যাটাগরি</h2>
            <Link to={shopPath(business, 'c')} className="text-xs font-bold text-orange-600 hover:text-orange-700">
              সব দেখুন
            </Link>
          </div>
          <ShopCategoryGrid shop={business} categories={categories} />
        </section>
      )}

      <section id="products" className="space-y-3">
        <h2 className="text-lg font-black">{search ? 'খোঁজার ফল' : 'সব পণ্য'}</h2>
        {visible.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
            {search ? 'এই খোঁজে কোনো পণ্য নেই।' : 'এই মুহূর্তে কোনো পণ্য যোগ করা নেই।'}
            <div className="mt-4">
              <Link to={`/chat/${business.id}`} className="inline-flex items-center gap-1.5 font-bold text-orange-600">
                <MessageCircle className="w-4 h-4" /> চ্যাটে জিজ্ঞাসা করুন
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {visible.map(product => (
              <ShopProductCard key={product.id} business={business} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
