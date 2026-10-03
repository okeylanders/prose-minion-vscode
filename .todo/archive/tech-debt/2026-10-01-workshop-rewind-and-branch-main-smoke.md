# Workshop Rewind and Branch main smoke — passed

**Date Identified**: 2026-10-01
**Reviewed**: 2026-10-02
**Status**: Resolved — all checks confirmed by Okey on 2026-10-02
**Priority**: High (the release gate)
**Estimated Effort**: Small (seven short Extension Development Host scenarios with cheap models)
**Found by**: Workshop Rewind and Branch epic closure ([epic](../epics/epic-workshop-rewind-and-branch-2026-09-30/README.md))

## Problem as identified on 2026-10-01

Rewind, Edit and Branch have strong automated proof: an equivalence oracle over every rest point, fault-injected rollback, and mutation-checked regressions. At identification, nobody had yet driven them in a real VS Code window, with live models, a window reload and a session file that Git changed. The cloud sessions that built the epic can't run the Extension Development Host (Sprint 03 kickoff decision 4).

On 2026-10-01 Okey chose to run the smoke on the `main` build after the epic merges, rather than hold the merge for it, and to patch anything wonky from `main`. The epic's reviews already treat the smoke as part of the release, not the merge:

- [PR #119 review](../../../docs/pr-reviews/pr-119-workshop-rewind-ca93f7e-review.md): "Branch delivery, recorded manual smoke, and the already tracked follow-ups remain part of the epic's release assessment."
- [PR #120 review](../../../docs/pr-reviews/pr-120-workshop-branch-16c751b-review.md): "Manual Extension Development Host smoke remains a separate pending release gate."

## Recommendation

On a build of `main` that includes the epic, run the seven scenarios in the [epic memory-bank entry](../../../.memory-bank/20261001-1105-workshop-rewind-and-branch.md), and check the startup notice too. Record each result in its table with the date and the build's commit. Fix any failure in a small PR off `main`, then re-run that scenario.

## Related Files

- `.memory-bank/20261001-1105-workshop-rewind-and-branch.md`: the checklist and the results table.
- [Sprint 03](../epics/epic-workshop-rewind-and-branch-2026-09-30/sprints/03-branch-and-release.md): the smoke as planned.
- [Release preparation](2026-10-01-workshop-rewind-and-branch-release-preparation.md), which waits on this.

## Completion Criteria

- All seven scenarios are recorded as passing, with the date and the build.
- Any failure has a fix merged to `main`, and its scenario was re-run.
- The startup notice opened once, on the Rewind and Branch page.
- This item moves to `.todo/archive/tech-debt/`.

## Resolution — 2026-10-02

Okey confirmed all checks performed on the reviewed main build (`7f9823be`), including the seven Workshop scenarios and startup notice. Results are recorded in the memory-bank table. This is writer-reported verification; no fresh host run was performed by the release agent. The release-preparation gate is satisfied.
