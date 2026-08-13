<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.1.0** was hardened automatically. 6 finding(s) were identified and resolved across 2 iteration(s).

## Findings Fixed

### script-injection (severity: high)

Multiple run: blocks in main.yml directly interpolate ${{ }} expressions inside shell commands (rule a), enabling script injection. Affected steps: 'Get Git SHA' uses `echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT`; 'Get Docker tag' uses `ref="${{ github.ref_name }}"` directly in shell; 'Collect Docker labels & tags' interpolates ${{ github.ref_name }}, ${{ steps.package.outputs.version }}, ${{ steps.sha.outputs.sha }}, ${{ github.repository }}, ${{ github.run_id }} directly in shell echo commands; 'Generate step summary' interpolates ${{ steps.docker-labels-tags.outputs.tags }} and ${{ steps.docker-labels-tags.outputs.labels }} directly in shell echo commands.

Locations:

- `.github/workflows/main.yml:75`
- `.github/workflows/main.yml:79`
- `.github/workflows/main.yml:100`
- `.github/workflows/main.yml:163`

### script-injection (severity: high)

Multiple run: blocks in pr-preview.yml directly interpolate ${{ }} expressions inside shell commands (rule a). This workflow uses pull_request_target which runs with write permissions and access to secrets, making this especially dangerous. Affected steps: 'Get PR head SHA' uses `echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`; 'Get Docker tag' uses `echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`; 'Validate inputs' uses `[[ ! "${{ steps.docker-tag.outputs.tag }}" =~ ^pr-[0-9]+$ ]]` and `echo "${{ steps.package.outputs.version }}"` in shell conditionals; 'Collect Docker labels & tags' interpolates multiple expressions directly in shell echo commands; 'Generate step summary' interpolates ${{ steps.docker-labels-tags.outputs.tags }} and ${{ steps.docker-labels-tags.outputs.labels }} directly in shell echo commands.

Locations:

- `.github/workflows/pr-preview.yml:60`
- `.github/workflows/pr-preview.yml:65`
- `.github/workflows/pr-preview.yml:70`
- `.github/workflows/pr-preview.yml:85`
- `.github/workflows/pr-preview.yml:100`
- `.github/workflows/pr-preview.yml:155`

### github-env-injection (severity: high)

Multiple run: blocks in main.yml write values derived from ${{ }} expressions (github context and steps outputs) directly to $GITHUB_OUTPUT without the required sanitization step (printf '%s' ... | tr -d '\n\r'). Affected steps: 'Get Git SHA': `echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT`; 'Collect Docker labels & tags': writes ${{ steps.package.outputs.version }}, ${{ steps.sha.outputs.sha }}, ${{ github.repository }}, ${{ github.run_id }}, ${{ github.ref_name }}, ${{ steps.docker-tag.outputs.tag }} directly to $GITHUB_OUTPUT without sanitization.

Locations:

- `.github/workflows/main.yml:75`
- `.github/workflows/main.yml:100`

### github-env-injection (severity: high)

Multiple run: blocks in pr-preview.yml write values derived from ${{ }} expressions directly to $GITHUB_OUTPUT without the required sanitization step (printf '%s' ... | tr -d '\n\r'). This workflow uses pull_request_target making injection especially dangerous. Affected steps: 'Get PR head SHA': `echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`; 'Get Docker tag': `echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`; 'Collect Docker labels & tags': writes ${{ steps.package.outputs.version }}, ${{ github.event.pull_request.number }}, ${{ steps.sha.outputs.sha }}, ${{ github.repository }}, ${{ github.run_id }}, ${{ steps.docker-tag.outputs.tag }} directly to $GITHUB_OUTPUT without sanitization.

Locations:

- `.github/workflows/pr-preview.yml:60`
- `.github/workflows/pr-preview.yml:65`
- `.github/workflows/pr-preview.yml:100`

### permissions (severity: medium)

missing-permissions: The workflow file main.yml has no top-level permissions: key, and none of its three jobs (lint, ci, cd) define a job-level permissions: block. Without explicit permissions, the workflow inherits the repository default token permissions which may be overly broad. Each job should declare the minimal permissions it requires.

Locations:

- `.github/workflows/main.yml:1`

### unpinned-uses (severity: high)

The action.yml Docker action references the image `docker://ghcr.io/47ng/actions-clever-cloud:2.1.0` using a mutable version tag (2.1.0) rather than an immutable SHA digest. A tag can be silently overwritten to point to a different (potentially malicious) image. The image reference should use a SHA digest, e.g. `docker://ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest> # 2.1.0`.

Locations:

- `action.yml:56`

## Iteration Notes

### Iteration 1

**Fixes applied:** script-injection, github-env-injection, permissions, unpinned-uses

**Notes:**

Fixed all 6 findings across 3 files:

1. action.yml: Pinned docker image ghcr.io/47ng/actions-clever-cloud:2.1.0 to immutable SHA digest sha256:4bec0a5a8d98b53e057aa732ffec7c5b9a43f6eb6a23102b146803bb883b90fb.

2. main.yml (script-injection + github-env-injection): Moved all ${{ }} expressions from run: blocks to env: blocks in 'Get Git SHA', 'Get Docker tag', 'Collect Docker labels & tags', and 'Generate step summary' steps. Added printf '%s' ... | tr -d '\n\r' sanitization for all values written to $GITHUB_OUTPUT.

3. main.yml (permissions): Added job-level permissions blocks to all three jobs: lint (contents: read), ci (contents: read), cd (contents: read, packages: write).

4. pr-preview.yml (script-injection + github-env-injection): Moved all ${{ }} expressions from run: blocks to env: blocks in 'Get PR head SHA', 'Get Docker tag', 'Validate inputs', 'Collect Docker labels & tags', and 'Generate step summary' steps. Added sanitization for all GITHUB_OUTPUT writes. The request-approval job already had permissions defined.

### Iteration 2

**Fixes applied:** github-env-injection

**Notes:**

Fixed github-env-injection in both .github/workflows/main.yml (line 109) and .github/workflows/pr-preview.yml (line 104). In the 'Collect Docker labels & tags' step of each file, all variables derived from github context (REPOSITORY, REF_NAME/PR_NUMBER, RUN_ID) and step outputs (PKG_VERSION, GIT_SHA, DOCKER_TAG) are now sanitized with `printf '%s' "$VAR" | tr -d '\n\r'` before being used in printf/echo statements that write to $GITHUB_OUTPUT. The sanitized safe_* variables are then used throughout the rest of the step instead of the raw environment variables.

