'use strict';

/**
 * AWS Lambda adapter (Function URL or API Gateway HTTP API v2 payload).
 */

const { handleRequest } = require('./handler');

exports.handler = async function (event) {
  const method = event.requestContext && event.requestContext.http && event.requestContext.http.method
    || event.httpMethod
    || 'GET';
  const path = event.rawPath || event.path || '/';
  const query = event.queryStringParameters || {};

  try {
    const out = await handleRequest({ method, path, query });
    return {
      statusCode: out.status,
      headers: out.headers,
      body: out.body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'internal: ' + ((err && err.message) || 'unknown') }),
    };
  }
};
