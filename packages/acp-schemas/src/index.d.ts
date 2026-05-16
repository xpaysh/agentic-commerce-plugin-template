/**
 * @xpaysh/acp-schemas — JSON Schemas for the Agentic Commerce Protocol.
 *
 * v0.0.x reserves the npm namespace and establishes the package shape.
 * Schema content lands in v0.1.0 (pinned to SPEC_VERSION below) from
 * agentic-commerce-protocol/agentic-commerce-protocol.
 */

export declare const SPEC_VERSION: '2026-04-17';
export declare const SPEC_URL: 'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol';
export declare const SPEC_OPENAPI_PATH: string;
export declare const SPEC_JSON_SCHEMA_PATH: string;

/**
 * Placeholder schema registry. Keyed by upstream schema name.
 * Empty in v0.0.x; populated in v0.1.0+.
 */
export declare const schemas: Readonly<Record<string, object>>;

/**
 * Resolve a JSON Schema by name. Returns `undefined` if the schema isn't
 * registered (always undefined in v0.0.x).
 */
export declare function getSchema(name: string): object | undefined;
