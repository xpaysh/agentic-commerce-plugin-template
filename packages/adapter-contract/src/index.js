'use strict';

/**
 * @xpaysh/adapter-contract — minimal runtime surface.
 *
 * The package is types-first; this JS file exists only to host a tiny
 * adapter-registry helper (used by hosted dispatch layers like
 * agent-commerce.xpay.sh) and the canonical capability-flag constants.
 * Everything else is in index.d.ts.
 */

/**
 * Capability flags an adapter advertises. Matches UCP capability identifiers
 * 1-for-1 where possible; the `extras` map is for vendor-specific extensions.
 */
const CAPABILITIES = Object.freeze({
  // dev.ucp.shopping.* — present implies the adapter implements the
  // matching method (e.g. `cart` ⇔ createCart/updateCart/getCart).
  CART: 'cart',
  CHECKOUT: 'checkout',
  CATALOG_SEARCH: 'catalog.search',
  CATALOG_LOOKUP: 'catalog.lookup',
  ORDER: 'order',
  // Optional capabilities — only set if the corresponding optional method
  // is implemented.
  REFUNDS: 'refunds',
  DISPUTES: 'disputes',
  // Soft signals that downstream code can branch on.
  INVENTORY_REALTIME: 'inventory.realtime',
  WEBHOOKS: 'webhooks',
});

const REQUIRED_METHODS = Object.freeze([
  'listProducts',
  'getProduct',
  'createCart',
  'updateCart',
  'getCart',
  'completeCheckout',
  'getOrder',
  'listOrders',
]);

/**
 * Validate that a value looks like a PlatformAdapter at runtime. Returns
 * { ok: true } or { ok: false, missing }. Use this on registry boundaries
 * (e.g., when a sibling plugin hot-loads an adapter at server startup).
 *
 * @param {unknown} adapter
 * @returns {{ ok: true } | { ok: false, missing: string[] }}
 */
function isAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    return { ok: false, missing: ['<adapter is not an object>'] };
  }
  const missing = [];
  if (typeof adapter.platformName !== 'string' || !adapter.platformName) {
    missing.push('platformName');
  }
  if (!adapter.capabilities || typeof adapter.capabilities !== 'object') {
    missing.push('capabilities');
  }
  for (const m of REQUIRED_METHODS) {
    if (typeof adapter[m] !== 'function') missing.push(m + '()');
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/**
 * In-memory registry keyed by merchant slug. The hosted backend uses this
 * to dispatch incoming protocol calls to the right per-merchant adapter.
 *
 * @returns {{ register, get, list, remove }}
 */
function createAdapterRegistry() {
  const map = new Map();

  return {
    /**
     * @param {string} slug
     * @param {object} adapter
     */
    register(slug, adapter) {
      if (typeof slug !== 'string' || !slug) {
        throw new TypeError('register: slug (non-empty string) is required');
      }
      const check = isAdapter(adapter);
      if (!check.ok) {
        throw new TypeError(
          'register: adapter is missing required members: ' + check.missing.join(', ')
        );
      }
      map.set(slug, adapter);
    },

    /** @param {string} slug @returns {object | undefined} */
    get(slug) { return map.get(slug); },

    /** @returns {string[]} */
    list() { return Array.from(map.keys()); },

    /** @param {string} slug @returns {boolean} */
    remove(slug) { return map.delete(slug); },
  };
}

module.exports = {
  CAPABILITIES,
  REQUIRED_METHODS,
  isAdapter,
  createAdapterRegistry,
};
