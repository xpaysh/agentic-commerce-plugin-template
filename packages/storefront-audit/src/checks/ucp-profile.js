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

  // Warn if signing keys are missing — required for RFC 9421-signed requests.
  if (signingKeys.length === 0) {
    return {
      id: ID,
      name: 'Has /.well-known/ucp (UCP business profile)',
      spec: SPEC,
      severity: 'fail',
      status: 'warn',
      message: `Profile served but signing_keys[] is empty — agents cannot verify RFC 9421 signatures`,
      url: target,
      details: { version: ucp.version, capabilityCount, serviceCount, signingKeyCount: 0 },
    };
  }

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
      signingKeyCount: signingKeys.length,
      hosted,
    },
  };
}

module.exports = { id: ID, run };
