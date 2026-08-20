type FallbackProduct = {
  name?: unknown;
  price?: unknown;
  stock?: unknown;
  stockCount?: unknown;
  description?: unknown;
  isAvailable?: unknown;
};

type FallbackFaq = {
  question?: unknown;
  answer?: unknown;
  isActive?: unknown;
};

type FallbackBusiness = {
  products?: FallbackProduct[];
  faqs?: FallbackFaq[];
};

function clean(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalized(value: unknown): string {
  return clean(value).toLocaleLowerCase('bn-BD');
}

function words(value: unknown): string[] {
  return normalized(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);
}

function money(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `৳${amount.toLocaleString('en-US')}` : '';
}

function findFaq(message: string, faqs: FallbackFaq[]): FallbackFaq | undefined {
  const messageText = normalized(message);
  if (!messageText) return undefined;
  const messageWords = new Set(words(message));
  let best: { faq: FallbackFaq; score: number } | undefined;

  for (const faq of faqs) {
    if (faq?.isActive === false || !clean(faq?.answer)) continue;
    const question = normalized(faq?.question);
    if (!question) continue;
    const exact = messageText.includes(question) || question.includes(messageText);
    const overlap = words(question).filter((word) => messageWords.has(word)).length;
    const score = exact ? 100 : overlap;
    if (score >= 2 && (!best || score > best.score)) best = { faq, score };
  }
  return best?.faq;
}

function findProduct(message: string, products: FallbackProduct[]): FallbackProduct | undefined {
  const messageText = normalized(message);
  const messageWords = new Set(words(message));
  let best: { product: FallbackProduct; score: number } | undefined;

  for (const product of products) {
    if (product?.isAvailable === false) continue;
    const name = normalized(product?.name);
    if (!name) continue;
    const exact = messageText.includes(name);
    const overlap = words(name).filter((word) => messageWords.has(word)).length;
    const score = exact ? 100 : overlap;
    if (score > 0 && (!best || score > best.score)) best = { product, score };
  }
  return best?.product;
}

function productLine(product: FallbackProduct): string {
  const name = clean(product.name) || 'পণ্যটি';
  const price = money(product.price);
  const stockValue = product.stock ?? product.stockCount;
  const stock = Number(stockValue);
  if (Number.isFinite(stock) && stock <= 0) return `${name} বর্তমানে স্টকে নেই।`;

  const description = clean(product.description).slice(0, 140);
  return `${name}${price ? ` এর দাম ${price}` : ''}${description ? `। ${description}` : '।'}`;
}

/**
 * Produces a useful reply without an external AI provider. This is deliberately
 * grounded only in merchant catalog/FAQ data so provider outages never turn
 * into silence or fabricated sales information.
 */
export function buildSalesFallbackReply(
  message: string,
  business: FallbackBusiness | null | undefined,
  mediaKinds: string[] = []
): string {
  const text = clean(message);
  const products = Array.isArray(business?.products) ? business.products : [];
  const faqs = Array.isArray(business?.faqs) ? business.faqs : [];

  if (mediaKinds.includes('audio')) {
    return 'আপনার ভয়েস মেসেজটি পেয়েছি। দয়া করে কথাটি একবার লিখে পাঠাবেন? তাহলে এখনই সাহায্য করতে পারব।';
  }
  if (mediaKinds.includes('image') && !text.replace(/\[[^\]]+\]/g, '').trim()) {
    return 'আপনার ছবিটি পেয়েছি। এটি কোন পণ্য বা বিষয় সম্পর্কে, একটু লিখে জানাবেন?';
  }

  const faq = findFaq(text, faqs);
  if (faq) return clean(faq.answer).slice(0, 1900);

  const product = findProduct(text, products);
  const priceIntent = /দাম|মূল্য|price|কত টাকা|কতো টাকা|কত|কতো/i.test(text);
  const orderIntent = /অর্ডার|order|নিব|নেব|কিনতে|লাগবে|চাই/i.test(text);

  if (product) {
    const line = productLine(product);
    if (orderIntent) {
      return `${line} অর্ডার করতে আপনার নাম, ১১ ডিজিটের ফোন নম্বর ও পূর্ণ ঠিকানা পাঠান।`.slice(0, 1900);
    }
    return `${line} অর্ডার করতে চাইলে জানাবেন।`.slice(0, 1900);
  }

  const available = products.filter((item) => item?.isAvailable !== false && clean(item?.name));
  if (priceIntent && available.length > 0) {
    const choices = available
      .slice(0, 3)
      .map((item) => `${clean(item.name)}${money(item.price) ? ` — ${money(item.price)}` : ''}`)
      .join(', ');
    return `${choices}। কোন পণ্যটি সম্পর্কে বিস্তারিত জানতে চান?`.slice(0, 1900);
  }

  if (orderIntent) {
    return 'অবশ্যই। যে পণ্যটি নিতে চান তার নামের সাথে আপনার নাম, ১১ ডিজিটের ফোন নম্বর ও পূর্ণ ঠিকানা পাঠান।';
  }

  if (available.length > 0) {
    const names = available.slice(0, 3).map((item) => clean(item.name)).join(', ');
    return `জি, আমি সাহায্য করছি। ${names}—কোন পণ্যটি সম্পর্কে জানতে চান?`.slice(0, 1900);
  }

  return 'জি, আমি সাহায্য করছি। আপনি কোন পণ্য বা বিষয় সম্পর্কে জানতে চান?';
}
