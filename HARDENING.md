<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v1.2.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `1`

Action **47ng--actions-clever-cloud/v1.2.0** was hardened automatically. 1 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

The action.yml uses a Docker image reference with a mutable version tag instead of an immutable SHA digest. `image: docker://47ng/actions-clever-cloud:v1.2.0` uses the tag `v1.2.0`, which can be silently replaced by a different image, enabling supply-chain attacks. It should be pinned to a specific SHA digest, e.g. `image: docker://47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`

Locations:

- `action.yml:49`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses

**Notes:**

Replaced the mutable Docker image tag `docker://47ng/actions-clever-cloud:v1.2.0` with the immutable SHA digest `docker://47ng/actions-clever-cloud@sha256:e3cd9da32bac9356e10a6f4340049dab2d580413ccd5db862ebb32cf78cabb8c # v1.2.0` in action.yml line 49. The tag is preserved as a comment for readability.

