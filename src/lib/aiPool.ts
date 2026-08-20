export interface PooledGeminiKey {
  key: string;
  label: string;
  enabled: boolean;
}

export interface AiPool {
  geminiKeys: PooledGeminiKey[];
  openRouterKey: string;
  openRouterModel: string;
  openAiKey: string;
  openAiModel: string;
}

export function normalizePooledGeminiKeys(raw: unknown): PooledGeminiKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const keys: PooledGeminiKey[] = [];
  for (const item of raw) {
    const key = String((item as any)?.key || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push({
      key,
      label: String((item as any)?.label || '').trim() || `Gemini Key ${keys.length + 1}`,
      enabled: (item as any)?.enabled !== false,
    });
  }
  return keys;
}

export function parseAiPoolFromSettings(data: Record<string, unknown> | null | undefined, envKey = ''): AiPool {
  const pool: AiPool = {
    geminiKeys: normalizePooledGeminiKeys(data?.geminiKeys),
    openRouterKey: String(data?.openRouterKey || '').trim(),
    openRouterModel: String(data?.openRouterModel || '').trim() || 'openrouter/auto',
    openAiKey: String(data?.openAiKey || '').trim(),
    openAiModel: String(data?.openAiModel || '').trim() || 'gpt-4o-mini',
  };

  const legacy = String(data?.geminiApiKey || '').trim();
  if (legacy && !pool.geminiKeys.some((item) => item.key === legacy)) {
    pool.geminiKeys.push({ key: legacy, label: 'Legacy Key', enabled: true });
  }

  const env = String(envKey || '').trim();
  if (env && !pool.geminiKeys.some((item) => item.key === env)) {
    pool.geminiKeys.push({ key: env, label: 'ENV Key', enabled: true });
  }

  return pool;
}

export function firstEnabledGeminiKey(pool: AiPool): string {
  return pool.geminiKeys.find((item) => item.enabled && item.key)?.key || '';
}

export function aiPoolHasProvider(pool: AiPool): boolean {
  return Boolean(firstEnabledGeminiKey(pool) || pool.openRouterKey || pool.openAiKey);
}

export function mergeGeminiKeyCandidates(
  preferred: PooledGeminiKey[] | undefined,
  poolKeys: PooledGeminiKey[],
): PooledGeminiKey[] {
  return [...(preferred || []), ...poolKeys].filter(
    (candidate, index, all) =>
      Boolean(candidate.key) && all.findIndex((item) => item.key === candidate.key) === index,
  );
}

export function buildAiPoolPersistPayload(input: {
  geminiKeys: PooledGeminiKey[];
  openRouterKey?: string;
  openRouterModel?: string;
  openAiKey?: string;
  openAiModel?: string;
}) {
  const geminiKeys = normalizePooledGeminiKeys(input.geminiKeys);
  return {
    geminiKeys,
    geminiApiKey: firstEnabledGeminiKey({
      geminiKeys,
      openRouterKey: '',
      openRouterModel: '',
      openAiKey: '',
      openAiModel: '',
    }),
    openRouterKey: String(input.openRouterKey || '').trim(),
    openRouterModel: String(input.openRouterModel || '').trim() || 'openrouter/auto',
    openAiKey: String(input.openAiKey || '').trim(),
    openAiModel: String(input.openAiModel || '').trim() || 'gpt-4o-mini',
  };
}

export function parseFirebaseServiceAccount(raw: string | undefined | null): Record<string, string> | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const candidates = [value];
  try {
    if (typeof Buffer !== 'undefined') {
      candidates.push(Buffer.from(value, 'base64').toString('utf8'));
    } else if (typeof atob === 'function') {
      candidates.push(atob(value));
    }
  } catch {
    // ignore invalid base64
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && parsed.private_key && parsed.client_email) {
        return parsed;
      }
    } catch {
      // try next
    }
  }
  return null;
}
