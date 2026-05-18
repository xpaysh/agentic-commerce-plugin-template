'use strict';

/**
 * @xpaysh/conformance-fixtures
 *
 * Golden request/response payloads for ACP, UCP, AP2. Plugin CIs load
 * these and assert their adapter implementations produce/accept the
 * documented shapes.
 *
 * Each fixture file is a self-describing JSON document with a `_meta`
 * envelope (protocol, spec_version, operation, source) plus `headers`
 * and `body`. Fixtures are versioned alongside the upstream spec they
 * were lifted from.
 *
 * Zero runtime deps.
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

/**
 * Load a single fixture by relative path under the fixtures directory.
 * Returns the parsed JSON; throws on read or parse errors.
 */
function loadFixture(relativePath) {
  const full = path.join(FIXTURES_DIR, relativePath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

/**
 * List all fixture files for a given protocol (`acp` | `ucp` | `ap2`).
 * Returns filenames sorted lexicographically. Excludes README.md.
 */
function listFixtures(protocol) {
  const dir = path.join(FIXTURES_DIR, protocol);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

/**
 * Load every fixture for a protocol as an array of {filename, fixture} pairs.
 */
function loadAllFixtures(protocol) {
  return listFixtures(protocol).map((filename) => ({
    filename,
    fixture: loadFixture(path.join(protocol, filename)),
  }));
}

/** Convenience: ACP fixtures keyed by short name (filename without extension). */
function acpFixturesByName() {
  const out = {};
  for (const { filename, fixture } of loadAllFixtures('acp')) {
    const name = filename.replace(/\.json$/, '');
    out[name] = fixture;
  }
  return out;
}

module.exports = {
  FIXTURES_DIR,
  loadFixture,
  listFixtures,
  loadAllFixtures,
  acpFixturesByName,
};
