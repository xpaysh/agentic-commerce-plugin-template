'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.agent_card';
const SPEC = 'https://a2a-protocol.org/';
const PATH = '/.well-known/agent-card.json';

/**
 * A2A 1.0 agent-card. Watchlist standard — absence is info, presence with a
 * malformed body is warn.
 */
async function run(siteUrl, opts) {
  const target = resolveUrl(siteUrl, PATH);
  const resp = await httpGet(target, opts);

  if (!resp.ok) {
    return {
      id: ID,
      name: 'A2A /.well-known/agent-card.json (watchlist)',
      spec: SPEC,
      severity: 'info',
      status: 'skip',
      message: 'No /.well-known/agent-card.json served (watchlist — emit when A2A adoption matures)',
      url: target,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(resp.body);
  } catch (e) {
    return {
      id: ID,
      name: 'A2A /.well-known/agent-card.json (watchlist)',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: 'Agent card served but did not parse as JSON: ' + (e && e.message),
      url: target,
    };
  }

  if (!parsed || typeof parsed.name !== 'string') {
    return {
      id: ID,
      name: 'A2A /.well-known/agent-card.json (watchlist)',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: 'Agent card missing required field "name"',
      url: target,
      details: { parsed },
    };
  }

  return {
    id: ID,
    name: 'A2A /.well-known/agent-card.json (watchlist)',
    spec: SPEC,
    severity: 'info',
    status: 'pass',
    message: `Agent card present: "${parsed.name}"`,
    url: target,
    details: {
      name: parsed.name,
      version: parsed.version || null,
      capabilities: parsed.capabilities ? Object.keys(parsed.capabilities) : [],
      skillCount: Array.isArray(parsed.skills) ? parsed.skills.length : 0,
    },
  };
}

module.exports = { id: ID, run };
