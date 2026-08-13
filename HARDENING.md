<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v1.3.1

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v1.3.1** was hardened automatically. 2 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml uses `runs.using: docker` with a mutable image tag reference `docker://47ng/actions-clever-cloud:v1.3.1` instead of a SHA digest. This is vulnerable to supply-chain attacks because the tag can be silently repointed to a different (potentially malicious) image. The image reference should use a SHA digest, e.g. `docker://47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:57`

### missing-permissions (severity: medium)

.github/workflows/main.yml has no top-level `permissions:` key, and neither of its jobs (`ci` or `cd`) defines a job-level `permissions:` block. Without explicit permissions, the workflow inherits the default repository permissions (which may include write access to contents, packages, etc.), violating the principle of least privilege. Explicit minimal permissions should be declared.

Locations:

- `.github/workflows/main.yml:1`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses, missing-permissions

**Notes:**

1. Pinned the Docker image in action.yml from `docker://47ng/actions-clever-cloud:v1.3.1` to `docker://47ng/actions-clever-cloud:v1.3.1@sha256:ff3e4c49277f16b21b4f45bc98725d28982fe0f31150ae781634b2d400fe1098` — preserves the `docker://` scheme and the tag while adding the immutable SHA256 digest. 2. Added a top-level `permissions: contents: read` block to `.github/workflows/main.yml` — this is the minimum permission needed for the `actions/checkout` steps in both jobs; the CD job's Docker Hub publishing uses repository secrets rather than GitHub token permissions.

