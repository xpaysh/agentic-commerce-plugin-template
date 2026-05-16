/**
 * @xpaysh/cart-deeplinks — sign + verify the HS256 cart-handoff JWT used by
 * the agentic-commerce-for-* plugin family. Wire-compatible with
 * xpaysh/agentic-commerce-for-woocommerce v0.2+.
 */

export declare const DEFAULT_PARAM: 'xpay_cart';
export declare const DEFAULT_TTL_SECONDS: 600;

// ---------------------------------------------------------------------------
// Payload shape
// ---------------------------------------------------------------------------

export interface CartDeeplinkItem {
  sku: string;
  qty?: number;
  variation_id?: number;
}

export interface CartDeeplinkPayload {
  items: CartDeeplinkItem[];
  exp: number;
  merchant: string;
  cart_id?: string;
  agent?: string;
  surface?: string;
  [extra: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

export interface SignCartDeeplinkOptions {
  merchant: string;
  items: CartDeeplinkItem[];
  /** Token lifetime in seconds. Defaults to 600. */
  ttlSeconds?: number;
  cartId?: string;
  agent?: string;
  surface?: string;
  /** Raw merchant api_key. The HMAC secret is derived as `sha256_hex(apiKey)`. */
  apiKey?: string;
  /** Pre-derived HMAC secret (sha256 hex of api_key). Supply this OR `apiKey`. */
  secret?: string;
  /** Override `now` in seconds since epoch. For tests. */
  now?: number;
}

export interface SignCartDeeplinkResult {
  token: string;
  /** Unix seconds at which the token expires. */
  expiresAt: number;
  /** The full payload that was signed (echoes back what's in the token). */
  payload: CartDeeplinkPayload;
}

export declare function signCartDeeplink(opts: SignCartDeeplinkOptions): SignCartDeeplinkResult;

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export interface VerifyCartDeeplinkOptions {
  apiKey?: string;
  secret?: string;
  /** If supplied, payload.merchant must equal this. */
  expectedMerchant?: string;
  /** Override `now` in seconds since epoch. For tests. */
  now?: number;
}

export type VerifyCartDeeplinkResult =
  | { ok: true; payload: CartDeeplinkPayload; expiresAt: number }
  | { ok: false; error: string };

export declare function verifyCartDeeplink(token: string, opts: VerifyCartDeeplinkOptions): VerifyCartDeeplinkResult;

// ---------------------------------------------------------------------------
// URL helpers + secret derivation
// ---------------------------------------------------------------------------

/** Derive the HMAC secret from the raw api_key (sha256 hex). */
export declare function deriveSecret(apiKey: string): string;

/** Build `{siteUrl}?xpay_cart={token}` (preserves existing query string). */
export declare function deeplinkUrl(siteUrl: string, token: string, paramName?: string): string;

/** Extract the cart-deeplink token from a URL or query-string; null if absent. */
export declare function extractTokenFromUrl(urlOrQs: string, paramName?: string): string | null;
