'use strict';

/**
 * @xpaysh/acp-session-store
 *
 * Storage backend for ACP checkout sessions. Two implementations behind
 * one interface:
 *
 *   - InMemorySessionStore   — process-local Map; default for dev.
 *   - DynamoDBSessionStore   — production; reads/writes the xpay-acp-sessions
 *                              table with TTL-driven expiry.
 *
 * The plugin family's ACP route handlers depend on the SessionStore interface,
 * not the concrete class — siblings switch via an env-driven factory below.
 *
 * SessionStore interface:
 *   - async put(session)            → void   (creates or overwrites)
 *   - async get(sessionId)          → session | null
 *   - async patch(sessionId, patch) → session | null   (deep-merge top-level keys)
 *   - async delete(sessionId)       → boolean
 *
 * A session is `{ id, pluginId, status, currency, line_items, totals, …, expiresAt? }`
 * — opaque to the store; the store only cares about `id` and `expiresAt`.
 */

/* ------------------------------------------------------------------ */
/* InMemorySessionStore                                                */
/* ------------------------------------------------------------------ */

class InMemorySessionStore {
  constructor(opts) {
    this._sweepEverySeconds = (opts && opts.sweepEverySeconds) || 60;
    this._map = new Map();
    this._lastSweep = 0;
  }

  _sweep(now) {
    if (now - this._lastSweep < this._sweepEverySeconds * 1000) return;
    this._lastSweep = now;
    for (const [id, session] of this._map) {
      if (session.expiresAt && Date.parse(session.expiresAt) <= now) this._map.delete(id);
    }
  }

  async put(session) {
    if (!session || typeof session.id !== 'string') {
      throw new TypeError('SessionStore.put: session.id (string) is required');
    }
    this._sweep(Date.now());
    this._map.set(session.id, { ...session });
  }

  async get(sessionId) {
    this._sweep(Date.now());
    const s = this._map.get(sessionId);
    if (!s) return null;
    if (s.expiresAt && Date.parse(s.expiresAt) <= Date.now()) {
      this._map.delete(sessionId);
      return null;
    }
    return { ...s };
  }

  async patch(sessionId, patch) {
    const current = await this.get(sessionId);
    if (!current) return null;
    const merged = { ...current, ...patch, id: current.id };
    this._map.set(sessionId, merged);
    return { ...merged };
  }

  async delete(sessionId) {
    return this._map.delete(sessionId);
  }
}

/* ------------------------------------------------------------------ */
/* DynamoDBSessionStore                                                */
/* ------------------------------------------------------------------ */

/**
 * Backed by a single DDB table.
 *
 * Recommended table shape:
 *   - PK: `pluginId` (S)
 *   - SK: `sessionId` (S)
 *   - TTL: `expiresAtEpoch` (N — unix seconds; DDB sweeps after expiry)
 *   - Payload: `data` (S — JSON-encoded session object)
 *
 * Defaults to table name `xpay-acp-sessions`; override via the `tableName`
 * constructor option or `XPAY_ACP_SESSIONS_TABLE` env var (factory uses env).
 *
 * Requires `@aws-sdk/client-dynamodb` to be installed by the consumer
 * (peerDep, optional). The constructor loads it lazily so InMemorySessionStore
 * works without the AWS SDK in dev.
 */
class DynamoDBSessionStore {
  constructor(opts) {
    if (!opts || !opts.pluginId) {
      throw new TypeError('DynamoDBSessionStore: opts.pluginId (string) is required');
    }
    this.pluginId = opts.pluginId;
    this.tableName = opts.tableName || 'xpay-acp-sessions';
    this._client = opts.client; // lazy — initialized on first call if absent
    this._region = opts.region || process.env.AWS_REGION || 'us-east-1';
    this._sdk = null;
  }

  async _loadSdk() {
    if (this._sdk && this._client) return;
    try {
      this._sdk = require('@aws-sdk/client-dynamodb');
    } catch (err) {
      throw new Error(
        'DynamoDBSessionStore: @aws-sdk/client-dynamodb is not installed. ' +
          'Install it or use InMemorySessionStore for dev.',
      );
    }
    if (!this._client) {
      this._client = new this._sdk.DynamoDBClient({ region: this._region });
    }
  }

  _payload(session) {
    const ttlSeconds = session.expiresAt ? Math.floor(Date.parse(session.expiresAt) / 1000) : undefined;
    return {
      pluginId: { S: this.pluginId },
      sessionId: { S: session.id },
      data: { S: JSON.stringify(session) },
      ...(ttlSeconds ? { expiresAtEpoch: { N: String(ttlSeconds) } } : {}),
    };
  }

  async put(session) {
    if (!session || typeof session.id !== 'string') {
      throw new TypeError('SessionStore.put: session.id (string) is required');
    }
    await this._loadSdk();
    const cmd = new this._sdk.PutItemCommand({
      TableName: this.tableName,
      Item: this._payload(session),
    });
    await this._client.send(cmd);
  }

  async get(sessionId) {
    await this._loadSdk();
    const cmd = new this._sdk.GetItemCommand({
      TableName: this.tableName,
      Key: { pluginId: { S: this.pluginId }, sessionId: { S: sessionId } },
      ConsistentRead: false,
    });
    const res = await this._client.send(cmd);
    if (!res.Item || !res.Item.data) return null;
    const session = JSON.parse(res.Item.data.S);
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) return null;
    return session;
  }

  async patch(sessionId, patch) {
    const current = await this.get(sessionId);
    if (!current) return null;
    const merged = { ...current, ...patch, id: current.id };
    await this.put(merged);
    return merged;
  }

  async delete(sessionId) {
    await this._loadSdk();
    const cmd = new this._sdk.DeleteItemCommand({
      TableName: this.tableName,
      Key: { pluginId: { S: this.pluginId }, sessionId: { S: sessionId } },
      ReturnValues: 'ALL_OLD',
    });
    const res = await this._client.send(cmd);
    return Boolean(res.Attributes);
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * Env-driven factory. Plugins call this once at startup.
 *
 *   ACP_SESSION_STORE=memory                            → InMemorySessionStore (default)
 *   ACP_SESSION_STORE=dynamodb                          → DynamoDBSessionStore
 *   XPAY_ACP_SESSIONS_TABLE=xpay-acp-sessions           (DDB only; defaults to that name)
 *   ACP_SESSION_PLUGIN_ID=agentic-commerce-for-shopify  (DDB only; required when ddb)
 *   AWS_REGION=us-east-1                                (DDB only)
 *
 * @param {object} [opts]   Explicit overrides; bypasses env when set.
 * @returns {InMemorySessionStore | DynamoDBSessionStore}
 */
function createSessionStore(opts) {
  const driver = (opts && opts.driver) || process.env.ACP_SESSION_STORE || 'memory';
  if (driver === 'dynamodb') {
    return new DynamoDBSessionStore({
      pluginId: (opts && opts.pluginId) || process.env.ACP_SESSION_PLUGIN_ID,
      tableName: (opts && opts.tableName) || process.env.XPAY_ACP_SESSIONS_TABLE || 'xpay-acp-sessions',
      region: opts && opts.region,
      client: opts && opts.client,
    });
  }
  return new InMemorySessionStore(opts);
}

module.exports = {
  InMemorySessionStore,
  DynamoDBSessionStore,
  createSessionStore,
};
