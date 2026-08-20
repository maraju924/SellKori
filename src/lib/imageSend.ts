export const MAX_PRODUCT_PHOTOS = 3;
export const MAX_REVIEW_PHOTOS = 3;

const REVIEW_REQUEST =
  /রিভিউ|review|প্রুফ|proof|ফিডব্যাক|feedback|আনবক্সিং|unboxing|কাস্টমার\s*(ছবি|ফটো|photo|pic)|গ্রাহক\s*(ছবি|ফটো)|ডেলিভারি\s*প্রুফ/i;

const PHOTO_REQUEST =
  /ছবি|ফটো|photo|picture|\bimage\b|\bpic\b/i;

const PRODUCT_PHOTO_WITH_REVIEW =
  /প্রোডাক্ট\s*(ছবি|ফটো|photo)|পণ্য(?:ের)?\s*(ছবি|ফটো)|product\s*(photo|image|pic)|ক্যাটালগ\s*(ছবি|ফটো)/i;

const ASKED_FOR_BOTH_PHOTO_AND_REVIEW =
  /(?:ছবি|ফটো|photo|picture|\bimage\b|\bpic\b).{0,24}(?:আর|ও|এবং|and).{0,24}(?:রিভিউ|review|প্রুফ)|(?:রিভিউ|review|প্রুফ).{0,24}(?:আর|ও|এবং|and).{0,24}(?:ছবি|ফটো|photo|picture|\bimage\b|\bpic\b)/i;

export function isPublicHttpUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\//i.test(url.trim());
}

export function detectImageRequest(message: string): {
  wantsProductPhotos: boolean;
  wantsReviewPhotos: boolean;
} {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return { wantsProductPhotos: false, wantsReviewPhotos: false };

  const wantsReviewPhotos = REVIEW_REQUEST.test(text);
  const askedForPhoto = PHOTO_REQUEST.test(text);
  const wantsProductPhotos = PRODUCT_PHOTO_WITH_REVIEW.test(text)
    || (askedForPhoto && wantsReviewPhotos && ASKED_FOR_BOTH_PHOTO_AND_REVIEW.test(text))
    || (askedForPhoto && !wantsReviewPhotos);

  return { wantsProductPhotos, wantsReviewPhotos };
}

export function resolveImageSendFlags(
  message: string,
  _ai?: { show_product_image?: boolean; show_review_images?: boolean } | null,
): { show_product_image: boolean; show_review_images: boolean } {
  const detected = detectImageRequest(message);
  return {
    show_product_image: detected.wantsProductPhotos,
    show_review_images: detected.wantsReviewPhotos,
  };
}

export function convertHostedImageLink(raw: string): string {
  const trimmed = String(raw || '').trim();
  const driveFile = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveFile?.[1]) return `https://drive.google.com/uc?export=view&id=${driveFile[1]}`;
  const driveOpen = trimmed.match(/drive\.google\.com\/(?:open|uc)\?[^#]*id=([^&]+)/i);
  if (driveOpen?.[1]) return `https://drive.google.com/uc?export=view&id=${driveOpen[1]}`;
  if (/dropbox\.com\//i.test(trimmed)) {
    return trimmed
      .replace(/[?&]dl=0/i, (match) => match.startsWith('?') ? '?dl=1' : '&dl=1')
      .replace(/www\.dropbox\.com/i, 'dl.dropboxusercontent.com');
  }
  return trimmed;
}

export function normalizeImageLink(raw: string): string | null {
  let value = String(raw || '').trim().replace(/^<|>$/g, '');
  if (!value) return null;
  if (/^(javascript|data|blob|file):/i.test(value)) return null;
  if (value.startsWith('//')) value = `https:${value}`;
  if (!/^https?:\/\//i.test(value)) {
    if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(value)) value = `https://${value}`;
    else return null;
  }
  try {
    const parsed = new URL(convertHostedImageLink(value));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseImageLinks(raw: string): { urls: string[]; invalid: string[] } {
  const tokens = String(raw || '')
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const urls: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const normalized = normalizeImageLink(token);
    if (!normalized) {
      invalid.push(token);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return { urls, invalid };
}

export function uniqueHttpUrls(urls: Array<string | null | undefined>, limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const raw = String(url || '').trim();
    if (!raw) continue;
    const normalized = raw.startsWith('data:image/') ? raw : normalizeImageLink(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= limit) break;
  }
  return out;
}

export function pickProductForImages<T extends {
  name?: string;
  images?: string[];
  reviewImages?: string[];
}>(
  products: T[] | undefined,
  wantedName?: string,
  message = '',
): T | undefined {
  const list = Array.isArray(products) ? products : [];
  if (list.length === 0) return undefined;
  const wanted = String(wantedName || '').toLowerCase().trim();
  const haystack = `${wanted}\n${message}`.toLowerCase();
  if (wanted) {
    const exact = list.find((product) => String(product.name || '').toLowerCase().trim() === wanted);
    if (exact) return exact;
    const partial = list.find((product) => {
      const name = String(product.name || '').toLowerCase();
      return Boolean(name) && (name.includes(wanted) || wanted.includes(name));
    });
    if (partial) return partial;
  }
  const mentioned = list.find((product) => {
    const name = String(product.name || '').toLowerCase().trim();
    return Boolean(name) && haystack.includes(name);
  });
  if (mentioned) return mentioned;
  return list.length === 1 ? list[0] : undefined;
}
