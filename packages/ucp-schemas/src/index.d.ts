/**
 * @xpaysh/ucp-schemas — Universal Commerce Protocol schemas + business-profile
 * helper. Tracks Universal-Commerce-Protocol/ucp at SPEC_VERSION.
 */

export declare const SPEC_VERSION: '2026-04-08';
export declare const SPEC_URL: 'https://github.com/Universal-Commerce-Protocol/ucp';
export declare const SPEC_OPENAPI_PATH: string;
export declare const SPEC_SCHEMAS_PATH: string;

/**
 * The canonical well-known URI for the UCP business profile. **No file
 * extension**.
 */
export declare const UCP_PROFILE_PATH: '/.well-known/ucp';

export interface UcpCapability {
  version: string;
  spec: string;
  schema?: string;
  extends?: string;
  [key: string]: unknown;
}

export interface UcpService {
  version: string;
  spec: string;
  transport: 'rest' | 'mcp' | 'graphql' | string;
  endpoint: string;
  schema?: string;
  [key: string]: unknown;
}

export interface UcpJwk {
  kid: string;
  kty: 'EC' | 'RSA' | 'OKP' | string;
  use?: 'sig' | 'enc';
  alg?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface UcpProfile {
  ucp: {
    version: string;
    services: Record<string, UcpService[]>;
    capabilities: Record<string, UcpCapability[]>;
    payment_handlers?: Record<string, object[]>;
  };
  signing_keys: UcpJwk[];
}

export interface GenerateUcpProfileOptions {
  /** Base URL of the UCP shopping service. */
  endpoint: string;
  /** Spec revision to advertise. Defaults to SPEC_VERSION. */
  version?: string;
  /** Override the default capability map. */
  capabilities?: Record<string, UcpCapability[]>;
  /** Map of payment-handler id → handler-config array. */
  paymentHandlers?: Record<string, object[]>;
  /** JWK array for verifying messages from the server. */
  signingKeys?: UcpJwk[];
  /** Additional `services` entries merged in. */
  extraServices?: Record<string, UcpService[]>;
}

/**
 * Generate a UCP business profile body for `/.well-known/ucp`.
 */
export declare function generateUcpProfile(opts: GenerateUcpProfileOptions): UcpProfile;

/** Default capability map advertised by the xpay plugin family. */
export declare const DEFAULT_CAPABILITIES: Readonly<Record<string, UcpCapability[]>>;

/** Placeholder schema registry. Populated in later 0.1.x releases. */
export declare const schemas: Readonly<Record<string, object>>;

/** Resolve a JSON Schema by name. */
export declare function getSchema(name: string): object | undefined;
