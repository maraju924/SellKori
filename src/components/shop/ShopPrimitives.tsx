import React from 'react';
import { ImageOff, Package } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatMoney } from '../../lib/orderUtils';
import type { Product } from '../../types';
import { maxBuyableQuantity, publicProductImage } from '../../lib/storefront';

export function ShopMoney({ amount, className }: { amount?: number | null; className?: string }) {
  return <span className={className}>{formatMoney(amount)}</span>;
}

export function ShopImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
  key?: React.Key;
}) {
  if (src) {
    return <img src={src} alt={alt} className={cn('object-cover bg-zinc-100', className)} />;
  }
  return (
    <div className={cn('bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400', className)}>
      <ImageOff className="w-8 h-8" />
    </div>
  );
}

export function StockHint({ product }: { product: Product }) {
  const stock = maxBuyableQuantity(product);
  const tracked = (product.stock || 0) > 0;
  if (!tracked) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
        <Package className="w-3 h-3" />
        অর্ডার করা যাবে
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
        <Package className="w-3 h-3" />
        মাত্র {stock} পিস বাকি
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
      <Package className="w-3 h-3" />
      স্টকে আছে
    </span>
  );
}

export function productThumb(product?: Product | null) {
  return publicProductImage(product || undefined);
}
