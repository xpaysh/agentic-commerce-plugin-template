'use strict';

const { httpGet, resolveUrl } = require('../http');

const ID = 'discovery.schema_org_product';
const SPEC = 'https://schema.org/Product';

/**
 * Check that a product detail page (PDP) emits a schema.org Product JSON-LD
 * block, with at minimum Product + Offer + price. Warn (not fail) if
 * BuyAction is missing — xpay's plugin family adds it, but many SEO plugins
 * (Yoast, Rank Math) don't, and a missing BuyAction degrades agent UX
 * without making the store invisible.
 *
 * PDP URL is either supplied via opts.productUrl or auto-discovered from
 * /sitemap.xml or /sitemap_index.xml. If neither can yield a candidate, the
 * check returns severity=info status=skip.
 */
async function run(siteUrl, opts) {
  const pdpUrl = (opts && opts.productUrl) || (await discoverProductUrl(siteUrl, opts));
  if (!pdpUrl) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'fail',
      status: 'skip',
      message: 'No product URL discovered (no sitemap or no /product/ entries); pass --product-url=<url> to audit a PDP explicitly',
      url: siteUrl,
    };
  }

  const resp = await httpGet(pdpUrl, opts);
  if (!resp.ok) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: resp.error
        ? `GET ${pdpUrl} failed: ${resp.error}`
        : `GET ${pdpUrl} returned ${resp.status}`,
      url: pdpUrl,
    };
  }

  const blocks = extractJsonLdBlocks(resp.body);
  if (blocks.length === 0) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: 'No <script type="application/ld+json"> blocks found on the PDP',
      url: pdpUrl,
    };
  }

  const products = blocks.filter(function (b) { return isProductNode(b); });
  if (products.length === 0) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: 'PDP has JSON-LD blocks but none with @type "Product"',
      url: pdpUrl,
      details: { blockCount: blocks.length },
    };
  }

  // Validate the first Product node.
  const product = products[0];
  const offer = pickOffer(product);
  const hasName = typeof product.name === 'string' && product.name.length > 0;
  const hasPrice = offer && (offer.price !== undefined && offer.price !== null && offer.price !== '');
  const hasCurrency = offer && typeof offer.priceCurrency === 'string' && offer.priceCurrency.length > 0;
  const hasBuyAction = hasBuyActionNode(product) ||
                       blocks.some(function (b) { return hasBuyActionNode(b); });

  const missing = [];
  if (!hasName) missing.push('Product.name');
  if (!hasPrice) missing.push('Offer.price');
  if (!hasCurrency) missing.push('Offer.priceCurrency');

  if (missing.length > 0) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'fail',
      status: 'fail',
      message: 'Product JSON-LD missing required field(s): ' + missing.join(', '),
      url: pdpUrl,
      details: { product, missing },
    };
  }

  if (!hasBuyAction) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'warn',
      status: 'warn',
      message: 'Product JSON-LD present but BuyAction missing — agents may struggle to find the buy target',
      url: pdpUrl,
      details: {
        name: product.name,
        sku: product.sku,
        price: offer.price,
        priceCurrency: offer.priceCurrency,
        hasBuyAction: false,
      },
    };
  }

  return {
    id: ID,
    name: 'PDP emits schema.org Product JSON-LD',
    spec: SPEC,
    severity: 'fail',
    status: 'pass',
    message: `Product JSON-LD complete (name + Offer with price/currency + BuyAction)`,
    url: pdpUrl,
    details: {
      name: product.name,
      sku: product.sku,
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      hasBuyAction: true,
    },
  };
}

// --- PDP discovery ----------------------------------------------------------

async function discoverProductUrl(siteUrl, opts) {
  // Try /sitemap_index.xml first (WC default), then /sitemap.xml.
  for (const p of ['/sitemap_index.xml', '/sitemap.xml']) {
    const candidate = await tryFindProductUrl(resolveUrl(siteUrl, p), opts);
    if (candidate) return candidate;
  }
  return null;
}

async function tryFindProductUrl(sitemapUrl, opts) {
  const resp = await httpGet(sitemapUrl, opts);
  if (!resp.ok) return null;

  // Sitemap may be index-of-sitemaps or url-set. Walk locs heuristically.
  const locs = (resp.body.match(/<loc>\s*([^<]+?)\s*<\/loc>/gi) || [])
    .map(function (m) { return m.replace(/<\/?loc>/gi, '').trim(); });

  // 1. Direct hit: any loc containing "/product/" or "/products/" (and is HTML, not another sitemap).
  for (const loc of locs) {
    if (/\/(product|products)\//.test(loc) && !/\.xml(\?|$)/.test(loc)) {
      return loc;
    }
  }
  // 2. Indirect: a sub-sitemap named *product*.xml → recurse one level.
  for (const loc of locs) {
    if (/\.xml(\?|$)/.test(loc) && /product/i.test(loc)) {
      const inner = await httpGet(loc, opts);
      if (!inner.ok) continue;
      const innerLocs = (inner.body.match(/<loc>\s*([^<]+?)\s*<\/loc>/gi) || [])
        .map(function (m) { return m.replace(/<\/?loc>/gi, '').trim(); });
      for (const il of innerLocs) {
        if (!/\.xml(\?|$)/.test(il)) return il;
      }
    }
  }
  return null;
}

// --- JSON-LD extraction -----------------------------------------------------

function extractJsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) out.push(item);
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed['@graph'])) {
          for (const item of parsed['@graph']) out.push(item);
        } else {
          out.push(parsed);
        }
      }
    } catch (_e) { /* skip malformed block */ }
  }
  return out;
}

function isProductNode(node) {
  if (!node || typeof node !== 'object') return false;
  const t = node['@type'];
  if (typeof t === 'string') return t.toLowerCase() === 'product';
  if (Array.isArray(t)) return t.some(function (x) { return typeof x === 'string' && x.toLowerCase() === 'product'; });
  return false;
}

function pickOffer(productNode) {
  const o = productNode.offers;
  if (!o) return null;
  if (Array.isArray(o)) return o[0] || null;
  if (typeof o === 'object') return o;
  return null;
}

function hasBuyActionNode(node) {
  if (!node || typeof node !== 'object') return false;
  const pa = node.potentialAction;
  if (!pa) return false;
  const list = Array.isArray(pa) ? pa : [pa];
  return list.some(function (a) {
    if (!a || typeof a !== 'object') return false;
    const t = a['@type'];
    if (typeof t === 'string') return t.toLowerCase() === 'buyaction';
    if (Array.isArray(t)) return t.some(function (x) { return typeof x === 'string' && x.toLowerCase() === 'buyaction'; });
    return false;
  });
}

module.exports = { id: ID, run };
