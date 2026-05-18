# `@xpaysh/conformance-fixtures`

Golden request/response payloads for [ACP](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol), [UCP](https://github.com/Universal-Commerce-Protocol/ucp), and [AP2](https://github.com/google-agentic-commerce/AP2). Sibling `agentic-commerce-for-*` plugins run these in CI to verify their adapter implementations conform to the protocol shapes.

## Coverage (v0.1.0)

### ACP — spec rev `2026-04-17` (`upstream openapi.agentic_checkout.yaml`)

| Operation | Fixture | Target schema |
|---|---|---|
| `createCheckoutSession` (minimal) | `create-session.minimal.{request,response}.json` | `CheckoutSessionCreateRequest`, `CheckoutSession` |
| `createCheckoutSession` (with address) | `create-session.with-address.request.json` | `CheckoutSessionCreateRequest` |
| `createCheckoutSession` (with attribution) | `create-session.with-attribution.request.json` | `CheckoutSessionCreateRequest` |
| `updateCheckoutSession` (set fulfillment) | `update-session.set-fulfillment.request.json` | `CheckoutSessionUpdateRequest` |
| `completeCheckoutSession` (basic) | `complete-session.basic.{request,response}.json` | `CheckoutSessionCompleteRequest`, `CheckoutSessionWithOrder` |
| Error 400 — idempotency key required | `error.idempotency-key-required.response.json` | `Error` |
| Error 400 — invalid email | `error.invalid-email.response.json` | `Error` |

All 9 ACP fixtures validate against the canonical JSON Schemas vendored in `@xpaysh/acp-schemas@0.1.0` (`spec/2026-04-17/`). Run `npm run validate` from this package to verify.

> Note: upstream OpenAPI `examples:` blocks in `agentic-commerce-protocol` are inconsistent with the canonical JSON Schemas (e.g. they show `totals` as an object instead of an array; `Order` examples omit required `checkout_session_id` and `permalink_url`). These fixtures align to the **JSON Schemas**, which the spec maintainers treat as authoritative.

### UCP — `SPEC_VERSION = 'draft'`, wire-version `2026-05-18`

| Fixture | Target schema |
|---|---|
| `discovery.profile.golden.json` | `https://ucp.dev/schemas/discovery/profile.json` (business profile served at `/.well-known/ucp`) |
| `shopping.create-checkout.response.json` | `https://ucp.dev/schemas/shopping/checkout.json` (201 Created — authoritative state) |
| `shopping.error.out-of-stock.response.json` | `https://ucp.dev/schemas/common/types/error_response.json` (unrecoverable error envelope) |
| `shopping.create-checkout.request.json` | *skipped — see below* |

3 of 4 UCP fixtures validate against the canonical JSON Schemas in `@xpaysh/ucp-schemas@0.2.0`.

> Note: the upstream UCP checkout schema uses a single schema for BOTH wire directions (request and response), with `ucp_request: omit|optional|required` annotations indicating per-direction field requirements. Generic JSON Schema validators can't honor those annotations — so request fixtures intentionally have no `validates_against`. A `ucp_request`-aware validator that strips `ucp_request:omit` fields from `required` before validation is a future enhancement.

### AP2

Placeholder. AP2 upstream is still draft.

## Install

```bash
npm install --save-dev @xpaysh/conformance-fixtures
```

## Use

```js
const { loadFixture, acpFixturesByName } = require('@xpaysh/conformance-fixtures');

// One fixture
const minimal = loadFixture('acp/create-session.minimal.request.json');

// All ACP fixtures keyed by name
const acp = acpFixturesByName();
acp['create-session.minimal.request'];
```

### Each fixture's shape

```json
{
  "_meta": {
    "protocol": "acp",
    "spec_version": "2026-04-17",
    "operation": "createCheckoutSession",
    "method": "POST",
    "path": "/checkout_sessions",
    "summary": "Single item; no fulfillment details",
    "source": "openapi.agentic_checkout.yaml example: minimal"
  },
  "headers": { "Authorization": "Bearer api_key_123", "...": "..." },
  "body": { "items": [ { "id": "item_123", "quantity": 1 } ] }
}
```

`_meta` documents provenance — every fixture traces back to the named upstream example so reviewers can verify nothing was invented locally.

## Use in a plugin CI

```js
// in tests/conformance.test.js of agentic-commerce-for-<platform>
const { acpFixturesByName } = require('@xpaysh/conformance-fixtures');

const fixtures = acpFixturesByName();

test('plugin accepts the ACP minimal create-session shape', async () => {
  const fx = fixtures['create-session.minimal.request'];
  const resp = await myPlugin.handleCheckoutSession(fx.body, fx.headers);
  expect(resp.status).toBe(201);
  expect(resp.body).toHaveProperty('id');
  expect(resp.body.status).toBe('ready_for_payment');
});
```

## License

Apache-2.0.
