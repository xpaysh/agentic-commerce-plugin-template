# `@xpaysh/lint-wellknowns`

CI linter that enforces the **real-standards-only** design principle of the [`agentic-commerce-for-*`](https://github.com/xpaysh?q=agentic-commerce-for-) plugin family.

Every plugin in the family commits to emitting only discovery files / URIs that trace to a published spec or RFC. This package codifies the deny-list, scans source trees for accidental references, and probes a running storefront over HTTP.

## The lists

**Banned** (fictitious — no spec, no RFC, no IANA registration):

| Path | Why it's banned |
|---|---|
| `/.well-known/agentic-commerce.json` | ACP defines no discovery file. Capability negotiation happens per-session in `POST /checkout_sessions`. |
| `/.well-known/ucp.json` | Wrong filename. Real path is `/.well-known/ucp` (no extension), per ucp.dev. |
| `/.well-known/acp.json` | ACP has no well-known file. |
| `/.well-known/ap2.json` | AP2 uses A2A message envelopes, not a manifest. |
| `/.well-known/mcp.json` | MCP servers advertise via their own endpoint URL. |
| `/.well-known/ai-plugin.json` | Deprecated. OpenAI retired the ChatGPT plugin manifest. |
| `/agents.txt` | No RFC. Use `/llms.txt`. |
| `/ai.txt` | No RFC. |

**Allowed** (real):

| Path | Spec |
|---|---|
| `/llms.txt` | [llmstxt.org](https://llmstxt.org) |
| `/robots.txt` | RFC 9309 |
| `/.well-known/ucp` | [ucp.dev](https://ucp.dev) / Google UCP profile guide |
| `/.well-known/agent-card.json` | [A2A 1.0](https://a2a-protocol.org) (IANA-registered 2025-08-01) |
| `/.well-known/oauth-protected-resource` | [RFC 9728](https://datatracker.ietf.org/doc/rfc9728/) |

## Install

```bash
npm install --save-dev @xpaysh/lint-wellknowns
```

## CLI

```bash
# Scan the current directory's source tree
npx lint-wellknowns scan

# Probe a running storefront
npx lint-wellknowns probe https://shop.example.com

# Print the canonical deny-list + allow-list
npx lint-wellknowns list

# Emit GitHub Actions inline-annotations on findings (use in CI)
npx lint-wellknowns scan --github
```

Exit codes: `0` = clean, `1` = findings (CI fails), `2` = usage error.

## Programmatic API

```js
const { scanDirectory, probeStorefront, FICTITIOUS_PATHS } = require('@xpaysh/lint-wellknowns');

// Static scan
const { findings, scannedFileCount } = scanDirectory({ rootDir: process.cwd() });

// HTTP probe (Node >= 18, uses global fetch)
const liveFindings = await probeStorefront({ baseUrl: 'https://shop.example.com' });
```

## GitHub Actions

A reusable composite action is published from the template repo at `.github/actions/lint-wellknowns/`. Plugins reference it like:

```yaml
- uses: xpaysh/agentic-commerce-plugin-template/.github/actions/lint-wellknowns@main
  with:
    target: ./src
```

## Documentation references

The scanner matches plain string occurrences — including inside comments and docs. If you have a file that legitimately documents the deny-list (e.g. an alternate impl of the same check, or a "why this is banned" comment), exclude it with `--ignore-file <basename>` or a CI workflow filter.

## License

Apache-2.0.
