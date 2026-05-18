# @xpaysh/cart-deeplinks

Sign + verify the HS256 cart-handoff JWT used by the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family. Wire-compatible with [`xpaysh/agentic-commerce-for-woocommerce`](https://github.com/xpaysh/agentic-commerce-for-woocommerce) v0.2+ and the xpay backend.

**Zero runtime deps.** Node `crypto` only. Apache-2.0.

## What it does

An AI shopping agent (or the xpay backend on the agent's behalf) signs a short-lived JWT that says "this buyer wants to land on the merchant's cart with these SKUs pre-filled, paying through the merchant's existing gateway." The token rides in a query string:

```
https://store.example/?xpay_cart=<jwt>
```

The merchant's plugin verifies the token, empties the WC cart, adds each SKU, tags the order with attribution metadata, and 302s to the existing checkout. Payment runs through the merchant's existing PSP (Stripe / WooPayments / PayPal / Square / etc.). xpay never sits in the payment path.

## Install

```bash
npm install @xpaysh/cart-deeplinks
```

## Use

```ts
import {
  signCartDeeplink,
  verifyCartDeeplink,
  deeplinkUrl,
  extractTokenFromUrl,
  deriveSecret,
} from '@xpaysh/cart-deeplinks';

// Sign — server-side, on the xpay backend (or anyone who holds the merchant's api_key)
const { token, expiresAt } = signCartDeeplink({
  merchant: 'acme-outdoors',
  items: [
    { sku: 'DYN-001', qty: 1 },
    { sku: 'GU-25',   qty: 6 },
  ],
  ttlSeconds: 600,
  cartId: 'cart_8f3a',
  agent: 'gpt-5',
  surface: 'chatgpt-buy-it',
  apiKey: process.env.XPAY_MERCHANT_API_KEY!,
});

// Build the deeplink URL the agent hands to the buyer
const url = deeplinkUrl('https://acme.example/', token);
// → "https://acme.example/?xpay_cart=eyJhbGciOiJIUzI1NiIs..."

// Verify — server-side, on the merchant's storefront (or anywhere the api_key is held)
const incomingToken = extractTokenFromUrl(req.url) ?? '';
const result = verifyCartDeeplink(incomingToken, {
  apiKey: process.env.XPAY_MERCHANT_API_KEY!,
  expectedMerchant: 'acme-outdoors',
});

if (result.ok) {
  // result.payload.items, .expiresAt, .cart_id, .agent, .surface
  proceedToCheckout(result.payload);
} else {
  // result.error — "token expired" | "signature mismatch" | "merchant mismatch" | ...
  reject(result.error);
}
```

## Wire format

Standard 3-part HS256 JWT:

```
<header_b64u>.<payload_b64u>.<sig_b64u>
```

**Header**:
```json
{"alg":"HS256","typ":"JWT"}
```

**Payload**:
```json
{
  "items":    [{ "sku": "DYN-001", "qty": 1, "variation_id": 42 }, ...],
  "exp":      1747353600,
  "merchant": "acme-outdoors",
  "cart_id":  "cart_8f3a",    /* optional */
  "agent":    "gpt-5",        /* optional */
  "surface":  "chatgpt-buy-it" /* optional */
}
```

**Signature**: `HMAC-SHA256(header_b64u + "." + payload_b64u, secret)` — binary, then base64url-encoded.

**Secret**: `sha256_hex(api_key)`. Use `deriveSecret(apiKey)` to compute it manually, or just pass `apiKey` to `signCartDeeplink` / `verifyCartDeeplink` and the package derives it for you.

Why hashed: matches the PHP plugin's `hash('sha256', $raw_key)` (PHP's `hash()` returns hex by default), which lets the plugin verify tokens signed by either xpay's backend or any sibling plugin without sharing the raw api_key in HMAC inputs.

## Interop guarantees

Tokens signed by this package are accepted by:

- **`xpaysh/agentic-commerce-for-woocommerce` v0.2+** PHP plugin (`includes/class-xpay-cart.php` + `includes/class-xpay-client.php#verify_jwt`)
- **`xpaysh/xpay-wc-plugin-backend`** Lambda (server-side issuance)
- Any sibling [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin that imports this package (commercetools, BigCommerce, Magento, Shopify-app, Salesforce Commerce, PrestaShop, Saleor — all live at v0.1+)

Tokens this package verifies must have been signed by the same secret. The package does not silently allow other algorithms — `alg=HS256` is required.

## Security notes

- **HMAC-SHA256, constant-time compare.** `crypto.timingSafeEqual` for the signature check.
- **`exp` is mandatory.** Tokens without a numeric `exp` are rejected.
- **`merchant` matching is opt-in but recommended.** Pass `expectedMerchant` to `verifyCartDeeplink` to scope a token to a specific store; otherwise any merchant whose secret derives from the same api_key accepts the token.
- **Tokens are NOT one-shot.** Until they expire (default 10 min), they remain valid. If you need single-use semantics, layer it externally (track `cart_id` in a Redis seen-set).
- **Tokens travel in URLs.** They will appear in browser history, server logs, CDN access logs. Keep `ttlSeconds` short. The default 600s matches the WC plugin v0.2 default.
- **The package does NOT enforce a maximum payload size.** Don't smuggle huge data through `items[]`; AI shoppers typically send 1-20 items.

## Reference (cart-deeplink anatomy)

```
Sign side ─────────────────────────────────────────────┐
                                                       │
  apiKey ────► deriveSecret() ────► secret (sha256_hex)│
                                          │            │
  { merchant, items, ttl, cartId,         │            │
    agent, surface, now }                 │            │
       │                                  │            │
       ▼                                  ▼            │
    payload  ──┐                  HMAC-SHA256         │
       │       │                          │            │
       ▼       ▼                          │            │
    b64u(header) + "." + b64u(payload) ───┘            │
       │                                               │
       ▼                                               │
    + "." + b64u(signature)                            │
       │                                               │
       ▼                                               │
    "eyJhbGciOiJIUzI1NiIs..."  ── token                │
                                                       │
Verify side ───────────────────────────────────────────┤
                                                       │
  apiKey ────► deriveSecret() ────► secret             │
                                                       │
  token.split(".") = [h64, p64, s64]                   │
       │                                               │
       ├─► JSON.parse(b64u(h64)) → header              │
       │   → alg must be "HS256"                       │
       │                                               │
       ├─► HMAC-SHA256(h64 + "." + p64, secret)        │
       │   == b64u-decoded s64  (timing-safe compare)  │
       │                                               │
       ├─► JSON.parse(b64u(p64)) → payload             │
       │   → exp > now                                 │
       │   → merchant == expectedMerchant (if given)   │
       │   → items is non-empty array                  │
       │                                               │
       ▼                                               │
    { ok: true, payload, expiresAt }                   │
```

## See also

- [`xpaysh/agentic-commerce-for-woocommerce`](https://github.com/xpaysh/agentic-commerce-for-woocommerce) — the reference PHP plugin that consumes these tokens
- [`@xpaysh/discovery`](https://www.npmjs.com/package/@xpaysh/discovery) — discovery-file generators that advertise the cart-deeplink URL pattern in `/llms.txt`
- [`@xpaysh/storefront-audit`](https://www.npmjs.com/package/@xpaysh/storefront-audit) — auditor (v0.4+ will include a cart-deeplink mint check)
- [Plugin template](https://github.com/xpaysh/agentic-commerce-plugin-template) — the monorepo this package lives in

## License

Apache-2.0.
