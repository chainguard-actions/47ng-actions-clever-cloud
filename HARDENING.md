<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.4

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.1.4** was hardened automatically. 12 finding(s) were identified and resolved across 2 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses a Docker image referenced by a mutable version tag (`2.1.4`) rather than an immutable SHA digest. This means a supply-chain attacker could replace the image at that tag and have the action execute arbitrary code. The `image:` field should use a SHA digest, e.g. `docker://ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:57`

### script-injection (severity: high)

Sub-rule (a): `${{ github.event.pull_request.head.sha }}` is interpolated directly into a `run:` shell command string. Although a commit SHA is low-risk in practice, any `${{ ... }}` expression inside a `run:` block is a script-injection finding per the check rules. Offending line: `run: echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`

Locations:

- `.github/workflows/pr-preview.yml:37`

### script-injection (severity: high)

Sub-rule (a): `${{ github.event.pull_request.number }}` is interpolated directly into a `run:` shell command string. Offending line: `run: echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`

Locations:

- `.github/workflows/pr-preview.yml:42`

### script-injection (severity: high)

Sub-rule (a): The `Collect Docker labels & tags` run block directly interpolates multiple `${{ ... }}` expressions — including `${{ steps.package.outputs.version }}`, `${{ github.event.pull_request.number }}`, `${{ steps.sha.outputs.sha }}`, `${{ github.repository }}`, `${{ github.run_id }}`, and `${{ steps.docker-tag.outputs.tag }}` — into shell command strings. These values flow through YAML template substitution before the shell sees them and must not appear inside `run:` blocks.

Locations:

- `.github/workflows/pr-preview.yml:55`

### script-injection (severity: high)

Sub-rule (a): The `Generate step summary` run block directly interpolates `${{ steps.docker-build-push.outputs.digest }}`, `${{ steps.docker-labels-tags.outputs.tags }}`, and `${{ steps.docker-labels-tags.outputs.labels }}` into shell command strings. These step outputs could contain attacker-influenced content and must not be interpolated directly into `run:` blocks.

Locations:

- `.github/workflows/pr-preview.yml:100`

### script-injection (severity: high)

Sub-rule (a): The `Collect Docker labels` run block in the `build` job directly interpolates `${{ github.repository }}` (three times) and `${{ github.run_id }}` into shell command strings written to `$GITHUB_OUTPUT`. All `${{ ... }}` expressions inside `run:` blocks are script-injection findings regardless of context.

Locations:

- `.github/workflows/main.yml:152`

### script-injection (severity: high)

Sub-rule (a): The `Login to registries` run block in the `publish` job directly interpolates `${{ github.repository_owner }}` into a shell command string (`skopeo login ghcr.io --username "${{ github.repository_owner }}" ...`). Any `${{ ... }}` expression inside a `run:` block is a script-injection finding.

Locations:

- `.github/workflows/main.yml:228`

### script-injection (severity: high)

Sub-rule (a): The `Login to registries` run block in the `latest` job directly interpolates `${{ github.repository_owner }}` into a shell command string (`skopeo login ghcr.io --username "${{ github.repository_owner }}" ...`). Any `${{ ... }}` expression inside a `run:` block is a script-injection finding.

Locations:

- `.github/workflows/main.yml:270`

### github-env-injection (severity: high)

The `Get PR head SHA` step writes `${{ github.event.pull_request.head.sha }}` directly to `$GITHUB_OUTPUT` without the required sanitization step (`printf '%s' ... | tr -d '\n\r'`). Offending line: `run: echo "sha=${{ github.event.pull_request.head.sha }}" >> $GITHUB_OUTPUT`

Locations:

- `.github/workflows/pr-preview.yml:37`

### github-env-injection (severity: high)

The `Get Docker tag` step writes `${{ github.event.pull_request.number }}` directly to `$GITHUB_OUTPUT` without the required sanitization step (`printf '%s' ... | tr -d '\n\r'`). Offending line: `run: echo "tag=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT`

Locations:

- `.github/workflows/pr-preview.yml:42`

### github-env-injection (severity: high)

The `Collect Docker labels & tags` run block writes multiple unsanitized `${{ ... }}` expressions — including `${{ steps.package.outputs.version }}`, `${{ github.event.pull_request.number }}`, `${{ steps.sha.outputs.sha }}`, `${{ github.repository }}`, `${{ github.run_id }}`, and `${{ steps.docker-tag.outputs.tag }}` — directly to `$GITHUB_OUTPUT` without the required `printf '%s' ... | tr -d '\n\r'` sanitization step.

Locations:

- `.github/workflows/pr-preview.yml:55`

### github-env-injection (severity: high)

The `Collect Docker labels` run block in the `build` job writes `${{ github.repository }}` and `${{ github.run_id }}` directly to `$GITHUB_OUTPUT` without the required `printf '%s' ... | tr -d '\n\r'` sanitization step.

Locations:

- `.github/workflows/main.yml:152`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, script-injection, github-env-injection

**Notes:**

Fixed all 12 findings across 3 files:

1. action.yml: Pinned Docker image `ghcr.io/47ng/actions-clever-cloud:2.1.4` to immutable digest `sha256:7c15fa682dff7e168f2eadb43417a1c9706f62d8185e68911420af3d997ef9e1`, preserving the `docker://` scheme and tag inline.

2. pr-preview.yml (Get PR head SHA, line 37): Moved `${{ github.event.pull_request.head.sha }}` to env block as `PR_HEAD_SHA`, sanitized with `tr -d '\n\r'` before writing to GITHUB_OUTPUT.

3. pr-preview.yml (Get Docker tag, line 42): Moved `${{ github.event.pull_request.number }}` to env block as `PR_NUMBER`, sanitized before writing to GITHUB_OUTPUT.

4. pr-preview.yml (Collect Docker labels & tags, line 55): Moved all 6 expressions to env block, sanitized each, and used safe variables when writing to GITHUB_OUTPUT.

5. pr-preview.yml (Generate step summary, line 100): Moved digest, tags, and labels expressions to env block and referenced as plain env vars.

6. main.yml (Collect Docker labels in build job, line 152): Moved `github.repository` and `github.run_id` to env block, sanitized, and used safe variables when writing to GITHUB_OUTPUT.

7. main.yml (Login to registries in publish job, line 228): Moved `github.repository_owner` to env block as `REPOSITORY_OWNER` and referenced as `$REPOSITORY_OWNER`.

8. main.yml (Login to registries in latest job, line 270): Same fix as #7 applied to the latest job.

### Iteration 2

**Fixes applied:** github-env-injection

**Notes:**

Fixed two github-env-injection findings:

1. hardened/action/.github/workflows/main.yml ('Collect Docker labels' step, line ~130): Added sanitization for RELEASE_VERSION and RELEASE_SHA using `printf '%s' | tr -d '\n\r'` before writing to $GITHUB_OUTPUT. The sanitized values (safe_version, safe_sha) are now used in all echo statements within the heredoc.

2. hardened/action/.github/workflows/pr-preview-manual.yml ('Compute Docker tags & labels' step, line ~175): Added sanitization for all five untrusted env vars (HEAD_SHA, PR_NUMBER, FORK, REPO, RUN_ID) using `printf '%s' | tr -d '\n\r'`, producing safe_head_sha, safe_pr_number, safe_fork, safe_repo, and safe_run_id. All echo statements in the heredoc now use the sanitized variables.

