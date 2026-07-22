<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.3

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.1.3** was hardened automatically. 3 finding(s) were identified and resolved across 3 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses a Docker image reference with a mutable version tag (`docker://ghcr.io/47ng/actions-clever-cloud:2.1.3`) instead of an immutable SHA digest. A supply-chain attacker could push a malicious image to the same tag. The image reference should use a SHA digest (e.g., `ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`).

Failing reference: `image: docker://ghcr.io/47ng/actions-clever-cloud:2.1.3`

Locations:

- `action.yml:57`

### script-injection (severity: high)

Sub-rule (a): Multiple `${{ }}` expressions are interpolated directly inside `run:` shell command strings, allowing YAML template substitution to inject shell metacharacters before the shell ever sees the value.

**pr-preview.yml — `Get PR head SHA` step:**
`run: echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`

**pr-preview.yml — `Get Docker tag` step:**
`run: echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`

**pr-preview.yml — `Collect Docker labels & tags` step:** Multiple lines in the run block interpolate `${{ steps.package.outputs.version }}`, `${{ github.event.pull_request.number }}`, `${{ steps.sha.outputs.sha }}`, `${{ github.repository }}`, `${{ github.run_id }}`, `${{ steps.docker-tag.outputs.tag }}` directly into shell echo commands.

**pr-preview.yml — `Generate step summary` step:** `${{ steps.docker-build-push.outputs.digest }}`, `${{ steps.docker-labels-tags.outputs.tags }}`, `${{ steps.docker-labels-tags.outputs.labels }}` are interpolated directly into shell echo commands.

**main.yml — `Collect Docker labels` step:** `${{ github.repository }}` and `${{ github.run_id }}` are interpolated directly into shell echo commands inside the run block.

**main.yml — `Login to registries` step (publish job):** `${{ github.repository_owner }}` is interpolated directly into a `skopeo login` shell command.

**main.yml — `Login to registries` step (latest job):** `${{ github.repository_owner }}` is interpolated directly into a `skopeo login` shell command.

All of these should be moved to `env:` variables and referenced as `"$VAR"` in the shell script.

Locations:

- `.github/workflows/pr-preview.yml:39`
- `.github/workflows/pr-preview.yml:44`
- `.github/workflows/pr-preview.yml:57`
- `.github/workflows/pr-preview.yml:96`
- `.github/workflows/main.yml:148`
- `.github/workflows/main.yml:196`
- `.github/workflows/main.yml:240`

### github-env-injection (severity: high)

Multiple `run:` steps write values derived from untrusted/workflow-controlled expressions directly to `$GITHUB_OUTPUT` without the required sanitization step (`printf '%s' ... | tr -d '\n\r'`). An attacker-controlled value containing newlines could inject additional key=value pairs into the output file, poisoning downstream steps.

**pr-preview.yml — `Get PR head SHA` step:**
`echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`
— `github.event.pull_request.head.sha` is written unsanitized.

**pr-preview.yml — `Get Docker tag` step:**
`echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`
— `github.event.pull_request.number` is written unsanitized.

**pr-preview.yml — `Collect Docker labels & tags` step:** Multiple echo lines write `${{ steps.package.outputs.version }}`, `${{ github.event.pull_request.number }}`, `${{ steps.sha.outputs.sha }}`, `${{ github.repository }}`, `${{ github.run_id }}`, `${{ steps.docker-tag.outputs.tag }}` directly to `$GITHUB_OUTPUT` without sanitization.

**main.yml — `Collect Docker labels` step:** `${{ github.repository }}` and `${{ github.run_id }}` are written directly into a heredoc redirected to `$GITHUB_OUTPUT` without sanitization.

Fix: sanitize each value before writing, e.g.:
```bash
safe=$(printf '%s' "$VALUE" | tr -d '\n\r')
echo "key=$safe" >> "$GITHUB_OUTPUT"
```

Locations:

- `.github/workflows/pr-preview.yml:39`
- `.github/workflows/pr-preview.yml:44`
- `.github/workflows/pr-preview.yml:57`
- `.github/workflows/main.yml:148`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection, github-env-injection

**Notes:**

Fixed all three finding types across action.yml, .github/workflows/pr-preview.yml, and .github/workflows/main.yml:

1. unpinned-uses: Pinned docker://ghcr.io/47ng/actions-clever-cloud:2.1.3 with SHA digest sha256:a8ef688d9f3795b7e69aafb79671a60a79edebd0eb2312cec191b9c5ffe932f4 in action.yml, preserving the tag inline.

2. script-injection: Moved all ${{ }} expressions out of run: shell strings into env: blocks in all affected steps: 'Get PR head SHA', 'Get Docker tag', 'Collect Docker labels & tags', 'Generate step summary' in pr-preview.yml; 'Collect Docker labels', 'Login to registries' (publish job), 'Login to registries' (latest job) in main.yml.

3. github-env-injection: Added sanitization (printf '%s' "$VAR" | tr -d '\n\r') before writing values to $GITHUB_OUTPUT in all affected steps: 'Get PR head SHA', 'Get Docker tag', 'Collect Docker labels & tags' in pr-preview.yml; 'Collect Docker labels' in main.yml.

### Iteration 2

**Fixes applied:** github-env-injection

**Notes:**

Fixed the 'Compute Docker tags & labels' step in .github/workflows/pr-preview-manual.yml. Added sanitization of all five untrusted environment variables (HEAD_SHA, PR_NUMBER, FORK, REPO, RUN_ID) using `printf '%s' "$VAR" | tr -d '\n\r'` before they are used in the heredoc that writes to $GITHUB_OUTPUT. The sanitized versions (safe_head_sha, safe_pr_number, safe_fork, safe_repo, safe_run_id) are used throughout the heredoc block, preventing newline injection attacks that could overwrite subsequent step outputs.

### Iteration 1

**Fixes applied:** github-env-injection

**Notes:**

In the 'Collect Docker labels' step of the `build` job in `.github/workflows/main.yml`, added sanitization for `RELEASE_VERSION` and `RELEASE_SHA` using `printf '%s' ... | tr -d '\n\r'` (same pattern already used for `REPOSITORY` and `RUN_ID`). The sanitized variables `safe_version` and `safe_sha` are now used in place of the raw `${RELEASE_VERSION}` and `${RELEASE_SHA}` in all heredoc lines written to `$GITHUB_OUTPUT`, preventing newline injection attacks.

