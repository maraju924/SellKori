import assert from 'node:assert/strict';
import {
  aiPoolHasProvider,
  buildAiPoolPersistPayload,
  firstEnabledGeminiKey,
  geminiFailoverCandidates,
  mergeGeminiKeyCandidates,
  normalizePooledGeminiKeys,
  parseAiPoolFromSettings,
  parseFirebaseServiceAccount,
  resolveSystemGeminiModel,
  FALLBACK_GEMINI_MODEL,
} from './aiPool.ts';

const keys = normalizePooledGeminiKeys([
  { key: ' AIza1 ', label: ' One ', enabled: true },
  { key: 'AIza1', label: 'dup', enabled: true },
  { key: '', label: 'empty' },
  { key: 'AIza2', enabled: false },
]);
assert.equal(keys.length, 2);
assert.equal(keys[0].label, 'One');
assert.equal(keys[1].enabled, false);

const pool = parseAiPoolFromSettings({
  geminiKeys: [{ key: 'pool-1', label: 'Pool', enabled: true }],
  geminiApiKey: 'legacy-1',
  defaultAiModel: 'gemini-3.1-pro-preview',
  openRouterKey: ' or-key ',
}, 'env-1');
assert.equal(pool.defaultGeminiKey, 'legacy-1');
assert.equal(pool.defaultGeminiKeyLabel, 'Default Key');
assert.deepEqual(pool.geminiKeys.map((item) => item.key), ['pool-1', 'env-1']);
assert.equal(pool.openRouterKey, 'or-key');
assert.equal(pool.geminiModel, 'gemini-3.1-pro-preview');
assert.equal(firstEnabledGeminiKey(pool), 'legacy-1');
assert.equal(aiPoolHasProvider(pool), true);

const envOnly = parseAiPoolFromSettings({}, 'env-only');
assert.equal(envOnly.defaultGeminiKey, 'env-only');
assert.equal(envOnly.defaultGeminiKeyLabel, 'ENV Key');
assert.deepEqual(envOnly.geminiKeys, []);
assert.equal(firstEnabledGeminiKey(envOnly), 'env-only');
assert.equal(aiPoolHasProvider(parseAiPoolFromSettings({})), false);
assert.equal(aiPoolHasProvider(parseAiPoolFromSettings({ openAiKey: 'sk-1' })), true);

const poolOnly = parseAiPoolFromSettings({
  geminiKeys: [{ key: 'pool-1', label: 'Pool', enabled: true }],
});
assert.equal(poolOnly.defaultGeminiKey, '');
assert.equal(firstEnabledGeminiKey(poolOnly), 'pool-1');
assert.equal(poolOnly.geminiModel, FALLBACK_GEMINI_MODEL);

const defaultAlsoInPool = parseAiPoolFromSettings({
  geminiApiKey: 'same-key',
  geminiKeys: [
    { key: 'same-key', label: 'Dup', enabled: true },
    { key: 'pool-2', label: 'Backup', enabled: true },
  ],
});
assert.deepEqual(defaultAlsoInPool.geminiKeys.map((item) => item.key), ['pool-2']);
assert.deepEqual(
  geminiFailoverCandidates(defaultAlsoInPool).map((item) => item.key),
  ['same-key', 'pool-2'],
);

const merged = mergeGeminiKeyCandidates(
  [{ key: 'merchant', label: 'merchant-own', enabled: true }],
  pool.geminiKeys,
);
assert.deepEqual(merged.map((item) => item.key), ['merchant', 'pool-1', 'env-1']);

assert.deepEqual(
  geminiFailoverCandidates(pool, [{ key: 'merchant', label: 'merchant-own', enabled: true }]).map((item) => item.key),
  ['merchant', 'legacy-1', 'pool-1', 'env-1'],
);

const payload = buildAiPoolPersistPayload({
  geminiKeys: [
    { key: 'AIza-off', label: 'Off', enabled: false },
    { key: 'AIza-on', label: 'On', enabled: true },
  ],
  openRouterKey: 'sk-or',
});
assert.equal('geminiApiKey' in payload, false);
assert.deepEqual(payload.geminiKeys.map((item) => item.key), ['AIza-off', 'AIza-on']);
assert.equal(payload.openRouterModel, 'openrouter/auto');

assert.equal(resolveSystemGeminiModel(''), FALLBACK_GEMINI_MODEL);
assert.equal(resolveSystemGeminiModel('gemini-1.5-flash'), FALLBACK_GEMINI_MODEL);
assert.equal(resolveSystemGeminiModel('gemini-2.5-flash'), FALLBACK_GEMINI_MODEL);
assert.equal(resolveSystemGeminiModel('  gemini-3.1-pro-preview  '), 'gemini-3.1-pro-preview');
assert.equal(parseAiPoolFromSettings({ defaultAiModel: 'gemini-1.5-pro' }).geminiModel, FALLBACK_GEMINI_MODEL);

const saJson = JSON.stringify({
  client_email: 'svc@example.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
  project_id: 'demo',
});
assert.equal(parseFirebaseServiceAccount(saJson)?.client_email, 'svc@example.com');
assert.equal(parseFirebaseServiceAccount(Buffer.from(saJson, 'utf8').toString('base64'))?.project_id, 'demo');
assert.equal(parseFirebaseServiceAccount('not-json'), null);
assert.equal(parseFirebaseServiceAccount(''), null);

console.log('aiPool tests passed');
