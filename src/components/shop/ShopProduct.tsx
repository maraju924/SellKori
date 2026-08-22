import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft, MessageCircle, ShoppingBag, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { findShopProduct, maxBuyableQuantity, relatedShopProducts, shopPath } from '../../lib/storefront';
import { Button } from '../ui/button';
import { ShopImage, ShopMoney, StockHint } from './ShopPrimitives';
import { ShopProductCard } from './ShopProductCard';
import { useShopCart } from './ShopCartContext';
import type { ShopOutletContext } from './ShopLayout';

export function ShopProduct() {
  const { productId } = useParams<{ productId: string }>();
  const { business } = useOutletContext<ShopOutletContext>();
  const cart = useShopCart();
  const navigate = useNavigate();
  const product = findShopProduct(business.products || [], productId);
  const images = product?.images?.filter(Boolean) || [];
  const reviews = product?.reviewImages?.filter(Boolean) || [];
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const maxQty = product ? maxBuyableQuantity(product) : 1;
  const related = useMemo(
    () => (product ? relatedShopProducts(business.products || [], product) : []),
    [business.products, product]
  );
  const faqs = (business.faqs || []).filter(
    faq => faq.isActive !== false && (faq.productId === product?.id || faq.type === 'general')
  ).slice(0, 6);

  if (!product) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
        <p className="font-bold">পণ্যটি পাওয়া যায়নি</p>
        <Link to={shopPath(business)} className="mt-3 inline-block text-sm text-orange-600 font-bold">দোকানে ফিরুন</Link>
      </div>
    );
  }

  const add = (buyNow = false) => {
    cart.addItem(product.id, qty);
    toast.success(buyNow ? 'চেকআউটে যাচ্ছেন' : 'কার্টে যোগ হয়েছে', { description: product.name });
    if (buyNow) navigate(shopPath(business, 'checkout'));
  };

  return (
    <div className="space-y-8">
      <Link to={shopPath(business)} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-orange-600">
        <ChevronLeft className="w-4 h-4" /> সব পণ্য
      </Link>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="space-y-3">
          <ShopImage
            src={images[active] || images[0]}
            alt={product.name}
            className="w-full aspect-square rounded-3xl"
          />
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, index) => (
                <button
                  key={src + index}
                  onClick={() => setActive(index)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border ${active === index ? 'border-orange-600' : 'border-zinc-200'}`}
                >
                  <ShopImage src={src} alt="" className="w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {product.category && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">{product.category}</p>
          )}
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">{product.name}</h1>
          <ShopMoney amount={product.price} className="text-2xl font-black text-orange-600" />
          <StockHint product={product} />
          {product.description && (
            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}
          {product.specs && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 whitespace-pre-line">
              <p className="font-bold text-zinc-900 mb-1">স্পেসিফিকেশন</p>
              {product.specs}
            </div>
          )}

          {product.pricingTiers && product.pricingTiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-500">প্যাক ও অফার</p>
              <div className="flex flex-wrap gap-2">
                {product.pricingTiers.map(tier => (
                  <button
                    key={`${tier.quantity}-${tier.price}`}
                    onClick={() => setQty(Math.min(maxQty, tier.quantity))}
                    className={`px-3 py-2 rounded-xl border text-left text-xs ${
                      qty >= tier.quantity ? 'border-orange-600 bg-orange-50' : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <span className="font-bold block">{tier.label || `${tier.quantity} পিস`}</span>
                    <span className="text-orange-600 font-black">৳{tier.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center border border-zinc-200 rounded-xl bg-white">
              <button className="w-10 h-11 font-black" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button className="w-10 h-11 font-black" onClick={() => setQty(q => Math.min(maxQty, q + 1))}>+</button>
            </div>
            <Button
              onClick={() => add(false)}
              className="flex-1 h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold"
            >
              <ShoppingBag className="w-4 h-4 mr-1.5" /> কার্টে রাখুন
            </Button>
          </div>
          <Button
            onClick={() => add(true)}
            className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black"
          >
            <Zap className="w-4 h-4 mr-1.5" /> এখনই অর্ডার · COD
          </Button>
          <Link
            to={`/chat/${business.id}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-zinc-600 hover:text-orange-600"
          >
            <MessageCircle className="w-4 h-4" /> দাম বা ডেলিভারি নিয়ে চ্যাটে জিজ্ঞাসা করুন
          </Link>
        </div>
      </div>

      {reviews.length > 0 && (
        <section>
          <h2 className="font-black text-lg mb-3">কাস্টমার রিভিউ ছবি</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {reviews.map((src, index) => (
              <ShopImage key={src + index} src={src} alt="রিভিউ" className="aspect-square rounded-2xl" />
            ))}
          </div>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-black text-lg">প্রশ্নোত্তর</h2>
          {faqs.map(faq => (
            <details key={faq.id || faq.question} className="bg-white border border-zinc-200 rounded-2xl px-4 py-3">
              <summary className="font-bold text-sm cursor-pointer">{faq.question}</summary>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{faq.answer}</p>
            </details>
          ))}
        </section>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="font-black text-lg mb-3">আরও দেখুন</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {related.map(item => (
              <ShopProductCard key={item.id} business={business} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
