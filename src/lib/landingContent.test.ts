import assert from 'node:assert/strict';
import {
  buildPublicSiteConfig,
  defaultPublicSiteConfig,
  formatBnNumber,
  interpolateCopy,
  sanitizeLandingContent,
} from './landingContent.ts';

assert.equal(formatBnNumber(100000), '১০০০০০');
assert.equal(formatBnNumber(20), '২০');

const interpolated = interpolateCopy('ট্রায়াল {freeTrial}, রেট {tokenRate}, ফি {serverFee}', {
  tokenRatePerLakh: 20,
  monthlyServerCost: 1000,
  freeTrialTokens: 100000,
});
assert.match(interpolated, /১০০০০০/);
assert.match(interpolated, /২০/);
assert.match(interpolated, /১০০০/);

const sanitized = sanitizeLandingContent({
  heroHeadline: '<b>হ্যালো</b>',
  primaryCta: 'শুরু',
  features: [{ title: 'এক', description: 'দুই', bullets: ['ক'] }],
  faqs: [{ q: 'কী?', a: 'উত্তর {tokenRate}' }],
}, { tokenRatePerLakh: 25, monthlyServerCost: 1000, freeTrialTokens: 5000 });
assert.equal(sanitized.heroHeadline, 'হ্যালো');
assert.equal(sanitized.features[0].title, 'এক');
assert.equal(sanitized.faqs[0].a.includes('২৫'), true);
assert.ok(sanitized.nav.length >= 4);

const stripped = sanitizeLandingContent(null);
assert.equal(stripped.brandSuffix, 'Kori');

const built = buildPublicSiteConfig({
  globalAnnouncement: 'রক্ষণাবেক্ষণ',
  maintenanceMode: true,
  tokenRatePerLakh: 30,
  landing: { primaryCta: 'প্রবেশ' },
}, { monthlyServerCost: 1500, freeTrialTokens: 200000 });
assert.equal(built.globalAnnouncement, 'রক্ষণাবেক্ষণ');
assert.equal(built.maintenanceMode, true);
assert.equal(built.billing.tokenRatePerLakh, 30);
assert.equal(built.billing.monthlyServerCost, 1500);
assert.equal(built.landing.primaryCta, 'প্রবেশ');

const fallback = defaultPublicSiteConfig();
assert.equal(fallback.billing.freeTrialTokens, 100000);
assert.ok(fallback.landing.faqs.length > 0);

console.log('landingContent tests passed');
