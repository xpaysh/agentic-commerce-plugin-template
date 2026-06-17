'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.ucp_profile';
const SPEC = 'https://ucp.dev/latest/specification/overview/';
const PATH = '/.well-known/ucp';

/**
 * Check that /.well-known/ucp (no extension) is served, parses as JSON, and
 * meets the minimum shape: ucp.version, ucp.services, ucp.capabilities, and
 * a signing_keys array. Per the UCP spec the path has no file extension —
 * serving the same body at /.well-known/ucp.json does NOT satisfy discovery.
 */
async function run(siteUrl, opts) {
  const target = resolveUrl(siteUrl, PATH);
  const resp = await httpGet(target, opts);

  if (!resp.ok) {
    return {
      id: ID,
      name: 'Has /.well-known/ucp (UCP business profile)',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: resp.error
        ? `GET /.well-known/ucp failed: ${resp.error}`
        : `GET /.well-known/ucp returned ${resp.status}`,
      url: target,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(resp.body);
  } catch (e) {
    return {
      id: ID,
      name: 'Has /.well-known/ucp (UCP business profile)',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: '/.well-known/ucp did not parse as JSON: ' + (e && e.message),
      url: target,
    };
  }

  const ucp = parsed && parsed.ucp;
  if (!ucp || typeof ucp !== 'object') {
    return {
      id: ID,
      name: 'Has /.well-known/ucp (UCP business profile)',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: 'Profile body missing top-level "ucp" object',
      url: target,
    };
  }

  const missing = [];
  if (typeof ucp.version !== 'string' || !ucp.version) missing.push('ucp.version');
  if (!ucp.services || typeof ucp.services !== 'object') missing.push('ucp.services');
  if (!ucp.capabilities || typeof ucp.capabilities !== 'object') missing.push('ucp.capabilities');
  if (missing.length) {
    return {
      id: ID,
      name: 'Has /.well-known/ucp (UCP business profile)',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: 'Profile missing required field(s): ' + missing.join(', '),
      url: target,
      details: { parsed: ucp },
    };
  }

  const signingKeys = Array.isArray(parsed.signing_keys) ? parsed.signing_keys : [];
  const capabilityCount = Object.keys(ucp.capabilities).length;
  const serviceCount = Object.keys(ucp.services).length;

  // Detect xpay-hosted endpoint vs merchant-hosted.
  let hosted = 'merchant';
  for (const k of Object.keys(ucp.services)) {
    const svcs = Array.isArray(ucp.services[k]) ? ucp.services[k] : [];
    for (const s of svcs) {
      if (typeof s.endpoint === 'string' && /agent-commerce\.xpay\.sh/.test(s.endpoint)) {
        hosted = 'xpay';
        break;
      }
    }
    if (hosted === 'xpay') break;
  }

  // Empty signing_keys[] is NOT a readiness gap on its own. RFC 9421 request
  // signing is not yet enabled on xpay's hosted sidecars, so an empty array on
  // an xpay-hosted profile is OUR unfinished feature, not the merchant's —
  // don't drag the verdict for it. Only warn when a MERCHANT-hosted profile
  // advertises a signing capability but ships no keys (a real merchant-side
  // inconsistency). Otherwise the otherwise-valid profile passes (info).
  if (signingKeys.length === 0) {
    const caps = ucp.capabilities || {};
    const advertisesSigning = !!(
      caps.request_signing ||
      caps['request-signing'] ||
      caps.signing ||
      (ucp.security && ucp.security.request_signing)
    );
    if (hosted === 'merchant' && advertisesSigning) {
      return {
        id: ID,
        name: 'Has /.well-known/ucp (UCP business profile)',
        spec: SPEC,
        severity: 'warn',
        status: 'warn',
        message: 'Profile advertises request signing but signing_keys[] is empty — agents cannot verify RFC 9421 signatures',
        url: target,
        details: { version: ucp.version, capabilityCount, serviceCount, signingKeyCount: 0, hosted },
      };
    }
    return {
      id: ID,
      name: 'Has /.well-known/ucp (UCP business profile)',
      spec: SPEC,
      severity: 'info',
      status: 'pass',
      message: `Profile served (v${ucp.version}, ${capabilityCount} capabilities) — signature verification not yet enabled`,
      url: target,
      // Carry the full capabilities[] array + raw services payload so the v2
      // signal extractor can count capabilities and detect an MCP-transport
      // service. Omitting them (older code only sent capabilityCount) made
      // every xpay-hosted, signing-off profile read as 0 capabilities / no MCP.
      details: { version: ucp.version, capabilities: Object.keys(ucp.capabilities), capabilityCount, serviceCount, services: ucp.services, signingKeyCount: 0, hosted },
    };
  }

  return {
    id: ID,
    name: 'Has /.well-known/ucp (UCP business profile)',
    spec: SPEC,
    severity: 'fail',
    status: 'pass',
    message: `Profile served (v${ucp.version}, ${capabilityCount} capabilities, ${signingKeys.length} signing key${signingKeys.length === 1 ? '' : 's'})`,
    url: target,
    details: {
      version: ucp.version,
      capabilities: Object.keys(ucp.capabilities),
      serviceCount,
      services: ucp.services,
      signingKeyCount: signingKeys.length,
      hosted,
    },
  };
}

module.exports = { id: ID, run };
