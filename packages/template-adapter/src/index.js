'use strict';

/**
 * @xpaysh/template-adapter
 *
 * A working reference PlatformAdapter implementation. Backed by a small
 * deterministic in-memory catalog so contributors can copy this directory
 * to bootstrap a new `agentic-commerce-for-<platform>` plugin, swap the
 * in-memory store for the platform's native client (Shopify, BigCommerce,
 * commercetools, …), and have the protocol routes work end-to-end.
 *
 * Every PlatformAdapter method documented in @xpaysh/adapter-contract is
 * implemented here. Methods return live Promises (not synchronous values)
 * so the swap to a network-backed client is structurally identical.
 *
 * Zero runtime deps.
 */

const DEMO_PRODUCTS = Object.freeze([
  {
    id: 'demo-shirt-blue',
    title: 'Demo Shirt — Blue',
    description: 'A reference product. Replace with your platform catalog.',
    brand: 'Demo Brand',
    images: [{ url: 'https://example.com/img/demo-shirt-blue.jpg', alt: 'Demo Shirt — Blue' }],
    basePrice: { amount: 2500, currency: 'USD' },
    variants: [
      { id: 'demo-shirt-blue-s', sku: 'DEMO-SHIRT-BLUE-S', attributes: { size: 'S' }, inStock: true, inventory: 12 },
      { id: 'demo-shirt-blue-m', sku: 'DEMO-SHIRT-BLUE-M', attributes: { size: 'M' }, inStock: true, inventory: 8 },
      { id: 'demo-shirt-blue-l', sku: 'DEMO-SHIRT-BLUE-L', attributes: { size: 'L' }, inStock: false, inventory: 0 },
    ],
  },
  {
    id: 'demo-mug',
    title: 'Demo Mug',
    description: 'Reference product #2.',
    brand: 'Demo Brand',
    images: [{ url: 'https://example.com/img/demo-mug.jpg', alt: 'Demo Mug' }],
    basePrice: { amount: 1500, currency: 'USD' },
    variants: [{ id: 'demo-mug-default', sku: 'DEMO-MUG', inStock: true, inventory: 200 }],
  },
]);

/**
 * Build a fresh adapter instance. State is per-instance so tests can isolate.
 *
 * @param {object} [opts]
 * @param {string} [opts.currency='USD']
 * @returns {import('./index').TemplateAdapter}
 */
function createTemplateAdapter(opts) {
  const currency = (opts && opts.currency) || 'USD';
  const carts = new Map(); // cartId → cart
  const orders = new Map(); // orderId → order
  let nextCart = 1;
  let nextOrder = 1;

  function priceFor(productId, variantId) {
    const p = DEMO_PRODUCTS.find((x) => x.id === productId);
    if (!p) return null;
    const v = variantId ? p.variants.find((x) => x.id === variantId) : p.variants[0];
    if (!v) return null;
    return v.price || p.basePrice;
  }

  function lineTotal(lines) {
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice.amount * l.quantity, 0);
    return { amount: subtotal, currency };
  }

  return {
    async listProducts(query) {
      const limit = (query && query.limit) || 25;
      const offset = (query && query.offset) || 0;
      const filtered = query && query.search
        ? DEMO_PRODUCTS.filter((p) => p.title.toLowerCase().includes(query.search.toLowerCase()))
        : DEMO_PRODUCTS.slice();
      return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        hasMore: offset + limit < filtered.length,
      };
    },

    async getProduct(id) {
      return DEMO_PRODUCTS.find((p) => p.id === id) || null;
    },

    async createCart(input) {
      const id = `cart_${nextCart++}`;
      const lines = (input.lines || []).map((l, i) => {
        const unitPrice = priceFor(l.productId, l.variantId);
        if (!unitPrice) throw new Error(`product not found: ${l.productId}`);
        return {
          id: `li_${i + 1}`,
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice,
          totalPrice: { amount: unitPrice.amount * l.quantity, currency: unitPrice.currency },
        };
      });
      const cart = {
        id,
        lines,
        subtotal: lineTotal(lines),
        currency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      carts.set(id, cart);
      return cart;
    },

    async updateCart(id, mutation) {
      const cart = carts.get(id);
      if (!cart) throw new Error(`cart not found: ${id}`);
      const lines = cart.lines.slice();
      for (const op of mutation.operations || []) {
        if (op.type === 'add') {
          const unitPrice = priceFor(op.productId, op.variantId);
          if (!unitPrice) throw new Error(`product not found: ${op.productId}`);
          lines.push({
            id: `li_${lines.length + 1}`,
            productId: op.productId,
            variantId: op.variantId,
            quantity: op.quantity,
            unitPrice,
            totalPrice: { amount: unitPrice.amount * op.quantity, currency: unitPrice.currency },
          });
        } else if (op.type === 'remove') {
          const idx = lines.findIndex((l) => l.id === op.lineItemId);
          if (idx >= 0) lines.splice(idx, 1);
        } else if (op.type === 'set_quantity') {
          const line = lines.find((l) => l.id === op.lineItemId);
          if (line) {
            line.quantity = op.quantity;
            line.totalPrice = { amount: line.unitPrice.amount * op.quantity, currency: line.unitPrice.currency };
          }
        }
      }
      cart.lines = lines;
      cart.subtotal = lineTotal(lines);
      cart.updatedAt = new Date().toISOString();
      return cart;
    },

    async completeCheckout(input) {
      const cart = carts.get(input.cartId);
      if (!cart) throw new Error(`cart not found: ${input.cartId}`);
      const id = `order_${nextOrder++}`;
      const order = {
        id,
        cartId: cart.id,
        lines: cart.lines,
        total: cart.subtotal,
        currency,
        buyerEmail: input.buyer && input.buyer.email,
        shippingAddress: input.shippingAddress,
        paymentReference: `demo-pay-${id}`,
        status: 'confirmed',
        permalink: `https://demo.example.com/orders/${id}`,
        createdAt: new Date().toISOString(),
      };
      orders.set(id, order);
      carts.delete(cart.id);
      return order;
    },

    async getOrder(id) {
      return orders.get(id) || null;
    },
  };
}

/** A pre-built singleton — convenient for ad-hoc usage outside tests. */
const templateAdapter = createTemplateAdapter();

module.exports = {
  DEMO_PRODUCTS,
  createTemplateAdapter,
  templateAdapter,
};
