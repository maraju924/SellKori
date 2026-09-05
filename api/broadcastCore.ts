export type BroadcastAudience = 'all' | 'hot_leads' | 'buyers';

export function normalizeBroadcastAudience(raw: unknown): BroadcastAudience {
  const value = String(raw || 'all').trim().toLowerCase();
  if (value === 'hot_leads' || value === 'hot' || value === 'leads') return 'hot_leads';
  if (value === 'buyers' || value === 'buyer') return 'buyers';
  return 'all';
}

export function featureOn(features: any, key: string): boolean {
  if (!features || typeof features !== 'object' || features[key] === undefined) return true;
  return features[key] !== false;
}

export function broadcastFeaturesAllowed(features: any): boolean {
  return featureOn(features, 'broadcastingEnabled') && featureOn(features, 'messengerRepliesEnabled');
}

export function businessPagesOf(
  businessData: any
): Array<{ pageId: string; pageName: string; pageAccessToken: string; enabled: boolean }> {
  const pages = Array.isArray(businessData?.messengerPages) ? businessData.messengerPages : [];
  return pages
    .map((p: any) => ({
      pageId: String(p?.pageId || '').trim(),
      pageName: String(p?.pageName || '').trim(),
      pageAccessToken: String(p?.pageAccessToken || '').trim(),
      enabled: p?.enabled !== false,
    }))
    .filter((p: any) => p.pageId && p.pageAccessToken);
}

export function pageTokenForBusiness(businessData: any, pageId?: string): string {
  const pid = String(pageId || '').trim();
  const pages = businessPagesOf(businessData);
  if (pid) {
    const exact = pages.find((p) => p.enabled && p.pageId === pid);
    if (exact) return exact.pageAccessToken;
  }
  const rootToken = String(
    businessData?.pageAccessToken || businessData?.accessToken || ''
  ).trim();
  if (rootToken) return rootToken;
  const firstEnabled = pages.find((p) => p.enabled);
  return firstEnabled?.pageAccessToken || '';
}

export function clipBroadcastMessage(raw: unknown, max = 1900): string {
  return String(raw || '').trim().slice(0, max);
}

export function clipBroadcastTitle(raw: unknown, fallback = 'মেসেঞ্জার অফার'): string {
  return String(raw || '').trim().slice(0, 120) || fallback;
}
