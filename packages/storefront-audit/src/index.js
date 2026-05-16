'use strict';

/**
 * @xpaysh/storefront-audit — conformance + readiness auditor for agentic-
 * commerce storefronts. Zero runtime dependencies; pure HTTP; no auth.
 *
 * v0.1 covers the discovery layer:
 *   - /llms.txt (llmstxt.org)
 *   - /.well-known/ucp (UCP business profile)
 *   - /.well-known/agent-card.json (A2A 1.0, watchlist)
 *   - /.well-known/oauth-protected-resource (RFC 9728, optional)
 *   - schema.org Product JSON-LD on a PDP
 *   - robots.txt AI-crawler allowlist (RFC 9309)
 *   - rejection of fictitious well-known URIs (the project denylist)
 *
 * Protocol-level + commerce-level checks land in v0.2+ (see roadmap notes in
 * the README). Library + CLI (`ac-doctor`). Programmatic API:
 *
 *   const { audit } = require('@xpaysh/storefront-audit');
 *   const report = await audit('https://store.example/', { timeoutMs: 5000 });
 *   if (report.summary.counts.fail > 0) process.exit(1);
 */

const { ALL_CHECKS, byId } = require('./checks');
const { ensureTrailingSlash } = require('./http');
const { renderMarkdown, computeVerdict } = require('./format');

/**
 * Run the audit against a storefront URL.
 *
 * @param {string} siteUrl                        Root URL (will be normalized to a trailing slash).
 * @param {object} [opts]
 * @param {string[]} [opts.checks]                Subset of check IDs to run (defaults to all).
 * @param {string} [opts.productUrl]              Explicit PDP URL for schema-org check.
 * @param {number} [opts.timeoutMs=10000]
 * @param {string} [opts.userAgent]
 * @returns {Promise<object>} report
 */
async function audit(siteUrl, opts) {
  if (typeof siteUrl !== 'string' || !siteUrl) {
    throw new TypeError('audit: siteUrl (string) is required');
  }
  const normalized = ensureTrailingSlash(siteUrl);
  const requested = (opts && Array.isArray(opts.checks)) ? opts.checks : null;

  const checks = requested
    ? requested.map(byId).filter(function (c) { return !!c; })
    : ALL_CHECKS;

  const results = [];
  for (const c of checks) {
    let result;
    try {
      result = await c.run(normalized, opts || {});
    } catch (err) {
      result = {
        id: c.id,
        name: c.id,
        spec: null,
        severity: 'fail',
        status: 'fail',
        message: 'check threw: ' + ((err && err.message) || String(err)),
        url: normalized,
      };
    }
    results.push(result);
  }

  const summary = computeVerdict(results);

  return {
    siteUrl: normalized,
    auditedAt: new Date().toISOString(),
    auditorVersion: require('../package.json').version,
    results,
    summary,
  };
}

module.exports = {
  audit,
  ALL_CHECKS,
  renderMarkdown,
};
