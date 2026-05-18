/**
 * @xpaysh/acp-schemas — JSON Schemas for the Agentic Commerce Protocol.
 *
 * Vendored from the upstream Apache-2.0 spec at
 * agentic-commerce-protocol/agentic-commerce-protocol, pinned to
 * SPEC_VERSION below.
 */

export type AcpBundleName =
  | 'agentic_checkout'
  | 'cart'
  | 'delegate_authentication'
  | 'delegate_payment'
  | 'discount'
  | 'extension'
  | 'feed';

export declare const SPEC_VERSION: '2026-04-17';
export declare const SPEC_URL: 'https://github.com/agentic-commerce-protocol/agentic-commerce-protocol';
export declare const SPEC_OPENAPI_PATH: string;
export declare const SPEC_JSON_SCHEMA_PATH: string;
export declare const SCHEMAS_DIR: string;

export declare const schemas: Readonly<Record<AcpBundleName, object>>;

export declare function getSchema(name: AcpBundleName | string): object | undefined;
export declare function getDef(bundle: AcpBundleName | string, def: string): object | undefined;
export declare function listDefs(): Array<{ bundle: string; def: string }>;
