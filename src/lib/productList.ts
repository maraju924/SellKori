import type { Product } from '../types';

export function sameProductId(a?: string | number | null, b?: string | number | null): boolean {
  if (a == null || b == null) return false;
  const left = String(a).trim();
  const right = String(b).trim();
  return left.length > 0 && left === right;
}

/** Firestore sometimes stores `products` as a map instead of an array. */
export function asProductList(raw: unknown): Product[] {
  if (Array.isArray(raw)) {
    return raw.filter(Boolean) as Product[];
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, Product>).filter(Boolean);
  }
  return [];
}

export function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => omitUndefined(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      out[key] = omitUndefined(nested);
    }
    return out as T;
  }
  return value;
}
