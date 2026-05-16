'use strict';

/**
 * @xpaysh/discovery — pure-function generators for the real, externally-
 * verified agent-readable discovery surface. Zero runtime dependencies.
 *
 * Ported from the reference implementation in
 * xpaysh/agentic-commerce-for-woocommerce (v0.2.0, PHP). The TypeScript port
 * is the canonical surface every sibling plugin in the family should consume;
 * the PHP plugin retains a parallel implementation since the WP ecosystem
 * cannot depend on npm packages at runtime.
 *
 * What this package covers (all verified against published specs):
 *   - /llms.txt                             llmstxt.org
 *   - schema.org JSON-LD (Product, Offer,   schema.org / W3C
 *     BuyAction, ItemList, AggregateRating)
 *   - robots.txt allowlist                  RFC 9309 + real AI-crawler UAs
 *   - /.well-known/agent-card.json          A2A 1.0, IANA-registered 2025-08-01
 *   - /.well-known/oauth-protected-resource RFC 9728
 *
 * NOT covered here (lives in @xpaysh/ucp-schemas):
 *   - /.well-known/ucp                      UCP business profile, spec 2026-04-08
 *
 * Anti-coverage (the "do not emit" list): /.well-known/agentic-commerce.json,
 * /.well-known/ucp.json (wrong filename), /.well-known/acp.json,
 * /.well-known/ap2.json, /.well-known/mcp.json, /.well-known/ai-plugin.json,
 * /agents.txt, /ai.txt. Sibling plugins MUST run the project CI linter that
 * rejects any of these.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LLMS_TXT_PATH = '/llms.txt';
const OAUTH_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';
const AGENT_CARD_PATH = '/.well-known/agent-card.json';

/**
 * Canonical AI-crawler User-Agent strings, drawn from each vendor's published
 * documentation as of 2026-05-16. Keep this list narrowly to UAs that have a
 * documented spec page or robots-policy URL; do not add speculative entries.
 */
const REAL_AI_USER_AGENTS = Object.freeze([
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Amazonbot',
]);

const SCHEMA_ORG_CONTEXT = 'https://schema.org/';

// ---------------------------------------------------------------------------
// llms.txt — llmstxt.org Markdown convention
// ---------------------------------------------------------------------------

/**
 * Generate the Markdown body for /llms.txt per llmstxt.org. Output is intended
 * to be served with Content-Type: text/plain; charset=utf-8.
 *
 * @param {object} opts
 * @param {string} opts.siteName
 * @param {string} [opts.siteDescription]
 * @param {string} opts.siteUrl                    Trailing slash recommended.
 * @param {string} [opts.merchantSlug]             Used in the xpay-hosted protocol links.
 * @param {Array<{title:string,url:string}>} [opts.storeLinks]
 * @param {string} [opts.catalogFeedUrl]
 * @param {object} [opts.commerceProtocols]        { acp, ucp, ap2, mcp } URLs
 * @param {string} [opts.cartDeeplinkPattern]      e.g. 'https://store.example/?xpay_cart={token}'
 * @param {Array<{name:string,url:string}>} [opts.topCategories]
 * @param {string} [opts.agentSummary]             Trailing paragraph for AI shopping agents.
 * @returns {string} Markdown text with a trailing newline.
 */
function generateLlmsTxt(opts) {
  if (!opts || typeof opts.siteName !== 'string' || !opts.siteName) {
    throw new TypeError('generateLlmsTxt: opts.siteName (string) is required');
  }
  if (typeof opts.siteUrl !== 'string' || !opts.siteUrl) {
    throw new TypeError('generateLlmsTxt: opts.siteUrl (string) is required');
  }

  const siteUrl = opts.siteUrl.endsWith('/') ? opts.siteUrl : opts.siteUrl + '/';
  const lines = [];
  lines.push('# ' + opts.siteName);
  if (opts.siteDescription) {
    lines.push('');
    lines.push('> ' + opts.siteDescription);
  }

  // Store
  const storeLinks = Array.isArray(opts.storeLinks) && opts.storeLinks.length > 0
    ? opts.storeLinks
    : [
        { title: 'Shop home', url: siteUrl + 'shop/' },
        { title: 'Products sitemap', url: siteUrl + 'sitemap_index.xml' },
      ];
  lines.push('');
  lines.push('## Store');
  lines.push('');
  for (const link of storeLinks) {
    lines.push('- [' + link.title + '](' + link.url + ')');
  }
  if (opts.catalogFeedUrl) {
    lines.push('- [Agent-readable catalog (JSON)](' + opts.catalogFeedUrl + ')');
  }

  // Commerce protocols
  if (opts.commerceProtocols && typeof opts.commerceProtocols === 'object') {
    lines.push('');
    lines.push('## Commerce protocols');
    lines.push('');
    if (opts.commerceProtocols.acp) lines.push('- [ACP — Agentic Commerce Protocol](' + opts.commerceProtocols.acp + ')');
    if (opts.commerceProtocols.ucp) lines.push('- [UCP — Universal Commerce Protocol](' + opts.commerceProtocols.ucp + ')');
    if (opts.commerceProtocols.ap2) lines.push('- [AP2 — Agent Payments Protocol](' + opts.commerceProtocols.ap2 + ')');
    if (opts.commerceProtocols.mcp) lines.push('- [MCP — Model Context Protocol server](' + opts.commerceProtocols.mcp + ')');
  }

  // Cart handoff
  if (opts.cartDeeplinkPattern) {
    lines.push('');
    lines.push('## Cart handoff');
    lines.push('');
    lines.push('- Cart deeplink: `' + opts.cartDeeplinkPattern + '` — pre-fills the merchant cart and lands the buyer on the existing checkout.');
  }

  // Top categories
  if (Array.isArray(opts.topCategories) && opts.topCategories.length > 0) {
    lines.push('');
    lines.push('## Top categories');
    lines.push(''); // Blank line for Markdown-strict parsers (the WC PHP plugin
                   // omits this; correct it there in a future release for parity).
    for (const c of opts.topCategories) {
      lines.push('- [' + c.name + '](' + c.url + ')');
    }
  }

  // For AI shopping agents
  lines.push('');
  lines.push('## For AI shopping agents');
  lines.push('');
  lines.push(
    opts.agentSummary ||
      'This store accepts agent-initiated purchases via the open commerce protocols above. Live product data is exposed as schema.org JSON-LD on every product page; robots.txt explicitly allows GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Google-Extended and related AI user-agents.'
  );

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// schema.org JSON-LD — Product / ItemList
// ---------------------------------------------------------------------------

function _availability(inStock) {
  return inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
}

/**
 * Generate a schema.org Product JSON-LD object with Offer + BuyAction.
 * Output is intended to be serialised and wrapped in
 * `<script type="application/ld+json" data-emitter="xpay">…</script>`.
 *
 * @param {object} opts
 * @returns {object}
 */
function generateProductJsonLd(opts) {
  if (!opts || typeof opts.url !== 'string' || !opts.url) {
    throw new TypeError('generateProductJsonLd: opts.url (string) is required');
  }
  if (typeof opts.name !== 'string' || !opts.name) {
    throw new TypeError('generateProductJsonLd: opts.name (string) is required');
  }
  if (typeof opts.priceCurrency !== 'string' || !opts.priceCurrency) {
    throw new TypeError('generateProductJsonLd: opts.priceCurrency (string) is required');
  }

  const context = opts.context || SCHEMA_ORG_CONTEXT;
  const priceValidUntil = opts.priceValidUntil ||
    new Date().getUTCFullYear() + '-12-31';

  const offer = {
    '@type': 'Offer',
    priceCurrency: opts.priceCurrency,
    price: opts.price == null ? null : String(opts.price),
    availability: _availability(opts.inStock),
    url: opts.url,
    priceValidUntil,
  };

  const node = {
    '@context': context,
    '@type': 'Product',
    name: opts.name,
    sku: opts.sku || undefined,
    image: Array.isArray(opts.images) && opts.images.length > 0 ? opts.images : undefined,
    description: opts.description || undefined,
    url: opts.url,
    offers: offer,
    potentialAction: {
      '@type': 'BuyAction',
      target: opts.buyActionTarget || opts.url,
      expectsAcceptanceOf: {
        '@type': 'Offer',
        price: offer.price,
        priceCurrency: opts.priceCurrency,
      },
    },
  };

  if (opts.aggregateRating &&
      typeof opts.aggregateRating.ratingValue === 'number' &&
      typeof opts.aggregateRating.reviewCount === 'number' &&
      opts.aggregateRating.reviewCount > 0) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.aggregateRating.ratingValue,
      reviewCount: opts.aggregateRating.reviewCount,
    };
  }

  return _stripUndefined(node);
}

/**
 * Generate a slim Product JSON-LD that ONLY contributes the BuyAction +
 * canonical URL. Use when another emitter (Yoast / Rank Math / WC core /
 * commercetools storefront) already serves a full Product block — avoids
 * double schemas while still surfacing the BuyAction that other emitters
 * don't include.
 *
 * @param {object} opts
 * @returns {object}
 */
function generateProductJsonLdSlim(opts) {
  if (!opts || typeof opts.url !== 'string' || !opts.url) {
    throw new TypeError('generateProductJsonLdSlim: opts.url (string) is required');
  }
  if (typeof opts.sku !== 'string' || !opts.sku) {
    throw new TypeError('generateProductJsonLdSlim: opts.sku (string) is required');
  }
  if (typeof opts.buyActionTarget !== 'string' || !opts.buyActionTarget) {
    throw new TypeError('generateProductJsonLdSlim: opts.buyActionTarget (string) is required');
  }
  return {
    '@context': opts.context || SCHEMA_ORG_CONTEXT,
    '@type': 'Product',
    '@id': opts.url + '#xpay-buyaction',
    sku: opts.sku,
    url: opts.url,
    potentialAction: {
      '@type': 'BuyAction',
      target: opts.buyActionTarget,
    },
  };
}

/**
 * Generate a schema.org ItemList JSON-LD for shop archives / homepages.
 *
 * @param {object} opts
 * @param {string} [opts.name]
 * @param {Array<object>} opts.items     Each: { name, sku?, url, image?, price?, priceCurrency, inStock? }
 * @returns {object}
 */
function generateItemListJsonLd(opts) {
  if (!opts || !Array.isArray(opts.items)) {
    throw new TypeError('generateItemListJsonLd: opts.items (array) is required');
  }
  const items = opts.items.map(function (entry, idx) {
    const offer = {
      '@type': 'Offer',
      price: entry.price == null ? null : String(entry.price),
      priceCurrency: entry.priceCurrency,
      availability: _availability(entry.inStock),
      url: entry.url,
    };
    return {
      '@type': 'ListItem',
      position: idx + 1,
      item: _stripUndefined({
        '@type': 'Product',
        name: entry.name,
        sku: entry.sku || undefined,
        url: entry.url,
        image: entry.image || undefined,
        offers: offer,
      }),
    };
  });

  return _stripUndefined({
    '@context': SCHEMA_ORG_CONTEXT,
    '@type': 'ItemList',
    name: opts.name || undefined,
    numberOfItems: items.length,
    itemListElement: items,
  });
}

// ---------------------------------------------------------------------------
// robots.txt — append allow blocks for real AI crawlers
// ---------------------------------------------------------------------------

/**
 * Append explicit "User-agent: X / Allow: /" blocks for each real AI crawler
 * not already mentioned in the existing robots.txt. Returns both the new
 * robots.txt content and the list of agents that were appended (for telemetry
 * and admin-UI feedback).
 *
 * Mirrors the WC plugin's Xpay_Robots::append_agent_allows() behaviour — if a
 * UA is already mentioned (Allow OR Disallow), leave it alone to avoid
 * fighting deliberate merchant config.
 *
 * @param {object} [opts]
 * @param {string} [opts.existingRobotsTxt='']
 * @param {readonly string[]} [opts.agents=REAL_AI_USER_AGENTS]
 * @param {string} [opts.header='# xpay — shopping agents allowed']
 * @returns {{ robotsTxt: string, appendedAgents: string[] }}
 */
function generateRobotsTxtBlock(opts) {
  const existing = (opts && typeof opts.existingRobotsTxt === 'string') ? opts.existingRobotsTxt : '';
  const agents = (opts && Array.isArray(opts.agents)) ? opts.agents : REAL_AI_USER_AGENTS;
  const header = (opts && typeof opts.header === 'string') ? opts.header : '# xpay — shopping agents allowed';

  const lowered = existing.toLowerCase();
  const appended = [];
  const blocks = [];
  for (const ua of agents) {
    const needle = 'user-agent: ' + ua.toLowerCase();
    if (lowered.indexOf(needle) !== -1) {
      continue;
    }
    blocks.push('User-agent: ' + ua + '\nAllow: /\n');
    appended.push(ua);
  }

  if (blocks.length === 0) {
    return { robotsTxt: existing, appendedAgents: [] };
  }

  const trimmed = existing.replace(/\n+$/, '');
  const prefix = trimmed.length > 0 ? trimmed + '\n' : '';
  return {
    robotsTxt: prefix + '\n' + header + '\n' + blocks.join('\n'),
    appendedAgents: appended,
  };
}

// ---------------------------------------------------------------------------
// /.well-known/agent-card.json — A2A 1.0
// ---------------------------------------------------------------------------

const DEFAULT_AGENT_CARD_SKILLS = Object.freeze([
  Object.freeze({
    id: 'browse_catalog',
    name: 'Browse catalog',
    description: 'List and search products in the merchant catalog.',
  }),
  Object.freeze({
    id: 'create_cart',
    name: 'Create cart',
    description: 'Build a cart and obtain a signed checkout deeplink.',
  }),
]);

const DEFAULT_AGENT_CARD_CAPABILITIES = Object.freeze({
  shopping: true,
  cart: true,
  inventory: true,
});

/**
 * Generate the JSON body for /.well-known/agent-card.json per A2A 1.0.
 * Watchlist standard — sibling plugins emit this only when the merchant
 * opts in. Default values mirror the WC plugin's default profile shape.
 *
 * @param {object} opts
 * @returns {object}
 */
function generateAgentCardJson(opts) {
  if (!opts || typeof opts.name !== 'string' || !opts.name) {
    throw new TypeError('generateAgentCardJson: opts.name (string) is required');
  }
  if (typeof opts.url !== 'string' || !opts.url) {
    throw new TypeError('generateAgentCardJson: opts.url (string) is required');
  }
  if (typeof opts.version !== 'string' || !opts.version) {
    throw new TypeError('generateAgentCardJson: opts.version (string) is required');
  }

  const payload = {
    name: opts.name,
    description: opts.description || undefined,
    url: opts.url,
    version: opts.version,
    capabilities: opts.capabilities || DEFAULT_AGENT_CARD_CAPABILITIES,
    skills: Array.isArray(opts.skills) ? opts.skills : DEFAULT_AGENT_CARD_SKILLS,
  };
  if (opts.provider) {
    payload.provider = opts.provider;
  }
  return _stripUndefined(payload);
}

// ---------------------------------------------------------------------------
// /.well-known/oauth-protected-resource — RFC 9728
// ---------------------------------------------------------------------------

/**
 * Generate the JSON body for /.well-known/oauth-protected-resource per RFC
 * 9728 (IANA-registered 2024-10-22).
 *
 * @param {object} opts
 * @returns {object}
 */
function generateOAuthProtectedResource(opts) {
  if (!opts || typeof opts.resource !== 'string' || !opts.resource) {
    throw new TypeError('generateOAuthProtectedResource: opts.resource (string) is required');
  }
  if (!Array.isArray(opts.authorizationServers) || opts.authorizationServers.length === 0) {
    throw new TypeError('generateOAuthProtectedResource: opts.authorizationServers (non-empty array) is required');
  }

  return _stripUndefined({
    resource: opts.resource,
    resource_name: opts.resourceName || undefined,
    authorization_servers: opts.authorizationServers,
    scopes_supported: opts.scopesSupported || ['catalog.read', 'cart.write', 'order.read'],
    bearer_methods_supported: opts.bearerMethodsSupported || ['header'],
    resource_documentation: opts.resourceDocumentation || undefined,
    resource_signing_alg_values_supported: opts.resourceSigningAlgValuesSupported || ['ES256', 'RS256'],
  });
}

// ---------------------------------------------------------------------------
// Emitter descriptors — the WC plugin's emitter-registry pattern, in TypeScript
// ---------------------------------------------------------------------------

/**
 * Standard emitter descriptors. Sibling plugins import this map and wire each
 * descriptor into their platform-specific request router. Adding a new
 * emitter to the family = adding one entry here + one generator function.
 *
 * Note: UCP business profile (`/.well-known/ucp`) is NOT in this map. It
 * lives in @xpaysh/ucp-schemas (along with the generator and TypeScript
 * types). Plugins should import both packages and merge the two registries.
 *
 * The do-not-emit list (which the project CI linter enforces) is in the
 * standards-and-extensibility-guide.md doc. NEVER add a row here that emits
 * a path on the deny list.
 */
const STANDARD_EMITTERS = Object.freeze({
  llms: Object.freeze({
    path: LLMS_TXT_PATH,
    contentType: 'text/plain; charset=utf-8',
    defaultOn: true,
    spec: 'https://llmstxt.org',
  }),
  oauthProtectedResource: Object.freeze({
    path: OAUTH_PROTECTED_RESOURCE_PATH,
    contentType: 'application/json; charset=utf-8',
    defaultOn: false,
    spec: 'https://datatracker.ietf.org/doc/rfc9728/',
  }),
  agentCard: Object.freeze({
    path: AGENT_CARD_PATH,
    contentType: 'application/json; charset=utf-8',
    defaultOn: false,
    spec: 'https://a2a-protocol.org/',
  }),
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _stripUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj.map(_stripUndefined);
  }
  if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v !== undefined) {
        out[k] = _stripUndefined(v);
      }
    }
    return out;
  }
  return obj;
}

module.exports = {
  // Constants
  LLMS_TXT_PATH,
  OAUTH_PROTECTED_RESOURCE_PATH,
  AGENT_CARD_PATH,
  REAL_AI_USER_AGENTS,
  SCHEMA_ORG_CONTEXT,
  DEFAULT_AGENT_CARD_SKILLS,
  DEFAULT_AGENT_CARD_CAPABILITIES,
  STANDARD_EMITTERS,

  // Generators
  generateLlmsTxt,
  generateProductJsonLd,
  generateProductJsonLdSlim,
  generateItemListJsonLd,
  generateRobotsTxtBlock,
  generateAgentCardJson,
  generateOAuthProtectedResource,
};
