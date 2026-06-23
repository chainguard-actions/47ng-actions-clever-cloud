<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v1.3.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `1`

Action **47ng--actions-clever-cloud/v1.3.0** was hardened automatically. 1 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

The action.yml Docker action references a mutable image tag instead of an immutable SHA digest. The image `docker://47ng/actions-clever-cloud:v1.3.0` uses a version tag (`v1.3.0`) which can be silently overwritten, enabling supply-chain attacks. It should be pinned to a SHA digest, e.g. `docker://47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:57`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses

**Notes:**

Pinned the Docker image reference in action.yml from `docker://47ng/actions-clever-cloud:v1.3.0` to `docker://47ng/actions-clever-cloud@sha256:7a1e50bab861b508991f091801f13f5ad740d1de3519e681e1928cf789d93d6a # v1.3.0`. The SHA digest was resolved using the Docker Registry API to ensure it is accurate and immutable.

