<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.2.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.2.0** was hardened automatically. 3 finding(s) were identified and resolved across 3 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses a Docker image reference with a mutable version tag instead of a SHA digest. The reference `docker://ghcr.io/47ng/actions-clever-cloud:2.2.0` uses a tag (`2.2.0`) that can be silently overwritten, enabling supply-chain attacks. It should be pinned to a SHA digest, e.g. `docker://ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest> # 2.2.0`.

Locations:

- `action.yml:59`

### script-injection (severity: high)

Sub-rule (a): The 'Collect Docker labels' step in the `build` job directly interpolates `${{ github.repository }}` and `${{ github.run_id }}` inside `run:` shell command strings. These expressions are substituted by the YAML template engine before the shell ever sees them, allowing an attacker who controls the repository name to inject arbitrary shell commands. Offending lines:
  `echo "org.opencontainers.image.source=https://github.com/${{ github.repository }}/tree/${RELEASE_SHA}"`
  `echo "org.opencontainers.image.documentation=https://github.com/${{ github.repository }}/blob/master/README.md"`
  `echo "org.opencontainers.image.url=https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"`
Fix: move `github.repository` and `github.run_id` into `env:` variables and reference them as `$REPOSITORY` / `$RUN_ID` (already done for other similar steps in the same repo).

Locations:

- `.github/workflows/main.yml:163`

### github-env-injection (severity: high)

Two instances of unsanitized untrusted-input values written to $GITHUB_OUTPUT:

1. `.github/workflows/main.yml` — 'Collect Docker labels' step: `${{ github.repository }}` is directly interpolated inside the `run:` block and the result is written to `$GITHUB_OUTPUT` via a heredoc (`labels<<__LABELS_EOF__`). No `printf '%s' ... | tr -d '\n\r'` sanitization is applied before the write.

2. `.github/workflows/pr-preview.yml` — 'Get PR head SHA' step: `HEAD_SHA` (sourced from `${{ github.event.pull_request.head.sha }}`) is written directly to `$GITHUB_OUTPUT` with `echo "sha=$HEAD_SHA" >> "$GITHUB_OUTPUT"` without sanitization. Similarly, 'Get Docker tag' step writes `PR_NUMBER` (from `${{ github.event.pull_request.number }}`) to `$GITHUB_OUTPUT` without sanitization.

Locations:

- `.github/workflows/main.yml:163`
- `.github/workflows/pr-preview.yml:62`
- `.github/workflows/pr-preview.yml:67`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection, github-env-injection

**Notes:**

1. action.yml: Pinned Docker image from tag-only `docker://ghcr.io/47ng/actions-clever-cloud:2.2.0` to `docker://ghcr.io/47ng/actions-clever-cloud:2.2.0@sha256:a7c6d3b17ed552a0322b0c22da90c06f576a00404be40666723afd9078617a37`, preserving the `docker://` scheme and tag inline.

2. main.yml 'Collect Docker labels' step: Moved `${{ github.repository }}` and `${{ github.run_id }}` into an `env:` block as `REPOSITORY` and `RUN_ID`. In the run script, sanitized both with `printf '%s' ... | tr -d '\n\r'` before using them in the heredoc written to `$GITHUB_OUTPUT`.

3. pr-preview.yml 'Get PR head SHA' step: Added `printf '%s' "$HEAD_SHA" | tr -d '\n\r'` sanitization before writing to `$GITHUB_OUTPUT`. 'Get Docker tag' step: Added `printf '%s' "$PR_NUMBER" | tr -d '\n\r'` sanitization before writing to `$GITHUB_OUTPUT`.

### Iteration 2

**Fixes applied:** script-injection, github-env-injection

**Notes:**

Fixed 4 findings across 4 workflow files:
1. main.yml (publish job, line ~252): Moved `${{ github.repository_owner }}` out of the `run:` shell string into the `env:` block as `REPOSITORY_OWNER`, referenced as `$REPOSITORY_OWNER` in the skopeo login command.
2. main.yml (latest job, line ~305): Same fix applied to the second 'Login to registries' step.
3. pr-preview.yml (line ~82): Added `SAFE_PR_NUMBER`, `SAFE_REPOSITORY`, and `SAFE_RUN_ID` variables using `printf '%s' ... | tr -d '\n\r'` sanitization before writing to $GITHUB_OUTPUT heredoc.
4. e2e-release-please.yml (line ~148): Added `SAFE_HEAD_SHA`, `SAFE_PR_NUMBER`, `SAFE_REPOSITORY`, and `SAFE_RUN_ID` sanitization before writing to $GITHUB_OUTPUT heredoc.
5. pr-preview-manual.yml (line ~196): Added `SAFE_HEAD_SHA`, `SAFE_PR_NUMBER`, `SAFE_FORK`, `SAFE_REPO`, and `SAFE_RUN_ID` sanitization before writing to $GITHUB_OUTPUT heredoc.

### Iteration 1

**Fixes applied:** github-env-injection

**Notes:**

In the 'build' job's 'Collect Docker labels' step of .github/workflows/main.yml, added sanitization for RELEASE_VERSION and RELEASE_SHA (sourced from needs.release.outputs.*) before they are written to $GITHUB_OUTPUT. Added SAFE_RELEASE_VERSION=$(printf '%s' "$RELEASE_VERSION" | tr -d '\n\r') and SAFE_RELEASE_SHA=$(printf '%s' "$RELEASE_SHA" | tr -d '\n\r'), then replaced all uses of the unsanitized variables in the heredoc with the sanitized versions. This follows the same pattern already used for REPOSITORY and RUN_ID in the same step.

