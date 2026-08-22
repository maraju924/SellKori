import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronLeft, MessageCircle, ShoppingBag, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  categoryPath,
  findShopProduct,
  maxBuyableQuantity,
  productPath,
  publicProductImage,
  relatedShopProducts,
  shopPath,
} from '../../lib/storefront';
import {
  absoluteUrl,
  decodeProductParam,
  imageAltFor,
  normalizeProductSlug,
  productJsonLd,
  productRatingSummary,
  productSeoDescription,
  productSeoTitle,
} from '../../lib/productSeo';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { sameProductId } from '../../lib/productList';
import { Button } from '../ui/button';
import { ShopImage, ShopMoney, StockHint } from './ShopPrimitives';
import { useShopCart } from './ShopCartContext';
import type { ShopOutletContext } from './ShopLayout';
import {
  OptionChips,
  ProductBlock,
  ProductFaqs,
  ProductHighlights,
  ProductPolicy,
  ProductReviews,
  ProductSpecTable,
  ProductVideo,
  RelatedProducts,
  ShopBreadcrumb,
} from './ShopProductSections';

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
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const maxQty = product ? maxBuyableQuantity(product) : 1;
  const related = useMemo(
    () => (product ? relatedShopProducts(business.products || [], product) : []),
    [business.products, product]
  );
  const storeFaqs = (business.faqs || []).filter(
    faq => faq.isActive !== false && (faq.productId === product?.id || faq.type === 'general')
  );
  const faqs = [
    ...(product?.faqItems || []),
    ...storeFaqs.map(faq => ({ question: faq.question, answer: faq.answer })),
  ].filter((faq, index, list) => list.findIndex(item => item.question === faq.question) === index).slice(0, 12);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonicalPath = product ? productPath(business, product) : '';
  const canonicalUrl = product ? absoluteUrl(origin, canonicalPath) : '';
  const rating = product ? productRatingSummary(product) : null;
  const compareAt = product && (product.compareAtPrice || 0) > product.price ? product.compareAtPrice : 0;
  const discount = compareAt ? Math.round((1 - product!.price / compareAt) * 100) : 0;
  const variant = [color, size].filter(Boolean).join(' / ');

  useEffect(() => {
    if (!product) return;
    const slug = normalizeProductSlug(product.slug);
    if (!slug) return;
    const current = decodeProductParam(productId);
    if (current === slug) return;
    if (sameProductId(product.id, current)) {
      navigate(canonicalPath, { replace: true });
    }
  }, [canonicalPath, navigate, product, productId]);

  useDocumentMeta({
    title: product ? productSeoTitle(product, business.name) : `${business.name} — অনলাইন শপ`,
    description: product ? productSeoDescription(product, business.name) : '',
    url: canonicalUrl,
    image: product ? publicProductImage(product) : '',
    type: product ? 'product' : 'website',
    price: product?.price,
    jsonLd: product
      ? productJsonLd({
          product,
          shop: business,
          url: canonicalUrl,
          image: publicProductImage(product),
          faqs,
          crumbs: [
            { name: business.name, url: absoluteUrl(origin, shopPath(business)) },
            ...(product.category ? [{ name: product.category, url: absoluteUrl(origin, categoryPath(business, product.category)) }] : []),
            { name: product.name, url: canonicalUrl },
          ],
        })
      : [],
  });

  if (!product) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
        <p className="font-bold">পণ্যটি পাওয়া যায়নি</p>
        <Link to={shopPath(business)} className="mt-3 inline-block text-sm text-orange-600 font-bold">দোকানে ফিরুন</Link>
      </div>
    );
  }

  const add = (buyNow = false) => {
    cart.addItem(product.id, qty, variant || undefined);
    toast.success(buyNow ? 'চেকআউটে যাচ্ছেন' : 'কার্টে যোগ হয়েছে', {
      description: variant ? `${product.name} · ${variant}` : product.name,
    });
    if (buyNow) navigate(shopPath(business, 'checkout'));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link to={shopPath(business)} className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-orange-600">
          <ChevronLeft className="w-4 h-4" /> সব পণ্য
        </Link>
        <ShopBreadcrumb shop={business} product={product} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="space-y-3">
          <ShopImage
            src={images[active] || images[0]}
            alt={imageAltFor(product, active)}
            className="w-full aspect-square rounded-3xl"
          />
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, index) => (
                <button
                  key={src + index}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border ${active === index ? 'border-orange-600' : 'border-zinc-200'}`}
                >
                  <ShopImage src={src} alt={imageAltFor(product, index)} className="w-full h-full" />
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
          {(product.brand || product.sku) && (
            <p className="text-xs text-zinc-500">
              {product.brand ? <span>{product.brand}</span> : null}
              {product.brand && product.sku ? ' · ' : ''}
              {product.sku ? <span>SKU {product.sku}</span> : null}
            </p>
          )}
          {rating && (
            <p className="text-sm text-zinc-600">
              {rating.average} / ৫ · {rating.count}টি রিভিউ
              {product.soldCount ? ` · ${product.soldCount} জন কিনেছেন` : ''}
            </p>
          )}
          <div className="flex items-end gap-2.5 flex-wrap">
            <ShopMoney amount={product.price} className="text-2xl font-black text-orange-600" />
            {compareAt ? (
              <>
                <span className="text-sm text-zinc-400 line-through">৳{compareAt}</span>
                {discount > 0 && <span className="text-xs font-bold text-emerald-700">-{discount}%</span>}
              </>
            ) : null}
          </div>
          <StockHint product={product} />
          <ProductHighlights product={product} />
          {product.description && (
            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          <OptionChips label="কালার" options={product.colors || []} value={color} onChange={setColor} />
          <OptionChips label="সাইজ" options={product.sizes || []} value={size} onChange={setSize} />

          {product.pricingTiers && product.pricingTiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-zinc-500">প্যাক ও অফার</p>
              <div className="flex flex-wrap gap-2">
                {product.pricingTiers.map(tier => (
                  <button
                    key={`${tier.quantity}-${tier.price}`}
                    type="button"
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
              <button type="button" className="w-10 h-11 font-black" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="w-8 text-center font-bold">{qty}</span>
              <button type="button" className="w-10 h-11 font-black" onClick={() => setQty(q => Math.min(maxQty, q + 1))}>+</button>
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
          <p className="text-[11px] text-zinc-500">
            ঢাকা ৳{business.courierConfig?.deliveryChargeInsideDhaka || 70} · বাইরে ৳{business.courierConfig?.deliveryChargeOutsideDhaka || 130} · ক্যাশ অন ডেলিভারি
          </p>
          <Link
            to={`/chat/${business.id}`}
            className="flex items-center justify-center gap-2 text-sm font-bold text-zinc-600 hover:text-orange-600"
          >
            <MessageCircle className="w-4 h-4" /> দাম বা ডেলিভারি নিয়ে চ্যাটে জিজ্ঞাসা করুন
          </Link>
        </div>
      </div>

      <ProductSpecTable product={product} />
      <ProductBlock title="সাইজ চার্ট" text={product.sizeGuide} />
      <ProductBlock title="বক্সে যা থাকবে" text={product.boxContents} />
      <ProductBlock title="দেখাশোনার নিয়ম" text={product.careInstructions} />
      <ProductBlock title="কার জন্য" text={product.suitableFor} />
      <ProductVideo url={product.videoUrl} />
      <ProductPolicy
        product={product}
        inside={business.courierConfig?.deliveryChargeInsideDhaka || 70}
        outside={business.courierConfig?.deliveryChargeOutsideDhaka || 130}
      />
      <ProductReviews product={product} photos={reviews} />
      <ProductFaqs items={faqs} />
      <RelatedProducts shop={business} products={related} />
    </div>
  );
}
