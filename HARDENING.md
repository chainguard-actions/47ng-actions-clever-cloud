<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.2

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.1.2** was hardened automatically. 5 finding(s) were identified and resolved across 3 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses a Docker image with a mutable version tag instead of an immutable SHA digest. The reference `docker://ghcr.io/47ng/actions-clever-cloud:2.1.2` can be silently replaced by a different image if the tag is overwritten in the registry. It should be pinned to a SHA digest, e.g. `docker://ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:57`

### script-injection (severity: high)

Sub-rule (a): Multiple run: blocks in pr-preview.yml directly interpolate ${{ ... }} expressions inside shell command strings. YAML template substitution occurs before the shell parses the string, so an attacker-controlled value (e.g. a PR SHA or number containing shell metacharacters) can break out of the intended context.

Affected lines:
- "Get PR head SHA" step: `run: echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`
- "Get Docker tag" step: `run: echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`
- "Collect Docker labels & tags" step: multiple ${{ steps.*.outputs.* }}, ${{ github.event.pull_request.number }}, ${{ github.repository }}, ${{ github.run_id }} interpolated directly in run: block writing to $GITHUB_OUTPUT
- "Generate step summary" step: ${{ steps.docker-build-push.outputs.digest }}, ${{ steps.docker-labels-tags.outputs.tags }}, ${{ steps.docker-labels-tags.outputs.labels }} interpolated directly in run: block

Fix: move all ${{ ... }} values into env: variables and reference them as quoted shell variables ("$VAR").

Locations:

- `.github/workflows/pr-preview.yml:36`
- `.github/workflows/pr-preview.yml:40`
- `.github/workflows/pr-preview.yml:47`
- `.github/workflows/pr-preview.yml:88`

### script-injection (severity: high)

Sub-rule (a): Multiple run: blocks in main.yml directly interpolate ${{ ... }} expressions inside shell command strings.

Affected locations:
- "Collect Docker labels" step (build job): `${{ github.repository }}` and `${{ github.run_id }}` are interpolated directly inside a run: block that writes to $GITHUB_OUTPUT via a heredoc.
- "Login to registries" steps (publish and latest jobs): `${{ github.repository_owner }}` is interpolated directly inside the skopeo login shell command: `skopeo login ghcr.io --username "${{ github.repository_owner }}" --password-stdin <<< "$GITHUB_TOKEN"`

Fix: move all ${{ ... }} values into env: variables and reference them as quoted shell variables.

Locations:

- `.github/workflows/main.yml:131`
- `.github/workflows/main.yml:175`
- `.github/workflows/main.yml:215`

### github-env-injection (severity: high)

run: blocks in pr-preview.yml write ${{ ... }} expressions derived from untrusted PR metadata directly to $GITHUB_OUTPUT without the required sanitization step (`printf '%s' ... | tr -d '\n\r'`). A value containing newline characters could inject additional key=value pairs into $GITHUB_OUTPUT, poisoning subsequent steps.

- "Get PR head SHA" step: `echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT` — the PR head SHA is attacker-controlled (a fork PR can set any SHA-like string as the head).
- "Get Docker tag" step: `echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT` — PR number is GitHub-controlled but still flows through unsanitized template substitution.
- "Collect Docker labels & tags" step: multiple ${{ steps.*.outputs.* }} and ${{ github.event.pull_request.number }} values written directly to $GITHUB_OUTPUT without sanitization.

Locations:

- `.github/workflows/pr-preview.yml:36`
- `.github/workflows/pr-preview.yml:40`
- `.github/workflows/pr-preview.yml:47`

### github-env-injection (severity: high)

The "Collect Docker labels" run: block in main.yml writes ${{ github.repository }} and ${{ github.run_id }} directly to $GITHUB_OUTPUT via a heredoc without the required sanitization step (`printf '%s' ... | tr -d '\n\r'`). Although `github.repository` and `github.run_id` are GitHub-controlled, they still flow through YAML template substitution before the shell sees them, and the check requires sanitization for all non-literal values written to special environment files.

Locations:

- `.github/workflows/main.yml:131`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection, github-env-injection

**Notes:**

Fixed all 5 findings across 3 files:

1. action.yml: Pinned Docker image `ghcr.io/47ng/actions-clever-cloud:2.1.2` to immutable SHA digest `sha256:7a8a686415a0b5f49fb365ff77eaed3598a0caf7682ee9e5aa5cd82051bfff47`, preserving the tag inline with the `docker://` scheme.

2. pr-preview.yml: Fixed script-injection and github-env-injection in 4 steps:
   - 'Get PR head SHA': moved PR_HEAD_SHA into env, sanitized with tr before writing to GITHUB_OUTPUT
   - 'Get Docker tag': moved PR_NUMBER into env, sanitized with tr before writing to GITHUB_OUTPUT
   - 'Collect Docker labels & tags': moved all 6 ${{ }} expressions (PKG_VERSION, PR_NUMBER, PR_SHA, REPOSITORY, RUN_ID, DOCKER_TAG) into env vars, sanitized all with tr before writing to GITHUB_OUTPUT
   - 'Generate step summary': moved DIGEST, TAGS, LABELS into env vars, referenced as shell variables

3. main.yml: Fixed script-injection and github-env-injection in 3 steps:
   - 'Collect Docker labels' (build job): moved REPOSITORY and RUN_ID into env vars, sanitized with tr before writing to GITHUB_OUTPUT
   - 'Login to registries' (publish job): moved github.repository_owner into REPOSITORY_OWNER env var
   - 'Login to registries' (latest job): moved github.repository_owner into REPOSITORY_OWNER env var

### Iteration 2

**Fixes applied:** github-env-injection

**Notes:**

In pr-preview-manual.yml, the 'Compute Docker tags & labels' step now sanitizes all five attacker-controlled env vars (HEAD_SHA, PR_NUMBER, FORK, REPO, RUN_ID) using `printf '%s' "$VAR" | tr -d '\n\r'` before writing them to $GITHUB_OUTPUT. The sanitized safe_* variables are then used in all echo statements, preventing newline injection attacks. This matches the pattern already used in the analogous step in pr-preview.yml.

### Iteration 3

**Fixes applied:** github-env-injection

**Notes:**

In the 'Collect Docker labels' step of the 'build' job in .github/workflows/main.yml, added sanitization for RELEASE_VERSION and RELEASE_SHA using `printf '%s' "$VAR" | tr -d '\n\r'` to create safe_release_version and safe_release_sha variables. Replaced all uses of the unsanitized ${RELEASE_VERSION} and ${RELEASE_SHA} in the heredoc block (including in the image.source URL) with the sanitized safe_ variants. This prevents newline injection attacks that could inject additional key=value pairs into $GITHUB_OUTPUT.

