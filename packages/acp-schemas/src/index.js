'use strict';

/**
 * @xpaysh/acp-schemas — JSON Schemas for the Agentic Commerce Protocol.
 *
 * Schemas vendored from the upstream Apache-2.0 spec at
 * agentic-commerce-protocol/agentic-commerce-protocol, pinned to
 * SPEC_VERSION below.
 *
 * Zero runtime dependencies — consumers bring their own JSON Schema
 * validator (Ajv, Hyperjump, etc.).
 */

const path = require('path');

const SPEC_VERSION = '2026-04-17';
const SPEC_URL = 'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol';
const SPEC_OPENAPI_PATH = 'spec/2026-04-17/openapi/';
const SPEC_JSON_SCHEMA_PATH = 'spec/2026-04-17/json-schema/';

const SCHEMAS_DIR = path.join(__dirname, 'schemas', SPEC_VERSION);

const agenticCheckout = require('./schemas/2026-04-17/schema.agentic_checkout.json');
const cart = require('./schemas/2026-04-17/schema.cart.json');
const delegateAuthentication = require('./schemas/2026-04-17/schema.delegate_authentication.json');
const delegatePayment = require('./schemas/2026-04-17/schema.delegate_payment.json');
const discount = require('./schemas/2026-04-17/schema.discount.json');
const extension = require('./schemas/2026-04-17/schema.extension.json');
const feed = require('./schemas/2026-04-17/schema.feed.json');

/**
 * Schema registry keyed by short name. Each value is the parsed bundle
 * schema (JSON Schema 2020-12) lifted verbatim from upstream.
 *
 * Cross-file `$ref`s in the upstream bundles use relative URIs (e.g.
 * `schema.agentic_checkout.json#/$defs/LineItem`). When passing schemas
 * to a validator, register all bundles so it can resolve references
 * across them — see README for the Ajv snippet.
 */
const schemas = Object.freeze({
  agentic_checkout: agenticCheckout,
  cart,
  delegate_authentication: delegateAuthentication,
  delegate_payment: delegatePayment,
  discount,
  extension,
  feed,
});

/**
 * Resolve a schema bundle by short name (e.g. 'agentic_checkout', 'cart').
 * @param {string} name
 * @returns {object | undefined}
 */
function getSchema(name) {
  return schemas[name];
}

/**
 * Resolve a specific $defs entry inside a bundle. Convenience for the
 * common case of validating against a single type like `CheckoutSession`.
 *
 * @param {string} bundle - Short name of the bundle (e.g. 'agentic_checkout').
 * @param {string} def    - $defs key (e.g. 'CheckoutSession', 'LineItem').
 * @returns {object | undefined}
 */
function getDef(bundle, def) {
  const b = schemas[bundle];
  return b && b.$defs ? b.$defs[def] : undefined;
}

/**
 * List every $defs name inside every bundle, useful for discovery in
 * documentation generators and conformance loops.
 * @returns {Array<{bundle: string, def: string}>}
 */
function listDefs() {
  const out = [];
  for (const [bundle, schema] of Object.entries(schemas)) {
    if (schema && schema.$defs) {
      for (const def of Object.keys(schema.$defs)) {
        out.push({ bundle, def });
      }
    }
  }
  return out;
}

module.exports = {
  SPEC_VERSION,
  SPEC_URL,
  SPEC_OPENAPI_PATH,
  SPEC_JSON_SCHEMA_PATH,
  SCHEMAS_DIR,
  schemas,
  getSchema,
  getDef,
  listDefs,
};
