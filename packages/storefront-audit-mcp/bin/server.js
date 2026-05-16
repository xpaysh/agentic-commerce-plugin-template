#!/usr/bin/env node
'use strict';

const { createServer, start } = require('../src/server.js');

(async function main() {
  const server = createServer();
  await start(server);
})().catch(function (err) {
  console.error('[xpay-storefront-audit-mcp] fatal: ' + ((err && err.stack) || err));
  process.exit(1);
});
