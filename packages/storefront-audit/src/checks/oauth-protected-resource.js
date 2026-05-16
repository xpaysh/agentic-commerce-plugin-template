'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.oauth_protected_resource';
const SPEC = 'https://datatracker.ietf.org/doc/rfc9728/';
const PATH = '/.well-known/oauth-protected-resource';

/**
 * RFC 9728 OAuth resource metadata. Optional; emit only when UCP Identity
 * Linking is enabled. Absence is info, malformed body is warn.
 */
async function run(siteUrl, opts) {
  const target = resolveUrl(siteUrl, PATH);
  const resp = await httpGet(target, opts);

  if (!resp.ok) {
    return {
      id: ID,
      name: 'RFC 9728 /.well-known/oauth-protected-resource (optional)',
      spec: SPEC,
      severity: 'info',
      status: 'skip',
      message: 'No /.well-known/oauth-protected-resource (optional — emit when UCP OAuth Identity Linking is enabled)',
      url: target,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(resp.body);
  } catch (e) {
    return {
      id: ID,
      name: 'RFC 9728 /.well-known/oauth-protected-resource (optional)',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: 'Resource metadata did not parse as JSON: ' + (e && e.message),
      url: target,
    };
  }

  if (!parsed || typeof parsed.resource !== 'string' || !Array.isArray(parsed.authorization_servers) || parsed.authorization_servers.length === 0) {
    return {
      id: ID,
      name: 'RFC 9728 /.well-known/oauth-protected-resource (optional)',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: 'Resource metadata missing required fields (resource, authorization_servers)',
      url: target,
      details: { parsed },
    };
  }

  return {
    id: ID,
    name: 'RFC 9728 /.well-known/oauth-protected-resource (optional)',
    spec: SPEC,
    severity: 'info',
    status: 'pass',
    message: `OAuth resource metadata present (resource=${parsed.resource})`,
    url: target,
    details: {
      resource: parsed.resource,
      authorizationServers: parsed.authorization_servers,
      scopes: parsed.scopes_supported || [],
    },
  };
}

module.exports = { id: ID, run };
