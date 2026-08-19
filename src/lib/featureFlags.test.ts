import assert from 'node:assert/strict';
import {
  buildFeaturePromptBlock,
  countEnabled,
  FEATURE_CATALOG,
  isFeatureEnabled,
  isQuietHoursNow,
  mergeFeatures,
  parseMinutes,
  shouldRunAi
} from './featureFlags.ts';

function testDefaults() {
  const merged = mergeFeatures(undefined);
  assert.equal(merged.aiEnabled, true);
  assert.equal(isFeatureEnabled({}, 'aiEnabled'), true);
  assert.equal(isFeatureEnabled({ aiEnabled: false }, 'aiEnabled'), false);
  assert.equal(FEATURE_CATALOG.length, countEnabled({}).total);
}

function testQuietHoursOvernight() {
  const features = { quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00' };
  const night = new Date('2026-08-19T16:30:00Z'); // 22:30 Dhaka (UTC+6)
  const morning = new Date('2026-08-19T01:00:00Z'); // 07:00 Dhaka
  const noon = new Date('2026-08-19T06:00:00Z'); // 12:00 Dhaka
  assert.equal(isQuietHoursNow(features, night), true);
  assert.equal(isQuietHoursNow(features, morning), true);
  assert.equal(isQuietHoursNow(features, noon), false);
  assert.equal(shouldRunAi({ aiEnabled: true, ...features }, night), false);
  assert.equal(shouldRunAi({ aiEnabled: true, ...features }, noon), true);
}

function testParseMinutes() {
  assert.equal(parseMinutes('22:00', '00:00'), 22 * 60);
  assert.equal(parseMinutes('bad', '08:00'), 8 * 60);
}

function testPromptDirectives() {
  const block = buildFeaturePromptBlock({ negotiationEnabled: false, autoOrderEnabled: false });
  assert.match(block, /দরদাম নিষিদ্ধ/);
  assert.match(block, /should_create_order সবসময় false/);
}

function testCount() {
  const { on, total } = countEnabled({ aiEnabled: false, broadcastingEnabled: false, quietHoursEnabled: true });
  assert.equal(total, FEATURE_CATALOG.length);
  assert.equal(on, total - 2);
}

testDefaults();
testQuietHoursOvernight();
testParseMinutes();
testPromptDirectives();
testCount();
console.log('featureFlags tests passed');
