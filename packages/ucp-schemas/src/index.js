'use strict';

/**
 * @xpaysh/ucp-schemas — Universal Commerce Protocol schemas + business-profile
 * helper.
 *
 * Two things matter for downstream consumers:
 *
 *   1. `generateUcpProfile(opts)` — emits a spec-compliant UCP business
 *      profile (the JSON body served at `/.well-known/ucp`, no extension).
 *      This is the discovery file Google, Shopify, Etsy, Wayfair, Target and
 *      Walmart fetch to negotiate capabilities before talking to a merchant.
 *      Verified path against:
 *        - https://developers.google.com/merchant/ucp/guides/ucp-profile
 *        - https://ucp.dev/latest/specification/overview/
 *
 *   2. `schemas` + `getSchema(key)` + `getDef(key, def)` — JSON Schema registry
 *      vendored from `Universal-Commerce-Protocol/ucp` `source/`. Keys mirror
 *      the upstream on-disk structure (e.g. 'shopping/checkout',
 *      'shopping/types/item', 'common/types/amount', 'discovery/profile').
 *
 * Zero runtime dependencies — consumers bring their own JSON Schema validator.
 */

const fs = require('fs');
const path = require('path');

/**
 * UCP upstream pins `ucp_version: "draft"` in mkdocs.yml until the spec
 * stabilizes; ucp.dev publishes everything under `/latest/...`. We mirror
 * that here. `SPEC_SOURCE_COMMIT` captures the exact upstream SHA the
 * vendored schemas were lifted from so consumers can pin precisely.
 */
const SPEC_VERSION = 'draft';

/**
 * `WIRE_VERSION` is the dated value actually emitted on the wire (in the
 * profile body, capability entries, service entries). Upstream's
 * `ucp.json#/$defs/version` requires `^\d{4}-\d{2}-\d{2}$`, so the
 * placeholder string 'draft' would fail validation if emitted directly.
 * We pin WIRE_VERSION to the lift date until upstream tags a real revision.
 */
const WIRE_VERSION = '2026-05-18';
const SPEC_SOURCE_COMMIT = '72f5da646bf425e92b20872760fbde3cc41f4bf4';
const SPEC_URL = 'https://github.com/Universal-Commerce-Protocol/ucp';
const SPEC_OPENAPI_PATH = 'source/services/shopping/rest.openapi.json';
const SPEC_SCHEMAS_PATH = 'source/schemas/';

const SCHEMAS_DIR = path.join(__dirname, 'schemas', 'draft');

/**
 * The canonical well-known URI for the UCP business profile. **No file
 * extension** — the spec is explicit about this. Serving the same JSON at
 * `/.well-known/ucp.json` does NOT satisfy the spec.
 */
const UCP_PROFILE_PATH = '/.well-known/ucp';

/**
 * The reverse-domain namespace prefix for xpay-issued custom capabilities.
 * Per UCP namespace-governance rule, vendors MUST use their own reverse-
 * domain namespace; the `dev.ucp.*` namespace is reserved for UCP-
 * governing-body capabilities.
 */
const XPAY_NAMESPACE = 'sh.xpay';

/**
 * Walk SCHEMAS_DIR and register every .json file under a key derived from
 * its relative path. Service contracts (OpenAPI / OpenRPC) under `services/`
 * and `handlers/` are registered too — consumers pluck out an operation
 * definition by traversing into the parsed object.
 *
 * Examples (after `schemas/` prefix-strip below):
 *   schemas['ucp']                          → root protocol-metadata schema
 *   schemas['shopping/checkout']            → checkout payload schema
 *   schemas['shopping/types/item']          → item type
 *   schemas['common/types/amount']          → amount type
 *   schemas['discovery/profile']            → /.well-known/ucp body schema
 *   schemas['services/shopping/rest']       → REST OpenAPI service contract
 *   schemas['services/shopping/mcp']        → MCP OpenRPC service contract
 *   schemas['services/shopping/embedded']   → embedded OpenRPC service contract
 *   schemas['handlers/tokenization']        → tokenization handler OpenAPI
 *   schemas['transports/embedded_config']   → embedded-transport config schema
 */
function buildRegistry() {
  const registry = {};
  walk(SCHEMAS_DIR, '');
  return registry;

  function walk(absDir, relDir) {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(absDir, e.name);
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (!e.isFile() || !rel.endsWith('.json')) continue;
      const key = stripSuffixes(rel.replace(/\.json$/, ''));
      try {
        registry[key] = JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch {
        // Vendored content should never fail to parse; skip if it does.
      }
    }
  }

  function stripSuffixes(key) {
    return key
      .replace(/_schema$/, '')
      .replace(/\.openapi$/, '')
      .replace(/\.openrpc$/, '');
  }
}

const rawRegistry = buildRegistry();

/**
 * Upstream layout nests payload schemas inside a `schemas/` subdirectory.
 * Strip that prefix so consumers write `getSchema('shopping/checkout')`,
 * not `getSchema('schemas/shopping/checkout')`. Discovery, services,
 * handlers, and transports trees are surfaced unchanged.
 */
const schemas = Object.freeze(
  Object.fromEntries(
    Object.entries(rawRegistry).map(([key, value]) => [
      key.replace(/^schemas\//, ''),
      value,
    ]),
  ),
);

/**
 * Resolve a schema by registry key.
 * @param {string} key e.g. 'shopping/checkout', 'common/types/amount', 'discovery/profile'.
 * @returns {object | undefined}
 */
function getSchema(key) {
  return schemas[key];
}

/**
 * Resolve a specific $defs entry inside a registered schema.
 * @param {string} key
 * @param {string} def
 * @returns {object | undefined}
 */
function getDef(key, def) {
  const s = schemas[key];
  return s && s.$defs ? s.$defs[def] : undefined;
}

/** List every registered schema key. */
function listSchemas() {
  return Object.keys(schemas).sort();
}

/**
 * Register every UCP schema with an Ajv instance under all the URIs other
 * schemas might use to `$ref` it. Upstream files use a mix of canonical
 * `$id` URIs (`https://ucp.dev/schemas/...`) and relative file paths
 * (`../schemas/ucp.json`, `types/item.json`). The relative paths don't
 * always resolve correctly against the file's own `$id` base, so we register
 * each schema under both its `$id` and a set of synthetic aliases derived
 * from the on-disk layout.
 *
 * @param {object} ajv - An Ajv instance (callers control draft / formats).
 * @returns {number} Count of unique schemas registered.
 */
function registerForValidation(ajv) {
  let count = 0;
  for (const [key, schema] of Object.entries(schemas)) {
    if (!schema || typeof schema !== 'object') continue;
    const ids = new Set();
    if (schema.$id) ids.add(schema.$id);

    // Alias 1: canonical ucp.dev URI assuming `schemas/` mount point.
    ids.add(`https://ucp.dev/schemas/${key}.json`);
    // Alias 2: same with the upstream `schemas/schemas/` double-prefix that
    // appears when discovery/* refs `../schemas/ucp.json` against its own $id.
    ids.add(`https://ucp.dev/schemas/schemas/${key}.json`);
    // Alias 3: file-relative form some upstream refs use directly.
    ids.add(`${key}.json`);

    for (const id of ids) {
      if (ajv.getSchema(id)) continue;
      try { ajv.addSchema(schema, id); count += 1; } catch { /* duplicate or invalid; ignore */ }
    }
  }
  return count;
}

/** List every `$defs` name across every registered schema. */
function listDefs() {
  const out = [];
  for (const [key, schema] of Object.entries(schemas)) {
    if (schema && schema.$defs) {
      for (const def of Object.keys(schema.$defs)) {
        out.push({ key, def });
      }
    }
  }
  return out;
}

/**
 * Default capabilities the xpay plugin family advertises out of the box.
 *
 * Covers the full set of UCP core capabilities documented at
 * https://ucp.dev/documentation/core-concepts/#business.
 */
const DEFAULT_CAPABILITIES = Object.freeze({
  'dev.ucp.shopping.checkout': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/checkout',
      schema: 'https://ucp.dev/schemas/shopping/checkout.json',
    },
  ],
  'dev.ucp.shopping.catalog.lookup': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/catalog',
      schema: 'https://ucp.dev/schemas/shopping/catalog_lookup.json',
    },
  ],
  'dev.ucp.shopping.catalog.search': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/catalog',
      schema: 'https://ucp.dev/schemas/shopping/catalog_search.json',
    },
  ],
  'dev.ucp.shopping.cart': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/cart',
      schema: 'https://ucp.dev/schemas/shopping/cart.json',
      extends: 'dev.ucp.shopping.checkout',
    },
  ],
  'dev.ucp.shopping.order': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/order',
      schema: 'https://ucp.dev/schemas/shopping/order.json',
      extends: 'dev.ucp.shopping.checkout',
    },
  ],
  'dev.ucp.shopping.fulfillment': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/fulfillment',
      schema: 'https://ucp.dev/schemas/shopping/fulfillment.json',
      extends: 'dev.ucp.shopping.checkout',
    },
  ],
  'dev.ucp.shopping.discount': [
    {
      version: WIRE_VERSION,
      spec: 'https://ucp.dev/specification/discount',
      schema: 'https://ucp.dev/schemas/shopping/discount.json',
      extends: 'dev.ucp.shopping.checkout',
    },
  ],
});

/**
 * Generate a UCP business profile body for `/.well-known/ucp`.
 *
 * @param {object} opts
 * @param {string} opts.endpoint                Base URL of the UCP shopping service
 *                                              (e.g. https://agent-commerce.xpay.sh/ucp/v1/<slug>)
 * @param {string} [opts.version=WIRE_VERSION] Spec revision to advertise (YYYY-MM-DD)
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

  const version = typeof opts.version === 'string' ? opts.version : WIRE_VERSION;
  const capabilities = opts.capabilities || DEFAULT_CAPABILITIES;
  const signingKeys = Array.isArray(opts.signingKeys) ? opts.signingKeys : [];

  const services = {
    'dev.ucp.shopping': [
      {
        version,
        spec: 'https://ucp.dev/specification/overview',
        transport: 'rest',
        endpoint: opts.endpoint,
        schema: 'https://ucp.dev/schemas/services/shopping/rest.openapi.json',
      },
    ],
    ...(opts.extraServices || {}),
  };

  // Business-profile schema requires both `services` and `payment_handlers`
  // (ucp.json#/$defs/business_schema). Emit an empty object when the caller
  // hasn't configured any handlers — the merchant is still discoverable for
  // catalog/shopping while payment handlers are configured server-side.
  const paymentHandlers =
    opts.paymentHandlers && typeof opts.paymentHandlers === 'object'
      ? opts.paymentHandlers
      : {};

  const ucp = { version, services, capabilities, payment_handlers: paymentHandlers };
  return { ucp, signing_keys: signingKeys };
}

module.exports = {
  SPEC_VERSION,
  WIRE_VERSION,
  SPEC_SOURCE_COMMIT,
  SPEC_URL,
  SPEC_OPENAPI_PATH,
  SPEC_SCHEMAS_PATH,
  SCHEMAS_DIR,
  UCP_PROFILE_PATH,
  XPAY_NAMESPACE,
  DEFAULT_CAPABILITIES,
  schemas,
  getSchema,
  getDef,
  listSchemas,
  listDefs,
  registerForValidation,
  generateUcpProfile,
};
