'use strict';

/**
 * @xpaysh/storefront-audit-mcp — MCP server wrapping @xpaysh/storefront-audit.
 *
 * Exposes one tool: `audit_storefront(url, [product_url], [checks], [timeout_ms])`.
 * Stdio transport. Drop into Claude Desktop / Cursor / any MCP-capable agent.
 *
 * Programmatic entry (e.g. embedding in another MCP server):
 *
 *   const { createServer, start } = require('@xpaysh/storefront-audit-mcp');
 *   const server = createServer({ defaultTimeoutMs: 8000 });
 *   await start(server);   // connects to stdio
 *
 * Or just `npx @xpaysh/storefront-audit-mcp` — the bin entry handles startup.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const { audit, renderMarkdown } = require('@xpaysh/storefront-audit');
const pkg = require('../package.json');

const TOOL_NAME = 'audit_storefront';

function createServer(opts) {
  const defaultTimeoutMs = (opts && opts.defaultTimeoutMs) || 10000;

  const server = new Server(
    { name: pkg.name, version: pkg.version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async function () {
    return {
      tools: [
        {
          name: TOOL_NAME,
          description:
            'Audit any storefront URL for agentic-commerce / AI-shopper readiness. ' +
            'Checks /llms.txt, /.well-known/ucp (UCP business profile), schema.org Product JSON-LD ' +
            'on a PDP, robots.txt AI-crawler allowlist, A2A agent-card, RFC 9728 OAuth metadata, ' +
            'and rejects fictitious well-known URIs. Returns a Markdown summary plus the full JSON ' +
            'report. Pure HTTP; no auth needed; safe to run against any public URL.',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Storefront URL to audit (root of the site).',
              },
              product_url: {
                type: 'string',
                description: 'Optional PDP URL for the schema.org Product check. If omitted, the audit tries to discover one via /sitemap.xml.',
              },
              checks: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional subset of check IDs (e.g. ["discovery.llms_txt", "discovery.ucp_profile"]). Defaults to all built-in checks.',
              },
              timeout_ms: {
                type: 'number',
                description: 'Per-HTTP-request timeout in milliseconds. Default 10000.',
                minimum: 1000,
                maximum: 60000,
              },
            },
            required: ['url'],
            additionalProperties: false,
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async function (req) {
    if (!req.params || req.params.name !== TOOL_NAME) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'unknown tool: ' + (req.params && req.params.name) }],
      };
    }

    const args = req.params.arguments || {};
    if (typeof args.url !== 'string' || !args.url) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'audit_storefront: url (string) is required' }],
      };
    }

    let report;
    try {
      report = await audit(args.url, {
        productUrl: typeof args.product_url === 'string' && args.product_url ? args.product_url : undefined,
        checks: Array.isArray(args.checks) && args.checks.length > 0 ? args.checks : undefined,
        timeoutMs: typeof args.timeout_ms === 'number' ? args.timeout_ms : defaultTimeoutMs,
      });
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'audit failed: ' + ((err && err.message) || String(err)) }],
      };
    }

    const markdown = renderMarkdown(report);
    const json = JSON.stringify(report, null, 2);

    return {
      content: [
        { type: 'text', text: markdown },
        { type: 'text', text: '```json\n' + json + '\n```' },
      ],
      // Surface the structured report alongside the human-readable output so
      // agents that prefer JSON can parse without re-fetching.
      structuredContent: report,
    };
  });

  return server;
}

async function start(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

module.exports = { createServer, start, TOOL_NAME };
