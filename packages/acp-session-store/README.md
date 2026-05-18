# `@xpaysh/acp-session-store`

Storage backend for ACP checkout sessions. Two implementations behind a single `SessionStore` interface:

| Driver | Use |
|---|---|
| `InMemorySessionStore` | Dev / single-instance. Sweeps expired sessions on each access. |
| `DynamoDBSessionStore` | Production. Reads/writes the `xpay-acp-sessions` table; expiry handled by DDB's native TTL. |

ACP route handlers depend on the interface, not the concrete class — siblings switch via env.

## Interface

```ts
interface SessionStore {
  put(session: ACPSession): Promise<void>;
  get(sessionId: string): Promise<ACPSession | null>;
  patch(sessionId: string, patch: Partial<ACPSession>): Promise<ACPSession | null>;
  delete(sessionId: string): Promise<boolean>;
}
```

A session is `{ id, status, currency, line_items, totals, …, expiresAt? }` — opaque payload. The store only cares about `id` and `expiresAt`.

## Install

```bash
npm install @xpaysh/acp-session-store
# Optional — only needed if you use the DynamoDB driver
npm install @aws-sdk/client-dynamodb
```

## Use

### Factory (env-driven — recommended for plugins)

```js
const { createSessionStore } = require('@xpaysh/acp-session-store');

const sessions = createSessionStore();
// ACP_SESSION_STORE=memory             → InMemorySessionStore (default)
// ACP_SESSION_STORE=dynamodb           → DynamoDBSessionStore
//   ACP_SESSION_PLUGIN_ID=agentic-commerce-for-shopify
//   XPAY_ACP_SESSIONS_TABLE=xpay-acp-sessions  (default)
//   AWS_REGION=us-east-1
```

### Direct construction

```js
const { InMemorySessionStore, DynamoDBSessionStore } = require('@xpaysh/acp-session-store');

const dev = new InMemorySessionStore();

const prod = new DynamoDBSessionStore({
  pluginId: 'agentic-commerce-for-bigcommerce',
  tableName: 'xpay-acp-sessions',
  region: 'us-east-1',
});

await prod.put({ id: 'cs_abc123', status: 'ready_for_payment', currency: 'USD', line_items: [] });
const session = await prod.get('cs_abc123');
await prod.patch('cs_abc123', { status: 'completed' });
```

## DynamoDB table shape

Single shared table across all plugins. Recommended schema:

| Attribute | Type | Role |
|---|---|---|
| `pluginId` | S | Partition key — `agentic-commerce-for-<platform>` |
| `sessionId` | S | Sort key |
| `data` | S | JSON-encoded session object |
| `expiresAtEpoch` | N | TTL attribute (unix seconds). DDB sweeps after expiry. |

CloudFormation / Terraform / `aws ddb create-table` snippet — see the merchant-onboarding playbook in `mvp/docs/may-17/`.

## Test

```bash
npm test
```

11 round-trip + edge-case tests cover put/get/patch/delete, TTL sweeping, validation, factory, and a stubbed-DDB-client round-trip (so the SDK isn't a hard test dep).

## License

Apache-2.0.
