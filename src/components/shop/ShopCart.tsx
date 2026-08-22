import React from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { productPath, resolveCart, shopPath } from '../../lib/storefront';
import { Button } from '../ui/button';
import { ShopImage, ShopMoney } from './ShopPrimitives';
import { useShopCart } from './ShopCartContext';
import type { ShopOutletContext } from './ShopLayout';

export function ShopCart() {
  const { business } = useOutletContext<ShopOutletContext>();
  const cart = useShopCart();
  const navigate = useNavigate();
  const totals = resolveCart(business.products, cart.items, { business });

  if (totals.lines.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center space-y-3">
        <p className="text-lg font-black">কার্ট খালি</p>
        <p className="text-sm text-zinc-500">পণ্য দেখে কার্টে রাখুন, তারপর ক্যাশ অন ডেলিভারিতে অর্ডার করুন।</p>
        <Link to={shopPath(business)}>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold">কেনাকাটা শুরু করুন</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="space-y-3">
        <h1 className="text-xl font-black">আপনার কার্ট</h1>
        {totals.lines.map(line => (
          <div key={`${line.product.id}::${line.variant || ''}`} className="bg-white border border-zinc-200 rounded-2xl p-3.5 flex gap-3">
            <ShopImage src={line.product.images?.[0]} alt={line.product.name} className="w-20 h-20 rounded-xl shrink-0" />
            <div className="min-w-0 flex-1">
              <Link to={productPath(business, line.product)} className="font-bold text-sm line-clamp-2 hover:text-orange-600">
                {line.product.name}
              </Link>
              {line.variant && <p className="text-[11px] text-zinc-500 mt-0.5">{line.variant}</p>}
              <ShopMoney amount={line.unitPrice} className="block text-xs text-orange-600 font-bold mt-1" />
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center border border-zinc-200 rounded-lg">
                  <button className="w-8 h-8" onClick={() => cart.setQuantity(line.product.id, line.quantity - 1, line.variant)}>−</button>
                  <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                  <button className="w-8 h-8" onClick={() => cart.setQuantity(line.product.id, line.quantity + 1, line.variant)}>+</button>
                </div>
                <button onClick={() => cart.removeItem(line.product.id, line.variant)} className="text-zinc-400 hover:text-rose-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <ShopMoney amount={line.lineTotal} className="font-black text-sm shrink-0" />
          </div>
        ))}
      </div>

      <aside className="bg-white border border-zinc-200 rounded-2xl p-5 h-fit space-y-3 sticky top-20">
        <h2 className="font-black">অর্ডার সারাংশ</h2>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">পণ্য ({totals.itemCount})</span>
          <ShopMoney amount={totals.subtotal} className="font-bold" />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">ডেলিভারি (ঢাকার ভিতরে)</span>
          <ShopMoney amount={business.courierConfig?.deliveryChargeInsideDhaka || 70} className="font-bold" />
        </div>
        <p className="text-[11px] text-zinc-400">ঠিকানা অনুযায়ী চার্জ চেকআউটে চূড়ান্ত হবে। ঢাকার বাইরে ৳{business.courierConfig?.deliveryChargeOutsideDhaka || 130}।</p>
        <Button
          onClick={() => navigate(shopPath(business, 'checkout'))}
          className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black"
        >
          চেকআউটে যান
        </Button>
      </aside>
    </div>
  );
}
