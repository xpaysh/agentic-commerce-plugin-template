import type { KeyObject } from 'node:crypto';

export type SupportedAlg = 'ed25519' | 'hmac-sha256';

export declare const SUPPORTED_ALGS: readonly SupportedAlg[];
export declare const COVERED_COMPONENTS: readonly ['@method', '@target-uri', 'content-digest', 'idempotency-key'];
export declare const DEFAULT_LABEL: 'sig1';

export declare function contentDigest(body: string | Buffer | null | undefined): string;

export interface BuildSignatureBaseOpts {
  method: string;
  url: string;
  headers: Record<string, string>;
  components: readonly string[];
  params: string;
}
export declare function buildSignatureBase(opts: BuildSignatureBaseOpts): string;

export interface SignRequestOpts {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | Buffer | null;
  keyId: string;
  alg: SupportedAlg;
  privateKey: KeyObject | Buffer | string;
  created?: number;
  components?: readonly string[];
  label?: string;
}
export interface SignRequestResult {
  Signature: string;
  'Signature-Input': string;
  'Content-Digest': string;
}
export declare function signRequest(opts: SignRequestOpts): SignRequestResult;

export type VerifyRequestSuccess = {
  ok: true;
  keyId: string;
  alg: string;
  created?: number;
  components: string[];
};
export type VerifyRequestFailure = { ok: false; reason: string };
export type VerifyRequestResult = VerifyRequestSuccess | VerifyRequestFailure;

export interface VerifyRequestOpts {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Buffer | null;
  keyResolver: (keyId: string, alg: string) => KeyObject | Buffer | string | null;
  now?: number;
  maxAgeSeconds?: number;
}
export declare function verifyRequest(opts: VerifyRequestOpts): VerifyRequestResult;

export interface ParsedSignatureInput {
  label: string;
  components: string[];
  params: string;
  created?: number;
  expires?: number;
  keyId: string;
  alg: string;
}
export declare function parseSignatureInput(value: string): ParsedSignatureInput | null;
