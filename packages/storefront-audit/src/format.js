'use strict';

const STATUS_GLYPH = { pass: '✓', fail: '✗', warn: '!', skip: '·' };

/**
 * Render a Report as a single-screen Markdown summary suitable for terminal
 * output. Tight, scannable; full detail stays in the JSON output.
 *
 * @param {object} report
 * @returns {string}
 */
function renderMarkdown(report) {
  const lines = [];
  lines.push('# Storefront audit — ' + report.siteUrl);
  lines.push('');
  const c = report.summary.counts;
  lines.push('**Verdict**: ' + report.summary.verdict + '  ' +
             '·  pass ' + c.pass + ' / warn ' + c.warn + ' / fail ' + c.fail + ' / skip ' + c.skip);
  lines.push('');
  for (const r of report.results) {
    const glyph = STATUS_GLYPH[r.status] || '?';
    lines.push(`- ${glyph} **${r.name}** — ${r.message}`);
  }
  lines.push('');
  lines.push('Run with `--json` for full details. Spec references in JSON output.');
  return lines.join('\n');
}

/**
 * Compute the overall verdict: 'pass' if no fail-severity checks failed,
 * 'warn' if only warns/skips, 'fail' if any fail.
 */
function computeVerdict(results) {
  let pass = 0, warn = 0, fail = 0, skip = 0, info = 0;
  for (const r of results) {
    if (r.status === 'pass') pass++;
    else if (r.status === 'fail' && r.severity === 'fail') fail++;
    else if (r.status === 'warn' || (r.status === 'fail' && r.severity === 'warn')) warn++;
    else if (r.status === 'skip') skip++;
    if (r.severity === 'info') info++;
  }
  let verdict = 'pass';
  if (fail > 0) verdict = 'fail';
  else if (warn > 0) verdict = 'warn';
  return { verdict, counts: { pass, warn, fail, skip, info } };
}

module.exports = { renderMarkdown, computeVerdict };
