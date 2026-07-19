<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.1

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.1.1** was hardened automatically. 3 finding(s) were identified and resolved across 2 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses `runs.image: docker://ghcr.io/47ng/actions-clever-cloud:2.1.1` — a mutable version tag rather than an immutable SHA digest. This is vulnerable to supply-chain attacks if the tag is moved to point to a different image. It should be pinned to a SHA digest, e.g. `image: ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`

Locations:

- `action.yml:57`

### script-injection (severity: high)

Sub-rule (a): Multiple `run:` blocks directly interpolate `${{ ... }}` GitHub Actions expressions inside shell command strings, allowing expression values to be parsed as shell code before the shell ever sees them.

In `.github/workflows/main.yml` (cd job):
- `run: echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT` — github.sha interpolated directly in shell (Get Git SHA step)
- `ref="${{ github.ref_name }}"` — github.ref_name interpolated directly in shell (Get Docker tag step)
- `echo "org.opencontainers.image.version=${{ steps.package.outputs.version }}"` and many other `${{ steps.*.outputs.* }}` and `${{ github.ref_name }}` interpolations in the Collect Docker labels & tags step
- `echo "${{ steps.docker-labels-tags.outputs.tags }}"` and `echo "${{ steps.docker-labels-tags.outputs.labels }}"` in the Generate step summary step

In `.github/workflows/pr-preview.yml` (build job):
- `run: echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT` — attacker-controlled PR head SHA interpolated directly in shell (Get PR head SHA step)
- `run: echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT` — PR number interpolated directly in shell (Get Docker tag step)
- Multiple `${{ steps.*.outputs.* }}` and `${{ github.event.pull_request.number }}` interpolations in the Collect Docker labels & tags step
- `${{ steps.docker-labels-tags.outputs.* }}` interpolations in the Generate step summary step

All these should be moved to `env:` blocks and referenced as `"$VAR"` in the shell.

Locations:

- `.github/workflows/main.yml:87`
- `.github/workflows/main.yml:92`
- `.github/workflows/main.yml:108`
- `.github/workflows/main.yml:131`
- `.github/workflows/pr-preview.yml:37`
- `.github/workflows/pr-preview.yml:41`
- `.github/workflows/pr-preview.yml:55`
- `.github/workflows/pr-preview.yml:80`

### github-env-injection (severity: high)

Multiple `run:` blocks write values derived from `github.*` context and `steps.*.outputs.*` directly to `$GITHUB_OUTPUT` without the required sanitization step (`printf '%s' ... | tr -d '\n\r'`). An attacker who can control these values (e.g. via a crafted branch name or PR) could inject newlines to poison the output file and set arbitrary environment variables or outputs for downstream steps.

In `.github/workflows/main.yml`:
- `echo "sha=${{ github.sha }}" >> $GITHUB_OUTPUT` (Get Git SHA step) — github.sha written unsanitized
- `echo "tag=$tag" >> $GITHUB_OUTPUT` where `$tag` is derived from `${{ github.ref_name }}` (Get Docker tag step) — attacker-controlled ref_name written unsanitized
- `echo "org.opencontainers.image.version=${{ steps.package.outputs.version }}" >> $GITHUB_OUTPUT` and other step output writes in Collect Docker labels & tags step

In `.github/workflows/pr-preview.yml`:
- `echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT` (Get PR head SHA step)
- `echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT` (Get Docker tag step)
- Multiple `${{ steps.*.outputs.* }}` and `${{ github.event.pull_request.number }}` writes in Collect Docker labels & tags step

Locations:

- `.github/workflows/main.yml:87`
- `.github/workflows/main.yml:101`
- `.github/workflows/main.yml:108`
- `.github/workflows/pr-preview.yml:37`
- `.github/workflows/pr-preview.yml:41`
- `.github/workflows/pr-preview.yml:55`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection, github-env-injection

**Notes:**

1. action.yml: Pinned docker://ghcr.io/47ng/actions-clever-cloud:2.1.1 to immutable digest sha256:c374d7bc5e669d01d1d76eaa17bc9645994825f5d3928b2accf1117a8b310029, preserving the docker:// scheme and tag inline.

2. main.yml script-injection: Moved all ${{ }} expressions in run: blocks to env: blocks — Get Git SHA (github.sha), Get Docker tag (github.ref_name), Collect Docker labels & tags (steps.package.outputs.version, steps.sha.outputs.sha, github.repository, github.run_id, github.ref_name, steps.docker-tag.outputs.tag), and Generate step summary (steps.docker-build-push.outputs.digest, steps.docker-labels-tags.outputs.tags/labels).

3. pr-preview.yml script-injection: Same pattern applied — Get PR head SHA (github.event.pull_request.head.sha), Get Docker tag (github.event.pull_request.number), Collect Docker labels & tags (all step outputs and github context values), Generate step summary.

4. github-env-injection: All values written to $GITHUB_OUTPUT are now sanitized with `printf '%s' "$VAR" | tr -d '\n\r'` before writing, preventing newline injection attacks. $GITHUB_OUTPUT references are also properly double-quoted.

### Iteration 2

**Fixes applied:** github-env-injection

**Notes:**

Fixed the 'Compute Docker tags & labels' step in .github/workflows/pr-preview-manual.yml. Added sanitization for all five variables (HEAD_SHA, PR_NUMBER, FORK, REPO, RUN_ID) using `printf '%s' "$VAR" | tr -d '\n\r'` before they are written to $GITHUB_OUTPUT. The sanitized variables (safe_head_sha, safe_pr_number, safe_fork, safe_repo, safe_run_id) are now used in all echo commands within the heredoc block, consistent with the pattern already applied in main.yml and pr-preview.yml.

