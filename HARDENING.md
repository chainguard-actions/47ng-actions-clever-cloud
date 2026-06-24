<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.1.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `1`

Action **47ng--actions-clever-cloud/v2.1.0** was hardened automatically. 1 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

The action.yml references a Docker image using a mutable tag (`2.1.0`) instead of an immutable SHA digest. The image `docker://ghcr.io/47ng/actions-clever-cloud:2.1.0` could be replaced at any time with a different (potentially malicious) image without changing the tag. It should be pinned to a specific SHA digest, e.g. `docker://ghcr.io/47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:59`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses

**Notes:**

Replaced the mutable Docker image tag reference `docker://ghcr.io/47ng/actions-clever-cloud:2.1.0` with the immutable SHA digest `docker://ghcr.io/47ng/actions-clever-cloud@sha256:dc5a597a4359f6497d516699057399c299f361c067bef684aea03ec142cfcae0 # 2.1.0` in action.yml line 59.

