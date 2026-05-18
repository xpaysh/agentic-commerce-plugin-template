'use strict';

/**
 * @xpaysh/lint-wellknowns
 *
 * Fail-the-build linter that enforces the real-standards-only design
 * principle of the agentic-commerce-for-<platform> plugin family.
 *
 * The plugin family commits to emitting ONLY discovery files / URIs that
 * trace to a published spec or RFC. This module exposes the canonical
 * deny-list and a scanner that walks source trees + a probe that walks
 * a running storefront.
 *
 * Authoritative reference: the plan in
 *   docs/may-16/opensource-agentic-commerce-repos-plan.md (Section
 *   "Real discovery standards only").
 */

const fs = require('fs');
const path = require('path');

/**
 * Fictitious / banned paths.
 *
 * Each entry pairs the path with a `note` so reviewers and contributors
 * can see WHY it's banned, not just THAT it's banned. Notes are surfaced
 * in lint output and in the GitHub Actions error annotation.
 */
const FICTITIOUS_PATHS = Object.freeze([
  {
    path: '/.well-known/agentic-commerce.json',
    note: 'Not a standard. ACP does not define a discovery file; capability negotiation happens per-session inside POST /checkout_sessions.',
  },
  {
    path: '/.well-known/ucp.json',
    note: 'Wrong filename. The real UCP discovery path is "/.well-known/ucp" (no extension), per ucp.dev specification.',
  },
  {
    path: '/.well-known/acp.json',
    note: 'Not a standard. ACP has no well-known discovery file.',
  },
  {
    path: '/.well-known/ap2.json',
    note: 'Not a standard. AP2 uses A2A message envelopes, not a well-known manifest.',
  },
  {
    path: '/.well-known/mcp.json',
    note: 'Not a standard. MCP servers advertise via their own endpoint URL, not a well-known file.',
  },
  {
    path: '/.well-known/ai-plugin.json',
    note: 'Deprecated. OpenAI retired the ChatGPT plugin manifest format with the move to GPTs / Apps SDK.',
  },
  {
    path: '/agents.txt',
    note: 'Not a standard. No RFC or IANA registration. Use /llms.txt (llmstxt.org) for agent-readable site context.',
  },
  {
    path: '/ai.txt',
    note: 'Not a standard. No RFC or IANA registration.',
  },
]);

/**
 * Allow-list (real standards). Surfaced so the lint output can
 * differentiate "you emitted a fictitious file" from "you emitted a
 * real file under a wrong path."
 */
const REAL_PATHS = Object.freeze([
  { path: '/llms.txt', spec: 'llmstxt.org' },
  { path: '/robots.txt', spec: 'RFC 9309' },
  { path: '/.well-known/ucp', spec: 'ucp.dev / Google UCP profile guide' },
  { path: '/.well-known/agent-card.json', spec: 'A2A 1.0 (IANA-registered 2025-08-01)' },
  { path: '/.well-known/oauth-protected-resource', spec: 'RFC 9728' },
]);

/** Build alternation regex from the deny-list paths (escaped). */
function buildDenyRegex() {
  const escaped = FICTITIOUS_PATHS.map((entry) =>
    entry.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

/**
 * Default extensions and ignore-globs the file scanner walks.
 * Conservative — includes source code and config but skips lock files,
 * node_modules, build outputs.
 */
const DEFAULT_SCAN_EXTENSIONS = Object.freeze([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.php', '.go', '.rs', '.java',
  '.yml', '.yaml', '.toml', '.json',
  '.md', '.mdx',
  '.html', '.htm',
  '.sh', '.bash',
]);

const DEFAULT_IGNORE_DIRS = Object.freeze([
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo',
  'coverage', '.cache', '__pycache__', 'venv', '.venv',
  'vendor', 'target',
]);

/**
 * Scan a directory recursively for source-tree occurrences of any
 * fictitious well-known path. Self-references (this very package's own
 * `FICTITIOUS_PATHS` array, README documentation of the deny-list) are
 * filtered via the `ignorePackages` set.
 *
 * @param {object} options
 * @param {string} options.rootDir - Absolute path to scan.
 * @param {string[]=} options.extensions - File extensions to inspect.
 * @param {string[]=} options.ignoreDirs - Directory basenames to skip.
 * @param {string[]=} options.ignoreFiles - File basenames to skip (relative paths also OK).
 * @returns {{findings: Array<{file:string,line:number,column:number,match:string,note:string}>, scannedFileCount: number}}
 */
function scanDirectory({ rootDir, extensions, ignoreDirs, ignoreFiles } = {}) {
  if (!rootDir) throw new Error('scanDirectory: rootDir is required');
  const exts = new Set(extensions || DEFAULT_SCAN_EXTENSIONS);
  const skipDirs = new Set(ignoreDirs || DEFAULT_IGNORE_DIRS);
  const skipFiles = new Set(ignoreFiles || []);
  const findings = [];
  let scannedFileCount = 0;
  const denyRegex = buildDenyRegex();
  const noteByPath = new Map(FICTITIOUS_PATHS.map((e) => [e.path, e.note]));

  walk(rootDir);

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        if (skipFiles.has(entry.name)) continue;
        const ext = path.extname(entry.name);
        if (!exts.has(ext)) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(rootDir, full);
        if (skipFiles.has(rel)) continue;
        scannedFileCount += 1;
        let content;
        try {
          content = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          let m;
          denyRegex.lastIndex = 0;
          while ((m = denyRegex.exec(lines[i])) !== null) {
            findings.push({
              file: rel,
              line: i + 1,
              column: m.index + 1,
              match: m[1],
              note: noteByPath.get(m[1]) || '',
            });
          }
        }
      }
    }
  }

  return { findings, scannedFileCount };
}

/**
 * Probe a running storefront — HEAD/GET each fictitious path on the base
 * URL and flag any that respond 2xx. Returns the findings array so the
 * caller can format/exit-code as desired.
 *
 * Uses the global `fetch` (Node 18+). No external deps.
 *
 * @param {object} options
 * @param {string} options.baseUrl - Origin to probe, e.g. https://shop.example.com
 * @param {number=} options.timeoutMs - Per-request timeout. Default 5000.
 * @returns {Promise<Array<{path:string,status:number,note:string}>>}
 */
async function probeStorefront({ baseUrl, timeoutMs = 5000 } = {}) {
  if (!baseUrl) throw new Error('probeStorefront: baseUrl is required');
  if (typeof fetch !== 'function') {
    throw new Error('probeStorefront: global fetch is required (Node >= 18).');
  }
  const origin = baseUrl.replace(/\/+$/, '');
  const findings = [];
  for (const entry of FICTITIOUS_PATHS) {
    const url = origin + entry.path;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: controller.signal });
      if (res.status >= 200 && res.status < 300) {
        findings.push({ path: entry.path, status: res.status, note: entry.note });
      }
    } catch {
      // network errors / aborts are not findings; treated as "not emitted"
    } finally {
      clearTimeout(t);
    }
  }
  return findings;
}

/**
 * Format scan findings as GitHub Actions workflow-command annotations
 * (one `::error file=...,line=...,col=...::message` per finding). When
 * emitted to stdout from inside a workflow run, GitHub renders inline
 * code-annotations on the PR diff.
 */
function formatGitHubAnnotations(findings) {
  return findings
    .map(
      (f) =>
        `::error file=${f.file},line=${f.line},col=${f.column}::Fictitious well-known URI emitted: ${f.match} — ${f.note}`,
    )
    .join('\n');
}

module.exports = {
  FICTITIOUS_PATHS,
  REAL_PATHS,
  buildDenyRegex,
  scanDirectory,
  probeStorefront,
  formatGitHubAnnotations,
};
