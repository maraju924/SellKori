/**
 * Safely parse a fetch Response as JSON.
 *
 * Vercel (and other proxies) return plain-text bodies like
 * "A server error has occurred / FUNCTION_INVOCATION_FAILED" on crashes.
 * Calling res.json() on those throws the cryptic
 * `Unexpected token 'A', "A server e"... is not valid JSON` error.
 * This helper converts such responses into a readable Bengali message instead.
 */
export async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (res.status >= 500) {
      throw new Error(`সার্ভারে সাময়িক সমস্যা হচ্ছে (HTTP ${res.status})। কিছুক্ষণ পরে আবার চেষ্টা করুন।`);
    }
    throw new Error(
      `সার্ভার থেকে অপ্রত্যাশিত উত্তর (HTTP ${res.status})${snippet ? `: ${snippet}` : ''}`
    );
  }
}
