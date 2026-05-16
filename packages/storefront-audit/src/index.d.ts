/**
 * @xpaysh/storefront-audit — discovery-layer auditor for agentic-commerce
 * storefronts.
 */

export type CheckSeverity = 'fail' | 'warn' | 'info';
export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  id: string;
  name: string;
  spec: string | null;
  severity: CheckSeverity;
  status: CheckStatus;
  message: string;
  url: string;
  details?: Record<string, unknown>;
}

export interface CheckDescriptor {
  id: string;
  run(siteUrl: string, opts?: AuditOptions): Promise<CheckResult>;
}

export interface AuditOptions {
  /** Subset of check IDs to run. Defaults to all built-in checks. */
  checks?: string[];
  /** Explicit PDP URL for the schema.org check (skips auto-discovery). */
  productUrl?: string;
  /** Per-request timeout in milliseconds. Default 10000. */
  timeoutMs?: number;
  /** Override the HTTP User-Agent string. */
  userAgent?: string;
}

export interface AuditSummary {
  verdict: 'pass' | 'warn' | 'fail';
  counts: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
    info: number;
  };
}

export interface AuditReport {
  siteUrl: string;
  auditedAt: string;
  auditorVersion: string;
  results: CheckResult[];
  summary: AuditSummary;
}

/** Run the audit against a storefront URL. */
export declare function audit(siteUrl: string, opts?: AuditOptions): Promise<AuditReport>;

/** All built-in checks (in display order). */
export declare const ALL_CHECKS: readonly CheckDescriptor[];

/** Render an AuditReport as a terse Markdown summary suitable for terminals. */
export declare function renderMarkdown(report: AuditReport): string;
