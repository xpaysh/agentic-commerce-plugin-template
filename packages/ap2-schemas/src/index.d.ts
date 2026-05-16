/**
 * @xpaysh/ap2-schemas — JSON Schemas for the Agent Payments Protocol.
 *
 * v0.0.x reserves the npm namespace and establishes the package shape.
 * Schema content lands in v0.1.0 from google-agentic-commerce/AP2.
 */

export declare const SPEC_VERSION: 'draft' | string;
export declare const SPEC_URL: 'https://github.com/google-agentic-commerce/AP2';

/**
 * Placeholder schema registry. Keyed by upstream schema name.
 * Empty in v0.0.x; populated in v0.1.0+.
 */
export declare const schemas: Readonly<Record<string, object>>;

/**
 * Resolve a schema by name. Returns `undefined` if the schema isn't
 * registered (always undefined in v0.0.x).
 */
export declare function getSchema(name: string): object | undefined;
