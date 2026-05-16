'use strict';

const DEFAULT_USER_AGENT = 'xpay-storefront-audit/0.1 (+https://github.com/xpaysh/agentic-commerce-plugin-template)';
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Tolerant HTTP GET. Returns { ok, status, headers, body, error } — never throws.
 * Body is always a string (empty on non-2xx unless `includeBodyOnError` is true).
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=10000]
 * @param {string} [opts.userAgent]
 * @param {boolean} [opts.includeBodyOnError=false]
 * @param {string} [opts.method='GET']
 */
async function httpGet(url, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const userAgent = (opts && opts.userAgent) || DEFAULT_USER_AGENT;
  const includeBodyOnError = !!(opts && opts.includeBodyOnError);
  const method = (opts && opts.method) || 'GET';

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);

  try {
    const resp = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': userAgent, 'accept': '*/*' },
      signal: controller.signal,
    });
    const headers = {};
    resp.headers.forEach(function (v, k) { headers[k.toLowerCase()] = v; });
    let body = '';
    if (resp.ok || includeBodyOnError) {
      try { body = await resp.text(); } catch (_e) { body = ''; }
    }
    return { ok: resp.ok, status: resp.status, headers, body, url: resp.url, error: null };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      headers: {},
      body: '',
      url,
      error: err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'fetch_failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a URL string against a base, tolerating missing schemes. Returns
 * the resolved absolute URL or null if neither input is a valid URL.
 *
 * @param {string} base
 * @param {string} relOrAbs
 * @returns {string | null}
 */
function resolveUrl(base, relOrAbs) {
  if (!base && !relOrAbs) return null;
  try {
    return new URL(relOrAbs, base).toString();
  } catch (_e) {
    try { return new URL(relOrAbs).toString(); } catch (_e2) { return null; }
  }
}

/**
 * Ensure a URL ends with a trailing slash on its path. Inputs without a path
 * get one. Used for the root site URL throughout the audit.
 */
function ensureTrailingSlash(url) {
  try {
    const u = new URL(url);
    if (!u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/?$/, '/');
    return u.toString();
  } catch (_e) {
    return url;
  }
}

module.exports = {
  httpGet,
  resolveUrl,
  ensureTrailingSlash,
  DEFAULT_USER_AGENT,
  DEFAULT_TIMEOUT_MS,
};
