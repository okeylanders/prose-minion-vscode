# Build Command Gate Semantics

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Small

## Problem

Before the monorepo split, the root `npm run build` effectively ran tests,
typechecks, and webpack. After the split, root `npm run build` delegates to the
extension webpack build for a faster inner loop. The safety gate now lives at
the artifact and CI boundary: `prepackage` runs typecheck and tests, and CI runs
typecheck, tests, lint, and build.

This is intentional and documented, but it can surprise contributors who expect
`build` to mean "full verification."

## Recommendation

Leave the current command structure alone unless confusion recurs. If it does,
add an explicit `npm run verify` command and document that `build` is the fast
bundle step while `verify` is the full local gate.

## Related Files

- `package.json`
- `.github/workflows/ci.yml`
- `docs/CHANGELOG-DETAILED.md`

## Completion Criteria

- Command semantics are clear in docs and scripts.
- Any new `verify` command mirrors CI without slowing the normal build loop.
