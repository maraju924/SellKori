import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { trackShopOrders, type PublicShopOrder } from '../../lib/shopApi';
import { formatBdDate, formatMoney, statusLabel } from '../../lib/orderUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { ShopOutletContext } from './ShopLayout';

export function ShopTrack() {
  const { business } = useOutletContext<ShopOutletContext>();
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState<PublicShopOrder[] | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const rows = await trackShopOrders({ businessId: business.id, phone, orderId: orderId.trim() || undefined });
      setOrders(rows);
      if (rows.length === 0) toast.info('এই নম্বরে কোনো অর্ডার পাওয়া যায়নি');
    } catch (error: any) {
      toast.error(error?.message || 'ট্র্যাক করা যায়নি');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black">অর্ডার ট্র্যাক করুন</h1>
        <p className="text-sm text-zinc-500 mt-1">যে মোবাইল নম্বর দিয়ে অর্ডার করেছিলেন, সেটি লিখুন।</p>
      </div>
      <form onSubmit={submit} className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-3">
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-11 rounded-xl font-mono" required />
        <Input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="অর্ডার আইডি (ঐচ্ছিক)" className="h-11 rounded-xl font-mono" />
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold">
          {loading ? 'খোঁজা হচ্ছে...' : 'অর্ডার দেখুন'}
        </Button>
      </form>

      {orders && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map(order => (
            <article key={order.id} className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between gap-3">
                <p className="font-mono text-xs font-bold text-zinc-500">{order.id}</p>
                <span className="text-xs font-black text-orange-600">{statusLabel(order.status)}</span>
              </div>
              <p className="text-sm font-bold">{order.productName}</p>
              <p className="text-xs text-zinc-500">{formatBdDate(order.createdAtMs)} · {formatMoney(order.totalPrice)} COD</p>
              {order.courierTrackingId && (
                <a
                  href={`https://steadfast.com.bd/t/${encodeURIComponent(order.courierTrackingId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-orange-600"
                >
                  কুরিয়ার ট্র্যাকিং: {order.courierTrackingId}
                </a>
              )}
              {order.statusHistory?.length ? (
                <ol className="pt-2 space-y-1">
                  {order.statusHistory.map((event, index) => (
                    <li key={`${event.status}-${event.at}-${index}`} className="text-[11px] text-zinc-500">
                      {statusLabel(event.status)} · {formatBdDate(event.at)}
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
