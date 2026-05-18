#!/usr/bin/env node
'use strict';

/**
 * Cross-validate every ACP fixture in this package against the canonical
 * JSON Schemas in @xpaysh/acp-schemas. Each fixture declares its target
 * type in `_meta.validates_against`. Exits non-zero on any mismatch.
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

const { schemas } = require('@xpaysh/acp-schemas');
const { listFixtures, loadFixture } = require('..');

const ajv = new Ajv({ strict: false, allErrors: true });
for (const [name, schema] of Object.entries(schemas)) {
  ajv.addSchema(schema, `schema.${name}.json`);
}

let fails = 0;
let checked = 0;
for (const filename of listFixtures('acp')) {
  const fixture = loadFixture(`acp/${filename}`);
  const target = fixture._meta && fixture._meta.validates_against;
  if (!target) {
    process.stdout.write(`- acp/${filename} (no _meta.validates_against, skipped)\n`);
    continue;
  }
  const validate = ajv.getSchema(target);
  if (!validate) {
    process.stdout.write(`✗ acp/${filename} — could not resolve ${target}\n`);
    fails += 1;
    continue;
  }
  const ok = validate(fixture.body);
  checked += 1;
  if (ok) {
    process.stdout.write(`✓ acp/${filename}\n`);
  } else {
    process.stdout.write(`✗ acp/${filename}\n`);
    process.stdout.write(`   ${JSON.stringify(validate.errors).slice(0, 400)}\n`);
    fails += 1;
  }
}

process.stdout.write(
  fails === 0
    ? `\nAll ${checked} ACP fixtures validate against @xpaysh/acp-schemas.\n`
    : `\n${fails} fixture(s) failed validation.\n`,
);
process.exit(fails === 0 ? 0 : 1);
