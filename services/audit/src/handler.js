'use strict';

/**
 * audit.xpay.sh — request handler.
 *
 * Platform-portable: accepts a normalized request shape and returns a
 * normalized response shape. Adapters in src/server.js (bare Node http) and
 * other entry files map to/from Vercel / Lambda / Cloudflare / Express.
 *
 * Routes:
 *
 *   GET /                        HTML report (?url=...)
 *   GET /api/v1/audit            JSON report (?url=...)
 *   GET /badge.svg               SVG badge (?url=...)
 *   GET /healthz                 liveness
 *
 * Caching: in-memory TTL cache (default 300s). Production deployments should
 * sit behind a CDN with the same TTL; the in-memory layer protects the
 * origin from hot-key bursts and is safe for cold-start lambdas (skips on
 * cache miss).
 */

const { audit, renderMarkdown } = require('@xpaysh/storefront-audit');

const CACHE_TTL_MS = parseInt(process.env.AUDIT_CACHE_TTL_MS || '300000', 10);
const CACHE_MAX = parseInt(process.env.AUDIT_CACHE_MAX || '500', 10);
const AUDIT_TIMEOUT_MS = parseInt(process.env.AUDIT_TIMEOUT_MS || '10000', 10);

const _cache = new Map(); // key -> { expires, report }

function _cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) { _cache.delete(key); return null; }
  return hit.report;
}

function _cacheSet(key, report) {
  if (_cache.size >= CACHE_MAX) {
    // simple FIFO eviction (oldest insertion order)
    const oldest = _cache.keys().next().value;
    if (oldest !== undefined) _cache.delete(oldest);
  }
  _cache.set(key, { expires: Date.now() + CACHE_TTL_MS, report });
}

/**
 * Run an audit, with caching keyed on (url, productUrl, checks-list).
 */
async function _runCached(url, productUrl, checks) {
  const key = JSON.stringify([url, productUrl || null, checks || null]);
  const cached = _cacheGet(key);
  if (cached) return cached;

  const report = await audit(url, {
    productUrl: productUrl || undefined,
    checks: checks || undefined,
    timeoutMs: AUDIT_TIMEOUT_MS,
  });
  _cacheSet(key, report);
  return report;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

const BADGE_COLORS = {
  pass: '#10b981',  // green
  warn: '#f59e0b',  // amber
  fail: '#ef4444',  // red
  unknown: '#6b7280',
};

/**
 * Render an SVG badge. Shields-style layout — left label, right verdict, fixed widths.
 */
function renderBadge(verdict) {
  const v = (verdict in BADGE_COLORS) ? verdict : 'unknown';
  const color = BADGE_COLORS[v];
  const label = 'agent-ready';
  const value = v;
  // approximate widths in 11px font; not pixel-perfect but readable
  const labelW = 76;
  const valueW = Math.max(40, value.length * 8 + 12);
  const total = labelW + valueW;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="20" role="img" aria-label="' + label + ': ' + value + '">' +
      '<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>' +
      '<rect width="' + total + '" height="20" rx="3" fill="#555"/>' +
      '<rect x="' + labelW + '" width="' + valueW + '" height="20" rx="3" fill="' + color + '"/>' +
      '<rect width="' + total + '" height="20" rx="3" fill="url(#s)"/>' +
      '<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">' +
        '<text x="' + (labelW / 2) + '" y="14">' + label + '</text>' +
        '<text x="' + (labelW + valueW / 2) + '" y="14">' + value + '</text>' +
      '</g>' +
    '</svg>'
  );
}

function _escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function renderHtml(report) {
  const c = report.summary.counts;
  const v = report.summary.verdict;
  const rows = report.results.map(function (r) {
    const glyph = ({ pass: '✓', fail: '✗', warn: '!', skip: '·' })[r.status] || '?';
    return '<tr class="' + r.status + '"><td class="g">' + glyph + '</td><td>' +
      '<div class="n">' + _escapeHtml(r.name) + '</div>' +
      '<div class="m">' + _escapeHtml(r.message) + '</div>' +
      (r.spec ? '<div class="s"><a href="' + _escapeHtml(r.spec) + '">' + _escapeHtml(r.spec) + '</a></div>' : '') +
      '</td></tr>';
  }).join('');
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Agent-readiness audit · ' + _escapeHtml(report.siteUrl) + '</title>' +
    '<style>' +
      'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;color:#111}' +
      'h1{margin:0 0 .5rem 0;font-size:1.4rem}' +
      '.url{color:#666;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all}' +
      '.summary{margin:1rem 0;padding:1rem;border-radius:.5rem}' +
      '.summary.pass{background:#ecfdf5}.summary.warn{background:#fffbeb}.summary.fail{background:#fef2f2}' +
      '.verdict{font-weight:700;text-transform:uppercase;font-size:1.2rem}' +
      'table{width:100%;border-collapse:collapse}' +
      'td{padding:.6rem .4rem;border-top:1px solid #eee;vertical-align:top}' +
      'tr.fail .g{color:#ef4444}tr.warn .g{color:#f59e0b}tr.pass .g{color:#10b981}tr.skip .g{color:#9ca3af}' +
      '.g{font-size:1.1rem;width:1.5rem;text-align:center}' +
      '.n{font-weight:600}.m{color:#444;margin-top:.15rem}.s{font-size:.8rem;color:#888;margin-top:.2rem}.s a{color:inherit}' +
      'footer{margin-top:2rem;color:#888;font-size:.85rem}' +
    '</style></head><body>' +
    '<h1>Agent-readiness audit</h1>' +
    '<div class="url">' + _escapeHtml(report.siteUrl) + '</div>' +
    '<div class="summary ' + v + '">' +
      '<div class="verdict">' + v + '</div>' +
      '<div>pass ' + c.pass + '  ·  warn ' + c.warn + '  ·  fail ' + c.fail + '  ·  skip ' + c.skip + '</div>' +
    '</div>' +
    '<table>' + rows + '</table>' +
    '<footer>Audited ' + _escapeHtml(report.auditedAt) + ' by <a href="https://www.npmjs.com/package/@xpaysh/storefront-audit">@xpaysh/storefront-audit@' + _escapeHtml(report.auditorVersion) + '</a>. ' +
      'Embed the badge: <code>&lt;img src="https://audit.xpay.sh/badge.svg?url=' + encodeURIComponent(report.siteUrl) + '"&gt;</code></footer>' +
    '</body></html>'
  );
}

// ---------------------------------------------------------------------------
// Normalised request → response
// ---------------------------------------------------------------------------

function _bad(status, message) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Handle one request. `req` is `{ method, path, query }`. Returns
 * `{ status, headers, body }`.
 *
 * @param {{method:string,path:string,query:Record<string,string|undefined>}} req
 */
async function handleRequest(req) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    return _bad(405, 'method not allowed');
  }
  const path = (req.path || '/').replace(/\/+$/, '') || '/';

  if (path === '/healthz') {
    return {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify({ ok: true, cache_size: _cache.size }),
    };
  }

  // routes below all need url=
  const url = (req.query && req.query.url) ? String(req.query.url).trim() : '';
  if (!url) {
    if (path === '/' || path === '') {
      // Landing page when no url is given.
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
        body: '<!doctype html><html><head><meta charset=utf-8><title>audit.xpay.sh</title>' +
              '<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:3rem auto;padding:0 1rem}h1{font-size:1.4rem}form{display:flex;gap:.5rem;margin:1rem 0}input{flex:1;padding:.6rem;border:1px solid #ddd;border-radius:.4rem;font-size:1rem}button{padding:.6rem 1rem;border:0;border-radius:.4rem;background:#111;color:#fff;font-size:1rem;cursor:pointer}p{color:#444}code{background:#f3f4f6;padding:.15rem .3rem;border-radius:.2rem;font-size:.9em}</style>' +
              '</head><body><h1>Agent-readiness audit</h1>' +
              '<p>Free, anonymous check that any storefront URL is discoverable to AI shopping agents. Uses real, externally-verified standards only — no proprietary signals.</p>' +
              '<form method="get" action="/"><input name="url" placeholder="https://store.example/" required><button type="submit">Audit</button></form>' +
              '<p>Programmatic: <code>GET /api/v1/audit?url=…</code> returns JSON · <code>GET /badge.svg?url=…</code> returns an embeddable SVG · <code>GET /healthz</code> liveness.</p>' +
              '<p>Powered by <a href="https://www.npmjs.com/package/@xpaysh/storefront-audit">@xpaysh/storefront-audit</a>. Source: <a href="https://github.com/xpaysh/agentic-commerce-plugin-template">xpaysh/agentic-commerce-plugin-template</a>.</p>' +
              '</body></html>',
      };
    }
    return _bad(400, 'url= is required');
  }

  // Validate URL
  try { new URL(url); } catch (_e) { return _bad(400, 'invalid url'); }

  const productUrl = (req.query && req.query.product_url) ? String(req.query.product_url) : undefined;
  const checks = (req.query && req.query.checks) ? String(req.query.checks).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : undefined;

  let report;
  try {
    report = await _runCached(url, productUrl, checks);
  } catch (err) {
    return _bad(500, 'audit failed: ' + ((err && err.message) || String(err)));
  }

  if (path === '/api/v1/audit') {
    return {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=' + Math.floor(CACHE_TTL_MS / 1000),
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify(report, null, 2),
    };
  }

  if (path === '/badge.svg' || path === '/badge') {
    return {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'public, max-age=' + Math.floor(CACHE_TTL_MS / 1000),
        'access-control-allow-origin': '*',
      },
      body: renderBadge(report.summary.verdict),
    };
  }

  if (path === '/' || path === '/audit') {
    // HTML report
    return {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=' + Math.floor(CACHE_TTL_MS / 1000),
      },
      body: renderHtml(report),
    };
  }

  if (path === '/api/v1/markdown') {
    return {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'public, max-age=' + Math.floor(CACHE_TTL_MS / 1000),
        'access-control-allow-origin': '*',
      },
      body: renderMarkdown(report),
    };
  }

  return _bad(404, 'not found');
}

module.exports = {
  handleRequest,
  renderBadge,
  renderHtml,
};
