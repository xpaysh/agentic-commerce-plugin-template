# @xpaysh/adapter-contract

The TypeScript interface every per-platform [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin implements. One contract, N adapters.

Zero runtime deps. Mostly types — `index.js` ships only a tiny adapter-registry helper + an `isAdapter()` validator + capability-flag constants. Apache-2.0. Node 18+.

## Why this exists

```
                  ┌─── protocol-side packages (already shipped) ──────┐
                  │  discovery · ucp-schemas · acp-schemas · ap2     │
                  │  cart-deeplinks · storefront-audit · audit-mcp   │
                  └──────────────────┬───────────────────────────────┘
                                     │   calls
                                     ▼
                  ┌─────────────────────────────────────────────────┐
                  │   PlatformAdapter   (this package)               │
                  │   listProducts, getProduct, createCart, ...      │
                  └──────────────────┬───────────────────────────────┘
                                     │   implemented by
        ┌────────────────┬───────────┼───────────────┬────────────────┐
        ▼                ▼           ▼               ▼                ▼
   WooCommerce      commercetools  BigCommerce    Magento       Shopify App
   (PHP, today)     (TS, today)    (TS, planned)  (PHP, plan)   (TS, plan)
```

Protocol-side packages know the wire format. Platform adapters know the native API. The contract is the seam.

## Install

```bash
npm install @xpaysh/adapter-contract
```

## Use — implementing an adapter (TS)

```ts
import {
  PlatformAdapter,
  Product,
  Cart,
  Order,
  CAPABILITIES,
} from '@xpaysh/adapter-contract';

export class MyPlatformAdapter implements PlatformAdapter {
  readonly platformName = 'my-platform';
  readonly capabilities = {
    cart: true,
    checkout: true,
    catalogSearch: true,
    catalogLookup: true,
    order: true,
    refunds: true,
    disputes: false,
    inventoryRealtime: true,
    webhooks: true,
  };

  async listProducts(q) { /* call your native search API */ }
  async getProduct(id)  { /* return null if 404 */ }

  async createCart(input)        { /* ... */ }
  async updateCart(id, mutation) { /* ... */ }
  async getCart(id)              { /* return null if 404 */ }

  async completeCheckout(input)  { /* hand off to merchant PSP */ }

  async getOrder(id)             { /* return null if 404 */ }
  async listOrders(query)        { /* ... */ }

  async refundOrder(id, amount)  { /* optional — only if you set capabilities.refunds = true */ }
}
```

## Use — hosted dispatch (e.g., `agent-commerce.xpay.sh`)

```ts
import { createAdapterRegistry, isAdapter } from '@xpaysh/adapter-contract';
import { CommercetoolsAdapter } from '@xpaysh/agentic-commerce-for-commercetools';
import { WooCommerceAdapter } from '@xpaysh/agentic-commerce-for-woocommerce';

const registry = createAdapterRegistry();

// At merchant-connect time, the backend instantiates the right adapter and registers it
registry.register('acme-outdoors',  new CommercetoolsAdapter({ /* project keys, etc. */ }));
registry.register('boulder-coffee', new WooCommerceAdapter({   /* api url + key */ }));

// At request time, the protocol-handler picks the adapter by slug
const adapter = registry.get(req.params.slug);
if (!adapter) return res.status(404).json({ error: 'unknown merchant' });

const cart = await adapter.createCart({ items: [{ sku: 'DYN-001', quantity: 1 }] });
```

## What's in the contract

### Methods (required)

| Method | Returns | Notes |
|---|---|---|
| `listProducts(query)` | `Paginated<Product>` | Search / list with cursor pagination |
| `getProduct(id)` | `Product \| null` | Returns null for 404; throws only on transport errors |
| `createCart(input)` | `Cart` | Start a new cart with initial items |
| `updateCart(id, mutation)` | `Cart` | Set items, addresses, discount code |
| `getCart(id)` | `Cart \| null` | Null if expired or 404 |
| `completeCheckout(input)` | `Order` | Hand off to merchant's PSP |
| `getOrder(id)` | `Order \| null` | Null on 404 |
| `listOrders(query)` | `Paginated<Order>` | Filter by status, date range, externalId |

### Methods (optional — declare in `capabilities`)

| Method | Capability flag | Notes |
|---|---|---|
| `refundOrder(id, amount?)` | `capabilities.refunds = true` | Full or partial refund |
| `openDispute(id, reason)` | `capabilities.disputes = true` | Open a dispute case |

### Value types

`Money`, `Address`, `Image`, `Product`, `ProductVariant`, `LineItem`, `Cart`, `Order`, `OrderStatus`, `Paginated<T>`, `ProductQuery`, `OrderQuery`, `CreateCartInput`, `CartMutation`, `CompleteCheckoutInput`, `RefundResult`, `DisputeHandle`, `AdapterCapabilities`.

All value types are intentionally aligned to **UCP capability surface** where possible. The JSON Schemas in [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) remain canonical on the wire; these TS types are the runtime-friendly view platform plugins consume directly.

### Order lifecycle states

```
created  →  confirmed  →  processing  →  fulfilled  →  shipped  →  delivered
   │             │              │             │
   └────────► cancelled         └────────► refunded
```

Mirrors UCP's order state machine. Adapters MUST map their native order states into this enum.

### Capability flags

Export at the package's top level as `CAPABILITIES`. String constants match UCP capability identifiers 1-for-1 where possible:

```ts
CAPABILITIES.CART              // 'cart'
CAPABILITIES.CHECKOUT          // 'checkout'
CAPABILITIES.CATALOG_SEARCH    // 'catalog.search'
CAPABILITIES.CATALOG_LOOKUP    // 'catalog.lookup'
CAPABILITIES.ORDER             // 'order'
CAPABILITIES.REFUNDS           // 'refunds'
CAPABILITIES.DISPUTES          // 'disputes'
CAPABILITIES.INVENTORY_REALTIME // 'inventory.realtime'
CAPABILITIES.WEBHOOKS          // 'webhooks'
```

### Runtime helpers

```ts
// Validate any value at runtime — used at registry boundaries
isAdapter(unknownValue): { ok: true } | { ok: false, missing: string[] }

// In-memory slug → adapter registry for hosted dispatch
createAdapterRegistry(): { register, get, list, remove }
```

## Versioning policy

- **Major bump (1.0 → 2.0)**: any breaking change to the `PlatformAdapter` interface, value types, or method signatures. Forces every platform plugin to recompile.
- **Minor bump (0.1 → 0.2)**: additive (new optional capability, new value-type field made optional, new helper function). Existing adapters keep compiling.
- **Patch bump**: documentation, JSDoc clarifications, README updates.

Platform plugins SHOULD pin a minor range (`"^0.1.0"`) to absorb additive changes without breaking on majors.

## See also

- [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) — JSON Schemas + profile generator (canonical wire shapes)
- [`@xpaysh/discovery`](https://www.npmjs.com/package/@xpaysh/discovery) — discovery-file generators
- [`@xpaysh/cart-deeplinks`](https://www.npmjs.com/package/@xpaysh/cart-deeplinks) — HS256 cart-handoff JWT
- [`@xpaysh/storefront-audit`](https://www.npmjs.com/package/@xpaysh/storefront-audit) — auditor; v0.2+ adds commerce-level checks that call this contract
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) — the monorepo this package lives in
- [`agentic-commerce-for-commercetools`](https://github.com/xpaysh/agentic-commerce-for-commercetools) — first non-WC implementation, uses this contract

## License

Apache-2.0.
