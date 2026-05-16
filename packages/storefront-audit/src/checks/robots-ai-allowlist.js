'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.robots_ai_allowlist';
const SPEC = 'https://datatracker.ietf.org/doc/rfc9309/';

/**
 * Real AI-crawler User-Agent strings drawn from each vendor's published docs
 * as of 2026-05-16. Keep this list in sync with
 * @xpaysh/discovery#REAL_AI_USER_AGENTS.
 */
const AI_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Amazonbot',
];

/**
 * Parse a robots.txt into ordered (user-agent, directives) groups. RFC 9309
 * is whitespace-tolerant; we lowercase keys.
 */
function parseRobotsTxt(text) {
  const groups = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || current.directives.length > 0) {
        current = { userAgents: [value], directives: [] };
        groups.push(current);
      } else {
        current.userAgents.push(value);
      }
      continue;
    }
    if (!current) continue;
    current.directives.push({ key, value });
  }
  return groups;
}

/**
 * For a given UA, find the most-specific matching group's Disallow rules.
 * Returns 'explicit-disallow', 'explicit-allow', or 'unaddressed'.
 */
function uaPosture(groups, ua) {
  const lcUa = ua.toLowerCase();
  let posture = 'unaddressed';
  for (const g of groups) {
    const matchesExplicit = g.userAgents.some(function (u) { return u.toLowerCase() === lcUa; });
    const matchesWildcard = g.userAgents.some(function (u) { return u === '*'; });
    if (matchesExplicit) {
      // Explicit group — overrides wildcard
      for (const d of g.directives) {
        if (d.key === 'disallow' && d.value === '/') return 'explicit-disallow';
        if (d.key === 'disallow' && d.value === '') posture = 'explicit-allow';
        if (d.key === 'allow' && d.value === '/') posture = 'explicit-allow';
      }
      // Any explicit Disallow with a non-empty value is a partial block;
      // we treat it as "addressed, not fully allowed" — caller decides.
      if (posture === 'unaddressed') posture = 'explicit-partial';
    } else if (matchesWildcard && posture === 'unaddressed') {
      for (const d of g.directives) {
        if (d.key === 'disallow' && d.value === '/') posture = 'wildcard-disallow';
      }
    }
  }
  return posture;
}

async function run(siteUrl, opts) {
  const target = resolveUrl(siteUrl, '/robots.txt');
  const resp = await httpGet(target, opts);

  if (!resp.ok) {
    return {
      id: ID,
      name: 'robots.txt does not block AI crawlers',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: 'No robots.txt served — agents are unrestricted by default, but explicit allow blocks are recommended',
      url: target,
    };
  }

  const groups = parseRobotsTxt(resp.body);
  const blocked = [];
  const unaddressed = [];
  const allowed = [];
  for (const ua of AI_USER_AGENTS) {
    const posture = uaPosture(groups, ua);
    if (posture === 'explicit-disallow' || posture === 'wildcard-disallow') {
      blocked.push({ ua, posture });
    } else if (posture === 'unaddressed') {
      unaddressed.push(ua);
    } else {
      allowed.push(ua);
    }
  }

  if (blocked.length > 0) {
    return {
      id: ID,
      name: 'robots.txt does not block AI crawlers',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: `robots.txt blocks ${blocked.length} AI user-agent(s): ` +
               blocked.map(function (b) { return b.ua; }).join(', '),
      url: target,
      details: { blocked, unaddressed, allowed },
    };
  }

  if (unaddressed.length > 0) {
    return {
      id: ID,
      name: 'robots.txt does not block AI crawlers',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: `robots.txt does not explicitly allow ${unaddressed.length} AI user-agent(s) (they are not blocked, but explicit Allow blocks are recommended): ` +
               unaddressed.join(', '),
      url: target,
      details: { blocked, unaddressed, allowed },
    };
  }

  return {
    id: ID,
    name: 'robots.txt does not block AI crawlers',
    spec: SPEC,
    severity: 'fail',
    status: 'pass',
    message: `All ${AI_USER_AGENTS.length} AI user-agents explicitly allowed`,
    url: target,
    details: { allowed },
  };
}

module.exports = { id: ID, run, AI_USER_AGENTS };
