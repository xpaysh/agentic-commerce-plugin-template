'use strict';

/**
 * @xpaysh/ucp-schemas — JSON Schemas for the Universal Commerce Protocol.
 *
 * v0.0.x reserves the namespace and establishes the package shape.
 * Schemas are lifted from the upstream spec at Universal-Commerce-Protocol/ucp
 * starting with v0.1.0 (pinned to SPEC_VERSION below).
 */

const SPEC_VERSION = '2026-04-08';
const SPEC_URL = 'https://github.com/Universal-Commerce-Protocol/ucp';
const SPEC_OPENAPI_PATH = 'source/services/shopping/openapi.json';
const SPEC_SCHEMAS_PATH = 'source/schemas/';

/**
 * Placeholder schema registry. Keys will populate from upstream JSON Schemas
 * starting in v0.1.0 — `cart`, `checkout`, `order`, `catalog`, etc., plus the
 * MCP / A2A binding shapes.
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
  SPEC_SCHEMAS_PATH,
  schemas,
  getSchema,
};
