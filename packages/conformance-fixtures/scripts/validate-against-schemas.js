#!/usr/bin/env node
'use strict';

/**
 * Cross-validate every ACP + UCP fixture in this package against the
 * canonical JSON Schemas in @xpaysh/acp-schemas and @xpaysh/ucp-schemas.
 *
 * Each fixture declares its target schema URI in `_meta.validates_against`.
 * Exits non-zero on any mismatch.
 *
 * Requires `ajv` (peer dep — install in the consuming repo). The fixtures
 * package itself does not depend on ajv at runtime; this script is opt-in
 * tooling for repo-level CI.
 */

let Ajv;
try {
  Ajv = require('ajv/dist/2020');
} catch (err) {
  process.stderr.write(
    'validate-against-schemas: needs ajv installed (`npm i -D ajv`).\n',
  );
  process.exit(2);
}

const acp = require('@xpaysh/acp-schemas');
const ucp = require('@xpaysh/ucp-schemas');
const { listFixtures, loadFixture } = require('..');

const ajv = new Ajv({ strict: false, allErrors: true });

// ACP — register bundles under the `schema.<bundle>.json` relative-URI form
// that the bundles use to cross-reference each other.
for (const [name, schema] of Object.entries(acp.schemas)) {
  ajv.addSchema(schema, `schema.${name}.json`);
}

// UCP — register every schema under all the URIs other schemas might
// $ref it (canonical ucp.dev URI, double-prefixed alias, file-relative).
ucp.registerForValidation(ajv);

let fails = 0;
let checked = 0;
const protocols = ['acp', 'ucp'];

for (const protocol of protocols) {
  for (const filename of listFixtures(protocol)) {
    const rel = `${protocol}/${filename}`;
    const fixture = loadFixture(rel);
    const target = fixture._meta && fixture._meta.validates_against;
    if (!target) {
      process.stdout.write(`- ${rel} (no _meta.validates_against, skipped)\n`);
      continue;
    }
    const validate = ajv.getSchema(target);
    if (!validate) {
      process.stdout.write(`✗ ${rel} — could not resolve ${target}\n`);
      fails += 1;
      continue;
    }
    const ok = validate(fixture.body);
    checked += 1;
    if (ok) {
      process.stdout.write(`✓ ${rel}\n`);
    } else {
      process.stdout.write(`✗ ${rel}\n`);
      process.stdout.write(`   ${JSON.stringify(validate.errors).slice(0, 500)}\n`);
      fails += 1;
    }
  }
}

process.stdout.write(
  fails === 0
    ? `\nAll ${checked} fixtures validate against their canonical schemas.\n`
    : `\n${fails} of ${checked} fixture(s) failed validation.\n`,
);
process.exit(fails === 0 ? 0 : 1);
