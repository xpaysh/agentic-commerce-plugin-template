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
- **Schema dependencies** — [`@xpaysh/acp-schemas`](https://www.npmjs.com/package/@xpaysh/acp-schemas) (v0.1.0 — real JSON Schemas vendored from upstream `spec/2026-04-17/`; 7 bundles, 140 type defs), [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) (v0.2.0 — real JSON Schemas vendored from `Universal-Commerce-Protocol/ucp` source; 83 schemas covering discovery profile, shopping checkout/cart/order/fulfillment/discount/payment/ap2_mandate/buyer_consent/catalog_*, 45 shopping types, 17 common types, REST/MCP/OpenRPC service contracts; ships `generateUcpProfile()` + `registerForValidation(ajv)`), [`@xpaysh/ap2-schemas`](https://www.npmjs.com/package/@xpaysh/ap2-schemas) (`SPEC_VERSION = 'draft'` while upstream is pre-stable).
- **RFC 9421 signatures** — [`@xpaysh/http-message-signatures`](https://www.npmjs.com/package/@xpaysh/http-message-signatures) — sign/verify `Signature`, `Signature-Input`, `Content-Digest` headers per RFC 9421. Ed25519 (matches the UCP profile JWK shape) + HMAC-SHA256 (testing). Covers `(@method @target-uri content-digest idempotency-key)`. Round-trip + reject-tampered tests baked in.
- **Discovery generators** — [`@xpaysh/discovery`](https://www.npmjs.com/package/@xpaysh/discovery) — pure-function generators for `/llms.txt`, schema.org JSON-LD (Product, ItemList), `robots.txt` AI-crawler allowlist, A2A `/.well-known/agent-card.json`, RFC 9728 `/.well-known/oauth-protected-resource`. Ported from `agentic-commerce-for-woocommerce` v0.2.0. Zero deps.
- **Conformance audit** — [`@xpaysh/storefront-audit`](https://www.npmjs.com/package/@xpaysh/storefront-audit) — discovery-layer auditor + `ac-doctor` CLI. Verifies any storefront URL against the real-standards list, rejects fictitious well-known URIs, exits non-zero on fail. Every sibling plugin runs it in CI; merchants run it against their own store; commercial tier runs it daily and serves the result as a public badge.
- **Cart deeplinks** — [`@xpaysh/cart-deeplinks`](https://www.npmjs.com/package/@xpaysh/cart-deeplinks) — HS256-signed JWT sign + verify for the cart-handoff URL pattern. Wire-compatible with the WooCommerce reference plugin's `Xpay_Client::verify_jwt`. Used by sibling plugins to accept tokens issued by the xpay backend (commercial mode) or by any in-family signer (standalone mode).
- **CI linter** — [`@xpaysh/lint-wellknowns`](https://www.npmjs.com/package/@xpaysh/lint-wellknowns) — fails the build if a plugin source tree or live storefront emits any path from the project-wide deny-list. Ships a CLI (`lint-wellknowns scan|probe|list`) and a reusable GitHub composite action at `.github/actions/lint-wellknowns/`. The real `/.well-known/ucp` (no extension) is explicitly allow-listed; only the fictitious `.json` variant is flagged. Catches fictitious-standard regression in PR review, not in production.
- **Conformance fixtures** — [`@xpaysh/conformance-fixtures`](https://www.npmjs.com/package/@xpaysh/conformance-fixtures) — golden ACP request/response payloads (`createCheckoutSession`, `updateCheckoutSession`, `completeCheckoutSession`, error envelopes) keyed by `_meta.validates_against`. Every fixture validates against `@xpaysh/acp-schemas` — run `npm run validate` in the package to verify the round-trip. UCP/AP2 placeholders land alongside their schema lifts.
- **Two-mode operation** — standalone (no xpay backend) vs commercial (connect to xpay backend for catalog hosting + analytics).

## Sibling plugins

| Platform | Repo | Status |
|---|---|---|
| WooCommerce | [`agentic-commerce-for-woocommerce`](https://github.com/xpaysh/agentic-commerce-for-woocommerce) | Live (GPLv2, v0.2.x) — PHP reference |
| commercetools | [`agentic-commerce-for-commercetools`](https://github.com/xpaysh/agentic-commerce-for-commercetools) | Live (v0.2) — TS reference |
| BigCommerce | [`agentic-commerce-for-bigcommerce`](https://github.com/xpaysh/agentic-commerce-for-bigcommerce) | Live (v0.1) |
| Magento / Adobe Commerce | [`agentic-commerce-for-magento`](https://github.com/xpaysh/agentic-commerce-for-magento) | Live (v0.1) |
| Shopify (App Store) | [`agentic-commerce-for-shopify-app`](https://github.com/xpaysh/agentic-commerce-for-shopify-app) | Live (v0.1) — Custom App token; App Store distribution in v0.2 |
| Salesforce Commerce Cloud | [`agentic-commerce-for-salesforce-commerce`](https://github.com/xpaysh/agentic-commerce-for-salesforce-commerce) | Live (v0.1) |
| PrestaShop | [`agentic-commerce-for-prestashop`](https://github.com/xpaysh/agentic-commerce-for-prestashop) | Live (v0.1) |
| Saleor | [`agentic-commerce-for-saleor`](https://github.com/xpaysh/agentic-commerce-for-saleor) | Live (v0.1) |
| OpenCart, Shopware, Spree, Sylius, nopCommerce, Drupal Commerce, Ecwid | Community (template + PR) | Planned |

Curated index of every plugin (xpay-built + vendor-built + community): **[awesome-agentic-commerce](https://github.com/xpaysh/awesome-agentic-commerce)**.

## Background

- Comparison of the underlying protocols: [docs.xpay.sh — ACP vs UCP vs AP2](https://docs.xpay.sh/agentic-commerce-protocols/comparison)
- xpay✦ contributes upstream to ACP and UCP — see open PRs at [ACP #251](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/251) and [UCP #443](https://github.com/Universal-Commerce-Protocol/ucp/pull/443).

## Status

All 8 first-party platform plugins are live at v0.1 or later — every sibling is a thin adapter on top of the packages published from this monorepo (`@xpaysh/{acp,ucp,ap2}-schemas`, `@xpaysh/discovery`, `@xpaysh/adapter-contract`, `@xpaysh/cart-deeplinks`, `@xpaysh/storefront-audit`, `@xpaysh/conformance-fixtures`, `@xpaysh/lint-wellknowns`). v0.2 work across the family adds RFC 9421 signature verification, DDB-backed ACP session storage, and webhook subscriptions for order-state changes.

## License

Apache-2.0.
