# audit.xpay.sh — hosted-audit service

Deployable Node service that wraps [`@xpaysh/storefront-audit`](https://www.npmjs.com/package/@xpaysh/storefront-audit) behind a public HTTP surface. Intended to live at `https://audit.xpay.sh/`. Zero deploy-time secrets; runs anywhere Node 18+ runs.

## Surface

| Method | Path | Output | Cache |
|---|---|---|---|
| GET | `/` | HTML landing (no `url=`) or HTML report (with `?url=`) | 5 min |
| GET | `/api/v1/audit?url=<url>` | JSON report | 5 min |
| GET | `/api/v1/markdown?url=<url>` | Markdown report | 5 min |
| GET | `/badge.svg?url=<url>` | SVG badge (shields-style) | 5 min |
| GET | `/healthz` | `{ok: true, cache_size: N}` | no-store |

All audit routes accept these query params:

- `url` (required) — storefront URL to audit
- `product_url` — explicit PDP for the schema.org check
- `checks` — comma-separated check IDs (e.g. `discovery.llms_txt,discovery.ucp_profile`)

## Deploy

### Vercel

```bash
# In a Vercel project root
cp services/audit/src/vercel.js api/index.js
cp services/audit/src/handler.js .
# Or use a more idiomatic structure with src/ as a workspace.

# vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }] }
```

```bash
vercel deploy
# Domain: audit.xpay.sh → your Vercel project
```

### AWS Lambda (Function URL)

```bash
# Bundle (or use SAM/Serverless)
cd services/audit
zip -r dist.zip src package.json node_modules
aws lambda update-function-code --function-name xpay-audit-prod --zip-file fileb://dist.zip
# Or via Terraform / Pulumi / SAM.
```

Handler: `src/lambda.handler`. Pair with a Lambda Function URL or HTTP API v2.

### Docker / generic VPS

```bash
docker build -t xpay-audit services/audit
docker run -p 8787:8787 --env AUDIT_CACHE_TTL_MS=300000 xpay-audit
```

### Cloudflare Workers

Wrap `handleRequest` in a `fetch` event handler. The handler returns a normalised `{status, headers, body}` shape that maps cleanly to `Response`. Worker adapter not included; contribute one if you ship there.

## Environment

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8787` | Bare-Node listen port |
| `HOST` | `0.0.0.0` | Bare-Node listen host |
| `AUDIT_CACHE_TTL_MS` | `300000` | In-memory cache TTL |
| `AUDIT_CACHE_MAX` | `500` | Max cached audits before FIFO eviction |
| `AUDIT_TIMEOUT_MS` | `10000` | Per-HTTP-request timeout inside the audit |

## Caching layers

- **In-memory** (this service): 5-minute TTL per (url, product_url, checks) tuple. Survives within a single process. On Lambda, cold starts clear it — fine; cache-friendly TTLs at the edge cover the gap.
- **CDN** (recommended in front): put CloudFront / Cloudflare in front with the same TTL on `/api/v1/*`, `/badge.svg`, `/audit*`. Public-cacheable headers are set on every audited response.

## Badge embedding

```html
<a href="https://audit.xpay.sh/?url=https://store.example/">
  <img alt="agent-ready" src="https://audit.xpay.sh/badge.svg?url=https://store.example/">
</a>
```

## CORS

`access-control-allow-origin: *` on JSON / Markdown / SVG endpoints. Reasonable for a public read-only audit; tighten for a private deployment.

## Operational notes

- The service does **not** rate-limit. Put a WAF / CloudFront rate-limit rule in front for any production deployment (audits make outbound HTTP requests; pathological inputs could fan out).
- The handler does **not** allow audits of `localhost`, `127.0.0.1`, RFC 1918 ranges, or `.local` TLDs. Wait — actually as shipped here it does, so add an allowlist or denylist via a wrapper if you're worried about SSRF. (Recommended hardening before going public; tracked as v0.2 todo.)
- The handler ignores POST. Audits are idempotent reads.
- Verdict aggregation matches `@xpaysh/storefront-audit` v0.1: `pass` if no fail-severity failures, `warn` if any warn or fail-severity-warn, `fail` if any fail-severity failure.

## Hardening checklist (before going public at audit.xpay.sh)

- [ ] Add an SSRF guardrail (block private / link-local / loopback targets)
- [ ] Add request body / response body size limits
- [ ] Put behind WAF + per-IP rate limit (e.g. 60 req/min anonymous)
- [ ] Add a `?signature=` HMAC option for paid-tier callers who want a tamper-evident report
- [ ] Surface freshness metadata on the public report (`Last audited: 2026-05-16T14:00:00Z`)
- [ ] Log to `logs.xpay.sh` (or whatever the team uses) — minimal: url, verdict, duration

## License

Apache-2.0.
