#!/usr/bin/env node
'use strict';

const { audit, renderMarkdown } = require('../src/index.js');

const USAGE = `ac-doctor — discovery-layer conformance audit for agentic-commerce storefronts.

Usage:
  ac-doctor <url> [options]

Options:
  --json                       Emit JSON instead of Markdown summary.
  --checks=<id,id,...>         Subset of check IDs to run.
  --product-url=<url>          PDP URL for the schema.org check (skips auto-discovery).
  --timeout=<ms>               Per-request timeout (default 10000).
  --quiet                      Suppress Markdown output; only set exit code.
  -h, --help                   This help.

Exit codes:
  0  no fail-severity checks failed
  1  at least one fail-severity check failed
  2  invalid usage

Examples:
  ac-doctor https://store.example/
  ac-doctor https://store.example/ --json
  ac-doctor https://store.example/ --checks=discovery.llms_txt,discovery.ucp_profile
  ac-doctor https://store.example/ --product-url=https://store.example/product/dyneema-pack/`;

function parseArgs(argv) {
  const out = { url: null, json: false, checks: null, productUrl: null, timeoutMs: null, quiet: false, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { out.help = true; continue; }
    if (arg === '--json') { out.json = true; continue; }
    if (arg === '--quiet') { out.quiet = true; continue; }
    if (arg.startsWith('--checks=')) { out.checks = arg.slice('--checks='.length).split(',').map(function (s) { return s.trim(); }).filter(Boolean); continue; }
    if (arg.startsWith('--product-url=')) { out.productUrl = arg.slice('--product-url='.length); continue; }
    if (arg.startsWith('--timeout=')) { out.timeoutMs = parseInt(arg.slice('--timeout='.length), 10); continue; }
    if (arg.startsWith('-')) { return { error: 'unknown flag: ' + arg }; }
    if (!out.url) { out.url = arg; continue; }
    return { error: 'unexpected positional argument: ' + arg };
  }
  return out;
}

(async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help || (!parsed.url && !parsed.error)) {
    console.log(USAGE);
    process.exit(parsed.help ? 0 : 2);
  }
  if (parsed.error) {
    console.error('ac-doctor: ' + parsed.error);
    console.error('');
    console.error(USAGE);
    process.exit(2);
  }

  const report = await audit(parsed.url, {
    checks: parsed.checks || undefined,
    productUrl: parsed.productUrl || undefined,
    timeoutMs: parsed.timeoutMs || undefined,
  });

  if (parsed.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (!parsed.quiet) {
    process.stdout.write(renderMarkdown(report) + '\n');
  }

  process.exit(report.summary.counts.fail > 0 ? 1 : 0);
})().catch(function (err) {
  console.error('ac-doctor: unexpected error: ' + ((err && err.stack) || err));
  process.exit(1);
});
