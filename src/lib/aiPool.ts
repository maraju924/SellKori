export interface PooledGeminiKey {
  key: string;
  label: string;
  enabled: boolean;
}

export const FALLBACK_GEMINI_MODEL = 'gemini-3.7-flash';

const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro',
]);

export function resolveSystemGeminiModel(raw: unknown): string {
  const model = String(raw || '').trim();
  if (!model || RETIRED_GEMINI_MODELS.has(model)) return FALLBACK_GEMINI_MODEL;
  return model;
}

export interface AiPool {
  /** Global Gemini engine key — tried first, before the backup pool. */
  defaultGeminiKey: string;
  defaultGeminiKeyLabel: string;
  /** Backup Gemini keys used only after the default key hits quota/auth errors. */
  geminiKeys: PooledGeminiKey[];
  /** Model selected in Global Gemini AI Engine configuration. */
  geminiModel: string;
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
  const firestoreDefault = String(data?.geminiApiKey || '').trim();
  const env = String(envKey || '').trim();
  const defaultGeminiKey = firestoreDefault || env;
  const defaultGeminiKeyLabel = firestoreDefault ? 'Default Key' : (env ? 'ENV Key' : '');

  const geminiKeys = normalizePooledGeminiKeys(data?.geminiKeys)
    .filter((item) => item.key !== defaultGeminiKey);

  if (firestoreDefault && env && env !== firestoreDefault && !geminiKeys.some((item) => item.key === env)) {
    geminiKeys.push({ key: env, label: 'ENV Key', enabled: true });
  }

  return {
    defaultGeminiKey,
    defaultGeminiKeyLabel,
    geminiKeys,
    geminiModel: resolveSystemGeminiModel(data?.defaultAiModel),
    openRouterKey: String(data?.openRouterKey || '').trim(),
    openRouterModel: String(data?.openRouterModel || '').trim() || 'openrouter/auto',
    openAiKey: String(data?.openAiKey || '').trim(),
    openAiModel: String(data?.openAiModel || '').trim() || 'gpt-4o-mini',
  };
}

export function firstEnabledGeminiKey(pool: AiPool): string {
  if (pool.defaultGeminiKey) return pool.defaultGeminiKey;
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

/** Merchant own key → global default key → backup pool keys. */
export function geminiFailoverCandidates(
  pool: AiPool,
  preferred?: PooledGeminiKey[],
): PooledGeminiKey[] {
  const defaultKeys: PooledGeminiKey[] = pool.defaultGeminiKey
    ? [{
        key: pool.defaultGeminiKey,
        label: pool.defaultGeminiKeyLabel || 'Default Key',
        enabled: true,
      }]
    : [];
  return mergeGeminiKeyCandidates(preferred, [...defaultKeys, ...pool.geminiKeys]);
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
