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
 * SHOPPING agents — user-triggered fetchers (and the search bot that powers
 * shopping answers) that actually matter for agentic commerce. An explicit
 * Disallow of any of these is the only robots.txt state that makes a store
 * less agent-ready, so it's the only thing that fails this check.
 */
const SHOPPING_AGENTS = new Set([
  'ChatGPT-User',
  'Claude-User',
  'Perplexity-User',
  'OAI-SearchBot',
]);

/**
 * Everything else in AI_USER_AGENTS is a training / indexing crawler
 * (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Amazonbot,
 * …). Blocking those is a legitimate training-opt-out choice by the merchant,
 * NOT a commerce-readiness failure — we surface it as info only.
 */
function isShoppingAgent(ua) {
  return SHOPPING_AGENTS.has(ua);
}

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
 * Returns one of: 'explicit-disallow', 'explicit-allow', 'explicit-partial',
 * 'wildcard-disallow', 'unaddressed'.
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

function isBlocked(posture) {
  return posture === 'explicit-disallow' || posture === 'wildcard-disallow';
}

async function run(siteUrl, opts) {
  const target = resolveUrl(siteUrl, '/robots.txt');
  const resp = await httpGet(target, opts);

  // Per RFC 9309 §2.4: absence of a robots.txt (or a non-2xx) means "no
  // restrictions" — everything is allowed. That is the ideal state for agent
  // discovery, so it PASSES (not a warn).
  if (!resp.ok) {
    return {
      id: ID,
      name: 'robots.txt does not block AI shopping agents',
      spec: SPEC,
      severity: 'info',
      status: 'pass',
      message: 'No robots.txt served — agents are unrestricted by default (RFC 9309)',
      url: target,
      details: { posture: {} },
    };
  }

  const groups = parseRobotsTxt(resp.body);

  // posture: per-UA map (consumed by the v2 rubric signal-extractor to derive
  // perAgentAllowed + the blocks-shopping-agents gate).
  const posture = {};
  const shoppingBlocked = [];
  const trainingBlocked = [];
  const unaddressed = [];
  const allowed = [];
  for (const ua of AI_USER_AGENTS) {
    const p = uaPosture(groups, ua);
    posture[ua] = p;
    if (isBlocked(p)) {
      if (isShoppingAgent(ua)) shoppingBlocked.push(ua);
      else trainingBlocked.push(ua);
    } else if (p === 'unaddressed') {
      unaddressed.push(ua);
    } else {
      allowed.push(ua);
    }
  }

  // Only an explicit Disallow of a SHOPPING agent is a readiness failure.
  if (shoppingBlocked.length > 0) {
    return {
      id: ID,
      name: 'robots.txt does not block AI shopping agents',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: `robots.txt blocks ${shoppingBlocked.length} AI shopping agent(s): ` +
               shoppingBlocked.join(', '),
      url: target,
      details: { posture, shoppingBlocked, trainingBlocked, unaddressed, allowed },
    };
  }

  // Training/indexing crawlers blocked but all shopping agents reachable:
  // legitimate training-opt-out, NOT a readiness gap. Pass, surfaced as info.
  if (trainingBlocked.length > 0) {
    return {
      id: ID,
      name: 'robots.txt does not block AI shopping agents',
      spec: SPEC,
      severity: 'info',
      status: 'pass',
      message: `All AI shopping agents are reachable. ${trainingBlocked.length} training/indexing crawler(s) opted out (a legitimate merchant choice, not a readiness issue): ` +
               trainingBlocked.join(', '),
      url: target,
      details: { posture, shoppingBlocked, trainingBlocked, unaddressed, allowed },
    };
  }

  // No AI agent is blocked. Per RFC 9309 "unaddressed" == allowed, so this is
  // a pass whether or not the merchant added explicit Allow blocks.
  return {
    id: ID,
    name: 'robots.txt does not block AI shopping agents',
    spec: SPEC,
    severity: 'info',
    status: 'pass',
    message: unaddressed.length > 0
      ? `No AI agent is blocked (${unaddressed.length} unaddressed = allowed by default per RFC 9309, ${allowed.length} explicitly allowed)`
      : `All ${AI_USER_AGENTS.length} AI user-agents explicitly allowed`,
    url: target,
    details: { posture, shoppingBlocked, trainingBlocked, unaddressed, allowed },
  };
}

module.exports = { id: ID, run, AI_USER_AGENTS, SHOPPING_AGENTS };
