'use strict';

const llmsTxt = require('./llms-txt');
const ucpProfile = require('./ucp-profile');
const robotsAiAllowlist = require('./robots-ai-allowlist');
const schemaOrgProduct = require('./schema-org-product');
const agentCard = require('./agent-card');
const oauthProtectedResource = require('./oauth-protected-resource');

// NOTE: `no-fictitious-wellknowns` (discovery.no_fictitious_wellknowns) is
// deliberately UNREGISTERED — it scored merchants down for serving paths that
// xpay's own stack emits or emitted (e.g. /.well-known/agentic-commerce.json
// shipped by our 0.1.x plugin, /.well-known/mcp.json + /agents.txt served by
// our sidecar). That is xpay footprint, not agent-readiness. The file is kept
// for reference but is not part of ALL_CHECKS. (Sri, 2026-06-15.)
const ALL_CHECKS = [
  llmsTxt,
  ucpProfile,
  robotsAiAllowlist,
  schemaOrgProduct,
  agentCard,
  oauthProtectedResource,
];

function byId(id) {
  return ALL_CHECKS.find(function (c) { return c.id === id; }) || null;
}

module.exports = { ALL_CHECKS, byId };
