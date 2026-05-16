'use strict';

/**
 * @xpaysh/cart-deeplinks — sign + verify the HS256 cart-handoff JWT used by
 * the agentic-commerce-for-* plugin family.
 *
 * Wire format documented in xpaysh/agentic-commerce-for-woocommerce v0.2+:
 *
 *   GET https://merchant.example/?xpay_cart=<jwt>
 *
 *   Where <jwt> is a standard 3-part HS256 JWT:
 *     header  = base64url({"alg":"HS256","typ":"JWT"})
 *     payload = base64url(JSON):
 *               {
 *                 "items":    [{ "sku": "...", "qty": 1, "variation_id"?: 0 }, ...],   // required, non-empty
 *                 "exp":      <unix-seconds>,                                          // required
 *                 "merchant": "<merchant-slug>",                                       // required
 *                 "cart_id":  "...",                                                   // optional
 *                 "agent":    "...",                                                   // optional
 *                 "surface":  "..."                                                    // optional
 *               }
 *     signature = HMAC-SHA256( header_b64u + "." + payload_b64u , secret )
 *
 *   secret = sha256_hex(api_key)
 *
 * The plugin's verifier accepts the token if (a) alg=HS256, (b) signature
 * matches, (c) `exp` is in the future, (d) `merchant` equals the plugin's
 * configured slug, (e) `items` is a non-empty array.
 *
 * This package's `signCartDeeplink` produces tokens the plugin accepts;
 * `verifyCartDeeplink` mirrors the plugin's check semantics. Tokens are
 * therefore interoperable across the family: an xpay backend in Node, a
 * Magento PHP plugin, a commercetools TypeScript Connect Service all
 * agree on the wire shape.
 *
 * Zero runtime deps; Node `crypto` only.
 */

const crypto = require('crypto');

const DEFAULT_PARAM = 'xpay_cart';
const DEFAULT_TTL_SECONDS = 600; // 10 minutes; matches the WC plugin v0.2 default

// ---------------------------------------------------------------------------
// Base64url helpers (no padding)
// ---------------------------------------------------------------------------

function b64urlEncode(buf) {
  if (typeof buf === 'string') buf = Buffer.from(buf, 'utf8');
  return buf.toString('base64url');
}

function b64urlDecode(s) {
  return Buffer.from(s, 'base64url');
}

// ---------------------------------------------------------------------------
// Secret derivation — sha256(api_key), hex string
// ---------------------------------------------------------------------------

/**
 * Derive the HMAC secret from the merchant's raw api_key. Mirrors the WC
 * plugin's `hash('sha256', $raw_key)` (PHP default returns hex). Use this
 * when you have the raw api_key and want to pass it through `secret` to
 * the sign/verify functions — or just pass `apiKey` directly and let the
 * package call this.
 *
 * @param {string} apiKey
 * @returns {string} 64-char hex digest
 */
function deriveSecret(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new TypeError('deriveSecret: apiKey (non-empty string) is required');
  }
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function _resolveSecret(opts) {
  if (typeof opts.secret === 'string' && opts.secret.length > 0) return opts.secret;
  if (typeof opts.apiKey === 'string' && opts.apiKey.length > 0) return deriveSecret(opts.apiKey);
  throw new TypeError('cart-deeplinks: opts.apiKey or opts.secret is required');
}

function _now(opts) {
  if (opts && typeof opts.now === 'number') return Math.floor(opts.now);
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Sign a cart-deeplink JWT.
 *
 * @param {object} opts
 * @param {string}   opts.merchant                    Merchant slug (must match what the plugin is configured with)
 * @param {Array<{sku:string,qty?:number,variation_id?:number}>} opts.items
 * @param {number}   [opts.ttlSeconds=600]            How long the token is valid for
 * @param {string}   [opts.cartId]                    Optional cart correlation id
 * @param {string}   [opts.agent]                     Optional agent identifier (`gpt-5`, `claude-sonnet-4-7`, …)
 * @param {string}   [opts.surface]                   Optional surface identifier (`chatgpt-buy-it`, `gemini-shopping`, …)
 * @param {string}   [opts.apiKey]                    Raw merchant api_key (secret derived internally)
 * @param {string}   [opts.secret]                    Pre-derived sha256(api_key) hex string (if already known)
 * @param {number}   [opts.now]                       Override the current time (seconds since epoch) — for tests
 * @returns {{ token: string, expiresAt: number, payload: object }}
 */
function signCartDeeplink(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError('signCartDeeplink: opts object is required');
  }
  if (typeof opts.merchant !== 'string' || !opts.merchant) {
    throw new TypeError('signCartDeeplink: opts.merchant (non-empty string) is required');
  }
  if (!Array.isArray(opts.items) || opts.items.length === 0) {
    throw new TypeError('signCartDeeplink: opts.items (non-empty array) is required');
  }
  for (const item of opts.items) {
    if (!item || typeof item.sku !== 'string' || !item.sku) {
      throw new TypeError('signCartDeeplink: every items[i].sku must be a non-empty string');
    }
  }

  const ttlSeconds = typeof opts.ttlSeconds === 'number' && opts.ttlSeconds > 0
    ? Math.floor(opts.ttlSeconds)
    : DEFAULT_TTL_SECONDS;

  const secret = _resolveSecret(opts);
  const now = _now(opts);
  const exp = now + ttlSeconds;

  // Normalise items — drop unknown keys, keep only what the WC plugin reads.
  const items = opts.items.map(function (it) {
    const out = { sku: String(it.sku) };
    if (typeof it.qty === 'number' && it.qty > 0) out.qty = Math.floor(it.qty);
    else if (typeof it.qty === 'string' && /^\d+$/.test(it.qty)) out.qty = parseInt(it.qty, 10);
    else out.qty = 1;
    if (typeof it.variation_id === 'number' && it.variation_id > 0) {
      out.variation_id = Math.floor(it.variation_id);
    }
    return out;
  });

  const payload = {
    items: items,
    exp: exp,
    merchant: opts.merchant,
  };
  if (typeof opts.cartId === 'string' && opts.cartId) payload.cart_id = opts.cartId;
  if (typeof opts.agent === 'string' && opts.agent) payload.agent = opts.agent;
  if (typeof opts.surface === 'string' && opts.surface) payload.surface = opts.surface;

  const header = { alg: 'HS256', typ: 'JWT' };

  const h64 = b64urlEncode(JSON.stringify(header));
  const p64 = b64urlEncode(JSON.stringify(payload));
  const signingInput = h64 + '.' + p64;
  const sig = crypto.createHmac('sha256', secret).update(signingInput, 'utf8').digest();
  const s64 = b64urlEncode(sig);

  return {
    token: signingInput + '.' + s64,
    expiresAt: exp,
    payload: payload,
  };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify a cart-deeplink JWT. Mirrors the WC plugin's Xpay_Client::verify_jwt
 * semantics: HS256 only, signature must match, `exp` must be in the future,
 * `merchant` (if expected) must match. Returns a structured result rather
 * than throwing for `ok: false` paths so callers can branch cleanly.
 *
 * @param {string} token
 * @param {object} opts
 * @param {string} [opts.apiKey]            Raw merchant api_key
 * @param {string} [opts.secret]            Pre-derived sha256(api_key) hex
 * @param {string} [opts.expectedMerchant]  If supplied, payload.merchant must equal this
 * @param {number} [opts.now]               Override time-of-check (seconds since epoch)
 * @returns {{ ok: true, payload: object, expiresAt: number } | { ok: false, error: string }}
 */
function verifyCartDeeplink(token, opts) {
  if (typeof token !== 'string' || !token) {
    return { ok: false, error: 'token must be a non-empty string' };
  }
  if (!opts || typeof opts !== 'object') {
    return { ok: false, error: 'opts object is required (apiKey or secret)' };
  }

  let secret;
  try { secret = _resolveSecret(opts); }
  catch (e) { return { ok: false, error: e.message }; }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'malformed token: expected 3 parts' };
  }
  const [h64, p64, s64] = parts;

  let header;
  try { header = JSON.parse(b64urlDecode(h64).toString('utf8')); }
  catch (_e) { return { ok: false, error: 'malformed header' }; }

  if (!header || header.alg !== 'HS256') {
    return { ok: false, error: 'unsupported alg (expected HS256)' };
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(h64 + '.' + p64, 'utf8').digest();
  let gotSig;
  try { gotSig = b64urlDecode(s64); }
  catch (_e) { return { ok: false, error: 'malformed signature' }; }

  if (expectedSig.length !== gotSig.length || !crypto.timingSafeEqual(expectedSig, gotSig)) {
    return { ok: false, error: 'signature mismatch' };
  }

  let payload;
  try { payload = JSON.parse(b64urlDecode(p64).toString('utf8')); }
  catch (_e) { return { ok: false, error: 'malformed payload' }; }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'payload is not an object' };
  }

  if (typeof payload.exp !== 'number') {
    return { ok: false, error: 'payload.exp missing or non-numeric' };
  }
  const now = _now(opts);
  if (now >= payload.exp) {
    return { ok: false, error: 'token expired' };
  }

  if (typeof opts.expectedMerchant === 'string' && opts.expectedMerchant) {
    if (payload.merchant !== opts.expectedMerchant) {
      return { ok: false, error: 'merchant mismatch' };
    }
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, error: 'payload.items missing or empty' };
  }

  return { ok: true, payload: payload, expiresAt: payload.exp };
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Build a cart-deeplink URL: `{siteUrl}?xpay_cart={token}`. Preserves the
 * site's existing query string if any.
 *
 * @param {string} siteUrl
 * @param {string} token
 * @param {string} [paramName='xpay_cart']
 * @returns {string}
 */
function deeplinkUrl(siteUrl, token, paramName) {
  if (typeof siteUrl !== 'string' || !siteUrl) {
    throw new TypeError('deeplinkUrl: siteUrl (string) is required');
  }
  if (typeof token !== 'string' || !token) {
    throw new TypeError('deeplinkUrl: token (string) is required');
  }
  const param = (typeof paramName === 'string' && paramName) ? paramName : DEFAULT_PARAM;
  const u = new URL(siteUrl);
  u.searchParams.set(param, token);
  return u.toString();
}

/**
 * Extract the cart-deeplink token from a URL or query-string. Returns null
 * if no token is present.
 *
 * @param {string} urlOrQs
 * @param {string} [paramName='xpay_cart']
 * @returns {string | null}
 */
function extractTokenFromUrl(urlOrQs, paramName) {
  if (typeof urlOrQs !== 'string' || !urlOrQs) return null;
  const param = (typeof paramName === 'string' && paramName) ? paramName : DEFAULT_PARAM;
  try {
    // Try full URL first
    const u = new URL(urlOrQs);
    const v = u.searchParams.get(param);
    if (v) return v;
  } catch (_e) {
    // Fall through to raw query-string handling
  }
  // Raw query string (no leading host)
  const qs = urlOrQs.replace(/^\?/, '');
  const sp = new URLSearchParams(qs);
  return sp.get(param) || null;
}

module.exports = {
  DEFAULT_PARAM,
  DEFAULT_TTL_SECONDS,
  deriveSecret,
  signCartDeeplink,
  verifyCartDeeplink,
  deeplinkUrl,
  extractTokenFromUrl,
};
