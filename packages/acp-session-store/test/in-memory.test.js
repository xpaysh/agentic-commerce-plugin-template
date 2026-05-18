'use strict';

const assert = require('node:assert/strict');
const { InMemorySessionStore, createSessionStore, DynamoDBSessionStore } = require('../src');

let passed = 0;
let failed = 0;
async function t(name, fn) {
  try {
    await fn();
    process.stdout.write(`✓ ${name}\n`);
    passed += 1;
  } catch (err) {
    process.stdout.write(`✗ ${name}\n    ${(err.stack || err.message || err).toString().split('\n').slice(0, 3).join('\n    ')}\n`);
    failed += 1;
  }
}

(async () => {
  const session = {
    id: 'cs_abc123',
    status: 'ready_for_payment',
    currency: 'USD',
    line_items: [],
    totals: [],
  };

  await t('put + get round-trip', async () => {
    const s = new InMemorySessionStore();
    await s.put(session);
    const got = await s.get('cs_abc123');
    assert.equal(got.id, 'cs_abc123');
    assert.equal(got.status, 'ready_for_payment');
  });

  await t('get returns null for unknown id', async () => {
    const s = new InMemorySessionStore();
    assert.equal(await s.get('nope'), null);
  });

  await t('patch merges + preserves id', async () => {
    const s = new InMemorySessionStore();
    await s.put(session);
    const patched = await s.patch('cs_abc123', { status: 'completed' });
    assert.equal(patched.status, 'completed');
    assert.equal(patched.id, 'cs_abc123');
    const reread = await s.get('cs_abc123');
    assert.equal(reread.status, 'completed');
  });

  await t('patch returns null for unknown id', async () => {
    const s = new InMemorySessionStore();
    assert.equal(await s.patch('nope', { status: 'x' }), null);
  });

  await t('delete returns true on hit, false on miss', async () => {
    const s = new InMemorySessionStore();
    await s.put(session);
    assert.equal(await s.delete('cs_abc123'), true);
    assert.equal(await s.delete('cs_abc123'), false);
    assert.equal(await s.get('cs_abc123'), null);
  });

  await t('expired session returns null + is swept', async () => {
    const s = new InMemorySessionStore({ sweepEverySeconds: 0 });
    const expired = { ...session, expiresAt: new Date(Date.now() - 1000).toISOString() };
    await s.put(expired);
    assert.equal(await s.get('cs_abc123'), null);
  });

  await t('put rejects session without id', async () => {
    const s = new InMemorySessionStore();
    await assert.rejects(() => s.put({}), /session\.id/);
  });

  await t('factory returns InMemorySessionStore by default', async () => {
    const s = createSessionStore();
    assert.ok(s instanceof InMemorySessionStore);
  });

  await t('factory returns DynamoDBSessionStore with driver: dynamodb', async () => {
    const s = createSessionStore({ driver: 'dynamodb', pluginId: 'demo' });
    assert.ok(s instanceof DynamoDBSessionStore);
    assert.equal(s.tableName, 'xpay-acp-sessions');
    assert.equal(s.pluginId, 'demo');
  });

  await t('DynamoDBSessionStore throws without pluginId', async () => {
    assert.throws(() => new DynamoDBSessionStore({}), /pluginId/);
  });

  await t('DynamoDBSessionStore with stubbed client round-trips', async () => {
    // Stub the SDK shape: PutItemCommand → stored; GetItemCommand → returns stored.
    const items = new Map();
    const stub = {
      send: async (cmd) => {
        const k = `${cmd.input.Key && cmd.input.Key.sessionId && cmd.input.Key.sessionId.S || (cmd.input.Item && cmd.input.Item.sessionId.S)}`;
        if (cmd._type === 'Put') { items.set(k, cmd.input.Item); return {}; }
        if (cmd._type === 'Get') {
          const item = items.get(k);
          return item ? { Item: item } : {};
        }
        if (cmd._type === 'Delete') {
          const item = items.get(k);
          items.delete(k);
          return item ? { Attributes: item } : {};
        }
        throw new Error('unknown cmd');
      },
    };
    // Stub the command classes the store imports lazily.
    const sdkStub = {
      DynamoDBClient: class { constructor() {} send(cmd) { return stub.send(cmd); } },
      PutItemCommand: function (input) { return { _type: 'Put', input }; },
      GetItemCommand: function (input) { return { _type: 'Get', input }; },
      DeleteItemCommand: function (input) { return { _type: 'Delete', input }; },
    };
    const store = new DynamoDBSessionStore({ pluginId: 'demo', client: new sdkStub.DynamoDBClient() });
    store._sdk = sdkStub; // bypass require()
    await store.put(session);
    const got = await store.get('cs_abc123');
    assert.equal(got.id, 'cs_abc123');
    assert.equal(got.status, 'ready_for_payment');
    assert.equal(await store.delete('cs_abc123'), true);
    assert.equal(await store.get('cs_abc123'), null);
  });

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
