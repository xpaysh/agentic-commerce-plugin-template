# @xpaysh/ap2-schemas

JSON Schemas for the [**Agent Payments Protocol (AP2)**](https://github.com/google-agentic-commerce/AP2), packaged as a versioned, npm-installable dependency for the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family and any third-party consumer.

Vendor-neutral mirror. Tracks the canonical upstream spec maintained by Google.

## Status

- **v0.0.x** — namespace and package shape. **No schema content yet.** Use this release to verify your import path; do not rely on `schemas` having entries.
- **v0.1.0** — first schema content drop. Lifted from the upstream AP2 spec.
- AP2 is currently in draft/preview at upstream; `SPEC_VERSION` will move to a stable tag once Google publishes one.

## Install

```bash
npm install @xpaysh/ap2-schemas
```

## Usage

```ts
import { SPEC_VERSION, SPEC_URL, getSchema, schemas } from '@xpaysh/ap2-schemas';

console.log(SPEC_VERSION); // 'draft' in v0.0.x

// v0.1.0+:
// const mandateSchema = getSchema('mandate');
// const result = validate(mandateSchema, payload);
```

## Versioning policy

The package version tracks the **package shape**, not the spec. `SPEC_VERSION` identifies which upstream revision the bundled schemas come from. New upstream revisions → minor bump (additive). Breaking package-API changes → major bump.

## Upstream

- Spec repo: [google-agentic-commerce/AP2](https://github.com/google-agentic-commerce/AP2)
- Status: draft / preview
- Core artifacts (to be mirrored in v0.1.0): mandate format, verifiable-credential structure, A2A message envelope, agent-card metadata (`/.well-known/agent-card.json`).

## License

Apache-2.0. Schema content (when added in v0.1.0) inherits the upstream spec's Apache-2.0 license.

## See also

- [`@xpaysh/acp-schemas`](https://www.npmjs.com/package/@xpaysh/acp-schemas) · [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas)
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) (this monorepo's root)
- [docs.xpay.sh — ACP vs UCP vs AP2 comparison](https://docs.xpay.sh/agentic-commerce-protocols/comparison)
