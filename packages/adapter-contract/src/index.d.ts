/**
 * @xpaysh/adapter-contract — TypeScript interface every per-platform
 * agentic-commerce-for-* plugin implements.
 *
 * One contract, N adapters. Protocol-side packages (discovery, ucp-schemas,
 * acp-schemas, ap2-schemas, cart-deeplinks, storefront-audit) call this
 * contract; platform plugins implement it against native APIs (commercetools
 * SDK, BigCommerce REST, Magento Composer module, Shopify Admin API, etc.).
 *
 * Value types are intentionally aligned to UCP's capability surface where
 * possible. JSON Schemas in @xpaysh/ucp-schemas are the canonical wire
 * shapes; these TS types are the runtime-friendly view that platform
 * plugins consume directly without having to re-derive from JSON Schema.
 */

// ===========================================================================
// Primitive value types
// ===========================================================================

/** ISO 4217 currency code, e.g. "USD", "EUR", "INR". */
export type CurrencyCode = string;

/** Money — integer minor units (cents, paise, …) + currency code. */
export interface Money {
  /** Integer amount in the currency's minor unit (e.g. 19900 = $199.00 USD). */
  amount: number;
  currency: CurrencyCode;
}

/** Address — postal address shape; aligned to schema.org PostalAddress + UCP common. */
export interface Address {
  name?: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  phone?: string;
  email?: string;
}

/** Product image — public URL + optional dimensions. */
export interface Image {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

// ===========================================================================
// Product
// ===========================================================================

export type ProductId = string;
export type ProductVariantId = string;
export type CartId = string;
export type LineItemId = string;
export type OrderId = string;

export interface ProductVariant {
  id: ProductVariantId;
  sku: string;
  name?: string;
  /** Variant-specific price; falls back to the product's base price when absent. */
  price?: Money;
  /** Variant-specific images; merge with product-level images at display time. */
  images?: Image[];
  /** Attribute → value (e.g. { color: 'navy', size: 'M' }). Free-form. */
  attributes?: Record<string, string | number | boolean>;
  /** Inventory level if known. `null` means "unknown" — caller should not assume out-of-stock. */
  inventory?: number | null;
  /** Whether the variant is purchasable right now (combines `inventory` + lifecycle state). */
  inStock: boolean;
}

export interface Product {
  id: ProductId;
  /** Stable identifier for the product itself (often the SKU of the default variant). */
  sku?: string;
  name: string;
  description?: string;
  /** Default base price; variant.price overrides when set. */
  price?: Money;
  images?: Image[];
  /** Canonical product URL on the storefront. Used by JSON-LD + cart-deeplink builder. */
  url?: string;
  /** Brand / manufacturer name if known. */
  brand?: string;
  /** At least one variant; the "no-variant" case is modelled as a single default variant. */
  variants: ProductVariant[];
  /** Free-form attribute map at the product level. */
  attributes?: Record<string, string | number | boolean>;
  /** Categories / collections this product belongs to (display order). */
  categories?: string[];
}

export interface ProductQuery {
  /** Full-text query string. Adapter may map to native search. */
  q?: string;
  /** Filter by SKU. */
  sku?: string;
  /** Limit results. Default at adapter discretion. */
  limit?: number;
  /** Pagination cursor returned in a prior `Paginated` response. */
  cursor?: string;
  /** Filter by category path or id (free-form; adapter-defined). */
  category?: string;
  /** Lowest-price-first / highest-first / popular / newest — adapter-defined. */
  sort?: 'price_asc' | 'price_desc' | 'popular' | 'newest' | string;
}

export interface Paginated<T> {
  items: T[];
  /** Opaque cursor for the next page; null when exhausted. */
  nextCursor: string | null;
  /** Total result count when cheap to compute; null otherwise. */
  total?: number | null;
}

// ===========================================================================
// Cart
// ===========================================================================

export interface LineItem {
  id?: LineItemId;
  productId: ProductId;
  variantId?: ProductVariantId;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  /** quantity × unitPrice. */
  lineTotal: Money;
  /** Per-line attributes (e.g. engraving text, gift-wrap notes). */
  metadata?: Record<string, string>;
}

export interface Cart {
  id: CartId;
  /** Items currently in the cart. */
  items: LineItem[];
  /** Sum of all lineTotals before tax/shipping/discount. */
  subtotal: Money;
  /** Computed totals if the adapter knows them; null if "not yet computed at this stage". */
  shipping?: Money | null;
  tax?: Money | null;
  discount?: Money | null;
  total?: Money | null;
  /** Buyer's shipping / billing address if collected. */
  shippingAddress?: Address;
  billingAddress?: Address;
  /** ISO timestamp of last mutation. */
  updatedAt?: string;
  /** Opaque platform-specific state (commercetools cart version, etc.). */
  meta?: Record<string, unknown>;
}

export interface CreateCartInput {
  /** Initial line items to add. Quantity required; price comes from the adapter. */
  items: Array<{ sku: string; quantity: number; variantId?: ProductVariantId; metadata?: Record<string, string> }>;
  /** Currency the cart should be priced in. Defaults to the merchant's primary currency. */
  currency?: CurrencyCode;
  /** Buyer-side correlation id (xpay agent attribution, etc.). */
  externalId?: string;
}

/** Mutation operations applied to an existing cart. Adapter applies them transactionally. */
export interface CartMutation {
  /** Add or update items. Same `sku` is treated as upsert (quantity becomes the new quantity, not delta). */
  setItems?: Array<{ sku: string; quantity: number; variantId?: ProductVariantId; metadata?: Record<string, string> }>;
  /** Remove items by sku. */
  removeSkus?: string[];
  /** Set the shipping address. */
  shippingAddress?: Address;
  /** Set the billing address (if different). */
  billingAddress?: Address;
  /** Apply a discount code. */
  discountCode?: string;
}

// ===========================================================================
// Checkout / Order
// ===========================================================================

export interface CompleteCheckoutInput {
  cartId: CartId;
  /** Shipping address if not already set on the cart. */
  shippingAddress?: Address;
  /** Billing address if not already set on the cart. */
  billingAddress?: Address;
  /** Adapter-specific payment instrument hand-off (token, network token, etc.). */
  payment?: Record<string, unknown>;
  /** Buyer note. */
  note?: string;
}

/** Order lifecycle states. Mirrors the UCP order state machine. */
export type OrderStatus =
  | 'created'        // accepted; not yet paid
  | 'confirmed'      // payment captured / committed
  | 'processing'     // being prepared for fulfilment
  | 'fulfilled'      // ready / shipped by merchant
  | 'shipped'        // in carrier custody
  | 'delivered'      // delivered to buyer
  | 'cancelled'      // cancelled before fulfilment
  | 'refunded';      // funds returned (full or partial)

export interface Order {
  id: OrderId;
  cartId?: CartId;
  status: OrderStatus;
  items: LineItem[];
  subtotal: Money;
  shipping?: Money | null;
  tax?: Money | null;
  discount?: Money | null;
  total: Money;
  shippingAddress?: Address;
  billingAddress?: Address;
  /** ISO timestamp the order was placed. */
  createdAt: string;
  /** ISO timestamp of last status change. */
  updatedAt?: string;
  /** Payment status — adapter-defined nuance ("captured", "authorized", "voided", etc.). */
  paymentStatus?: string;
  /** Adapter-supplied tracking info if available. */
  tracking?: Array<{ carrier?: string; number?: string; url?: string }>;
  /** Buyer-side correlation id passed through from cart. */
  externalId?: string;
  /** Opaque platform-specific state. */
  meta?: Record<string, unknown>;
}

export interface OrderQuery {
  status?: OrderStatus | OrderStatus[];
  /** ISO 8601 timestamp. */
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  cursor?: string;
  /** Filter by externalId (buyer / agent correlation id). */
  externalId?: string;
}

export interface RefundResult {
  orderId: OrderId;
  /** Refunded amount (full or partial). */
  amount: Money;
  /** Whether the order is now fully refunded. */
  fullyRefunded: boolean;
  /** Adapter-specific reference (PSP refund id, etc.). */
  reference?: string;
}

export interface DisputeHandle {
  orderId: OrderId;
  /** Adapter-specific dispute id. */
  id: string;
  /** Free-form reason captured at open time. */
  reason: string;
  /** ISO timestamp. */
  openedAt: string;
}

// ===========================================================================
// Capabilities + the contract itself
// ===========================================================================

export interface AdapterCapabilities {
  cart: boolean;
  checkout: boolean;
  catalogSearch: boolean;
  catalogLookup: boolean;
  order: boolean;
  /** Optional capabilities. False or undefined ⇒ method is not callable. */
  refunds?: boolean;
  disputes?: boolean;
  /** Soft signals callers can branch on. */
  inventoryRealtime?: boolean;
  webhooks?: boolean;
  /** Extension map for vendor-specific capability flags. */
  extras?: Record<string, boolean>;
}

/**
 * The contract every per-platform plugin implements.
 *
 * Method semantics:
 *
 *   - All methods are async and may reject. Callers handle rejection by
 *     surfacing the error to the protocol layer (ACP/UCP/AP2 endpoint),
 *     which translates to an appropriate spec-compliant error code.
 *   - `getProduct`, `getCart`, `getOrder` MUST return `null` (not throw)
 *     when the entity doesn't exist. Throw only for transport / auth /
 *     unexpected errors.
 *   - `completeCheckout` is the integration seam to the merchant's PSP.
 *     The adapter is responsible for translating the protocol-supplied
 *     payment instrument into whatever its native API expects.
 *   - `refundOrder` and `openDispute` are optional. If implemented, the
 *     adapter MUST set the corresponding capability flag to true.
 */
export interface PlatformAdapter {
  /** Stable platform identifier, e.g. 'commercetools', 'woocommerce'. */
  readonly platformName: string;
  readonly capabilities: AdapterCapabilities;

  // -------- Catalog --------
  listProducts(query: ProductQuery): Promise<Paginated<Product>>;
  /** Returns null if the product doesn't exist. */
  getProduct(id: ProductId): Promise<Product | null>;

  // -------- Cart --------
  createCart(input: CreateCartInput): Promise<Cart>;
  updateCart(id: CartId, mutation: CartMutation): Promise<Cart>;
  /** Returns null if the cart doesn't exist or has expired. */
  getCart(id: CartId): Promise<Cart | null>;

  // -------- Checkout --------
  completeCheckout(input: CompleteCheckoutInput): Promise<Order>;

  // -------- Order --------
  /** Returns null if the order doesn't exist. */
  getOrder(id: OrderId): Promise<Order | null>;
  listOrders(query: OrderQuery): Promise<Paginated<Order>>;

  // -------- Optional (UCP refunds/disputes) --------
  refundOrder?(id: OrderId, amount?: Money): Promise<RefundResult>;
  openDispute?(id: OrderId, reason: string): Promise<DisputeHandle>;
}

// ===========================================================================
// Runtime helpers (implemented in index.js)
// ===========================================================================

export interface AdapterCheckResult {
  ok: true;
}

export interface AdapterCheckFailure {
  ok: false;
  missing: string[];
}

/** Validate a value looks like a PlatformAdapter at runtime. */
export declare function isAdapter(adapter: unknown): AdapterCheckResult | AdapterCheckFailure;

export interface AdapterRegistry {
  register(slug: string, adapter: PlatformAdapter): void;
  get(slug: string): PlatformAdapter | undefined;
  list(): string[];
  remove(slug: string): boolean;
}

/** In-memory registry for hosted-dispatch use cases. */
export declare function createAdapterRegistry(): AdapterRegistry;

/** Canonical capability-flag string constants. */
export declare const CAPABILITIES: Readonly<{
  CART: 'cart';
  CHECKOUT: 'checkout';
  CATALOG_SEARCH: 'catalog.search';
  CATALOG_LOOKUP: 'catalog.lookup';
  ORDER: 'order';
  REFUNDS: 'refunds';
  DISPUTES: 'disputes';
  INVENTORY_REALTIME: 'inventory.realtime';
  WEBHOOKS: 'webhooks';
}>;

/** Method names every adapter MUST implement. Used by `isAdapter`. */
export declare const REQUIRED_METHODS: readonly string[];
