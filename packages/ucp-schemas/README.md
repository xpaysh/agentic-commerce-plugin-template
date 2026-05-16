# @xpaysh/ucp-schemas

JSON Schemas for the [**Universal Commerce Protocol (UCP)**](https://github.com/Universal-Commerce-Protocol/ucp), packaged as a versioned, npm-installable dependency for the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family and any third-party consumer.

Vendor-neutral. Tracks the canonical upstream spec — we do not modify schemas, only mirror them with stable versioning.

## Status

- **v0.0.x** — namespace and package shape. **No schema content yet.** Use this release to verify your import path; do not rely on `schemas` having entries.
- **v0.1.0** — first schema content drop. Lifted from the upstream `source/schemas/` directory and `source/services/shopping/openapi.json`. Pinned via `SPEC_VERSION`.
- Future revisions tag a new minor version per upstream dated revision.

## Install

```bash
npm install @xpaysh/ucp-schemas
```

## Usage

```ts
import { SPEC_VERSION, SPEC_URL, getSchema, schemas } from '@xpaysh/ucp-schemas';

console.log(SPEC_VERSION); // '2026-04-08'

// v0.1.0+:
// const cartSchema = getSchema('cart');
// const result = validate(cartSchema, payload);
```

## Versioning policy

The package version tracks the **package shape**, not the spec. `SPEC_VERSION` always identifies which upstream revision the bundled schemas come from. New upstream revisions → minor bump (additive). Breaking package-API changes → major bump.

## Upstream

- Spec repo: [Universal-Commerce-Protocol/ucp](https://github.com/Universal-Commerce-Protocol/ucp)
- Current revision tracked: `2026-04-08`
- Notable: UCP normatively requires HTTP Message Signatures ([RFC 9421](https://datatracker.ietf.org/doc/rfc9421/)) for request integrity. Signature-related schemas (Signature, Signature-Input, Content-Digest payloads) ship in v0.1.0.
- MCP / A2A binding shapes are included in v0.1.0.

## License

Apache-2.0. Schema content (when added in v0.1.0) inherits the upstream spec's Apache-2.0 license.

## See also

- [`@xpaysh/acp-schemas`](https://www.npmjs.com/package/@xpaysh/acp-schemas) · [`@xpaysh/ap2-schemas`](https://www.npmjs.com/package/@xpaysh/ap2-schemas)
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) (this monorepo's root)
- [docs.xpay.sh — ACP vs UCP vs AP2 comparison](https://docs.xpay.sh/agentic-commerce-protocols/comparison)
