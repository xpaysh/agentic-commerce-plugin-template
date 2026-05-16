'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.no_fictitious_wellknowns';
const SPEC = 'file:///Users/sri/Documents/Dev/opensource-xp/docs/may-16/standards-and-extensibility-guide.md';

/**
 * URIs that look plausible but are not in any active spec. Fail if any
 * resolves to a 2xx (a real handler is serving them, suggesting drift toward
 * fabricated standards).
 *
 * Update this list in lockstep with §1.4 of standards-and-extensibility-guide.md.
 */
const FICTITIOUS_PATHS = [
  '/.well-known/agentic-commerce.json',  // fictitious (xpay shipped this in 0.1.x; removed in 0.2.0)
  '/.well-known/ucp.json',               // wrong filename (real path is /.well-known/ucp, no extension)
  '/.well-known/acp.json',               // not in ACP spec
  '/.well-known/ap2.json',               // not in AP2 spec
  '/.well-known/mcp.json',               // not standardized by the MCP spec
  '/.well-known/ai-plugin.json',         // deprecated (was OpenAI ChatGPT Plugins, 2023)
  '/agents.txt',                          // fictitious (confused with llms.txt)
  '/ai.txt',                              // fragmented proposals, no IANA registration
];

async function run(siteUrl, opts) {
  const checked = [];
  const offenders = [];

  for (const path of FICTITIOUS_PATHS) {
    const target = resolveUrl(siteUrl, path);
    const resp = await httpGet(target, Object.assign({}, opts, { includeBodyOnError: false }));
    checked.push({ path, status: resp.status });
    if (resp.ok) {
      offenders.push({ path, status: resp.status });
    }
  }

  if (offenders.length === 0) {
    return {
      id: ID,
      name: 'Does not emit fictitious well-known URIs',
      spec: SPEC,
      severity: 'fail',
      status: 'pass',
      message: `All ${FICTITIOUS_PATHS.length} fictitious paths return non-2xx`,
      url: siteUrl,
      details: { checked },
    };
  }

  return {
    id: ID,
    name: 'Does not emit fictitious well-known URIs',
    spec: SPEC,
    severity: 'fail',
    status: 'fail',
    message: `${offenders.length} fictitious well-known URI(s) served: ` +
             offenders.map(function (o) { return o.path; }).join(', '),
    url: siteUrl,
    details: { checked, offenders },
  };
}

module.exports = { id: ID, run, FICTITIOUS_PATHS };
