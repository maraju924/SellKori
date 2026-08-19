import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Coerce a value to a finite number. Firestore rejects NaN / Infinity and that
 * silently aborts product updates.
 */
export function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Strips all `undefined` / non-finite numbers recursively so Firestore
 * updateDoc/setDoc does not throw 'Unsupported field value' errors.
 */
export function cleanFirestoreData<T = any>(obj: T): T {
  if (typeof obj === 'number' && !Number.isFinite(obj)) {
    return undefined as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanFirestoreData(item))
      .filter(item => item !== undefined) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) continue;
      const nested = cleanFirestoreData(val);
      if (nested !== undefined) {
        cleaned[key] = nested;
      }
    }
    return cleaned as unknown as T;
  }
  return obj;
}

