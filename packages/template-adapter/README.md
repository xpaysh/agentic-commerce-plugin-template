# `@xpaysh/template-adapter`

A working reference [`PlatformAdapter`](https://www.npmjs.com/package/@xpaysh/adapter-contract) implementation, backed by a deterministic in-memory catalog.

**Purpose:** copy this directory when bootstrapping a new `agentic-commerce-for-<platform>` plugin. Every method in the contract is implemented; you swap the in-memory store for your platform's native client (Shopify, Magento, Saleor, …) and the protocol routes work end-to-end.

## What's covered

| Method | Reference impl |
|---|---|
| `listProducts(query)` | Returns paginated `DEMO_PRODUCTS`. Honors `query.search` (case-insensitive title match), `limit`, `offset`. |
| `getProduct(id)` | Returns the demo product or `null`. |
| `createCart(input)` | Allocates an in-memory cart from `input.lines`; throws on unknown `productId`. |
| `updateCart(id, mutation)` | Applies `add`/`remove`/`set_quantity` operations; recomputes subtotal. |
| `completeCheckout(input)` | Finalises the cart → order; deletes the source cart. Emits a fake `paymentReference`. |
| `getOrder(id)` | Returns the demo order or `null`. |

State is per-instance — `createTemplateAdapter()` returns a fresh adapter; the exported `templateAdapter` is a process-wide singleton convenient for ad-hoc usage outside tests.

## Use

```js
const { createTemplateAdapter } = require('@xpaysh/template-adapter');

const adapter = createTemplateAdapter();

const products = await adapter.listProducts({ limit: 10 });
const cart = await adapter.createCart({
  lines: [{ productId: 'demo-shirt-blue', variantId: 'demo-shirt-blue-m', quantity: 2 }],
});
const order = await adapter.completeCheckout({
  cartId: cart.id,
  buyer: { email: 'buyer@example.com' },
});
```

## Pattern for contributing a new platform

1. **Fork** [`xpaysh/agentic-commerce-plugin-template`](https://github.com/xpaysh/agentic-commerce-plugin-template).
2. **Copy** `packages/template-adapter` to `agentic-commerce-for-<your-platform>/src/adapter.ts` (rename the export).
3. **Replace** the in-memory `Map`s with the platform's native client (axios, GraphQL, SDK).
4. **Implement** the same six methods. The `Cart`/`Product`/`Order` shapes are documented in [`@xpaysh/adapter-contract`](https://www.npmjs.com/package/@xpaysh/adapter-contract).
5. **Reuse** the route tables: `@xpaysh/discovery` for `/llms.txt` + JSON-LD + `robots.txt`; `@xpaysh/ucp-schemas` `generateUcpProfile()` for `/.well-known/ucp`; `@xpaysh/cart-deeplinks` for HS256 cart-handoff URLs; `@xpaysh/http-message-signatures` `verifyRequest()` for RFC 9421 sig verification on `/ucp/*` + `/acp/*` routes.
6. **Wire conformance:** `tests/conformance.test.ts` loads fixtures from `@xpaysh/conformance-fixtures` and validates against the canonical schemas. Copy from any sibling plugin (e.g. [`agentic-commerce-for-commercetools`](https://github.com/xpaysh/agentic-commerce-for-commercetools)).
7. **Submit** to [`xpaysh/awesome-agentic-commerce`](https://github.com/xpaysh/awesome-agentic-commerce) — see its [`BOUNTIES.md`](https://github.com/xpaysh/awesome-agentic-commerce/blob/main/BOUNTIES.md) for reward amounts on accepted community plugins.

## License

Apache-2.0.
