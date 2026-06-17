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
 * PDP URL resolution order:
 *   1. opts.productUrl (explicit) — treated as a verified real PDP.
 *   2. Catalog probe — Shopify /products.json (real handle) or WooCommerce
 *      Store API /wp-json/wc/store/products (real permalink). This yields a
 *      GUARANTEED-real PDP regardless of the store's locale/permalink base.
 *   3. Sitemap heuristic (localized-aware) — last resort, only a "guessed" PDP.
 *
 * When the PDP is VERIFIED (explicit or catalog-probed), a missing Product
 * JSON-LD is a real failure. When it's only GUESSED from the sitemap, a miss
 * downgrades to skip — we can't fail a store for a page we aren't sure is a
 * PDP (this is what false-failed localized WooCommerce stores like
 * lordofcbd.fr, whose products live under /produit/, not /product/).
 */
async function run(siteUrl, opts) {
  const discovered = (opts && opts.productUrl)
    ? { url: opts.productUrl, verified: true, source: 'explicit' }
    : (await discoverProductUrl(siteUrl, opts));
  const pdpUrl = discovered && discovered.url;
  const verified = !!(discovered && discovered.verified);
  const source = (discovered && discovered.source) || 'none';
  // Severity/status for a "couldn't confirm a Product node" outcome: a real
  // fail only when we know the URL is a genuine PDP; otherwise skip.
  const missStatus = verified ? 'fail' : 'skip';
  const missSeverity = verified ? 'fail' : 'info';

  if (!pdpUrl) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: 'info',
      status: 'skip',
      message: 'No product URL discovered (catalog probe + sitemap both empty); pass --product-url=<url> to audit a PDP explicitly',
      url: siteUrl,
    };
  }

  const resp = await httpGet(pdpUrl, opts);
  if (!resp.ok) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: missSeverity,
      status: missStatus,
      message: (resp.error
        ? `GET ${pdpUrl} failed: ${resp.error}`
        : `GET ${pdpUrl} returned ${resp.status}`) +
        (verified ? '' : ' (PDP guessed from sitemap — not failing)'),
      url: pdpUrl,
      details: { source, verified },
    };
  }

  const blocks = extractJsonLdBlocks(resp.body);
  if (blocks.length === 0) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: missSeverity,
      status: missStatus,
      message: 'No <script type="application/ld+json"> blocks found on the PDP' +
        (verified ? '' : ' (PDP guessed from sitemap — not failing)'),
      url: pdpUrl,
      details: { source, verified },
    };
  }

  const products = blocks.filter(function (b) { return isProductOrGroupNode(b); });
  if (products.length === 0) {
    return {
      id: ID,
      name: 'PDP emits schema.org Product JSON-LD',
      spec: SPEC,
      severity: missSeverity,
      status: missStatus,
      message: 'PDP has JSON-LD blocks but none with @type "Product"' +
        (verified ? '' : ' (PDP guessed from sitemap — likely not a real PDP, not failing)'),
      url: pdpUrl,
      details: { blockCount: blocks.length, source, verified },
    };
  }

  // Aggregate across ALL Product / ProductGroup nodes (and their variants and
  // any nested BuyAction Offer) rather than inspecting only products[0].
  // Real stores split this across blocks: e.g. a WooCommerce variable product
  // emits a ProductGroup (name + hasVariant[] each with an Offer) via the SEO
  // plugin, while xpay's plugin injects a separate minimal Product carrying
  // only sku + a BuyAction. Neither block alone has every field, but together
  // the PDP is fully agent-ready — so we validate the union, not one node.
  const name = pickName(products);
  const offer = pickOfferAcross(products);
  const hasName = typeof name === 'string' && name.length > 0;
  const hasPrice = !!(offer && offerPrice(offer) !== null);
  const hasCurrency = !!(offer && typeof offer.priceCurrency === 'string' && offer.priceCurrency.length > 0);
  const hasBuyAction = products.some(function (p) { return nodeHasBuyAction(p); }) ||
                       blocks.some(function (b) { return hasBuyActionNode(b); });
  const product = products[0];

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
        name: name,
        sku: product && product.sku,
        productType: product && product['@type'],
        price: offerPrice(offer),
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
      name: name,
      sku: product && product.sku,
      productType: product && product['@type'],
      price: offerPrice(offer),
      priceCurrency: offer.priceCurrency,
      hasBuyAction: true,
    },
  };
}

// --- PDP discovery ----------------------------------------------------------

/**
 * Resolve a real PDP URL for the storefront.
 *
 * Returns { url, verified, source } or null.
 *  - verified:true  → a guaranteed-real product page (catalog probe / explicit)
 *  - verified:false → a sitemap-guessed URL (we may have grabbed a non-PDP)
 *
 * Catalog-probe first (locale-independent), sitemap heuristic as fallback.
 */
async function discoverProductUrl(siteUrl, opts) {
  const fromCatalog = await probeCatalogPdp(siteUrl, opts);
  if (fromCatalog) return fromCatalog;

  const fromSitemap = await discoverProductUrlFromSitemap(siteUrl, opts);
  if (fromSitemap) return { url: fromSitemap, verified: false, source: 'sitemap' };

  return null;
}

/**
 * Probe the public catalog API to get a guaranteed-real PDP. Mirrors the
 * catalog probe used by commerce-readiness.ts (Shopify /products.json handle,
 * WooCommerce Store API permalink) so we audit the SAME real PDP — no
 * sitemap-guessing, and no dependence on the store's permalink base/locale.
 */
async function probeCatalogPdp(siteUrl, opts) {
  // Shopify — /products.json gives a canonical handle → /products/<handle>.
  const shopify = await getJson(resolveUrl(siteUrl, '/products.json?limit=1'), opts);
  if (shopify && Array.isArray(shopify.products) && shopify.products.length) {
    const handle = shopify.products[0] && shopify.products[0].handle;
    if (typeof handle === 'string' && handle) {
      const url = resolveUrl(siteUrl, '/products/' + encodeURIComponent(handle));
      if (url) return { url, verified: true, source: 'shopify-products-json' };
    }
  }

  // WooCommerce Store API — returns a real `permalink` (locale-correct base).
  for (const p of ['/wp-json/wc/store/v1/products?per_page=1', '/wp-json/wc/store/products?per_page=1']) {
    const woo = await getJson(resolveUrl(siteUrl, p), opts);
    const arr = Array.isArray(woo) ? woo : (woo && Array.isArray(woo.products) ? woo.products : null);
    if (arr && arr.length) {
      const permalink = arr[0] && arr[0].permalink;
      if (typeof permalink === 'string' && /^https?:\/\//i.test(permalink)) {
        return { url: permalink, verified: true, source: 'woo-store-api' };
      }
    }
  }

  return null;
}

async function getJson(url, opts) {
  if (!url) return null;
  const resp = await httpGet(url, opts);
  if (!resp.ok) return null;
  try { return JSON.parse(resp.body); } catch (_e) { return null; }
}

// Localized WooCommerce permalink bases + Shopify. WooCommerce localizes the
// product permalink base (FR /produit/, DE /produkt/, IT /prodotto/, ES
// /producto/, …), which the old monolingual /product(s)/ regex missed →
// false-failed every non-English store.
const PRODUCT_PATH_RE = /\/(products?|produits?|produkte?|prodott[io]|productos?|produto|produtos)\//i;

async function discoverProductUrlFromSitemap(siteUrl, opts) {
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

  // 1. Direct hit: any loc whose path uses a (localized) product base and is
  //    HTML, not another sitemap.
  for (const loc of locs) {
    if (PRODUCT_PATH_RE.test(loc) && !/\.xml(\?|$)/.test(loc)) {
      return loc;
    }
  }
  // 2. Indirect: a sub-sitemap named *product*.xml → recurse one level. The WC
  //    post type slug stays "product" in the sitemap filename regardless of
  //    the localized permalink base, so this match is locale-stable.
  for (const loc of locs) {
    if (/\.xml(\?|$)/.test(loc) && /produ(c|k|t)/i.test(loc)) {
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

// --- aggregation across Product / ProductGroup nodes ------------------------

function typeIncludes(node, lcType) {
  if (!node || typeof node !== 'object') return false;
  const t = node['@type'];
  if (typeof t === 'string') return t.toLowerCase() === lcType;
  if (Array.isArray(t)) return t.some(function (x) { return typeof x === 'string' && x.toLowerCase() === lcType; });
  return false;
}

/**
 * A node counts as a product if it is schema.org Product OR ProductGroup.
 * ProductGroup is the canonical type for a variable product (one with size /
 * colour variants); SEO plugins like Rank Math emit it on WooCommerce variable
 * PDPs, with the real Offers living on each hasVariant[] entry. Treating it as
 * "not a product" false-failed every variable-product store.
 */
function isProductOrGroupNode(node) {
  return isProductNode(node) || typeIncludes(node, 'productgroup');
}

function variantsOf(node) {
  const v = node && node.hasVariant;
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** First non-empty name found on the node or any of its variants. */
function pickName(nodes) {
  for (const n of nodes) {
    if (n && typeof n.name === 'string' && n.name.length > 0) return n.name;
    for (const v of variantsOf(n)) {
      if (v && typeof v.name === 'string' && v.name.length > 0) return v.name;
    }
  }
  return null;
}

/** Normalise node.offers into an array of offer objects (Offer/AggregateOffer). */
function offersOf(node) {
  const o = node && node.offers;
  if (!o) return [];
  if (Array.isArray(o)) return o.filter(function (x) { return x && typeof x === 'object'; });
  if (typeof o === 'object') return [o];
  return [];
}

/** Price from an Offer (price) or AggregateOffer (lowPrice). null if absent. */
function offerPrice(offer) {
  if (!offer || typeof offer !== 'object') return null;
  for (const key of ['price', 'lowPrice', 'highPrice']) {
    const v = offer[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

/**
 * Find the first offer carrying a usable price across all product nodes —
 * checking the node's own offers, each variant's offers, and any nested
 * BuyAction.expectsAcceptanceOf Offer (how xpay's injected stub carries price).
 * Prefers an offer that also has a priceCurrency.
 */
function pickOfferAcross(nodes) {
  const candidates = [];
  for (const n of nodes) {
    for (const o of offersOf(n)) candidates.push(o);
    for (const v of variantsOf(n)) {
      for (const o of offersOf(v)) candidates.push(o);
    }
    for (const o of buyActionOffers(n)) candidates.push(o);
  }
  const priced = candidates.filter(function (o) { return offerPrice(o) !== null; });
  if (!priced.length) return null;
  const withCurrency = priced.find(function (o) { return typeof o.priceCurrency === 'string' && o.priceCurrency.length > 0; });
  return withCurrency || priced[0];
}

/** Offers reachable via a node's BuyAction.expectsAcceptanceOf. */
function buyActionOffers(node) {
  if (!node || typeof node !== 'object') return [];
  const pa = node.potentialAction;
  if (!pa) return [];
  const list = Array.isArray(pa) ? pa : [pa];
  const out = [];
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const eo = a.expectsAcceptanceOf;
    if (!eo) continue;
    const eos = Array.isArray(eo) ? eo : [eo];
    for (const o of eos) if (o && typeof o === 'object') out.push(o);
  }
  return out;
}

/** True if the node, or any of its variants, exposes a BuyAction. */
function nodeHasBuyAction(node) {
  if (hasBuyActionNode(node)) return true;
  return variantsOf(node).some(function (v) { return hasBuyActionNode(v); });
}

module.exports = { id: ID, run };
