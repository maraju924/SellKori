import React from 'react';
import { Link } from 'react-router-dom';
import type { BusinessConfig, Product, ProductFaqItem, ProductReview, ProductSpecRow } from '../../types';
import { categoryPath, shopPath } from '../../lib/storefront';
import {
  isDirectVideoUrl,
  productHighlights,
  productRatingSummary,
  productSpecRows,
  youtubeVideoId,
} from '../../lib/productSeo';
import { ShopImage } from './ShopPrimitives';
import { ShopProductCard } from './ShopProductCard';

export function ShopBreadcrumb({
  shop,
  product,
}: {
  shop: BusinessConfig;
  product: Product;
}) {
  const home = shopPath(shop);
  const items = [
    { label: shop.name || 'দোকান', href: home },
    product.category ? { label: product.category, href: categoryPath(shop, product.category) } : null,
    { label: product.name, href: '' },
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <nav aria-label="breadcrumb" className="text-[12px] text-zinc-500">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => (
          <li key={item.label + index} className="flex items-center gap-1.5 min-w-0">
            {index > 0 && <span className="text-zinc-300">/</span>}
            {item.href ? (
              <Link to={item.href} className="hover:text-orange-600 truncate max-w-[160px]">
                {item.label}
              </Link>
            ) : (
              <span className="text-zinc-800 truncate max-w-[220px]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function OptionChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-zinc-500">{label}{value ? ` · ${value}` : ''}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(value === option ? '' : option)}
            className={`px-2.5 py-1 rounded-lg border text-xs ${
              value === option
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProductHighlights({ product }: { product: Product }) {
  const items = productHighlights(product);
  if (!items.length) return null;
  return (
    <ul className="space-y-1 text-sm text-zinc-700">
      {items.map(item => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1 w-1 rounded-full bg-zinc-400 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

export function ProductSpecTable({ product }: { product: Product }) {
  const rows: ProductSpecRow[] = [...productSpecRows(product)];
  const extras: Array<[string, string | undefined]> = [
    ['ব্র্যান্ড', product.brand],
    ['SKU', product.sku],
    ['মডেল', product.model],
    ['ম্যাটেরিয়াল', product.material],
    ['কালার', product.color || product.colors?.join(', ')],
    ['সাইজ', product.sizes?.join(', ')],
    ['ওজন', product.weight],
    ['মাপ', product.dimensions],
    ['উৎস', product.origin],
    ['জন্য', product.gender],
  ];
  for (const [label, value] of extras) {
    if (!value) continue;
    if (rows.some(row => row.label === label)) continue;
    rows.push({ label, value });
  }
  const leftover = String(product.specs || '').trim();
  const hasTable = rows.length > 0;
  if (!hasTable && !leftover) return null;
  return (
    <Section title="স্পেসিফিকেশন">
      {hasTable && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-b border-zinc-100 last:border-0">
                  <th className="text-left font-semibold text-zinc-500 w-[38%] px-4 py-2.5 align-top">{row.label}</th>
                  <td className="px-4 py-2.5 text-zinc-800">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!hasTable && leftover && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-700 whitespace-pre-line">
          {leftover}
        </div>
      )}
    </Section>
  );
}

export function ProductBlock({ title, text }: { title: string; text?: string }) {
  if (!String(text || '').trim()) return null;
  return (
    <Section title={title}>
      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{text}</p>
    </Section>
  );
}

export function ProductVideo({ url }: { url?: string }) {
  if (!url) return null;
  const youtube = youtubeVideoId(url);
  return (
    <Section title="ভিডিও">
      {youtube ? (
        <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-900">
          <iframe
            title="পণ্যের ভিডিও"
            src={`https://www.youtube.com/embed/${youtube}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : isDirectVideoUrl(url) ? (
        <video src={url} controls className="w-full rounded-2xl border border-zinc-200 bg-zinc-900" />
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-orange-600">
          ভিডিও দেখুন
        </a>
      )}
    </Section>
  );
}

export function ProductPolicy({
  product,
  inside,
  outside,
}: {
  product: Product;
  inside: number;
  outside: number;
}) {
  return (
    <Section title="ডেলিভারি, পেমেন্ট ও রিটার্ন">
      <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100 text-sm">
        <div className="px-4 py-3">
          <p className="font-bold text-zinc-800">ডেলিভারি</p>
          <p className="mt-1 text-zinc-600 leading-relaxed">
            {product.deliveryNote || `ঢাকার ভিতরে ৳${inside}, ঢাকার বাইরে ৳${outside}। ক্যাশ অন ডেলিভারি সারা দেশে।`}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-bold text-zinc-800">পেমেন্ট</p>
          <p className="mt-1 text-zinc-600">ক্যাশ অন ডেলিভারি। অর্ডার কনফার্ম হলে কুরিয়ারে পাঠানো হয়।</p>
        </div>
        {(product.returnPolicy || product.warranty) && (
          <div className="px-4 py-3 space-y-2">
            {product.returnPolicy && (
              <div>
                <p className="font-bold text-zinc-800">রিটার্ন</p>
                <p className="mt-1 text-zinc-600 whitespace-pre-line">{product.returnPolicy}</p>
              </div>
            )}
            {product.warranty && (
              <div>
                <p className="font-bold text-zinc-800">ওয়ারেন্টি</p>
                <p className="mt-1 text-zinc-600 whitespace-pre-line">{product.warranty}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function StarRow({ rating }: { rating: number }) {
  const value = Math.round(rating);
  return (
    <span className="text-amber-500 tracking-tight" aria-label={`${rating} স্টার`}>
      {'★'.repeat(value)}{'☆'.repeat(Math.max(0, 5 - value))}
    </span>
  );
}

export function ProductReviews({
  product,
  photos,
}: {
  product: Product;
  photos: string[];
}) {
  const reviews = product.reviews || [];
  const summary = productRatingSummary(product);
  if (!reviews.length && !photos.length) return null;
  return (
    <Section title="ক্রেতার মতামত">
      {summary && (
        <p className="text-sm text-zinc-600">
          <StarRow rating={summary.average} /> {summary.average} · {summary.count}টি রিভিউ
          {product.soldCount ? ` · ${product.soldCount} জন কিনেছেন` : ''}
        </p>
      )}
      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((review: ProductReview, index: number) => (
            <article key={review.id || `${review.author}-${index}`} className="bg-white border border-zinc-200 rounded-2xl px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-bold text-sm">
                  {review.author}
                  {review.verified ? <span className="ml-2 text-[11px] font-semibold text-emerald-700">ভেরিফাইড</span> : null}
                </p>
                <StarRow rating={review.rating} />
              </div>
              {review.date && <p className="text-[11px] text-zinc-400 mt-0.5">{review.date}</p>}
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{review.text}</p>
            </article>
          ))}
        </div>
      )}
      {photos.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2">রিভিউ ছবি</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((src, index) => (
              <ShopImage key={src + index} src={src} alt={`${product.name} ক্রেতার ছবি ${index + 1}`} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

export function ProductFaqs({ items }: { items: ProductFaqItem[] }) {
  if (!items.length) return null;
  return (
    <Section title="প্রশ্নোত্তর">
      <div className="space-y-2">
        {items.map(faq => (
          <details key={faq.question} className="bg-white border border-zinc-200 rounded-2xl px-4 py-3">
            <summary className="font-bold text-sm cursor-pointer">{faq.question}</summary>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{faq.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function RelatedProducts({
  shop,
  products,
}: {
  shop: BusinessConfig;
  products: Product[];
}) {
  if (!products.length) return null;
  return (
    <Section title="আরও দেখুন">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {products.map(item => (
          <ShopProductCard key={item.id} business={shop} product={item} />
        ))}
      </div>
    </Section>
  );
}
