/** Server copy of public shop-slug helpers. Re-exports the shared module. */
export {
  RESERVED_SHOP_SLUGS,
  SHOP_SLUG_MAX,
  SHOP_SLUG_MIN,
  fallbackShopSlug,
  isReservedShopSlug,
  isValidShopSlug,
  matchRequestedShopSlug,
  nextShopSlugCandidate,
  normalizeShopSlug,
  publicShopSlug,
  shopPublicPath,
  shopPublicUrl,
  shopSlugKeys,
  slugEditDistance,
  slugifyStoreName,
  suggestedShopSlug,
} from '../../src/lib/storeSlug.js';
