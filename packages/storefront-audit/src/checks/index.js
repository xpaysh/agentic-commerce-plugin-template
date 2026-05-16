'use strict';

const llmsTxt = require('./llms-txt');
const ucpProfile = require('./ucp-profile');
const noFictitiousWellknowns = require('./no-fictitious-wellknowns');
const robotsAiAllowlist = require('./robots-ai-allowlist');
const schemaOrgProduct = require('./schema-org-product');
const agentCard = require('./agent-card');
const oauthProtectedResource = require('./oauth-protected-resource');

const ALL_CHECKS = [
  llmsTxt,
  ucpProfile,
  noFictitiousWellknowns,
  robotsAiAllowlist,
  schemaOrgProduct,
  agentCard,
  oauthProtectedResource,
];

function byId(id) {
  return ALL_CHECKS.find(function (c) { return c.id === id; }) || null;
}

module.exports = { ALL_CHECKS, byId };
