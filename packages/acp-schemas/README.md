# @xpaysh/acp-schemas

JSON Schemas for the [**Agentic Commerce Protocol (ACP)**](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol), packaged as a versioned, npm-installable dependency for the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family and any third-party consumer.

Vendor-neutral. Tracks the canonical upstream spec — we do not modify schemas, only mirror them with stable versioning.

## Status

- **v0.0.x** — namespace and package shape. **No schema content yet.** Use this release to verify your import path; do not rely on `schemas` having entries.
- **v0.1.0** — first schema content drop. Lifted from `spec/2026-04-17/` (the current stable revision in the upstream repo). Pinned via `SPEC_VERSION`.
- Future revisions tag a new minor version per spec date (`v0.2.0` → next stable revision, etc.).

## Install

```bash
npm install @xpaysh/acp-schemas
```

## Usage

```ts
import { SPEC_VERSION, SPEC_URL, getSchema, schemas } from '@xpaysh/acp-schemas';

console.log(SPEC_VERSION); // '2026-04-17'

// v0.1.0+:
// const checkoutSchema = getSchema('checkout_session');
// const result = validate(checkoutSchema, payload);
```

## Versioning policy

The package version tracks the **package shape**, not the spec. `SPEC_VERSION` always identifies which upstream revision the bundled schemas come from. When the upstream spec ships a new dated revision, this package bumps a **minor** version (additive — old schemas remain accessible via prior installs). Breaking changes to the *package API* (export shape, function signatures) bump **major**.

## Upstream

- Spec repo: [agentic-commerce-protocol/agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- Current stable revision tracked: `2026-04-17`
- RFCs: `rfcs/rfc.agentic_checkout.md`, `rfcs/rfc.payment_handlers.md`, `rfcs/rfc.capability_negotiation.md`, `rfcs/rfc.discount_extension.md`

## License

Apache-2.0. Schema content (when added in v0.1.0) inherits the upstream spec's Apache-2.0 license.

## See also

- [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) · [`@xpaysh/ap2-schemas`](https://www.npmjs.com/package/@xpaysh/ap2-schemas)
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) (this monorepo's root)
- [docs.xpay.sh — ACP vs UCP vs AP2 comparison](https://docs.xpay.sh/agentic-commerce-protocols/comparison)
