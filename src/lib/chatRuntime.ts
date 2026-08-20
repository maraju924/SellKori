export const CHAT_MEMORY_LIMIT = 100;

const NEGATED_CONFIRMATION =
  /(?:না|নাহ|করবেন না|করেন না|দিবেন না|দেন না|চাই না|বাতিল|cancel|don't|do not|not now)/i;

const EXPLICIT_ORDER_CONFIRMATION =
  /(?:অর্ডার\s*(?:টা|টি)?\s*(?:কনফার্ম|নিশ্চিত|করুন|করেন|দিন|দেন)|কনফার্ম\s*(?:করুন|করেন|দিন|দেন)?|নিশ্চিত\s*(?:করুন|করেন|দিন|দেন)?|confirm|place\s+(?:the\s+)?order)[.!।\s]*$/i;

const SHORT_CONFIRMATION = /^(?:ঠিক\s*আছে|ওকে|ok|okay|yes|হ্যাঁ|জি)[.!।\s]*$/i;

export function takeRecentMessages<T>(messages: readonly T[], limit = CHAT_MEMORY_LIMIT): T[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : CHAT_MEMORY_LIMIT;
  return messages.slice(-safeLimit);
}

/**
 * A completed checkout must still contain an explicit customer confirmation.
 * This deterministic guard supplements the model output so a valid Messenger
 * order is not lost when the model forgets to toggle should_create_order.
 */
export function isExplicitOrderConfirmation(message: string): boolean {
  const normalized = String(message || '').replace(/\s+/g, ' ').trim();
  if (!normalized || NEGATED_CONFIRMATION.test(normalized)) return false;
  return EXPLICIT_ORDER_CONFIRMATION.test(normalized) || SHORT_CONFIRMATION.test(normalized);
}

export function shouldCreateConfirmedOrder(input: {
  modelRequested: boolean;
  customerMessage: string;
  hasCompleteOrder: boolean;
}): boolean {
  if (!input.hasCompleteOrder) return false;
  if (NEGATED_CONFIRMATION.test(String(input.customerMessage || ''))) return false;
  return input.modelRequested || isExplicitOrderConfirmation(input.customerMessage);
}
