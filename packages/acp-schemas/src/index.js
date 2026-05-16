'use strict';

/**
 * @xpaysh/acp-schemas — JSON Schemas for the Agentic Commerce Protocol.
 *
 * v0.0.x reserves the namespace and establishes the package shape.
 * Schemas are lifted from the upstream spec at agentic-commerce-protocol/agentic-commerce-protocol
 * starting with v0.1.0 (pinned to SPEC_VERSION below).
 *
 * See README.md and the upstream RFCs for the canonical definitions.
 */

const SPEC_VERSION = '2026-04-17';
const SPEC_URL = 'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol';
const SPEC_OPENAPI_PATH = 'spec/2026-04-17/openapi/';
const SPEC_JSON_SCHEMA_PATH = 'spec/2026-04-17/json-schema/';

/**
 * Placeholder schema registry. Keys will populate from upstream JSON Schemas
 * starting in v0.1.0 — `checkout_session`, `delegate_payment`, `order`, etc.
 *
 * Consumers should not rely on this object having entries in v0.0.x; use it
 * only to verify the package import shape.
 */
const schemas = Object.freeze({});

/**
 * Resolve a schema by name. Returns undefined for unknown names in v0.0.x.
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
  SPEC_JSON_SCHEMA_PATH,
  schemas,
  getSchema,
};
