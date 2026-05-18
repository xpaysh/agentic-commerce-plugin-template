/**
 * @xpaysh/lint-wellknowns — CI linter for the agentic-commerce-for-*
 * plugin family. Enforces the real-standards-only design principle.
 */

export interface FictitiousPathEntry {
  readonly path: string;
  readonly note: string;
}

export interface RealPathEntry {
  readonly path: string;
  readonly spec: string;
}

export interface ScanFinding {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly match: string;
  readonly note: string;
}

export interface ScanResult {
  readonly findings: ScanFinding[];
  readonly scannedFileCount: number;
}

export interface ScanOptions {
  rootDir: string;
  extensions?: readonly string[];
  ignoreDirs?: readonly string[];
  ignoreFiles?: readonly string[];
}

export interface ProbeFinding {
  readonly path: string;
  readonly status: number;
  readonly note: string;
}

export interface ProbeOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export declare const FICTITIOUS_PATHS: readonly FictitiousPathEntry[];
export declare const REAL_PATHS: readonly RealPathEntry[];

export declare function buildDenyRegex(): RegExp;
export declare function scanDirectory(options: ScanOptions): ScanResult;
export declare function probeStorefront(options: ProbeOptions): Promise<ProbeFinding[]>;
export declare function formatGitHubAnnotations(findings: ScanFinding[]): string;
