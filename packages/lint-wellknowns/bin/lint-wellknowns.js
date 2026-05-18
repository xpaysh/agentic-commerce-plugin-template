#!/usr/bin/env node
'use strict';

/**
 * lint-wellknowns CLI
 *
 * Modes:
 *   lint-wellknowns scan [dir]                 # static scan of source tree (default: cwd)
 *   lint-wellknowns probe <baseUrl>            # HTTP probe of a running storefront
 *   lint-wellknowns list                       # print the deny-list + allow-list
 *
 * Flags:
 *   --github                Emit GitHub Actions workflow-command annotations.
 *   --json                  Emit JSON instead of human-readable text.
 *   --ignore-file <name>    Skip files with this basename (repeatable).
 *
 * Exit codes:
 *   0  no findings
 *   1  findings (CI should fail)
 *   2  invalid usage / runtime error
 */

const path = require('path');
const {
  FICTITIOUS_PATHS,
  REAL_PATHS,
  scanDirectory,
  probeStorefront,
  formatGitHubAnnotations,
} = require('../src/index.js');

function parseFlags(argv) {
  const flags = { github: false, json: false, ignoreFiles: [] };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--github') flags.github = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--ignore-file') flags.ignoreFiles.push(argv[++i]);
    else if (a === '--help' || a === '-h') flags.help = true;
    else positional.push(a);
  }
  return { flags, positional };
}

function printHelp() {
  process.stdout.write(
    [
      'Usage:',
      '  lint-wellknowns scan [dir]               Static-scan a source tree (default: cwd)',
      '  lint-wellknowns probe <baseUrl>          Probe a live storefront over HTTP',
      '  lint-wellknowns list                     Print deny-list + allow-list',
      '',
      'Flags:',
      '  --github         Emit GitHub Actions workflow-command annotations',
      '  --json           Emit JSON instead of text',
      '  --ignore-file F  Skip files named F (repeatable)',
      '',
    ].join('\n'),
  );
}

(async function main() {
  const { flags, positional } = parseFlags(process.argv.slice(2));
  const mode = positional[0];

  if (flags.help || !mode) {
    printHelp();
    process.exit(flags.help ? 0 : 2);
  }

  try {
    if (mode === 'list') {
      if (flags.json) {
        process.stdout.write(JSON.stringify({ fictitious: FICTITIOUS_PATHS, real: REAL_PATHS }, null, 2) + '\n');
      } else {
        process.stdout.write('Fictitious (BANNED):\n');
        for (const e of FICTITIOUS_PATHS) process.stdout.write(`  ${e.path}\n    ${e.note}\n`);
        process.stdout.write('\nReal (allowed):\n');
        for (const e of REAL_PATHS) process.stdout.write(`  ${e.path}   (${e.spec})\n`);
      }
      process.exit(0);
    }

    if (mode === 'scan') {
      const target = path.resolve(positional[1] || process.cwd());
      // The package's own source documents the deny-list intentionally;
      // skip it so the linter doesn't self-flag when run on this monorepo.
      const ignoreFiles = ['index.js', 'index.d.ts', 'README.md', 'lint-wellknowns.js', ...flags.ignoreFiles];
      const { findings, scannedFileCount } = scanDirectory({ rootDir: target, ignoreFiles });

      if (flags.json) {
        process.stdout.write(JSON.stringify({ findings, scannedFileCount }, null, 2) + '\n');
      } else if (flags.github) {
        if (findings.length > 0) process.stdout.write(formatGitHubAnnotations(findings) + '\n');
      } else {
        if (findings.length === 0) {
          process.stdout.write(`✓ no fictitious well-known URIs found (${scannedFileCount} files scanned)\n`);
        } else {
          process.stdout.write(`✗ ${findings.length} finding(s) across ${scannedFileCount} files:\n\n`);
          for (const f of findings) {
            process.stdout.write(`  ${f.file}:${f.line}:${f.column}  ${f.match}\n      ${f.note}\n`);
          }
        }
      }
      process.exit(findings.length === 0 ? 0 : 1);
    }

    if (mode === 'probe') {
      const baseUrl = positional[1];
      if (!baseUrl) {
        process.stderr.write('probe requires a baseUrl, e.g. lint-wellknowns probe https://shop.example.com\n');
        process.exit(2);
      }
      const findings = await probeStorefront({ baseUrl });
      if (flags.json) {
        process.stdout.write(JSON.stringify({ baseUrl, findings }, null, 2) + '\n');
      } else if (flags.github) {
        for (const f of findings) {
          process.stdout.write(`::error::${baseUrl}${f.path} responded ${f.status} — ${f.note}\n`);
        }
      } else {
        if (findings.length === 0) {
          process.stdout.write(`✓ ${baseUrl} does not emit any fictitious well-known URIs\n`);
        } else {
          process.stdout.write(`✗ ${baseUrl} emits ${findings.length} fictitious path(s):\n\n`);
          for (const f of findings) {
            process.stdout.write(`  ${f.path}   [${f.status}]\n      ${f.note}\n`);
          }
        }
      }
      process.exit(findings.length === 0 ? 0 : 1);
    }

    process.stderr.write(`unknown mode: ${mode}\n`);
    printHelp();
    process.exit(2);
  } catch (err) {
    process.stderr.write(`lint-wellknowns: ${err && err.message ? err.message : String(err)}\n`);
    process.exit(2);
  }
})();
