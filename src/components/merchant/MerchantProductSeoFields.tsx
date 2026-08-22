import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Product, ProductFaqItem, ProductReview, ProductSpecRow } from '../../types';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { suggestedProductSlug } from '../../lib/productSeo';
import { readInputValue } from '../../lib/productCatalog';
import { finiteNumber } from '../../lib/utils';

export type ProductPageFields = {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  brand: string;
  sku: string;
  model: string;
  compareAtPrice: string;
  material: string;
  color: string;
  colors: string;
  sizes: string;
  weight: string;
  dimensions: string;
  origin: string;
  gender: string;
  warranty: string;
  boxContents: string;
  careInstructions: string;
  sizeGuide: string;
  videoUrl: string;
  suitableFor: string;
  deliveryNote: string;
  returnPolicy: string;
  soldCount: string;
  highlights: string;
  tags: string;
  specRows: ProductSpecRow[];
  reviews: Array<Pick<ProductReview, 'author' | 'rating' | 'text' | 'date' | 'verified'>>;
  faqs: ProductFaqItem[];
  imageAlts: string[];
};

export function emptyProductPageFields(): ProductPageFields {
  return {
    slug: '',
    seoTitle: '',
    seoDescription: '',
    brand: '',
    sku: '',
    model: '',
    compareAtPrice: '',
    material: '',
    color: '',
    colors: '',
    sizes: '',
    weight: '',
    dimensions: '',
    origin: '',
    gender: '',
    warranty: '',
    boxContents: '',
    careInstructions: '',
    sizeGuide: '',
    videoUrl: '',
    suitableFor: '',
    deliveryNote: '',
    returnPolicy: '',
    soldCount: '',
    highlights: '',
    tags: '',
    specRows: [],
    reviews: [],
    faqs: [],
    imageAlts: [],
  };
}

export function fieldsFromProduct(prod: Product): ProductPageFields {
  return {
    ...emptyProductPageFields(),
    slug: prod.slug || '',
    seoTitle: prod.seoTitle || '',
    seoDescription: prod.seoDescription || '',
    brand: prod.brand || '',
    sku: prod.sku || '',
    model: prod.model || '',
    compareAtPrice: prod.compareAtPrice ? String(prod.compareAtPrice) : '',
    material: prod.material || '',
    color: prod.color || '',
    colors: (prod.colors || []).join(', '),
    sizes: (prod.sizes || []).join(', '),
    weight: prod.weight || '',
    dimensions: prod.dimensions || '',
    origin: prod.origin || '',
    gender: prod.gender || '',
    warranty: prod.warranty || '',
    boxContents: prod.boxContents || '',
    careInstructions: prod.careInstructions || '',
    sizeGuide: prod.sizeGuide || '',
    videoUrl: prod.videoUrl || '',
    suitableFor: prod.suitableFor || '',
    deliveryNote: prod.deliveryNote || '',
    returnPolicy: prod.returnPolicy || '',
    soldCount: prod.soldCount ? String(prod.soldCount) : '',
    highlights: (prod.highlights || []).join('\n'),
    tags: (prod.tags || []).join(', '),
    specRows: prod.specRows || [],
    reviews: (prod.reviews || []).map(row => ({
      author: row.author,
      rating: row.rating,
      text: row.text,
      date: row.date || '',
      verified: Boolean(row.verified),
    })),
    faqs: prod.faqItems || [],
    imageAlts: prod.imageAlts || [],
  };
}

function splitList(value: string): string[] {
  return value.split(/[\n,|]/).map(item => item.trim()).filter(Boolean);
}

export function payloadFromFields(fields: ProductPageFields) {
  return {
    slug: fields.slug.trim(),
    seoTitle: fields.seoTitle.trim(),
    seoDescription: fields.seoDescription.trim(),
    brand: fields.brand.trim(),
    sku: fields.sku.trim(),
    model: fields.model.trim(),
    compareAtPrice: finiteNumber(fields.compareAtPrice, 0),
    material: fields.material.trim(),
    color: fields.color.trim(),
    colors: splitList(fields.colors),
    sizes: splitList(fields.sizes),
    weight: fields.weight.trim(),
    dimensions: fields.dimensions.trim(),
    origin: fields.origin.trim(),
    gender: fields.gender.trim(),
    warranty: fields.warranty.trim(),
    boxContents: fields.boxContents.trim(),
    careInstructions: fields.careInstructions.trim(),
    sizeGuide: fields.sizeGuide.trim(),
    videoUrl: fields.videoUrl.trim(),
    suitableFor: fields.suitableFor.trim(),
    deliveryNote: fields.deliveryNote.trim(),
    returnPolicy: fields.returnPolicy.trim(),
    soldCount: finiteNumber(fields.soldCount, 0),
    highlights: fields.highlights.split('\n').map(item => item.trim()).filter(Boolean),
    tags: splitList(fields.tags),
    specRows: fields.specRows,
    reviews: fields.reviews,
    faqItems: fields.faqs,
    imageAlts: fields.imageAlts,
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-bold text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
      {hint ? <p className="text-[11px] text-zinc-500 leading-relaxed">{hint}</p> : null}
    </div>
  );
}

export function MerchantProductSeoFields({
  fields,
  onChange,
  productName,
  images,
  specs,
  onSpecsChange,
}: {
  fields: ProductPageFields;
  onChange: (next: ProductPageFields) => void;
  productName: string;
  images: string[];
  specs: string;
  onSpecsChange: (value: string) => void;
}) {
  const set = <K extends keyof ProductPageFields>(key: K, value: ProductPageFields[K]) => {
    onChange({ ...fields, [key]: value });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h4 className="font-black text-xs text-zinc-900 dark:text-white">৫. স্পেসিফিকেশন</h4>
        <Field label="স্পেক লিখুন" hint="প্রতি লাইনে বিষয়: মান — যেমন ফেব্রিক: কটন">
          <Textarea
            value={specs}
            onChange={e => onSpecsChange(e.target.value)}
            placeholder={'ফেব্রিক: ১০০% কটন\nকালার: নেভি ব্লু\nসাইজ: M-XXL'}
            className="rounded-2xl min-h-[88px] text-xs"
          />
        </Field>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-bold text-zinc-700 dark:text-zinc-300">টেবিলের সারি (ঐচ্ছিক)</p>
            <button
              type="button"
              onClick={() => set('specRows', [...fields.specRows, { label: '', value: '' }])}
              className="text-[11px] font-bold text-orange-600"
            >
              সারি যোগ
            </button>
          </div>
          {fields.specRows.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                value={row.label}
                onChange={e => {
                  const next = [...fields.specRows];
                  next[index] = { ...row, label: readInputValue(e) };
                  set('specRows', next);
                }}
                placeholder="বিষয়"
                className="h-9 rounded-xl text-xs"
              />
              <Input
                value={row.value}
                onChange={e => {
                  const next = [...fields.specRows];
                  next[index] = { ...row, value: readInputValue(e) };
                  set('specRows', next);
                }}
                placeholder="মান"
                className="h-9 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={() => set('specRows', fields.specRows.filter((_, i) => i !== index))}
                className="text-zinc-400 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-black text-xs text-zinc-900 dark:text-white">৬. সার্চ লিংক ও পরিচয়</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="পণ্যের লিংক (slug)" hint="ইংরেজি অক্ষর, সংখ্যা, হাইফেন। খালি রাখলে আইডি দিয়ে খুলবে।">
            <Input
              value={fields.slug}
              onChange={e => set('slug', readInputValue(e))}
              placeholder={suggestedProductSlug(productName) || 'cotton-panjabi'}
              className="h-10 rounded-xl text-xs font-mono"
            />
          </Field>
          <Field label="SEO টাইটেল">
            <Input
              value={fields.seoTitle}
              onChange={e => set('seoTitle', readInputValue(e))}
              placeholder="কটন পাঞ্জাবি নেভি | দোকানের নাম"
              className="h-10 rounded-xl text-xs"
              maxLength={70}
            />
          </Field>
        </div>
        <Field label="মেটা ডেসক্রিপশন">
          <Textarea
            value={fields.seoDescription}
            onChange={e => set('seoDescription', e.target.value)}
            placeholder="দাম, COD, সাইজ ও এক লাইনে কেন কিনবে — ১৬০ অক্ষরের মধ্যে।"
            className="rounded-2xl min-h-[68px] text-xs"
            maxLength={170}
          />
        </Field>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="ব্র্যান্ড">
            <Input value={fields.brand} onChange={e => set('brand', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
          <Field label="SKU">
            <Input value={fields.sku} onChange={e => set('sku', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
          <Field label="মডেল">
            <Input value={fields.model} onChange={e => set('model', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="আগের দাম (৳)" hint="এখনকার দামের চেয়ে বেশি হলে ছাড় দেখাবে।">
            <Input
              type="number"
              value={fields.compareAtPrice}
              onChange={e => set('compareAtPrice', readInputValue(e))}
              className="h-10 rounded-xl text-xs"
            />
          </Field>
          <Field label="বিক্রি হয়েছে">
            <Input
              type="number"
              value={fields.soldCount}
              onChange={e => set('soldCount', readInputValue(e))}
              className="h-10 rounded-xl text-xs"
            />
          </Field>
          <Field label="ট্যাগ">
            <Input
              value={fields.tags}
              onChange={e => set('tags', readInputValue(e))}
              placeholder="ঈদ, কটন, পুরুষ"
              className="h-10 rounded-xl text-xs"
            />
          </Field>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-black text-xs text-zinc-900 dark:text-white">৭. ভ্যারিয়েন্ট ও মাপ</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="কালারগুলো" hint="কমা দিয়ে আলাদা করুন">
            <Input
              value={fields.colors}
              onChange={e => set('colors', readInputValue(e))}
              placeholder="নেভি, মেরুন, সাদা"
              className="h-10 rounded-xl text-xs"
            />
          </Field>
          <Field label="সাইজগুলো">
            <Input
              value={fields.sizes}
              onChange={e => set('sizes', readInputValue(e))}
              placeholder="M, L, XL, XXL"
              className="h-10 rounded-xl text-xs"
            />
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="ম্যাটেরিয়াল">
            <Input value={fields.material} onChange={e => set('material', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
          <Field label="ওজন">
            <Input value={fields.weight} onChange={e => set('weight', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
          <Field label="মাপ">
            <Input value={fields.dimensions} onChange={e => set('dimensions', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="উৎস / কান্ট্রি">
            <Input value={fields.origin} onChange={e => set('origin', readInputValue(e))} className="h-10 rounded-xl text-xs" />
          </Field>
          <Field label="জেন্ডার">
            <Input value={fields.gender} onChange={e => set('gender', readInputValue(e))} placeholder="পুরুষ / নারী / ইউনিসেক্স" className="h-10 rounded-xl text-xs" />
          </Field>
        </div>
        <Field label="সাইজ চার্ট">
          <Textarea
            value={fields.sizeGuide}
            onChange={e => set('sizeGuide', e.target.value)}
            placeholder={'M: বুক ৩৮" লম্বা ৪০"\nL: বুক ৪০" লম্বা ৪২"'}
            className="rounded-2xl min-h-[72px] text-xs"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <h4 className="font-black text-xs text-zinc-900 dark:text-white">৮. পেজ কনটেন্ট</h4>
        <Field label="হাইলাইট" hint="প্রতি লাইনে একটি পয়েন্ট">
          <Textarea
            value={fields.highlights}
            onChange={e => set('highlights', e.target.value)}
            placeholder={'১০০% কটন\nমেশিন ওয়াশ করা যায়\nঢাকায় ২৪ ঘন্টায় ডেলিভারি'}
            className="rounded-2xl min-h-[80px] text-xs"
          />
        </Field>
        <Field label="বক্সে যা থাকবে">
          <Textarea value={fields.boxContents} onChange={e => set('boxContents', e.target.value)} className="rounded-2xl min-h-[64px] text-xs" />
        </Field>
        <Field label="দেখাশোনার নিয়ম">
          <Textarea value={fields.careInstructions} onChange={e => set('careInstructions', e.target.value)} className="rounded-2xl min-h-[64px] text-xs" />
        </Field>
        <Field label="কার জন্য">
          <Textarea value={fields.suitableFor} onChange={e => set('suitableFor', e.target.value)} className="rounded-2xl min-h-[56px] text-xs" />
        </Field>
        <Field label="ভিডিও লিংক" hint="YouTube লিংক দিলে পেজে এম্বেড হবে">
          <Input
            value={fields.videoUrl}
            onChange={e => set('videoUrl', readInputValue(e))}
            placeholder="https://youtu.be/..."
            className="h-10 rounded-xl text-xs"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="ডেলিভারি নোট">
            <Textarea value={fields.deliveryNote} onChange={e => set('deliveryNote', e.target.value)} className="rounded-2xl min-h-[64px] text-xs" />
          </Field>
          <Field label="রিটার্ন নীতি">
            <Textarea value={fields.returnPolicy} onChange={e => set('returnPolicy', e.target.value)} className="rounded-2xl min-h-[64px] text-xs" />
          </Field>
        </div>
        <Field label="ওয়ারেন্টি">
          <Textarea value={fields.warranty} onChange={e => set('warranty', e.target.value)} className="rounded-2xl min-h-[56px] text-xs" />
        </Field>
      </div>

      {images.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-black text-xs text-zinc-900 dark:text-white">ছবির Alt টেক্সট</h4>
          <p className="text-[11px] text-zinc-500">গুগল ছবি খুঁজতে এটা পড়ে। খালি রাখলে পণ্যের নাম ব্যবহার হবে।</p>
          {images.map((src, index) => (
            <div key={src + index} className="flex gap-3 items-center">
              <img src={src} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200" />
              <Input
                value={fields.imageAlts[index] || ''}
                onChange={e => {
                  const next = [...fields.imageAlts];
                  next[index] = readInputValue(e);
                  set('imageAlts', next);
                }}
                placeholder={`ছবি ${index + 1} কী দেখাচ্ছে`}
                className="h-10 rounded-xl text-xs"
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-xs text-zinc-900 dark:text-white">৯. লিখিত রিভিউ</h4>
          <button
            type="button"
            onClick={() => set('reviews', [...fields.reviews, { author: '', rating: 5, text: '', date: '', verified: true }])}
            className="text-[11px] font-bold text-orange-600 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> রিভিউ যোগ
          </button>
        </div>
        {fields.reviews.map((review, index) => (
          <div key={index} className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3 space-y-2">
            <div className="grid sm:grid-cols-[1fr_90px_auto] gap-2">
              <Input
                value={review.author}
                onChange={e => {
                  const next = [...fields.reviews];
                  next[index] = { ...review, author: readInputValue(e) };
                  set('reviews', next);
                }}
                placeholder="ক্রেতার নাম"
                className="h-9 rounded-xl text-xs"
              />
              <select
                value={review.rating}
                onChange={e => {
                  const next = [...fields.reviews];
                  next[index] = { ...review, rating: finiteNumber(e.target.value, 5) };
                  set('reviews', next);
                }}
                className="h-9 rounded-xl border border-zinc-200 text-xs px-2 bg-white dark:bg-zinc-900"
              >
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>{n} স্টার</option>
                ))}
              </select>
              <button type="button" onClick={() => set('reviews', fields.reviews.filter((_, i) => i !== index))} className="text-zinc-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              value={review.text}
              onChange={e => {
                const next = [...fields.reviews];
                next[index] = { ...review, text: e.target.value };
                set('reviews', next);
              }}
              placeholder="ক্রেতা কী লিখেছেন"
              className="rounded-xl min-h-[56px] text-xs"
            />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-black text-xs text-zinc-900 dark:text-white">১০. পণ্যের প্রশ্নোত্তর</h4>
          <button
            type="button"
            onClick={() => set('faqs', [...fields.faqs, { question: '', answer: '' }])}
            className="text-[11px] font-bold text-orange-600 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> প্রশ্ন যোগ
          </button>
        </div>
        {fields.faqs.map((faq, index) => (
          <div key={index} className="border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={faq.question}
                onChange={e => {
                  const next = [...fields.faqs];
                  next[index] = { ...faq, question: readInputValue(e) };
                  set('faqs', next);
                }}
                placeholder="প্রশ্ন"
                className="h-9 rounded-xl text-xs"
              />
              <button type="button" onClick={() => set('faqs', fields.faqs.filter((_, i) => i !== index))} className="text-zinc-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              value={faq.answer}
              onChange={e => {
                const next = [...fields.faqs];
                next[index] = { ...faq, answer: e.target.value };
                set('faqs', next);
              }}
              placeholder="উত্তর"
              className="rounded-xl min-h-[56px] text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
