'use strict';

/**
 * @xpaysh/ucp-schemas — Universal Commerce Protocol schemas + business-profile
 * helper.
 *
 * The package pins to upstream UCP spec rev SPEC_VERSION below. Two things
 * matter for downstream consumers:
 *
 *   1. `generateUcpProfile(opts)` — emits a spec-compliant UCP business
 *      profile (the JSON body served at `/.well-known/ucp`, no extension).
 *      This is the discovery file Google, Shopify, Etsy, Wayfair, Target and
 *      Walmart fetch to negotiate capabilities before talking to a merchant.
 *      Verified path against:
 *        - https://developers.google.com/merchant/ucp/guides/ucp-profile
 *        - https://ucp.dev/latest/specification/overview/
 *
 *   2. `schemas` + `getSchema(name)` — JSON Schema registry (populated from
 *      Universal-Commerce-Protocol/ucp source in later 0.1.x releases).
 */

const SPEC_VERSION = '2026-04-08';
const SPEC_URL = 'https://github.com/Universal-Commerce-Protocol/ucp';
const SPEC_OPENAPI_PATH = 'source/services/shopping/openapi.json';
const SPEC_SCHEMAS_PATH = 'source/schemas/';

/**
 * The canonical well-known URI for the UCP business profile. **No file
 * extension** — the spec is explicit about this. Serving the same JSON at
 * `/.well-known/ucp.json` does NOT satisfy the spec.
 */
const UCP_PROFILE_PATH = '/.well-known/ucp';

/**
 * Default capabilities the xpay plugin family advertises out of the box.
 * Each entry mirrors the example in Google's UCP profile guide.
 */
const DEFAULT_CAPABILITIES = Object.freeze({
  'dev.ucp.shopping.checkout': [
    {
      version: SPEC_VERSION,
      spec: 'https://ucp.dev/specification/checkout',
      schema: `https://ucp.dev/${SPEC_VERSION}/schemas/shopping/checkout.json`,
    },
  ],
  'dev.ucp.shopping.fulfillment': [
    {
      version: SPEC_VERSION,
      spec: 'https://ucp.dev/specification/fulfillment',
      schema: `https://ucp.dev/${SPEC_VERSION}/schemas/shopping/fulfillment.json`,
      extends: 'dev.ucp.shopping.checkout',
    },
  ],
  'dev.ucp.shopping.discount': [
    {
      version: SPEC_VERSION,
      spec: 'https://ucp.dev/specification/discount',
      schema: `https://ucp.dev/${SPEC_VERSION}/schemas/shopping/discount.json`,
      extends: 'dev.ucp.shopping.checkout',
    },
  ],
  'dev.ucp.shopping.order': [
    {
      version: SPEC_VERSION,
      spec: 'https://ucp.dev/latest/specification/order',
      schema: `https://ucp.dev/${SPEC_VERSION}/schemas/shopping/order.json`,
    },
  ],
});

/**
 * Generate a UCP business profile body for `/.well-known/ucp`.
 *
 * @param {object} opts
 * @param {string} opts.endpoint                Base URL of the UCP shopping service
 *                                              (e.g. https://agent-commerce.xpay.sh/ucp/v1/<slug>)
 * @param {string} [opts.version=SPEC_VERSION]  Spec revision to advertise
 * @param {object} [opts.capabilities]          Override the default capability map
 * @param {object} [opts.paymentHandlers]       Map of payment-handler id → handler-config array
 * @param {object[]} [opts.signingKeys=[]]      JWK array for verifying messages from the server
 * @param {object} [opts.extraServices]         Additional `services` entries merged in
 * @returns {object} A JSON-serialisable UCP profile body
 */
function generateUcpProfile(opts) {
  if (!opts || typeof opts.endpoint !== 'string' || !opts.endpoint) {
    throw new TypeError('generateUcpProfile: opts.endpoint (string) is required');
  }

  const version = typeof opts.version === 'string' ? opts.version : SPEC_VERSION;
  const capabilities = opts.capabilities || DEFAULT_CAPABILITIES;
  const signingKeys = Array.isArray(opts.signingKeys) ? opts.signingKeys : [];

  const services = {
    'dev.ucp.shopping': [
      {
        version,
        spec: 'https://ucp.dev/specification/overview',
        transport: 'rest',
        endpoint: opts.endpoint,
        schema: `https://ucp.dev/${version}/services/shopping/rest.openapi.json`,
      },
    ],
    ...(opts.extraServices || {}),
  };

  const ucp = { version, services, capabilities };
  if (opts.paymentHandlers && typeof opts.paymentHandlers === 'object') {
    ucp.payment_handlers = opts.paymentHandlers;
  }

  return { ucp, signing_keys: signingKeys };
}

/**
 * Placeholder schema registry. Populated from Universal-Commerce-Protocol/ucp
 * in later 0.1.x releases. Empty in 0.1.0.
 */
const schemas = Object.freeze({});

/**
 * Resolve a schema by name. Returns undefined for unknown names.
 * @param {string} name
 * @returns {object | undefined}
 */
function getSchema(name) {
  return schemas[name];
}

module.exports = {
  SPEC_VERSION,
  SPEC_URL,
  SPEC_OPENAPI_PATH,
  SPEC_SCHEMAS_PATH,
  UCP_PROFILE_PATH,
  DEFAULT_CAPABILITIES,
  generateUcpProfile,
  schemas,
  getSchema,
};
