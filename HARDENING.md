<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v1.3.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v1.3.0** was hardened automatically. 2 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

The action.yml uses a Docker image referenced by a mutable version tag (`docker://47ng/actions-clever-cloud:v1.3.0`) instead of an immutable SHA digest. This means the image could be silently replaced with a different (potentially malicious) version without any change to the action definition. It should be replaced with a reference like `docker://47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:63`

### missing-permissions (severity: medium)

The workflow file .github/workflows/main.yml has no top-level `permissions:` key, and neither the `ci` job nor the `cd` job defines its own `permissions:` block. Without explicit permissions, the GITHUB_TOKEN is granted default (potentially broad) permissions, which violates the principle of least privilege. A `permissions:` block with minimal required scopes should be added.

Locations:

- `.github/workflows/main.yml:1`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, missing-permissions

**Notes:**

1. Pinned the Docker image in action.yml from the mutable tag `docker://47ng/actions-clever-cloud:v1.3.0` to the immutable digest `docker://47ng/actions-clever-cloud:v1.3.0@sha256:7a1e50bab861b508991f091801f13f5ad740d1de3519e681e1928cf789d93d6a`, preserving the docker:// scheme and tag inline. 2. Added a top-level `permissions: contents: read` block to .github/workflows/main.yml to enforce least-privilege for the GITHUB_TOKEN — the CI job needs read access for checkout, and the CD job uses Docker Hub secrets (not GITHUB_TOKEN) for publishing.

