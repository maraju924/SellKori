import React from 'react';
import { Link } from 'react-router-dom';
import type { BusinessConfig } from '../../types';
import { categoryPath, type ShopCategorySummary } from '../../lib/storefront';
import { ShopImage } from './ShopPrimitives';

export function ShopCategoryGrid({
  shop,
  categories,
}: {
  shop: BusinessConfig;
  categories: ShopCategorySummary[];
}) {
  if (!categories.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {categories.map(item => (
        <Link
          key={item.name}
          to={categoryPath(shop, item.name)}
          className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-orange-200 hover:shadow-sm transition-colors"
        >
          <ShopImage
            src={item.image}
            alt={item.name}
            className="aspect-[4/3] w-full group-hover:scale-[1.02] transition-transform duration-300"
          />
          <div className="px-3 py-2.5">
            <h3 className="font-bold text-sm text-zinc-900 truncate">{item.name}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">{item.count}টি পণ্য</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
