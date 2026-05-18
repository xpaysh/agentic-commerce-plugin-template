'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { signRequest, verifyRequest, contentDigest } = require('../src');

let passed = 0;
let failed = 0;

function t(name, fn) {
  try {
    fn();
    process.stdout.write(`✓ ${name}\n`);
    passed += 1;
  } catch (err) {
    process.stdout.write(`✗ ${name}\n    ${err.stack.split('\n').slice(0, 3).join('\n    ')}\n`);
    failed += 1;
  }
}

/* ------------- Ed25519 round-trip -------------- */

const { publicKey: edPub, privateKey: edPriv } = crypto.generateKeyPairSync('ed25519');

const baseReq = {
  method: 'POST',
  url: 'https://shop.example.com/ucp/v1/checkout-sessions',
  headers: { 'Idempotency-Key': '550e8400-e29b-41d4-a716-446655441001' },
  body: JSON.stringify({ ucp: { version: '2026-05-18' }, currency: 'USD', line_items: [] }),
};

t('content-digest is deterministic SHA-256 base64', () => {
  const d1 = contentDigest('hello');
  const d2 = contentDigest(Buffer.from('hello'));
  assert.equal(d1, d2);
  assert.match(d1, /^sha-256=:[A-Za-z0-9+/=]+:$/);
});

t('ed25519 sign + verify round-trip succeeds', () => {
  const sig = signRequest({ ...baseReq, keyId: 'm-1', alg: 'ed25519', privateKey: edPriv, created: 1747566000 });
  assert.ok(sig.Signature.startsWith('sig1=:'));
  assert.ok(sig['Signature-Input'].includes('alg="ed25519"'));

  const headersOnWire = { ...baseReq.headers, ...sig };
  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: headersOnWire,
    body: baseReq.body,
    keyResolver: () => edPub,
    now: 1747566010,
  });
  assert.equal(result.ok, true);
  assert.equal(result.alg, 'ed25519');
  assert.equal(result.keyId, 'm-1');
});

t('ed25519 verify rejects tampered body (Content-Digest mismatch)', () => {
  const sig = signRequest({ ...baseReq, keyId: 'm-1', alg: 'ed25519', privateKey: edPriv });
  const tampered = JSON.stringify({ ucp: { version: '2026-05-18' }, currency: 'USD', line_items: [{ tampered: true }] });
  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: { ...baseReq.headers, ...sig },
    body: tampered,
    keyResolver: () => edPub,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Content-Digest mismatch/);
});

t('ed25519 verify rejects tampered signature bytes', () => {
  const sig = signRequest({ ...baseReq, keyId: 'm-1', alg: 'ed25519', privateKey: edPriv });
  // Flip a byte deep inside the base64 signature value.
  const m = sig.Signature.match(/^(sig1=:)([A-Za-z0-9+/=]+)(:)$/);
  const sigBytes = Buffer.from(m[2], 'base64');
  sigBytes[5] ^= 0xff;
  const tamperedSig = `${m[1]}${sigBytes.toString('base64')}${m[3]}`;
  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: { ...baseReq.headers, ...sig, Signature: tamperedSig },
    body: baseReq.body,
    keyResolver: () => edPub,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /signature verification failed/);
});

t('ed25519 verify rejects unknown keyId', () => {
  const sig = signRequest({ ...baseReq, keyId: 'm-1', alg: 'ed25519', privateKey: edPriv });
  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: { ...baseReq.headers, ...sig },
    body: baseReq.body,
    keyResolver: () => null,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown keyId/);
});

t('ed25519 verify rejects too-old signature', () => {
  const sig = signRequest({ ...baseReq, keyId: 'm-1', alg: 'ed25519', privateKey: edPriv, created: 1000 });
  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: { ...baseReq.headers, ...sig },
    body: baseReq.body,
    keyResolver: () => edPub,
    now: 1000 + 301,
    maxAgeSeconds: 300,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /too old/);
});

/* ------------- HMAC-SHA256 round-trip -------------- */

t('hmac-sha256 sign + verify round-trip succeeds', () => {
  const secret = Buffer.from('shared-test-secret', 'utf8');
  const sig = signRequest({ ...baseReq, keyId: 'shared-1', alg: 'hmac-sha256', privateKey: secret });
  assert.ok(sig['Signature-Input'].includes('alg="hmac-sha256"'));

  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: { ...baseReq.headers, ...sig },
    body: baseReq.body,
    keyResolver: () => secret,
  });
  assert.equal(result.ok, true);
  assert.equal(result.alg, 'hmac-sha256');
});

t('hmac-sha256 verify rejects wrong secret', () => {
  const sig = signRequest({ ...baseReq, keyId: 'shared-1', alg: 'hmac-sha256', privateKey: Buffer.from('right') });
  const result = verifyRequest({
    method: baseReq.method,
    url: baseReq.url,
    headers: { ...baseReq.headers, ...sig },
    body: baseReq.body,
    keyResolver: () => Buffer.from('wrong'),
  });
  assert.equal(result.ok, false);
});

/* ------------- malformed inputs -------------- */

t('verify rejects missing Signature headers', () => {
  const result = verifyRequest({
    method: 'GET',
    url: 'https://example.com',
    headers: {},
    keyResolver: () => null,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing Signature/);
});

t('sign throws on unsupported alg', () => {
  assert.throws(
    () => signRequest({ ...baseReq, keyId: 'k', alg: 'rsa-pss-sha256', privateKey: '' }),
    /unsupported alg/,
  );
});

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
