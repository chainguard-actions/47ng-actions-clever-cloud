<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.5

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.1.5** was hardened automatically. 3 finding(s) were identified and resolved across 2 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses a Docker image referenced by a mutable version tag (`docker://ghcr.io/47ng/actions-clever-cloud:2.1.5`) instead of an immutable SHA digest. A tag can be silently overwritten, enabling a supply-chain attack. The image reference should use a SHA digest, e.g. `docker://ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:56`

### script-injection (severity: high)

Sub-rule (a): The 'Collect Docker labels' step in the `build` job of main.yml directly interpolates `${{ github.repository }}` and `${{ github.run_id }}` inside `run:` shell commands (echo statements writing to $GITHUB_OUTPUT). Any `${{ ... }}` expression interpolated directly into a run: block is a script-injection risk because YAML template substitution happens before the shell ever sees the value. Offending lines:
  `echo "org.opencontainers.image.source=https://github.com/${{ github.repository }}/tree/${RELEASE_SHA}"`
  `echo "org.opencontainers.image.documentation=https://github.com/${{ github.repository }}/blob/master/README.md"`
  `echo "org.opencontainers.image.url=https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"`
Fix: move `github.repository` and `github.run_id` into `env:` variables and reference them as `$REPOSITORY` / `$RUN_ID` in the shell script.

Locations:

- `.github/workflows/main.yml:193`
- `.github/workflows/main.yml:194`
- `.github/workflows/main.yml:195`

### script-injection (severity: high)

Sub-rule (a): The 'Login to registries' steps in the `publish` and `latest` jobs of main.yml directly interpolate `${{ github.repository_owner }}` inside `run:` shell commands (skopeo login). Any `${{ ... }}` expression interpolated directly into a run: block is a script-injection risk. Offending lines:
  `skopeo login ghcr.io --username "${{ github.repository_owner }}" --password-stdin <<< "$GITHUB_TOKEN"`
Fix: move `github.repository_owner` into an `env:` variable (e.g. `REGISTRY_USER`) and reference it as `"$REGISTRY_USER"` in the shell script.

Locations:

- `.github/workflows/main.yml:240`
- `.github/workflows/main.yml:290`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection

**Notes:**

1. action.yml: Pinned Docker image from mutable tag `docker://ghcr.io/47ng/actions-clever-cloud:2.1.5` to immutable digest `docker://ghcr.io/47ng/actions-clever-cloud:2.1.5@sha256:7815cc180fa1762efa1f7a2d62a860d87a37fe7d2e8aa9b31dc0b56b6107f2b7`, preserving the docker:// scheme and tag inline. 2. main.yml 'Collect Docker labels' step: Moved `${{ github.repository }}` and `${{ github.run_id }}` into env vars `REPOSITORY` and `RUN_ID`, replaced inline expressions in shell with `${REPOSITORY}` and `${RUN_ID}`. 3. main.yml 'Login to registries' steps (publish and latest jobs): Moved `${{ github.repository_owner }}` into env var `REGISTRY_USER` in both steps, replaced inline expression with `"$REGISTRY_USER"` in the skopeo login command.

### Iteration 1

**Fixes applied:** github-env-injection

**Notes:**

Fixed all 6 github-env-injection findings across 4 workflow files:

1. pr-preview.yml (findings 1, 2, 3):
   - 'Get PR head SHA' step: Added `safe_sha=$(printf '%s' "$HEAD_SHA" | tr -d '\n\r')` before writing to GITHUB_OUTPUT.
   - 'Get Docker tag' step: Added `safe_pr=$(printf '%s' "$PR_NUMBER" | tr -d '\n\r')` before writing to GITHUB_OUTPUT.
   - 'Collect Docker labels & tags' step: Added sanitization for all 6 env vars (PACKAGE_VERSION, PR_NUMBER, SHA, REPOSITORY, RUN_ID, DOCKER_TAG) before the heredoc write.

2. e2e-release-please.yml (finding 4):
   - 'Collect Docker labels & tags' step: Added sanitization for HEAD_SHA, PR_NUMBER, REPOSITORY, RUN_ID, VERSION before the heredoc write.

3. main.yml (finding 5):
   - 'Collect Docker labels' step: Added sanitization for REPOSITORY and RUN_ID before the heredoc write.

4. pr-preview-manual.yml (finding 6):
   - 'Compute Docker tags & labels' step: Added sanitization for HEAD_SHA, PR_NUMBER, FORK, REPO, RUN_ID before the heredoc write.

