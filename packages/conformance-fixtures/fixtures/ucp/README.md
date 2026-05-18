# UCP fixtures

Placeholder. Real fixtures land alongside `@xpaysh/ucp-schemas@0.2.0`, which lifts the JSON Schemas from `Universal-Commerce-Protocol/ucp/source/schemas/*`. Tracked at:

- ucp.dev specification
- Google's UCP profile guide
- A2A 1.0 + MCP bindings

Until then, UCP discovery is verified via `@xpaysh/storefront-audit` against the live `/.well-known/ucp` endpoint and `@xpaysh/ucp-schemas`'s `generateUcpProfile()` golden output.
