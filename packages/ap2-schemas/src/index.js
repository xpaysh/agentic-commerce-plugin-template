'use strict';

/**
 * @xpaysh/ap2-schemas — JSON Schemas for the Agent Payments Protocol.
 *
 * v0.0.x reserves the namespace and establishes the package shape.
 * Schema content lifted from google-agentic-commerce/AP2 in v0.1.0.
 *
 * AP2 is currently in draft/preview; SPEC_VERSION will move to a stable
 * tag once Google publishes one.
 */

const SPEC_VERSION = 'draft';
const SPEC_URL = 'https://github.com/google-agentic-commerce/AP2';

/**
 * Placeholder schema registry. Keys will populate from upstream definitions
 * starting in v0.1.0 — `mandate`, `verifiable_credential`, `a2a_message`, etc.
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
  schemas,
  getSchema,
};
