# @xpaysh/storefront-audit-mcp

[Model Context Protocol](https://modelcontextprotocol.io) server that exposes [`@xpaysh/storefront-audit`](https://www.npmjs.com/package/@xpaysh/storefront-audit)'s `audit()` function as a tool callable from Claude Desktop, Cursor, Continue, MCP Inspector, or any MCP-capable agent.

One tool: `audit_storefront(url, [product_url], [checks], [timeout_ms])`. Returns a Markdown summary + the structured JSON report.

## Install + run

### Claude Desktop

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json   (macOS)
// %APPDATA%\Claude\claude_desktop_config.json                       (Windows)
{
  "mcpServers": {
    "xpay-storefront-audit": {
      "command": "npx",
      "args": ["-y", "@xpaysh/storefront-audit-mcp"]
    }
  }
}
```

Restart Claude Desktop. The `audit_storefront` tool appears in the tool list. Try:

> Use audit_storefront to check https://example-store.com/ and tell me what's missing for AI shoppers.

### Cursor / Continue / other MCP-capable IDEs

Reference `npx -y @xpaysh/storefront-audit-mcp` as the MCP server command in your IDE's settings. Tool name: `audit_storefront`.

### MCP Inspector (debugging)

```bash
npx @modelcontextprotocol/inspector npx -y @xpaysh/storefront-audit-mcp
```

Then call `audit_storefront` from the Inspector UI.

### Programmatic (embedding in another MCP server)

```ts
import { createServer, start } from '@xpaysh/storefront-audit-mcp';

const server = createServer({ defaultTimeoutMs: 8000 });
await start(server);
```

## Tool input schema

```jsonc
{
  "name": "audit_storefront",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url":         { "type": "string", "description": "Storefront URL to audit (root)." },
      "product_url": { "type": "string", "description": "Optional PDP URL. Skips sitemap auto-discovery." },
      "checks":      { "type": "array",  "items": { "type": "string" }, "description": "Optional subset of check IDs." },
      "timeout_ms":  { "type": "number", "minimum": 1000, "maximum": 60000, "description": "Default 10000." }
    },
    "required": ["url"]
  }
}
```

## Output shape

The tool returns three content blocks:

1. **Markdown summary** — same format as `ac-doctor` prints. Easy for an LLM to read and reason over.
2. **JSON report in a code block** — the full structured report for agents that want to parse it directly.
3. **`structuredContent`** — the same JSON, attached via the MCP `structuredContent` field for clients that surface structured tool output.

## What gets audited

Same checks as `@xpaysh/storefront-audit@0.1`:

- `/llms.txt` served + has H1
- `/.well-known/ucp` served + parses + has signing keys
- schema.org Product + Offer + BuyAction JSON-LD on a PDP
- `robots.txt` doesn't block the 12 canonical AI user-agents
- No fictitious well-known URIs served (`/.well-known/agentic-commerce.json`, `/agents.txt`, `/ai.txt`, etc.)
- Optional A2A `/.well-known/agent-card.json`
- Optional RFC 9728 `/.well-known/oauth-protected-resource`

Pure HTTP; no auth needed; safe to run against any public URL.

## Why this exists

Agents that are building checkout integrations need a quick "is this storefront agent-ready?" signal. Running the audit inline — without spawning a shell or hitting a hosted endpoint — is the cleanest path. The tool's JSON output is structured enough for an agent to react (e.g. "store is missing UCP profile; show user the install link instead of trying to checkout").

## Versioning + compatibility

- This package's `version` follows the MCP server's API shape, not the audit's check list. Adding new checks to `@xpaysh/storefront-audit` doesn't bump this package; changing the tool name, input schema, or output shape does.
- `@xpaysh/storefront-audit` is pinned via `^0.1.0` — new checks land automatically; spec breakages bump major.
- `@modelcontextprotocol/sdk` is pinned via `^1.0.0`. Major-version bumps to the SDK will be tracked.

## License

Apache-2.0.
