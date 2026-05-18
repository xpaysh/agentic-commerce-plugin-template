# `@xpaysh/http-message-signatures`

[RFC 9421](https://datatracker.ietf.org/doc/rfc9421/) HTTP Message Signatures — focused implementation covering the component set the UCP REST contract and the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family actually use.

## Algorithms

| `alg` value | Use |
|---|---|
| `ed25519` | Primary. Matches the JWK shape (`kty: OKP`, `crv: Ed25519`) advertised in `@xpaysh/ucp-schemas` `generateUcpProfile()` `signing_keys`. |
| `hmac-sha256` | For testing and shared-secret deployments. |

## Covered components

```
("@method" "@target-uri" "content-digest" "idempotency-key")
```

These are the four components the UCP REST OpenAPI references and the four agentic-commerce sibling plugins need to verify on inbound requests. Extending the covered set is mechanical — see `buildSignatureBase` in `src/index.js`.

## Install

```bash
npm install @xpaysh/http-message-signatures
```

## Use

### Sign an outbound request

```js
const crypto = require('node:crypto');
const { signRequest } = require('@xpaysh/http-message-signatures');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const headers = signRequest({
  method: 'POST',
  url: 'https://shop.example.com/ucp/v1/checkout-sessions',
  headers: { 'Idempotency-Key': '550e8400-e29b-41d4-a716-446655441001' },
  body: JSON.stringify({ ucp: { version: '2026-05-18' }, currency: 'USD', line_items: [] }),
  keyId: 'agent-ed25519-1',
  alg: 'ed25519',
  privateKey,
});
// → { Signature, 'Signature-Input', 'Content-Digest' }
// Attach these to your outbound request.
```

### Verify an inbound request

```js
const { verifyRequest } = require('@xpaysh/http-message-signatures');

const result = verifyRequest({
  method: req.method,
  url: req.url,
  headers: req.headers,
  body: rawBody, // raw bytes/string as received
  keyResolver: (keyId, alg) => myKeyStore.lookup(keyId, alg), // return KeyObject | Buffer | string | null
  maxAgeSeconds: 300,
});

if (!result.ok) {
  return res.status(401).json({ error: result.reason });
}
// result = { ok: true, keyId, alg, created, components }
```

The verifier:
- Rejects missing `Signature` / `Signature-Input` headers.
- Rejects unsupported `alg`.
- Rejects when `created` is older than `maxAgeSeconds` (default 300).
- Recomputes `Content-Digest` from the body and rejects on mismatch (catches tampered bodies).
- Reconstructs the signature base per [RFC 9421 §2.5](https://datatracker.ietf.org/doc/html/rfc9421#section-2.5) and asks the resolver for the key.
- Verifies cryptographically; constant-time compare for HMAC.

## Limitations vs. the full RFC 9421

- One signature label per request (`sig1`). RFC 9421 permits multiple parallel signatures.
- No `nonce`, `expires`, or `tag` Signature-Input parameters (additive when needed).
- Component set fixed to the four covered above. Extending is one switch statement.
- No `Accept-Signature` negotiation.

These are intentional scope limits — extending the package only when a concrete plugin v0.2 needs the feature.

## Test

```bash
npm test
```

10 round-trip + reject-tampered tests cover both algorithms, body tampering, signature tampering, unknown keyId, expired signatures, and malformed inputs.

## License

Apache-2.0.
