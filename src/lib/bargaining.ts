import type { Product, ProductTier } from '../types';
import { finiteNumber } from './productList';

export const DEFAULT_BARGAINING_SENSITIVITY = 60;

export interface BargainBand {
  quantity: number;
  packQty: number;
  listedPack: number;
  catalogMinPack: number;
  floorPack: number;
  listedUnit: number;
  catalogMinUnit: number;
  floorUnit: number;
  roomUnit: number;
  negotiationEnabled: boolean;
  sensitivity: number;
  stepsUnit: number[];
}

export interface BargainQuote {
  band: BargainBand;
  askCount: number;
  offerPack: number;
  offerUnit: number;
  isOpening: boolean;
  isFloor: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function taka(n: number): number {
  return Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
}

export function normalizeSensitivity(raw: unknown): number {
  return Math.round(clamp(finiteNumber(raw, DEFAULT_BARGAINING_SENSITIVITY), 0, 100));
}

export function pickPricingTier(
  product: Partial<Product> | null | undefined,
  quantity: number
): ProductTier | undefined {
  const tiers = Array.isArray(product?.pricingTiers) ? product!.pricingTiers! : [];
  if (tiers.length === 0) return undefined;
  const qty = Math.max(1, Math.round(finiteNumber(quantity, 1)));
  const sorted = [...tiers].sort(
    (a, b) => finiteNumber(a.quantity, 1) - finiteNumber(b.quantity, 1)
  );
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (finiteNumber(tier.quantity, 1) <= qty) chosen = tier;
  }
  return chosen;
}

export function buildBargainSteps(listed: number, floor: number, sensitivity: number): number[] {
  const hi = taka(listed);
  const lo = taka(Math.min(hi, floor));
  if (lo >= hi) return [hi];

  const room = hi - lo;
  let concessions = 2;
  if (sensitivity >= 85) concessions = 1;
  else if (sensitivity >= 55) concessions = 2;
  else if (sensitivity >= 25) concessions = 3;
  else concessions = 4;
  concessions = Math.max(1, Math.min(concessions, room));

  const out: number[] = [hi];
  for (let i = 1; i <= concessions; i++) {
    out.push(clamp(taka(hi - (room * i) / concessions), lo, hi));
  }
  const uniq: number[] = [];
  for (const price of out) {
    if (!uniq.includes(price)) uniq.push(price);
  }
  if (uniq[uniq.length - 1] !== lo) uniq.push(lo);
  return uniq;
}

export function resolveBargainBand(
  product: Partial<Product> | null | undefined,
  quantity: number,
  sensitivityRaw: unknown,
  negotiationEnabled = true
): BargainBand {
  const qty = Math.max(1, Math.round(finiteNumber(quantity, 1)));
  const sensitivity = negotiationEnabled ? normalizeSensitivity(sensitivityRaw) : 0;
  const tier = pickPricingTier(product, qty);
  const listedPackForTier = finiteNumber(tier?.price, finiteNumber(product?.price, 0));
  const tierQty = Math.max(1, finiteNumber(tier?.quantity, 1));
  const listedUnit = taka(listedPackForTier / tierQty);
  const rawMin = tier
    ? finiteNumber(tier.minPrice, finiteNumber(product?.minPrice, listedPackForTier))
    : finiteNumber(product?.minPrice, listedPackForTier);
  const catalogMinUnit = Math.min(listedUnit, taka(rawMin / tierQty));
  const roomUnit = Math.max(0, listedUnit - catalogMinUnit);
  const floorUnit = negotiationEnabled
    ? clamp(taka(listedUnit - roomUnit * (sensitivity / 100)), catalogMinUnit, listedUnit)
    : listedUnit;

  return {
    quantity: qty,
    packQty: tierQty,
    listedPack: listedUnit * qty,
    catalogMinPack: catalogMinUnit * qty,
    floorPack: floorUnit * qty,
    listedUnit,
    catalogMinUnit,
    floorUnit,
    roomUnit,
    negotiationEnabled,
    sensitivity,
    stepsUnit: buildBargainSteps(listedUnit, floorUnit, sensitivity),
  };
}

export function nextBargainOffer(band: BargainBand, askCount: number): BargainQuote {
  const steps = band.stepsUnit.length ? band.stepsUnit : [band.listedUnit];
  const idx = clamp(Math.round(finiteNumber(askCount, 0)), 0, steps.length - 1);
  const offerUnit = steps[idx];
  return {
    band,
    askCount: Math.max(0, Math.round(finiteNumber(askCount, 0))),
    offerPack: offerUnit * band.quantity,
    offerUnit,
    isOpening: idx === 0,
    isFloor: offerUnit <= band.floorUnit,
  };
}

export function isBargainAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    /কম\s*(?:রাখ|কর|দিবেন|দেন|হবে|হয়)/i.test(t)
    || /দাম\s*কম/i.test(t)
    || /(?:আরও|আরেকটু|একটু)\s*কম/i.test(t)
    || /ছাড়|ডিসকাউন্ট|discount|bargain|negotiate/i.test(t)
    || /last\s*price|ফাইনাল\s*(?:প্রাইস|দাম)|শেষ\s*দাম/i.test(t)
    || /কমা(?:বেন|বেন তো|ন|ও)/i.test(t)
  );
}

export function extractCustomerUtterances(chatHistory: string): string[] {
  return String(chatHistory || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^(?:Customer|User|কাস্টমার)\s*:/i.test(line))
    .map(line => line.replace(/^(?:Customer|User|কাস্টমার)\s*:\s*/i, ''));
}

export function countBargainAsks(chatHistory: string, currentMessage = ''): number {
  const prior = extractCustomerUtterances(chatHistory).filter(isBargainAsk).length;
  return prior + (isBargainAsk(currentMessage) ? 1 : 0);
}

export function parseMoney(raw: unknown, fallback = 0): number {
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function matchProductByName(
  products: Array<Partial<Product>> | undefined,
  name?: string
): Partial<Product> | undefined {
  const list = Array.isArray(products) ? products : [];
  const wanted = String(name || '').toLowerCase().trim();
  if (!wanted) return list.length === 1 ? list[0] : undefined;
  return (
    list.find(p => String(p?.name || '').toLowerCase() === wanted)
    || list.find(p => {
      const n = String(p?.name || '').toLowerCase();
      return Boolean(n) && (n.includes(wanted) || wanted.includes(n));
    })
    || (list.length === 1 ? list[0] : undefined)
  );
}

export function inferBargainProduct(
  products: Array<Partial<Product>> | undefined,
  text = '',
  knownName?: string
): Partial<Product> | undefined {
  const list = Array.isArray(products) ? products : [];
  const known = String(knownName || '').trim();
  if (known) {
    const matched = matchProductByName(list, known);
    if (matched) return matched;
  }
  const blob = String(text || '').toLowerCase();
  const mentioned = list.filter(p => {
    const n = String(p?.name || '').trim().toLowerCase();
    return n.length >= 2 && blob.includes(n);
  });
  if (mentioned.length === 1) return mentioned[0];
  return list.length === 1 ? list[0] : undefined;
}

function latinDigits(text: string): string {
  const map: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(text || '').replace(/[০-৯]/g, ch => map[ch] || ch);
}

export function inferBargainQuantity(raw?: unknown, text = ''): number {
  const parsedRaw = finiteNumber(raw, Number.NaN);
  if (Number.isFinite(parsedRaw) && parsedRaw >= 1) {
    return Math.min(99, Math.round(parsedRaw));
  }
  const match = latinDigits(text).match(/(\d+)\s*(?:পিস|pcs?|pieces?|টা|টি)/i);
  if (match) return Math.max(1, Math.min(99, Number(match[1])));
  return 1;
}

export function clampNegotiatedUnitPrice(input: {
  product?: Partial<Product> | null;
  quantity?: unknown;
  negotiated?: unknown;
  sensitivity?: unknown;
  negotiationEnabled?: boolean;
}): number {
  const qty = inferBargainQuantity(input.quantity);
  const enabled = input.negotiationEnabled !== false;
  const band = resolveBargainBand(input.product, qty, input.sensitivity, enabled);
  const parsed = parseMoney(input.negotiated, band.listedUnit);
  const lo = Math.min(band.floorUnit, band.listedUnit);
  const hi = Math.max(band.floorUnit, band.listedUnit);
  return taka(clamp(parsed, lo, hi));
}

export function applyBargainFloorToProduct(
  product: any,
  sensitivity: unknown,
  negotiationEnabled = true
): any {
  if (!product) return product;
  const qty1 = resolveBargainBand(product, 1, sensitivity, negotiationEnabled);
  const tiers = Array.isArray(product.pricingTiers) ? product.pricingTiers : [];
  return {
    ...product,
    minPrice: qty1.floorUnit,
    pricingTiers: tiers.map((tier: any) => {
      const qty = Math.max(1, Math.round(finiteNumber(tier?.quantity, 1)));
      const band = resolveBargainBand(product, qty, sensitivity, negotiationEnabled);
      return {
        ...tier,
        quantity: qty,
        price: finiteNumber(tier?.price, band.listedPack),
        minPrice: band.floorPack,
      };
    }),
  };
}

function uniqueTierQuantities(product: Partial<Product> | undefined): number[] {
  const tiers = Array.isArray(product?.pricingTiers) ? product!.pricingTiers! : [];
  if (!tiers.length) return [1];
  return [...new Set(tiers.map(tier => Math.max(1, Math.round(finiteNumber(tier.quantity, 1)))))]
    .sort((a, b) => a - b)
    .slice(0, 4);
}

function formatBandLine(
  name: string,
  band: BargainBand
): string {
  const steps = band.stepsUnit.map(unit => (
    band.quantity > 1 ? `${unit * band.quantity}৳ (${unit}×${band.quantity})` : `${unit}৳`
  )).join(' → ');
  if (band.quantity > 1) {
    return `- ${name} | ${band.quantity} পিস: লিস্টেড প্যাক ${band.listedPack}৳ (ইউনিট ${band.listedUnit}৳), অনুমোদিত সর্বনিম্ন প্যাক ${band.floorPack}৳, ধাপ ${steps}`;
  }
  return `- ${name} | ১ পিস: লিস্টেড ${band.listedUnit}৳, অনুমোদিত সর্বনিম্ন ${band.floorUnit}৳, ধাপ ${steps}`;
}

export function buildBargainingPromptBlock(input: {
  products?: Array<Partial<Product> | any>;
  bargainingSensitivity?: unknown;
  negotiationEnabled?: boolean;
  chatHistory?: string;
  customerMessage?: string;
  knownProductName?: string;
  knownQuantity?: unknown;
}): string {
  const enabled = input.negotiationEnabled !== false;
  const sensitivity = normalizeSensitivity(input.bargainingSensitivity);
  const products = Array.isArray(input.products) ? input.products.filter(Boolean) : [];

  if (!enabled) {
    return [
      '# দরদাম ইঞ্জিন (সার্ভার হিসাব — অবশ্যই মানবে)',
      'দরদাম বন্ধ। শুধু ক্যাটালগের লিস্টেড বিক্রয় মূল্য বলবে। কোনো ছাড় বা minPrice অফার নিষিদ্ধ।',
      'order_data.negotiated_price-এ লিস্টেড ইউনিট দাম লেখো।',
    ].join('\n');
  }

  const lines: string[] = [
    '# দরদাম ইঞ্জিন (সার্ভার হিসাব — অবশ্যই মানবে)',
    `স্লাইডার: ${sensitivity}% — অনুমোদিত ফ্লোর = লিস্টেড থেকে (লিস্টেড−ক্যাটালগ minPrice) এর ${sensitivity}% পর্যন্ত।`,
    'এই ছাড় ক্যাটালগ-অনুমোদিত দরদাম, বানানো/কাল্পনিক ডিসকাউন্ট নয়। ব্যান্ডের বাইরে দাম দেবে না। ফ্লোর বা minPrice কাস্টমারকে বলবে না।',
    'দাম জানতে চাইলে প্রথমে লিস্টেড দাম বলো। "কম রাখেন"/ছাড় চাইলে পরের ধাপ দাও; স্লাইডার ৮৫%+ না হলে একবারে ফ্লোরে নামবে না।',
    'order_data.negotiated_price = সম্মত প্রতি-পিস ইউনিট দাম (প্যাক দাম ÷ কোয়ান্টিটি)।',
    '',
    'পণ্য অফার ব্যান্ড:',
  ];

  const catalog = products.slice(0, 12);
  if (!catalog.length) {
    lines.push('- ক্যাটালগে পণ্য নেই — দাম বানিয়ে বলবে না।');
  } else {
    for (const product of catalog) {
      const name = String(product?.name || 'পণ্য').trim() || 'পণ্য';
      for (const qty of uniqueTierQuantities(product)) {
        lines.push(formatBandLine(name, resolveBargainBand(product, qty, sensitivity, true)));
      }
    }
  }

  const blob = `${input.chatHistory || ''}\n${input.customerMessage || ''}`;
  const product = inferBargainProduct(products, blob, input.knownProductName);
  if (product) {
    const qty = inferBargainQuantity(input.knownQuantity, blob);
    const band = resolveBargainBand(product, qty, sensitivity, true);
    const quote = nextBargainOffer(band, countBargainAsks(input.chatHistory || '', input.customerMessage || ''));
    lines.push('');
    lines.push('এই টার্নের সাজেশন:');
    lines.push(
      `${product.name || 'পণ্য'} ${qty} পিস — এখন অফার ${quote.offerPack}৳`
      + (qty > 1 ? ` (ইউনিট ${quote.offerUnit}৳)` : '')
      + `। negotiated_price=${quote.offerUnit}`
      + (quote.isOpening ? ' (প্রথম দাম, এখনো ছাড় চায়নি)' : '')
      + (quote.isFloor ? ' (শেষ অনুমোদিত অফার)' : '')
    );
  }

  return lines.join('\n');
}
