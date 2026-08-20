/**
 * Upload product/review images to a publicly fetchable URL.
 *
 * Firestore documents are capped at 1MB. Storing several base64 photos inside
 * the business.products array silently fails the save — which is why merchants
 * could pick review images in the UI but they never actually persisted.
 *
 * Strategy:
 *  1. Try Firebase Storage (gives a real https URL Facebook Messenger can fetch).
 *  2. Fall back to POST /api/media/upload which stores one image per Firestore
 *     doc and serves it at /api/media/:id.
 */

import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export function isPublicHttpUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('https://') || url.startsWith('http://');
}

export function isDataUrl(url?: string | null): boolean {
  return typeof url === 'string' && url.startsWith('data:');
}

async function uploadViaStorage(dataUrl: string, businessId: string, kind: string): Promise<string | null> {
  if (!storage) return null;
  try {
    const ext = dataUrl.includes('image/webp') ? 'webp' : dataUrl.includes('image/png') ? 'png' : 'jpg';
    const path = `product-media/${businessId || 'store'}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);
    return url || null;
  } catch (err) {
    console.warn('[mediaUpload] Firebase Storage upload failed, will try API fallback:', err);
    return null;
  }
}

async function uploadViaApi(dataUrl: string, businessId: string, kind: string): Promise<string | null> {
  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl, businessId, kind }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[mediaUpload] API upload failed:', err);
      return null;
    }
    const data = await res.json();
    if (data?.url) {
      // Prefer absolute URL so Messenger / other devices can fetch it.
      if (data.url.startsWith('http')) return data.url;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}${data.url}`;
    }
    return null;
  } catch (err) {
    console.warn('[mediaUpload] API upload error:', err);
    return null;
  }
}

export async function persistImageDataUrl(
  dataUrl: string,
  businessId: string,
  kind: 'product' | 'review' | 'logo' = 'product'
): Promise<string> {
  if (!dataUrl) throw new Error('খালি ছবি আপলোড করা যায় না');
  if (isPublicHttpUrl(dataUrl)) return dataUrl;

  const viaStorage = await uploadViaStorage(dataUrl, businessId, kind);
  if (viaStorage) return viaStorage;

  const viaApi = await uploadViaApi(dataUrl, businessId, kind);
  if (viaApi) return viaApi;

  // Last-resort: keep a tiny data URL so the merchant still sees a preview.
  // This will NOT be sendable to Messenger and may still fail Firestore if
  // too many are stored — so we only allow it if it is small.
  if (dataUrl.length < 80_000) return dataUrl;

  throw new Error('ছবি সংরক্ষণ করা যায়নি। অনুগ্রহ করে ছোট সাইজের ছবি দিন বা পরে আবার চেষ্টা করুন।');
}

export async function persistImageList(
  urls: string[],
  businessId: string,
  kind: 'product' | 'review' = 'product'
): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    out.push(await persistImageDataUrl(url, businessId, kind));
  }
  return out;
}

/**
 * Best-effort image persist for product saves. A single failed upload must not
 * abort the whole catalog write — keep a public URL if we already have one.
 */
export async function persistImageListBestEffort(
  urls: string[],
  businessId: string,
  kind: 'product' | 'review' = 'product'
): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    try {
      out.push(await persistImageDataUrl(url, businessId, kind));
    } catch (err) {
      console.warn('[mediaUpload] Skipping image that could not be hosted:', err);
      if (isPublicHttpUrl(url)) out.push(url);
    }
  }
  return out;
}
