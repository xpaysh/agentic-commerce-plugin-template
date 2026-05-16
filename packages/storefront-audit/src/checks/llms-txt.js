'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.llms_txt';
const SPEC = 'https://llmstxt.org';

/**
 * Check that /llms.txt is served and parses per the llmstxt.org Markdown
 * convention. We're lenient — we only require an H1 line; the structured
 * sections are common but not strictly required by the spec.
 */
async function run(siteUrl, opts) {
  const target = resolveUrl(siteUrl, '/llms.txt');
  const resp = await httpGet(target, opts);

  if (!resp.ok) {
    return {
      id: ID,
      name: 'Has /llms.txt',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: resp.error
        ? `GET /llms.txt failed: ${resp.error}`
        : `GET /llms.txt returned ${resp.status}`,
      url: target,
    };
  }

  const ct = (resp.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('text/') && !ct.startsWith('text/plain') && !ct.startsWith('text/markdown')) {
    return {
      id: ID,
      name: 'Has /llms.txt',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: `/llms.txt served with content-type "${ct || 'unset'}" — should be text/plain or text/markdown`,
      url: target,
    };
  }

  const lines = resp.body.split(/\r?\n/);
  const h1 = lines.find(function (l) { return /^#\s+\S/.test(l); });
  if (!h1) {
    return {
      id: ID,
      name: 'Has /llms.txt',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: '/llms.txt does not contain an H1 (# Title). llmstxt.org requires a top-level title.',
      url: target,
    };
  }

  // Detection: did this body come from xpay-discovery? (helpful info for the report.)
  const xpayDetected = /## For AI shopping agents/.test(resp.body) ||
                       /agent-feed\.xpay\.sh/.test(resp.body) ||
                       /agent-commerce\.xpay\.sh/.test(resp.body);

  return {
    id: ID,
    name: 'Has /llms.txt',
    spec: SPEC,
    severity: 'fail',
    status: 'pass',
    message: '/llms.txt served with H1 present',
    url: target,
    details: {
      title: h1.replace(/^#\s+/, '').trim(),
      bytes: resp.body.length,
      sections: lines.filter(function (l) { return /^##\s+/.test(l); }).length,
      xpayDetected,
    },
  };
}

module.exports = { id: ID, run };
