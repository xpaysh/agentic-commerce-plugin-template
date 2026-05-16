'use strict';

/**
 * Vercel adapter. Place under `api/[[...path]].js` in a Vercel project or
 * import directly from `services/audit/src/vercel.js`.
 */

const { handleRequest } = require('./handler');

module.exports = async function (req, res) {
  try {
    const query = Object.assign({}, req.query || {});
    const out = await handleRequest({ method: req.method, path: req.url.split('?')[0], query });
    for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
    res.status(out.status).send(out.body);
  } catch (err) {
    res.status(500).json({ error: 'internal: ' + ((err && err.message) || 'unknown') });
  }
};
