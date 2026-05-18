# @xpaysh/acp-schemas

JSON Schemas for the [**Agentic Commerce Protocol (ACP)**](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol), packaged as a versioned, npm-installable dependency for the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family and any third-party consumer.

Vendor-neutral. Tracks the canonical upstream spec — we do not modify schemas, only mirror them with stable versioning.

## Status

- **v0.1.0** — schemas vendored from upstream `spec/2026-04-17/json-schema/*`. 7 bundle schemas covering `agentic_checkout`, `cart`, `delegate_authentication`, `delegate_payment`, `discount`, `extension`, `feed`.
- Future revisions tag a new minor version per spec date (`v0.2.0` → next stable revision, etc.).

## Install

```bash
npm install @xpaysh/acp-schemas
```

## Bundles

| Bundle name | Source file | Key `$defs` |
|---|---|---|
| `agentic_checkout` | `schema.agentic_checkout.json` | `CheckoutSession`, `CheckoutSessionWithOrder`, `CheckoutSessionCreateRequest`, `CheckoutSessionUpdateRequest`, `CheckoutSessionCompleteRequest`, `LineItem`, `Buyer`, `Order`, `Error`, … |
| `cart` | `schema.cart.json` | `Cart` |
| `delegate_authentication` | `schema.delegate_authentication.json` | delegated-auth handshake |
| `delegate_payment` | `schema.delegate_payment.json` | `PaymentData` |
| `discount` | `schema.discount.json` | `Discount`, `Promotion` |
| `extension` | `schema.extension.json` | `Extension` |
| `feed` | `schema.feed.json` | product-feed shapes |

All bundles use JSON Schema 2020-12 (`$schema: https://json-schema.org/draft/2020-12/schema`).

## Usage

```js
const { SPEC_VERSION, schemas, getSchema, getDef } = require('@xpaysh/acp-schemas');

console.log(SPEC_VERSION); // '2026-04-17'

// Whole bundle
const checkoutBundle = getSchema('agentic_checkout');

// A specific type inside a bundle
const CheckoutSession = getDef('agentic_checkout', 'CheckoutSession');
```

### Validating with Ajv

Cross-file `$ref`s in the upstream bundles use relative URIs like `schema.agentic_checkout.json#/$defs/LineItem`. Register every bundle so Ajv can resolve them:

```js
const Ajv = require('ajv/dist/2020');
const { schemas } = require('@xpaysh/acp-schemas');

const ajv = new Ajv({ strict: false, allErrors: true });
for (const [name, schema] of Object.entries(schemas)) {
  // Register each bundle under the relative URI used by the others.
  ajv.addSchema(schema, `schema.${name}.json`);
}

const validate = ajv.getSchema('schema.agentic_checkout.json#/$defs/CheckoutSession');
const ok = validate(myPayload);
if (!ok) console.error(validate.errors);
```

## Versioning policy

The package version tracks the **package shape + spec revision**. `SPEC_VERSION` always identifies which upstream revision the bundled schemas come from. When the upstream spec ships a new dated revision, this package bumps a **minor** version. Breaking changes to the *package API* (export shape, function signatures) bump **major**.

## Upstream

- Spec repo: [agentic-commerce-protocol/agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- Current revision tracked: `2026-04-17`
- RFCs: `rfcs/rfc.agentic_checkout.md`, `rfcs/rfc.payment_handlers.md`, `rfcs/rfc.capability_negotiation.md`, `rfcs/rfc.discount_extension.md`

## License

Apache-2.0. Schema content inherits the upstream spec's Apache-2.0 license.

## See also

- [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) · [`@xpaysh/ap2-schemas`](https://www.npmjs.com/package/@xpaysh/ap2-schemas)
- [`@xpaysh/conformance-fixtures`](https://www.npmjs.com/package/@xpaysh/conformance-fixtures) — golden request/response payloads exercising these schemas
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) (this monorepo's root)
- [docs.xpay.sh — ACP vs UCP vs AP2 comparison](https://docs.xpay.sh/agentic-commerce-protocols/comparison)
