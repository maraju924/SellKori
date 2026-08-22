import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import type { Product } from '../../types';
import { productPath } from '../../lib/storefront';
import { Button } from '../ui/button';
import { ShopImage, ShopMoney, StockHint, productThumb } from './ShopPrimitives';
import { useShopCart } from './ShopCartContext';
import { toast } from 'sonner';

export function ShopProductCard({
  businessId,
  product,
}: {
  businessId: string;
  product: Product;
  key?: React.Key;
}) {
  const cart = useShopCart();
  const href = productPath(businessId, product.id);

  const add = (event: React.MouseEvent) => {
    event.preventDefault();
    cart.addItem(product.id, 1);
    toast.success('কার্টে যোগ হয়েছে', { description: product.name });
  };

  return (
    <article className="group bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-orange-200 transition-all">
      <Link to={href} className="block">
        <div className="relative aspect-square overflow-hidden">
          <ShopImage
            src={productThumb(product)}
            alt={product.name}
            className="w-full h-full group-hover:scale-[1.03] transition-transform duration-300"
          />
          {product.category ? (
            <span className="absolute top-2 left-2 text-[10px] font-bold bg-white/90 text-zinc-700 px-2 py-0.5 rounded-full">
              {product.category}
            </span>
          ) : null}
        </div>
        <div className="p-3.5 space-y-2">
          <h3 className="font-bold text-sm text-zinc-900 line-clamp-2 min-h-10 leading-5">
            {product.name}
          </h3>
          <ShopMoney amount={product.price} className="block text-base font-black text-orange-600" />
          <StockHint product={product} />
        </div>
      </Link>
      <div className="px-3.5 pb-3.5">
        <Button
          onClick={add}
          className="w-full h-10 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
        >
          <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
          কার্টে রাখুন
        </Button>
      </div>
    </article>
  );
}
