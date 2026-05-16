# @xpaysh/discovery

Pure-function generators for the **real agent-readable discovery surface** that every plugin in the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) family emits. Zero runtime dependencies. Apache-2.0.

Ported from the reference implementation in [`xpaysh/agentic-commerce-for-woocommerce`](https://github.com/xpaysh/agentic-commerce-for-woocommerce) (v0.2.0, PHP). The TypeScript port is the canonical surface every sibling plugin (`agentic-commerce-for-{commercetools,bigcommerce,magento,shopify-app,salesforce-commerce,prestashop,saleor}`) consumes.

## What this package emits

| Path / artifact | Spec | Default |
|---|---|---|
| `/llms.txt` | [llmstxt.org](https://llmstxt.org) — Markdown convention | **on** |
| `<script type="application/ld+json">` on product pages | [schema.org](https://schema.org) Product + Offer + BuyAction | **on** |
| `<script type="application/ld+json">` on listing pages | schema.org ItemList | **on** |
| `robots.txt` allowlist | [RFC 9309](https://datatracker.ietf.org/doc/rfc9309/) + the canonical AI-crawler UA list | **on** |
| `/.well-known/agent-card.json` | [A2A 1.0](https://a2a-protocol.org/), IANA-registered 2025-08-01 | **off** (watchlist) |
| `/.well-known/oauth-protected-resource` | [RFC 9728](https://datatracker.ietf.org/doc/rfc9728/), IANA-registered 2024-10-22 | **off** (enable with UCP OAuth Identity Linking) |

## What this package does NOT emit (intentionally)

- **`/.well-known/ucp`** — UCP business profile lives in [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) (`generateUcpProfile()`). Import both packages together when implementing a plugin's full discovery surface.
- **Anything on the project-wide "do not emit" list** — `/.well-known/agentic-commerce.json`, `/.well-known/ucp.json` (wrong filename), `/.well-known/acp.json`, `/.well-known/ap2.json`, `/.well-known/mcp.json`, `/.well-known/ai-plugin.json` (deprecated), `/agents.txt`, `/ai.txt`. The plugin template's CI linter rejects any of these.

## Install

```bash
npm install @xpaysh/discovery
```

Zero runtime deps. Works on Node 18+ (CJS + .d.ts).

## Usage

```ts
import {
  generateLlmsTxt,
  generateProductJsonLd,
  generateItemListJsonLd,
  generateRobotsTxtBlock,
  generateAgentCardJson,
  generateOAuthProtectedResource,
  REAL_AI_USER_AGENTS,
  STANDARD_EMITTERS,
  LLMS_TXT_PATH,
} from '@xpaysh/discovery';

// /llms.txt
const body = generateLlmsTxt({
  siteName: 'Acme Outdoors',
  siteDescription: 'Climbing gear and trail food, shipped from Boulder.',
  siteUrl: 'https://acme.example/',
  merchantSlug: 'acme-outdoors',
  catalogFeedUrl: 'https://agent-feed.xpay.sh/catalog/acme-outdoors.json',
  commerceProtocols: {
    acp: 'https://agent-commerce.xpay.sh/acp/v1/acme-outdoors',
    ucp: 'https://agent-commerce.xpay.sh/ucp/v1/acme-outdoors',
    ap2: 'https://agent-commerce.xpay.sh/ap2/v1/acme-outdoors',
  },
  cartDeeplinkPattern: 'https://acme.example/?xpay_cart={token}',
  topCategories: [
    { name: 'Climbing', url: 'https://acme.example/category/climbing/' },
    { name: 'Trail food', url: 'https://acme.example/category/trail-food/' },
  ],
});

// Product page JSON-LD
const productLd = generateProductJsonLd({
  url: 'https://acme.example/product/dyneema-pack/',
  name: 'Dyneema Pack',
  sku: 'DYN-001',
  price: '189.00',
  priceCurrency: 'USD',
  images: ['https://cdn.acme.example/dyn-001-1.jpg'],
  inStock: true,
});

// robots.txt allowlist
const { robotsTxt, appendedAgents } = generateRobotsTxtBlock({
  existingRobotsTxt: 'User-agent: *\nDisallow: /wp-admin/\n',
});
// appendedAgents: ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', ...]
```

## The emitter-registry pattern

This package exports `STANDARD_EMITTERS` — a registry of descriptors that sibling plugins wire into their platform-specific request routers. Adding a new standard becomes "one new entry + one new generator function."

```ts
import { STANDARD_EMITTERS, generateLlmsTxt, generateAgentCardJson, generateOAuthProtectedResource } from '@xpaysh/discovery';
import { UCP_PROFILE_PATH, generateUcpProfile } from '@xpaysh/ucp-schemas';

// Compose discovery's registry with the UCP profile from ucp-schemas.
const emitters = {
  llms: { ...STANDARD_EMITTERS.llms, generate: () => generateLlmsTxt({ /* ... */ }) },
  ucpProfile: {
    path: UCP_PROFILE_PATH,
    contentType: 'application/json; charset=utf-8',
    defaultOn: true,
    spec: 'https://ucp.dev/latest/specification/overview/',
    generate: () => generateUcpProfile({ /* ... */ }),
  },
  agentCard: { ...STANDARD_EMITTERS.agentCard, generate: () => generateAgentCardJson({ /* ... */ }) },
  oauthProtectedResource: { ...STANDARD_EMITTERS.oauthProtectedResource, generate: () => generateOAuthProtectedResource({ /* ... */ }) },
};
```

Wire `emitters` into your platform's request handler (Express middleware, Lambda handler, Connect Service router, etc.). Every plugin in the family uses this pattern.

## Two-mode operation

Every generator is pure: inputs in, output out. The "two-mode" behaviour (standalone vs commercial) lives in the *caller*, not this package:

- **Standalone mode**: caller passes generated defaults (no xpay backend).
- **Commercial mode**: caller passes backend-provided overrides (e.g. signing keys, hosted endpoints).

Both modes produce spec-compliant output. The caller can swap modes at runtime.

## See also

- [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) — UCP business profile generator + JSON Schemas
- [`@xpaysh/acp-schemas`](https://www.npmjs.com/package/@xpaysh/acp-schemas) · [`@xpaysh/ap2-schemas`](https://www.npmjs.com/package/@xpaysh/ap2-schemas)
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) (this monorepo)
- [Standards & extensibility guide](https://github.com/xpaysh/agentic-commerce-plugin-template/blob/main/STANDARDS.md) (TBD — currently at `docs/may-16/standards-and-extensibility-guide.md` in the strategy workspace)
- [`xpaysh/agentic-commerce-for-woocommerce`](https://github.com/xpaysh/agentic-commerce-for-woocommerce) — the PHP reference implementation this package was extracted from

## License

Apache-2.0.
