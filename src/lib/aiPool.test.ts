import assert from 'node:assert/strict';
import {
  aiPoolHasProvider,
  buildAiPoolPersistPayload,
  firstEnabledGeminiKey,
  mergeGeminiKeyCandidates,
  normalizePooledGeminiKeys,
  parseAiPoolFromSettings,
  parseFirebaseServiceAccount,
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
  openRouterKey: ' or-key ',
}, 'env-1');
assert.deepEqual(pool.geminiKeys.map((item) => item.key), ['pool-1', 'legacy-1', 'env-1']);
assert.equal(pool.openRouterKey, 'or-key');
assert.equal(firstEnabledGeminiKey(pool), 'pool-1');
assert.equal(aiPoolHasProvider(pool), true);

const envOnly = parseAiPoolFromSettings({}, 'env-only');
assert.equal(firstEnabledGeminiKey(envOnly), 'env-only');
assert.equal(aiPoolHasProvider(parseAiPoolFromSettings({})), false);
assert.equal(aiPoolHasProvider(parseAiPoolFromSettings({ openAiKey: 'sk-1' })), true);

const merged = mergeGeminiKeyCandidates(
  [{ key: 'merchant', label: 'merchant-own', enabled: true }],
  pool.geminiKeys,
);
assert.deepEqual(merged.map((item) => item.key), ['merchant', 'pool-1', 'legacy-1', 'env-1']);

const payload = buildAiPoolPersistPayload({
  geminiKeys: [
    { key: 'AIza-off', label: 'Off', enabled: false },
    { key: 'AIza-on', label: 'On', enabled: true },
  ],
  openRouterKey: 'sk-or',
});
assert.equal(payload.geminiApiKey, 'AIza-on');
assert.equal(payload.openRouterModel, 'openrouter/auto');

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
