# @xpaysh/storefront-audit

Discovery-layer conformance + readiness auditor for agentic-commerce storefronts. Library + CLI (`ac-doctor`). Apache-2.0. **Zero runtime deps.**

Checks any storefront URL — running an xpay plugin, a competitor's plugin, a hand-rolled implementation, or no plugin at all — for the real discovery standards every AI shopping agent expects:

| Check | Spec |
|---|---|
| `/llms.txt` served + has H1 | [llmstxt.org](https://llmstxt.org) |
| `/.well-known/ucp` served + ucp.{version, services, capabilities} + signing_keys | [ucp.dev](https://ucp.dev/latest/specification/overview/) |
| Product page emits schema.org `Product` + `Offer` + `BuyAction` JSON-LD | [schema.org/Product](https://schema.org/Product) |
| `robots.txt` doesn't block the 12 canonical AI user-agents | [RFC 9309](https://datatracker.ietf.org/doc/rfc9309/) |
| No fictitious well-known URIs served (`/.well-known/agentic-commerce.json`, `/agents.txt`, `/.well-known/ucp.json` (wrong filename), etc.) | project denylist |
| Optional: `/.well-known/agent-card.json` parses if served | [A2A 1.0](https://a2a-protocol.org/) |
| Optional: `/.well-known/oauth-protected-resource` parses if served | [RFC 9728](https://datatracker.ietf.org/doc/rfc9728/) |

## Install + use

```bash
# As a CLI (one-shot audit)
npx @xpaysh/storefront-audit https://store.example/

# Or globally
npm install -g @xpaysh/storefront-audit
ac-doctor https://store.example/

# As a library
npm install @xpaysh/storefront-audit
```

```ts
import { audit, renderMarkdown } from '@xpaysh/storefront-audit';

const report = await audit('https://store.example/', { timeoutMs: 5000 });

console.log(renderMarkdown(report));
if (report.summary.counts.fail > 0) process.exit(1);
```

## CLI

```
ac-doctor — discovery-layer conformance audit for agentic-commerce storefronts.

Usage:
  ac-doctor <url> [options]

Options:
  --json                       Emit JSON instead of Markdown summary.
  --checks=<id,id,...>         Subset of check IDs to run.
  --product-url=<url>          PDP URL for the schema.org check (skips auto-discovery).
  --timeout=<ms>               Per-request timeout (default 10000).
  --quiet                      Suppress Markdown output; only set exit code.

Exit codes:
  0  no fail-severity checks failed
  1  at least one fail-severity check failed
  2  invalid usage
```

### Example

```
$ ac-doctor https://acme.example/
# Storefront audit — https://acme.example/

**Verdict**: pass  ·  pass 5 / warn 0 / fail 0 / skip 0

- ✓ **Has /llms.txt** — /llms.txt served with H1 present
- ✓ **Has /.well-known/ucp (UCP business profile)** — Profile served (v2026-04-08, 6 capabilities, 1 signing key)
- ✓ **Does not emit fictitious well-known URIs** — All 8 fictitious paths return non-2xx
- ✓ **robots.txt does not block AI crawlers** — All 12 AI user-agents explicitly allowed
- ✓ **PDP emits schema.org Product JSON-LD** — Product JSON-LD complete (name + Offer with price/currency + BuyAction)
- · **A2A /.well-known/agent-card.json (watchlist)** — No /.well-known/agent-card.json served (watchlist — emit when A2A adoption matures)
- · **RFC 9728 /.well-known/oauth-protected-resource (optional)** — No /.well-known/oauth-protected-resource (optional — emit when UCP OAuth Identity Linking is enabled)

Run with `--json` for full details. Spec references in JSON output.
```

## Programmatic API

```ts
import { audit, AuditOptions, AuditReport } from '@xpaysh/storefront-audit';

interface AuditOptions {
  checks?: string[];        // subset by id (e.g. ['discovery.llms_txt'])
  productUrl?: string;      // explicit PDP for schema.org check (else auto-discovers via sitemap)
  timeoutMs?: number;       // default 10000
  userAgent?: string;       // override the HTTP User-Agent
}

interface AuditReport {
  siteUrl: string;
  auditedAt: string;        // ISO 8601
  auditorVersion: string;   // package version
  results: CheckResult[];
  summary: { verdict: 'pass' | 'warn' | 'fail'; counts: { pass, warn, fail, skip, info } };
}
```

Each `CheckResult` has `id`, `name`, `spec` (URL), `severity` (`fail` | `warn` | `info`), `status` (`pass` | `fail` | `warn` | `skip`), `message`, `url` (what was fetched), and an optional `details` object with the check-specific payload (parsed profile, blocked UA list, etc.).

## What v0.1 covers vs. what's coming

v0.1 is **discovery-layer only** — pure HTTP, anonymous. No auth required to audit any storefront.

| Phase | Surface | Adds |
|---|---|---|
| **v0.1** (this) | Library + CLI | All discovery checks above. |
| **v0.2** | + GitHub Action | Reusable Action `xpaysh/storefront-audit-action`; sibling plugins in the `agentic-commerce-for-*` family run it in CI. Replaces what was once scoped as `lint-no-fictitious-wellknowns`. |
| **v0.3** | + Protocol checks | RFC 9421 signature verification, ACP capability negotiation conformance, AP2 mandate acceptance smoke tests. Some need test credentials. |
| **v0.4** | + Commerce checks | Cart-deeplink mint + checkout-landing verification, catalog-feed freshness, inventory-sync probe. May need an API key (commercial-tier merchants). |
| **v1.0** | + Hosted endpoint + MCP server | `audit.xpay.sh/check?url=...` returns a JSON report card + embeddable Markdown/SVG badge. MCP wrapper exposes the audit to Claude / Cursor / etc. as a callable tool. |

The v0.1 scope is deliberate: every check runs against any URL without auth, which makes the package useful for (a) plugin authors validating their work, (b) merchants checking themselves, (c) anyone surveying competitors' agent-readiness.

## Project denylist of fictitious well-knowns

Maintained in lockstep with `/Users/sri/Documents/Dev/opensource-xp/docs/may-16/standards-and-extensibility-guide.md` §1.4. Current denylist (any of these returning 2xx fails the audit):

- `/.well-known/agentic-commerce.json` — fictitious
- `/.well-known/ucp.json` — wrong filename (real path is `/.well-known/ucp`, no extension)
- `/.well-known/acp.json` — not in ACP spec
- `/.well-known/ap2.json` — not in AP2 spec
- `/.well-known/mcp.json` — not standardized
- `/.well-known/ai-plugin.json` — deprecated (was OpenAI ChatGPT Plugins 2023)
- `/agents.txt` — fictitious (sometimes confused with `llms.txt`)
- `/ai.txt` — fragmented proposals, no IANA registration

If a new fictitious URI is identified, update both this package's denylist (`src/checks/no-fictitious-wellknowns.js`) and the standards guide. The two MUST stay in sync.

## When this package fails vs. warns

- **`fail`** — a real standard is missing, broken, or a fictitious URI is being served. Will set CLI exit code 1.
- **`warn`** — discoverable but incomplete (e.g., UCP profile served but `signing_keys[]` empty; product JSON-LD without `BuyAction`).
- **`info`** — informational only (watchlist standard not yet emitted).
- **`skip`** — a check couldn't run (e.g., no PDP discoverable; pass `--product-url=` to run it explicitly).

The exit code only flips for `fail` × `fail`. Warnings and skips don't break CI but show up in the report.

## See also

- [`@xpaysh/discovery`](https://www.npmjs.com/package/@xpaysh/discovery) — the generators this auditor validates against
- [`@xpaysh/ucp-schemas`](https://www.npmjs.com/package/@xpaysh/ucp-schemas) — UCP profile generator + types
- [`xpaysh/agentic-commerce-plugin-template`](https://github.com/xpaysh/agentic-commerce-plugin-template) — the family monorepo
- [Standards & extensibility guide](https://github.com/xpaysh/opensource-xp/blob/main/docs/may-16/standards-and-extensibility-guide.md) — what's real, what isn't, where extension points live

## License

Apache-2.0.
