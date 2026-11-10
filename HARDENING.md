<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v2.3.0

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `2`

Action **47ng--actions-clever-cloud/v2.3.0** was hardened automatically. 1 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

action.yml has `runs.image: docker://ghcr.io/47ng/actions-clever-cloud:2.3.0`. This points to a tag that can be changed, not a fixed sha256 digest. Pin it as `ghcr.io/47ng/actions-clever-cloud@sha256:<digest> # 2.3.0`.

Locations:

- `action.yml:70`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses

**Notes:**

Pinned runs.image to docker://ghcr.io/47ng/actions-clever-cloud:2.3.0@sha256:719e46d298198956b3f6738577880e6037c2b6127d981f632e2fffaa50cccbb8. The docker:// scheme and the inline tag are kept so the runner does not treat it as a local Dockerfile path.

