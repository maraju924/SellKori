import React from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { CheckCircle2, PackageSearch } from 'lucide-react';
import type { PublicShopOrder } from '../../lib/shopApi';
import { shopPath } from '../../lib/storefront';
import { formatMoney, statusLabel } from '../../lib/orderUtils';
import { Button } from '../ui/button';
import type { ShopOutletContext } from './ShopLayout';

export function ShopOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { business } = useOutletContext<ShopOutletContext>();
  const location = useLocation();
  const order = (location.state as { order?: PublicShopOrder } | null)?.order;

  return (
    <div className="max-w-lg mx-auto bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 text-center space-y-4">
      <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
      <h1 className="text-2xl font-black">অর্ডার সম্পন্ন</h1>
      <p className="text-sm text-zinc-500">
        {business.name} আপনার অর্ডার পেয়েছে। শিপিংয়ের আগে ফোন করে কনফার্ম করা হতে পারে।
      </p>
      <div className="bg-zinc-50 rounded-2xl p-4 text-left space-y-2 text-sm">
        <p className="flex justify-between"><span className="text-zinc-500">অর্ডার আইডি</span><span className="font-mono font-bold">{order?.id || orderId}</span></p>
        {order && (
          <>
            <p className="flex justify-between"><span className="text-zinc-500">স্ট্যাটাস</span><span className="font-bold">{statusLabel(order.status)}</span></p>
            <p className="flex justify-between"><span className="text-zinc-500">মোট · COD</span><span className="font-black text-orange-600">{formatMoney(order.totalPrice)}</span></p>
            <div className="pt-2 border-t border-zinc-200 space-y-1">
              {(order.items || []).map(item => (
                <p key={item.productId} className="flex justify-between text-zinc-600">
                  <span>{item.productName} × {item.quantity}</span>
                  <span>{formatMoney(item.lineTotal)}</span>
                </p>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Link to={shopPath(business.id, 'track')} className="flex-1">
          <Button className="w-full h-11 rounded-xl bg-zinc-900 text-white font-bold">
            <PackageSearch className="w-4 h-4 mr-1.5" /> অর্ডার ট্র্যাক
          </Button>
        </Link>
        <Link to={shopPath(business.id)} className="flex-1">
          <Button variant="outline" className="w-full h-11 rounded-xl font-bold">আরও কিনুন</Button>
        </Link>
      </div>
    </div>
  );
}
