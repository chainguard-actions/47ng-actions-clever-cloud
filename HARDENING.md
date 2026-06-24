<!-- markdownlint-disable -->

# Hardening Report: 47ng--actions-clever-cloud/v1.3.1

> This file was generated automatically by the hardening agent.

**Policy SHA:** `d636be7e43ef829af6e853da6b3c7566db9f72fe`

**Test Policy SHA:** `843adf9e4b8f85d0c08b27b9d0b09dd094b54702`

**Harden Agent Version:** `1`

Action **47ng--actions-clever-cloud/v1.3.1** was hardened automatically. 1 finding(s) were identified and resolved across 1 iteration(s).

## Findings Fixed

### unpinned-uses (severity: high)

The action.yml uses a Docker image reference with a mutable version tag (`docker://47ng/actions-clever-cloud:v1.3.1`) instead of an immutable SHA digest. This means the image could be replaced with a different (potentially malicious) version without changing the action.yml file. It should be pinned to a specific SHA digest, e.g. `docker://47ng/actions-clever-cloud@sha256:<64-hex-char-digest>`.

Locations:

- `action.yml:52`

## Iteration Notes

### Iteration 1

**Fixes applied:** unpinned-uses

**Notes:**

Replaced the mutable Docker image tag `docker://47ng/actions-clever-cloud:v1.3.1` with the immutable SHA256 digest `docker://47ng/actions-clever-cloud@sha256:ff3e4c49277f16b21b4f45bc98725d28982fe0f31150ae781634b2d400fe1098 # v1.3.1` in action.yml line 52.

