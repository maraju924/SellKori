import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { checkoutShop } from '../../lib/shopApi';
import {
  BD_DISTRICTS,
  addressLooksInsideDhaka,
  resolveCart,
  shopPath,
  validateShopCheckout,
} from '../../lib/storefront';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { ShopMoney } from './ShopPrimitives';
import { useShopCart } from './ShopCartContext';
import type { ShopOutletContext } from './ShopLayout';

export function ShopCheckout() {
  const { business } = useOutletContext<ShopOutletContext>();
  const cart = useShopCart();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('ঢাকা');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [insideDhaka, setInsideDhaka] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(
    () => resolveCart(business.products, cart.items, { address: `${address}, ${district}`, insideDhaka, business }),
    [address, business, cart.items, district, insideDhaka]
  );

  if (cart.items.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-3xl p-10 text-center">
        <p className="font-black">চেকআউটের আগে কার্টে পণ্য রাখুন</p>
        <Link to={shopPath(business)} className="mt-3 inline-block text-sm font-bold text-orange-600">দোকানে যান</Link>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const customer = { name, phone, address, district, notes, insideDhaka };
    const issues = validateShopCheckout(business.products, cart.items, customer);
    if (issues.length) {
      toast.error(issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const result = await checkoutShop({
        businessId: business.id,
        items: cart.items,
        customer,
        sessionId: cart.sessionId,
      });
      cart.clear();
      toast.success('অর্ডার কনফার্ম হয়েছে');
      navigate(shopPath(business, `order/${encodeURIComponent(result.order.id)}`), {
        state: { order: result.order },
      });
    } catch (error: any) {
      toast.error(error?.message || 'অর্ডার হয়নি। আবার চেষ্টা করুন।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-[1fr_340px] gap-5">
      <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-6 space-y-4">
        <h1 className="text-xl font-black">ডেলিভারি তথ্য</h1>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-bold">
            আপনার নাম
            <Input value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl" placeholder="যেমন: আব্দুল করিম" required />
          </label>
          <label className="space-y-1 text-xs font-bold">
            মোবাইল নম্বর
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-11 rounded-xl font-mono" placeholder="01XXXXXXXXX" required />
          </label>
        </div>
        <label className="space-y-1 text-xs font-bold block">
          জেলা
          <select
            value={district}
            onChange={e => {
              setDistrict(e.target.value);
              setInsideDhaka(e.target.value === 'ঢাকা');
            }}
            className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
          >
            {BD_DISTRICTS.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold block">
          সম্পূর্ণ ঠিকানা
          <Textarea
            value={address}
            onChange={e => {
              setAddress(e.target.value);
              if (addressLooksInsideDhaka(`${e.target.value} ${district}`)) setInsideDhaka(true);
            }}
            className="min-h-24 rounded-xl"
            placeholder="বাড়ি/রোড, এলাকা, থানা"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={insideDhaka}
            onChange={e => setInsideDhaka(e.target.checked)}
            className="rounded"
          />
          ঢাকার ভিতরে ডেলিভারি
        </label>
        <label className="space-y-1 text-xs font-bold block">
          নোট (ঐচ্ছিক)
          <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-11 rounded-xl" placeholder="কালার/সাইজ বা ডেলিভারি সময়" />
        </label>
      </div>

      <aside className="bg-white border border-zinc-200 rounded-3xl p-5 h-fit space-y-3">
        <h2 className="font-black">পেমেন্ট ও মোট</h2>
        {totals.lines.map(line => (
          <div key={line.product.id} className="flex justify-between text-sm gap-3">
            <span className="text-zinc-600 truncate">{line.product.name} × {line.quantity}</span>
            <ShopMoney amount={line.lineTotal} className="font-bold shrink-0" />
          </div>
        ))}
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">ডেলিভারি</span>
          <ShopMoney amount={totals.deliveryFee} className="font-bold" />
        </div>
        <div className="flex justify-between text-base pt-2 border-t border-zinc-100">
          <span className="font-black">সর্বমোট · COD</span>
          <ShopMoney amount={totals.total} className="font-black text-orange-600" />
        </div>
        <p className="text-[11px] text-zinc-400">পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে টাকা দিবেন। অগ্রিম পেমেন্ট লাগবে না।</p>
        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black"
        >
          {submitting ? 'অর্ডার হচ্ছে...' : 'অর্ডার কনফার্ম করুন'}
        </Button>
      </aside>
    </form>
  );
}
