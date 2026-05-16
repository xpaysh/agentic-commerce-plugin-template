# Storefront Audit — GitHub Action

Reusable composite Action that runs [`@xpaysh/storefront-audit`](https://www.npmjs.com/package/@xpaysh/storefront-audit) against a storefront URL in CI and fails the workflow on any discovery-layer regression.

## Usage

```yaml
# .github/workflows/audit.yml
name: Storefront audit
on:
  pull_request:
  schedule:
    - cron: '0 6 * * *'   # daily 06:00 UTC

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: xpaysh/agentic-commerce-plugin-template/.github/actions/storefront-audit@main
        with:
          url: https://store.example/
          # Optional:
          # product-url: https://store.example/product/dyneema-pack/
          # checks: discovery.llms_txt,discovery.ucp_profile
          # fail-on: any-fail        # any-fail (default) | warn | never
          # timeout: '10000'
          # version: '0.1.0'         # or 'latest'
          # node-version: '20'
          # report-path: ./audit.json
```

The Action:

- Installs Node, runs `npx @xpaysh/storefront-audit@<version> <url> --json`.
- Writes a JSON report to `${{ inputs.report-path }}` (defaults to `${RUNNER_TEMP}/storefront-audit-report.json`).
- Renders a Markdown summary to the GitHub Actions step summary panel.
- Uploads the JSON as a workflow artifact (`storefront-audit-report`).
- Fails the workflow per the `fail-on` policy.

## Inputs

| Input | Required | Default | Notes |
|---|---|---|---|
| `url` | ✅ | — | Storefront URL to audit. |
| `product-url` | | `''` | Explicit PDP URL for the schema.org check. Skips sitemap auto-discovery. |
| `checks` | | `''` | Subset of check IDs (`discovery.llms_txt,discovery.ucp_profile,…`). |
| `fail-on` | | `any-fail` | `any-fail` / `warn` / `never`. `any-fail` exits 1 if any fail-severity check failed. `warn` exits 1 unless verdict is `pass`. |
| `timeout` | | `10000` | Per-request timeout in ms. |
| `version` | | `latest` | npm version range for `@xpaysh/storefront-audit`. |
| `node-version` | | `20` | Node.js version for the audit run. |
| `report-path` | | `${RUNNER_TEMP}/storefront-audit-report.json` | Where to write the JSON report. |

## Outputs

| Output | Type | Notes |
|---|---|---|
| `verdict` | string | `pass` / `warn` / `fail` |
| `pass-count` | string (integer) | |
| `warn-count` | string (integer) | |
| `fail-count` | string (integer) | |
| `skip-count` | string (integer) | |
| `report-path` | string | Path to the JSON report file. |

## Example — fail PRs that regress audit; warn on stricter changes

```yaml
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - id: audit
        uses: xpaysh/agentic-commerce-plugin-template/.github/actions/storefront-audit@main
        with:
          url: ${{ vars.STAGING_URL }}
          fail-on: any-fail
      - name: Comment on PR
        if: steps.audit.outputs.verdict != 'pass' && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `Storefront audit verdict: \`${{ steps.audit.outputs.verdict }}\` (pass ${{ steps.audit.outputs.pass-count }} · warn ${{ steps.audit.outputs.warn-count }} · fail ${{ steps.audit.outputs.fail-count }}).`
            });
```

## Versioning

This Action is hosted inside the `agentic-commerce-plugin-template` monorepo. To pin a specific revision, reference a tag or commit:

```yaml
- uses: xpaysh/agentic-commerce-plugin-template/.github/actions/storefront-audit@v0.1.0   # once tagged
- uses: xpaysh/agentic-commerce-plugin-template/.github/actions/storefront-audit@<sha>
```

## License

Apache-2.0.
