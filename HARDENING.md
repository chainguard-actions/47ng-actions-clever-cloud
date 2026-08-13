<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v1.2.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v1.2.0** was hardened automatically. 2 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

The action.yml Docker image reference uses a mutable version tag (`v1.2.0`) instead of an immutable SHA digest. This means the image could be replaced with a different (potentially malicious) version without changing the workflow. The reference `docker://47ng/actions-clever-cloud:v1.2.0` should be replaced with a SHA-digest reference such as `docker://47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:48`

### missing-permissions (severity: medium)

The workflow file `.github/workflows/main.yml` has no top-level `permissions:` key, and neither the `ci` job nor the `cd` job defines its own `permissions:` block. Without explicit permissions, the workflow inherits the default repository permissions (which may include broad write access), violating the principle of least privilege. A `permissions:` block with minimal required scopes should be added at the top level or per job.

Locations:

- `.github/workflows/main.yml:1`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, missing-permissions

**Notes:**

1. Pinned the Docker image in action.yml from `docker://47ng/actions-clever-cloud:v1.2.0` to `docker://47ng/actions-clever-cloud:v1.2.0@sha256:e3cd9da32bac9356e10a6f4340049dab2d580413ccd5db862ebb32cf78cabb8c`, preserving the docker:// scheme and tag for readability. 2. Added `permissions: contents: read` at the top level of `.github/workflows/main.yml` to enforce least-privilege access — the workflow only needs to read repository contents for checkout and testing; Docker Hub publishing uses external secrets rather than GitHub token write permissions.

