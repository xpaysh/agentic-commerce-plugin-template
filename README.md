# Agentic Commerce Plugin Template

Reference implementation for an **agentic-commerce-for-`<platform>`** plugin. Every plugin in the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) family — WooCommerce, BigCommerce, commercetools, Magento, Shopify, Salesforce Commerce Cloud, and the long-tail — ships as a thin platform-adapter on top of this template.

## What a plugin in this family does

Exposes an existing eCommerce storefront to AI-agent buyers using **only real, externally-verified discovery standards** — no invented well-known URIs.

### Discovery surface (real standards only)

| File / standard | Action |
|---|---|
| **`/llms.txt`** ([llmstxt.org](https://llmstxt.org)) | Emit. Markdown, lists product API + checkout flow + OAuth + terms. |
| **`schema.org` JSON-LD** (`Product`, `Offer`, `AggregateOffer`, `BreadcrumbList`) | Emit on PDPs + listings. |
| **`robots.txt`** with explicit allow/disallow for real AI crawlers (`GPTBot`, `ClaudeBot`, `Google-Extended`, `PerplexityBot`, `CCBot`, `Amazonbot`) | Honor via opt-in allowlist UI. |
| **`/.well-known/agent-card.json`** ([A2A 1.0](https://a2a-protocol.org/), IANA-registered 2025-08-01) | Watchlist — emit behind a feature flag once A2A picks up in eCommerce. |
| **`/.well-known/oauth-protected-resource`** ([RFC 9728](https://datatracker.ietf.org/doc/rfc9728/)) | Use for UCP OAuth Identity Linking. |
| **`/openapi.json`** | Optional, if the plugin exposes a REST surface. |

### Protocol endpoints (real, not discovery files)

ACP, UCP, and AP2 do **not** define a `/.well-known/` discovery file. The template implements each protocol's real REST/OAuth surface:

- **[ACP](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)** — per-session capability negotiation inside `POST /checkout_sessions`. Plugin exposes `/acp/checkout_sessions`, `/acp/delegate_payment`, etc., on the merchant's domain.
- **[UCP](https://github.com/Universal-Commerce-Protocol/ucp)** — out-of-band OAuth Identity Linking. Plugin handles the OAuth dance and exposes UCP REST endpoints + RFC 9421 signature verification.
- **[AP2](https://github.com/google-agentic-commerce/AP2)** — mandate-binding model. Plugin accepts AP2 mandates alongside the merchant's existing checkout.

Each protocol's surface is *documented in the merchant's `/llms.txt`*, never advertised via an invented manifest.

## What this template provides

- **TypeScript core + per-platform adapter shape** — `core/` is platform-agnostic protocol/discovery logic; `adapter/` is the thin per-platform shim.
- **Schema dependencies** — `@xpaysh/acp-schemas`, `@xpaysh/ucp-schemas`, `@xpaysh/ap2-schemas` (pinned by spec date).
- **CI linter — `lint-no-fictitious-wellknowns`** — fails the build if a plugin attempts to emit any file from the project-wide "do not emit" list (`/.well-known/agentic-commerce.json`, `/.well-known/ucp.json`, `/.well-known/acp.json`, `/.well-known/ap2.json`, `/.well-known/mcp.json`, `/.well-known/ai-plugin.json`, `/agents.txt`, `/ai.txt`). Catches fictitious-standard regression in PR review, not in production.
- **Two-mode operation** — standalone (no xpay backend) vs commercial (connect to xpay backend for catalog hosting + analytics).
- **Conformance fixtures** — golden-test JSON payloads for ACP/UCP/AP2 round-trips, reused across platform plugins.

## Sibling plugins

| Platform | Repo | Status |
|---|---|---|
| WooCommerce | [`agentic-commerce-for-woocommerce`](https://github.com/xpaysh/agentic-commerce-for-woocommerce) | Live (GPLv2, v0.1.7+) |
| BigCommerce | `agentic-commerce-for-bigcommerce` | Phase B-1 |
| commercetools | `agentic-commerce-for-commercetools` | Phase B-2 |
| Magento / Adobe Commerce | `agentic-commerce-for-magento` | Phase B-3 |
| Shopify (App Store) | `agentic-commerce-for-shopify-app` | Phase B-4 |
| Salesforce Commerce Cloud | `agentic-commerce-for-salesforce-commerce` | Phase B-5 |
| PrestaShop, Saleor, OpenCart, Shopware, Spree, Sylius, nopCommerce, Drupal Commerce, Ecwid | Phase C (template + community PR) | Planned |

Curated index of every plugin (xpay-built + vendor-built + community): **[awesome-agentic-commerce](https://github.com/xpaysh/awesome-agentic-commerce)**.

## Background

- Comparison of the underlying protocols: [docs.xpay.sh — ACP vs UCP vs AP2](https://docs.xpay.sh/agentic-commerce-protocols/comparison)
- xpay✦ contributes upstream to ACP and UCP — see open PRs at [ACP #251](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/251) and [UCP #443](https://github.com/Universal-Commerce-Protocol/ucp/pull/443).

## Status

This repo is currently a scaffold. The reference implementation is being extracted from `agentic-commerce-for-woocommerce` (v0.1.7+) in Phase A; expect the first usable template release alongside `agentic-commerce-for-bigcommerce` (Phase B-1).

## License

Apache-2.0.
