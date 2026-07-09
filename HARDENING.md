<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.1

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `1`

Action **47ng--actions-clever-cloud/v2.1.1** was hardened automatically. 3 finding(s) were identified and resolved across 2 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses a Docker image referenced by a mutable tag (2.1.1) instead of an immutable SHA digest. The line `image: docker://ghcr.io/47ng/actions-clever-cloud:2.1.1` is vulnerable to supply-chain attacks because the tag can be silently overwritten to point to different (potentially malicious) image content.

Locations:

- `action.yml:57`

### script-injection (severity: high)

Multiple run: blocks directly interpolate ${{ }} expressions into shell commands (sub-rule a), allowing an attacker to inject arbitrary shell commands. Affected steps:
- main.yml 'Get Git SHA': `run: echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT`
- main.yml 'Get Docker tag': `ref="${{ github.ref_name }}"` — github.ref_name is attacker-controllable via branch names on push/release events
- main.yml 'Collect Docker labels & tags': multiple ${{ steps.*.outputs.* }}, ${{ github.repository }}, ${{ github.ref_name }}, ${{ github.run_id }} interpolated directly in run:
- main.yml 'Generate step summary': ${{ steps.docker-build-push.outputs.digest }}, ${{ steps.docker-labels-tags.outputs.tags/labels }} interpolated in run:
- pr-preview.yml 'Get PR head SHA': `run: echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`
- pr-preview.yml 'Get Docker tag': `run: echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`
- pr-preview.yml 'Collect Docker labels & tags': multiple ${{ }} expressions in run:
- pr-preview.yml 'Generate step summary': multiple ${{ steps.*.outputs.* }} in run:

Locations:

- `.github/workflows/main.yml:94`
- `.github/workflows/main.yml:98`
- `.github/workflows/main.yml:109`
- `.github/workflows/main.yml:133`
- `.github/workflows/pr-preview.yml:42`
- `.github/workflows/pr-preview.yml:46`
- `.github/workflows/pr-preview.yml:62`
- `.github/workflows/pr-preview.yml:97`

### github-env-injection (severity: high)

Multiple run: blocks write values derived from ${{ }} expressions (github context, steps outputs) directly to $GITHUB_OUTPUT without the required sanitization step (printf '%s' ... | tr -d '\n\r'). This allows newline injection into the output file, which can be exploited to set arbitrary environment variables or outputs.
- main.yml 'Get Git SHA': `echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT` — no sanitization
- main.yml 'Get Docker tag': ref set from ${{ github.ref_name }} then written to $GITHUB_OUTPUT — no sanitization
- main.yml 'Collect Docker labels & tags': multiple ${{ }} values written to $GITHUB_OUTPUT — no sanitization
- pr-preview.yml 'Get PR head SHA': `echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT` — no sanitization
- pr-preview.yml 'Get Docker tag': `echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT` — no sanitization
- pr-preview.yml 'Collect Docker labels & tags': multiple ${{ }} values written to $GITHUB_OUTPUT — no sanitization

Locations:

- `.github/workflows/main.yml:94`
- `.github/workflows/main.yml:98`
- `.github/workflows/main.yml:109`
- `.github/workflows/pr-preview.yml:42`
- `.github/workflows/pr-preview.yml:46`
- `.github/workflows/pr-preview.yml:62`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection, github-env-injection

**Notes:**

Fixed three security findings across three files:

1. action.yml: Pinned the Docker image from mutable tag ghcr.io/47ng/actions-clever-cloud:2.1.1 to immutable digest ghcr.io/47ng/actions-clever-cloud@sha256:c374d7bc5e669d01d1d76eaa17bc9645994825f5d3928b2accf1117a8b310029 # 2.1.1.

2. .github/workflows/main.yml: Fixed all script-injection and github-env-injection issues by moving every ${{ }} expression out of run: blocks into env: blocks, then referencing them as plain shell variables. Values written to $GITHUB_OUTPUT are sanitized with printf '%s' "$VAR" | tr -d '\n\r' before writing. Affected steps: Get Git SHA, Get Docker tag, Collect Docker labels & tags, Generate step summary.

3. .github/workflows/pr-preview.yml: Same fixes applied to Get PR head SHA, Get Docker tag, Collect Docker labels & tags, and Generate step summary steps. The comment job was already safe (used env: block with process.env in the script).

### Iteration 2

**Fixes applied:** github-env-injection

**Notes:**

Fixed the 'Compute Docker tags & labels' step in .github/workflows/pr-preview-manual.yml. Added sanitization for all five env vars (HEAD_SHA, PR_NUMBER, FORK, REPO, RUN_ID) using `printf '%s' "$VAR" | tr -d '\n\r'` before writing to $GITHUB_OUTPUT via the heredoc block. The sanitized local variables are then used in the heredoc instead of the raw env vars, preventing newline injection attacks that could poison GITHUB_OUTPUT. This matches the correct pattern already used in main.yml and pr-preview.yml.

