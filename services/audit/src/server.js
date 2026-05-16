#!/usr/bin/env node
'use strict';

/**
 * Bare-Node http server entry. Wraps src/handler.js for local dev and
 * Docker / Fly / generic-VPS deployments. For Vercel, use `vercel.js`. For
 * AWS Lambda, use `lambda.js`. Same handler under the hood.
 */

const http = require('http');
const { URL } = require('url');
const { handleRequest } = require('./handler');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async function (req, res) {
  try {
    const u = new URL(req.url, 'http://placeholder.local/');
    const query = {};
    u.searchParams.forEach(function (v, k) { query[k] = v; });
    const out = await handleRequest({ method: req.method, path: u.pathname, query });
    res.writeHead(out.status, out.headers);
    res.end(out.body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal: ' + ((err && err.message) || 'unknown') }));
  }
});

server.listen(PORT, HOST, function () {
  console.log('audit.xpay.sh handler listening on http://' + HOST + ':' + PORT);
});
