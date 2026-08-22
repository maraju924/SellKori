function text(value: unknown, max: number): string {
  return String(value || '').trim().slice(0, max);
}

function block(value: unknown, max: number): string {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function texts(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => text(item, maxLen)).filter(Boolean).slice(0, maxItems);
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Public catalog fields the storefront is allowed to see. */
export function sanitizePublicProduct(product: any) {
  const specRows = Array.isArray(product?.specRows)
    ? product.specRows
        .map((row: any) => ({
          label: text(row?.label, 60),
          value: text(row?.value, 160),
        }))
        .filter((row: { label: string; value: string }) => row.label && row.value)
        .slice(0, 24)
    : [];
  const reviews = Array.isArray(product?.reviews)
    ? product.reviews
        .map((row: any) => ({
          id: text(row?.id, 80),
          author: text(row?.author, 60),
          rating: Math.min(5, Math.max(1, Math.round(numberOrZero(row?.rating) || 5))),
          text: block(row?.text, 700),
          date: text(row?.date, 40),
          verified: row?.verified === true,
        }))
        .filter((row: { author: string; text: string }) => row.author && row.text)
        .slice(0, 30)
    : [];
  const faqItems = Array.isArray(product?.faqItems)
    ? product.faqItems
        .map((row: any) => ({
          question: text(row?.question, 160),
          answer: block(row?.answer, 700),
        }))
        .filter((row: { question: string; answer: string }) => row.question && row.answer)
        .slice(0, 12)
    : [];

  return {
    id: String(product?.id || ''),
    name: text(product?.name, 200),
    price: numberOrZero(product?.price),
    pricingTiers: Array.isArray(product?.pricingTiers)
      ? product.pricingTiers.slice(0, 10).map((tier: any) => ({
          quantity: Math.max(1, numberOrZero(tier.quantity) || 1),
          price: numberOrZero(tier.price),
          label: text(tier?.label, 100),
        }))
      : [],
    description: block(product?.description, 4_000),
    specs: block(product?.specs, 2_500),
    stock: Math.max(0, numberOrZero(product?.stock)),
    category: text(product?.category, 100),
    images: Array.isArray(product?.images) ? product.images.map(String).filter(Boolean).slice(0, 12) : [],
    reviewImages: Array.isArray(product?.reviewImages)
      ? product.reviewImages.map(String).filter(Boolean).slice(0, 12)
      : [],
    isAvailable: product?.isAvailable !== false,
    slug: text(product?.slug, 72).toLowerCase(),
    seoTitle: text(product?.seoTitle, 70),
    seoDescription: block(product?.seoDescription, 170),
    brand: text(product?.brand, 80),
    sku: text(product?.sku, 60),
    model: text(product?.model, 80),
    gtin: text(product?.gtin, 32),
    tags: texts(product?.tags, 16, 40),
    highlights: texts(product?.highlights, 8, 140),
    imageAlts: Array.isArray(product?.imageAlts)
      ? product.imageAlts.map((alt: unknown) => text(alt, 140)).slice(0, 12)
      : [],
    compareAtPrice: Math.max(0, numberOrZero(product?.compareAtPrice)),
    condition: ['new', 'used', 'refurbished'].includes(String(product?.condition || ''))
      ? String(product.condition)
      : 'new',
    material: text(product?.material, 80),
    color: text(product?.color, 60),
    colors: texts(product?.colors, 16, 40),
    sizes: texts(product?.sizes, 20, 40),
    weight: text(product?.weight, 40),
    dimensions: text(product?.dimensions, 80),
    origin: text(product?.origin, 80),
    gender: text(product?.gender, 40),
    warranty: block(product?.warranty, 1_200),
    boxContents: block(product?.boxContents, 1_200),
    careInstructions: block(product?.careInstructions, 1_200),
    sizeGuide: block(product?.sizeGuide, 2_000),
    videoUrl: text(product?.videoUrl, 500),
    suitableFor: block(product?.suitableFor, 800),
    deliveryNote: block(product?.deliveryNote, 1_200),
    returnPolicy: block(product?.returnPolicy, 1_200),
    soldCount: Math.max(0, Math.round(numberOrZero(product?.soldCount))),
    specRows,
    reviews,
    faqItems,
  };
}
