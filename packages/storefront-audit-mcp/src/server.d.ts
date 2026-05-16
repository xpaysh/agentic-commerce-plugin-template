/**
 * @xpaysh/storefront-audit-mcp — MCP server wrapping @xpaysh/storefront-audit.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface CreateServerOptions {
  /** Default per-HTTP-request timeout (ms) inside the audit. Default 10000. */
  defaultTimeoutMs?: number;
}

/** Build a configured MCP server. Does not connect to a transport. */
export declare function createServer(opts?: CreateServerOptions): Server;

/** Connect a server to the stdio transport and start serving. */
export declare function start(server: Server): Promise<void>;

/** The single tool exposed by this server: `audit_storefront`. */
export declare const TOOL_NAME: 'audit_storefront';
