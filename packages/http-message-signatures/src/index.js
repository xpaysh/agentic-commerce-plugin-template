'use strict';

/**
 * @xpaysh/http-message-signatures
 *
 * RFC 9421 (HTTP Message Signatures) — focused implementation covering the
 * component set the UCP REST contract and the agentic-commerce-for-* plugin
 * family actually use:
 *
 *   `("@method" "@target-uri" "content-digest" "idempotency-key")`
 *
 * Two algorithms supported:
 *   - `ed25519`     — primary. Matches UCP profile `signing_keys` JWK shape.
 *   - `hmac-sha256` — for testing and shared-secret deployments.
 *
 * Zero runtime deps. Uses Node 18+ built-in `crypto`.
 *
 * Three headers are emitted/consumed:
 *   - `Content-Digest:   sha-256=:<base64>:`         (RFC 9530, per-RFC 9421 §2.3)
 *   - `Signature-Input:  <label>=("..." "...");created=<unix>;keyid="<id>";alg="<alg>"`
 *   - `Signature:        <label>=:<base64-signature>:`
 *
 * Limitations vs. the full RFC 9421:
 *   - Only the four covered components above are supported. Adding more
 *     components is mechanical (extend `buildSignatureBase`).
 *   - No `nonce`, `expires`, or `tag` parameters yet (additive when needed).
 *   - One signature label per request (`sig1`). RFC 9421 allows multiple.
 *
 * The signature base format is exactly per RFC 9421 §2.5: one line per
 * component, then a terminating `"@signature-params": <params>` line.
 */

const crypto = require('crypto');

const SUPPORTED_ALGS = Object.freeze(['ed25519', 'hmac-sha256']);
const COVERED_COMPONENTS = Object.freeze(['@method', '@target-uri', 'content-digest', 'idempotency-key']);
const DEFAULT_LABEL = 'sig1';

/* ------------------------------------------------------------------ */
/* Content-Digest                                                      */
/* ------------------------------------------------------------------ */

/**
 * Compute the RFC 9530 Content-Digest header value for a request body
 * using SHA-256. Body may be a string, Buffer, or null/undefined (treated
 * as the empty string).
 *
 * @param {string|Buffer|null|undefined} body
 * @returns {string} e.g. `sha-256=:X48E9qOok…:`
 */
function contentDigest(body) {
  const buf = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const hash = crypto.createHash('sha256').update(buf).digest('base64');
  return `sha-256=:${hash}:`;
}

/* ------------------------------------------------------------------ */
/* Signature base construction (RFC 9421 §2.5)                         */
/* ------------------------------------------------------------------ */

/**
 * Build the signature base string per RFC 9421 §2.5.
 *
 * @param {object} opts
 * @param {string} opts.method                 HTTP method, uppercased.
 * @param {string} opts.url                    Full request URL (scheme + authority + path + query).
 * @param {Record<string,string>} opts.headers Lowercased-key map of request headers.
 * @param {string[]} opts.components           Components to cover (subset of COVERED_COMPONENTS).
 * @param {string} opts.params                 Pre-serialized Signature-Input params suffix
 *                                             (everything after the components list,
 *                                             e.g. `;created=1747566000;keyid="k1";alg="ed25519"`).
 * @returns {string}
 */
function buildSignatureBase({ method, url, headers, components, params }) {
  const lines = [];
  for (const c of components) {
    let value;
    switch (c) {
      case '@method':
        value = method.toUpperCase();
        break;
      case '@target-uri':
        value = url;
        break;
      default:
        value = headers[c.toLowerCase()];
        if (value === undefined) {
          throw new Error(`buildSignatureBase: missing required header for component "${c}"`);
        }
    }
    lines.push(`"${c}": ${value}`);
  }
  const componentsList = '(' + components.map((c) => `"${c}"`).join(' ') + ')';
  lines.push(`"@signature-params": ${componentsList}${params}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* sign / verify                                                       */
/* ------------------------------------------------------------------ */

/**
 * Sign a request. Returns the three headers to add to the outgoing message.
 *
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.url
 * @param {Record<string,string>} [opts.headers={}] Existing request headers (case-insensitive keys).
 * @param {string|Buffer|null} [opts.body=null]
 * @param {string} opts.keyId
 * @param {'ed25519'|'hmac-sha256'} opts.alg
 * @param {KeyObject|Buffer|string} opts.privateKey  KeyObject for ed25519; Buffer/string for hmac-sha256.
 * @param {number} [opts.created=Math.floor(Date.now()/1000)]
 * @param {string[]} [opts.components=COVERED_COMPONENTS]
 * @param {string} [opts.label='sig1']
 * @returns {{ 'Signature': string, 'Signature-Input': string, 'Content-Digest': string }}
 */
function signRequest(opts) {
  assertAlg(opts.alg);
  const components = opts.components || COVERED_COMPONENTS.slice();
  const created = typeof opts.created === 'number' ? opts.created : Math.floor(Date.now() / 1000);
  const label = opts.label || DEFAULT_LABEL;

  // Normalize headers to lowercase keys and ensure Content-Digest exists if
  // the component list asks for it.
  const headers = normalizeHeaders(opts.headers);
  if (components.includes('content-digest') && !headers['content-digest']) {
    headers['content-digest'] = contentDigest(opts.body);
  }

  const params = `;created=${created};keyid="${opts.keyId}";alg="${opts.alg}"`;
  const base = buildSignatureBase({
    method: opts.method,
    url: opts.url,
    headers,
    components,
    params,
  });

  const signatureBytes = signBytes(opts.alg, opts.privateKey, Buffer.from(base, 'utf8'));
  const signatureB64 = signatureBytes.toString('base64');

  return {
    'Signature': `${label}=:${signatureB64}:`,
    'Signature-Input': `${label}=(${components.map((c) => `"${c}"`).join(' ')})${params}`,
    'Content-Digest': headers['content-digest'],
  };
}

/**
 * Verify a request's signature. Pass `keyResolver(keyId, alg) → KeyObject|Buffer|string|null`.
 *
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.url
 * @param {Record<string,string>} opts.headers   Incoming headers (case-insensitive keys).
 * @param {string|Buffer|null} [opts.body=null]
 * @param {(keyId: string, alg: string) => any} opts.keyResolver
 * @param {number} [opts.now=Math.floor(Date.now()/1000)]
 * @param {number} [opts.maxAgeSeconds=300]
 * @returns {{ ok: true, keyId: string, alg: string, created: number, components: string[] }
 *         | { ok: false, reason: string }}
 */
function verifyRequest(opts) {
  const headers = normalizeHeaders(opts.headers);
  const sigInput = headers['signature-input'];
  const sig = headers['signature'];
  if (!sigInput || !sig) return { ok: false, reason: 'missing Signature or Signature-Input header' };

  const parsedInput = parseSignatureInput(sigInput);
  if (!parsedInput) return { ok: false, reason: 'unparseable Signature-Input' };
  const { label, components, params, created, keyId, alg } = parsedInput;
  if (!SUPPORTED_ALGS.includes(alg)) return { ok: false, reason: `unsupported alg: ${alg}` };

  const now = typeof opts.now === 'number' ? opts.now : Math.floor(Date.now() / 1000);
  const maxAge = typeof opts.maxAgeSeconds === 'number' ? opts.maxAgeSeconds : 300;
  if (typeof created === 'number' && now - created > maxAge) {
    return { ok: false, reason: 'signature too old' };
  }

  // Verify Content-Digest matches the body if the component list covers it.
  if (components.includes('content-digest')) {
    const expected = contentDigest(opts.body);
    if (headers['content-digest'] !== expected) {
      return { ok: false, reason: 'Content-Digest mismatch' };
    }
  }

  const sigB64 = extractSignatureValue(sig, label);
  if (!sigB64) return { ok: false, reason: 'unparseable Signature header' };

  const base = buildSignatureBase({
    method: opts.method,
    url: opts.url,
    headers,
    components,
    params,
  });

  const key = opts.keyResolver(keyId, alg);
  if (!key) return { ok: false, reason: `unknown keyId: ${keyId}` };

  const ok = verifyBytes(alg, key, Buffer.from(base, 'utf8'), Buffer.from(sigB64, 'base64'));
  return ok ? { ok: true, keyId, alg, created, components } : { ok: false, reason: 'signature verification failed' };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function assertAlg(alg) {
  if (!SUPPORTED_ALGS.includes(alg)) {
    throw new Error(`http-message-signatures: unsupported alg "${alg}" (supported: ${SUPPORTED_ALGS.join(', ')})`);
  }
}

function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) out[k.toLowerCase()] = String(v);
  return out;
}

function signBytes(alg, privateKey, data) {
  if (alg === 'ed25519') {
    return crypto.sign(null, data, privateKey);
  }
  // hmac-sha256
  return crypto.createHmac('sha256', privateKey).update(data).digest();
}

function verifyBytes(alg, key, data, signature) {
  if (alg === 'ed25519') {
    try { return crypto.verify(null, data, key, signature); } catch { return false; }
  }
  const expected = crypto.createHmac('sha256', key).update(data).digest();
  return expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
}

/**
 * Parse a `Signature-Input` header value like:
 *   sig1=("@method" "@target-uri" "content-digest" "idempotency-key");created=1747566000;keyid="k1";alg="ed25519"
 */
function parseSignatureInput(value) {
  const m = value.match(/^([\w-]+)=\(([^)]*)\)(.*)$/);
  if (!m) return null;
  const [, label, componentsRaw, paramsRaw] = m;
  const components = (componentsRaw.match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
  const params = {};
  for (const pair of paramsRaw.split(';')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const key = pair.slice(0, eq).trim();
    let raw = pair.slice(eq + 1).trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    params[key] = raw;
  }
  return {
    label,
    components,
    params: paramsRaw,
    created: params.created !== undefined ? Number(params.created) : undefined,
    expires: params.expires !== undefined ? Number(params.expires) : undefined,
    keyId: params.keyid,
    alg: params.alg,
  };
}

/**
 * Extract the base64-encoded signature bytes from a `Signature: <label>=:<b64>:` header.
 */
function extractSignatureValue(value, label) {
  const re = new RegExp(`(?:^|,\\s*)${label}=:([A-Za-z0-9+/=]+):`);
  const m = value.match(re);
  return m ? m[1] : null;
}

module.exports = {
  SUPPORTED_ALGS,
  COVERED_COMPONENTS,
  DEFAULT_LABEL,
  contentDigest,
  buildSignatureBase,
  signRequest,
  verifyRequest,
  parseSignatureInput,
};
