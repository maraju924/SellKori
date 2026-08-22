import React, { useMemo } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import type { BusinessConfig } from '../../types';
import {
  categoryPath,
  filterShopProducts,
  matchShopCategory,
  productPath,
  publicProductImage,
  shopCategorySummaries,
  shopPath,
} from '../../lib/storefront';
import {
  absoluteUrl,
  categoryJsonLd,
  categorySeoDescription,
  categorySeoTitle,
  shopSeoDescription,
  shopSeoTitle,
} from '../../lib/productSeo';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { ShopProductCard } from './ShopProductCard';
import { ShopCategoryGrid } from './ShopCategoryGrid';
import type { ShopOutletContext } from './ShopLayout';

function CategoryCrumb({
  shop,
  current,
}: {
  shop: BusinessConfig;
  current?: string;
}) {
  return (
    <nav aria-label="breadcrumb" className="text-[12px] text-zinc-500">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        <li>
          <Link to={shopPath(shop)} className="hover:text-orange-600">{shop.name || 'দোকান'}</Link>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-zinc-300">/</span>
          {current ? (
            <Link to={shopPath(shop, 'c')} className="hover:text-orange-600">ক্যাটাগরি</Link>
          ) : (
            <span className="text-zinc-800">ক্যাটাগরি</span>
          )}
        </li>
        {current && (
          <li className="flex items-center gap-1.5 min-w-0">
            <span className="text-zinc-300">/</span>
            <span className="text-zinc-800 truncate max-w-[220px]">{current}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}

export function ShopCategoryIndex() {
  const { business, search } = useOutletContext<ShopOutletContext>();
  const categories = useMemo(
    () => shopCategorySummaries(filterShopProducts(business.products || [], search)),
    [business.products, search]
  );
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = absoluteUrl(origin, shopPath(business, 'c'));
  useDocumentMeta({
    title: `ক্যাটাগরি | ${business.name}`.slice(0, 70),
    description: shopSeoDescription(business),
    url,
    image: business.logoUrl,
    type: 'website',
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `${business.name} ক্যাটাগরি`,
      url,
    }],
  });

  return (
    <div className="space-y-6">
      <CategoryCrumb shop={business} />
      <div>
        <h1 className="text-2xl font-black">ক্যাটাগরি</h1>
        <p className="mt-1 text-sm text-zinc-500">পণ্যের ধরন বেছে নিয়ে দেখুন।</p>
      </div>
      {categories.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
          {search ? 'এই খোঁজে কোনো ক্যাটাগরি নেই।' : 'এখনো কোনো ক্যাটাগরি যোগ হয়নি।'}
        </div>
      ) : (
        <ShopCategoryGrid shop={business} categories={categories} />
      )}
    </div>
  );
}

export function ShopCategory() {
  const { categoryKey } = useParams<{ categoryKey: string }>();
  const { business, search } = useOutletContext<ShopOutletContext>();
  const products = business.products || [];
  const category = matchShopCategory(products, categoryKey);
  const visible = useMemo(
    () => (category ? filterShopProducts(products, search, category) : []),
    [category, products, search]
  );
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = category ? categoryPath(business, category) : shopPath(business, 'c');
  const url = absoluteUrl(origin, path);
  const image = visible[0] ? publicProductImage(visible[0]) : business.logoUrl;

  useDocumentMeta({
    title: category ? categorySeoTitle(category, business.name) : shopSeoTitle(business),
    description: category
      ? categorySeoDescription(category, visible.length, business.name)
      : shopSeoDescription(business),
    url,
    image,
    type: 'website',
    jsonLd: category
      ? categoryJsonLd({
          category,
          shopName: business.name,
          url,
          image,
          products: visible.map(product => ({
            name: product.name,
            url: absoluteUrl(origin, productPath(business, product)),
          })),
          crumbs: [
            { name: business.name, url: absoluteUrl(origin, shopPath(business)) },
            { name: 'ক্যাটাগরি', url: absoluteUrl(origin, shopPath(business, 'c')) },
            { name: category, url },
          ],
        })
      : [],
  });

  if (!category) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
        <p className="font-bold">ক্যাটাগরি পাওয়া যায়নি</p>
        <Link to={shopPath(business, 'c')} className="mt-3 inline-block text-sm text-orange-600 font-bold">
          সব ক্যাটাগরি
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link to={shopPath(business, 'c')} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-orange-600">
          <ChevronLeft className="w-4 h-4" /> সব ক্যাটাগরি
        </Link>
        <CategoryCrumb shop={business} current={category} />
      </div>
      <div>
        <h1 className="text-2xl sm:text-3xl font-black">{category}</h1>
        <p className="mt-1 text-sm text-zinc-500">{visible.length}টি পণ্য</p>
      </div>
      {visible.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
          {search ? 'এই খোঁজে এই ক্যাটাগরিতে পণ্য নেই।' : 'এই ক্যাটাগরিতে এখন পণ্য নেই।'}
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
    </div>
  );
}
