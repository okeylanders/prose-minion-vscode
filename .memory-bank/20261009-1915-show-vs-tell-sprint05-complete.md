# Show vs. Tell — Slice 6 verification and remaining checks

**Date:** 2026-10-09 19:15 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-6-witnesses`, PR [#139](https://github.com/okeylanders/prose-minion-vscode/pull/139), into `epic/conversation-widgets`. Not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 6a witnesses](20261009-1830-show-vs-tell-slice6a-witnesses.md)

**Scope of this note:** docs only. Slice 6b changed no code and no tests.
`git diff --stat f4c0c4f HEAD` lists only `.md` files and `.todo` files.

## Slices

| Slice | PR | Merge commit | Review | Scope |
|---|---|---|---|---|
| 1 | [#134](https://github.com/okeylanders/prose-minion-vscode/pull/134) | `d068abd` | [pr-134](../docs/pr-reviews/pr-134-show-vs-tell-slice-1-review.md) — approved | Contracts, budgets, draft codec, lifecycle arm, shared vocabulary |
| 2 | [#135](https://github.com/okeylanders/prose-minion-vscode/pull/135) | `7cdfb77` | [pr-135](../docs/pr-reviews/pr-135-show-vs-tell-slice-2-review.md) — approved | 2a prompt bundle; 2b strict four-group codec, cancellation, correlation |
| 3 | [#136](https://github.com/okeylanders/prose-minion-vscode/pull/136) | `d425f4c` | [pr-136](../docs/pr-reviews/pr-136-show-vs-tell-slice-3-review.md) — changes requested, then approved after fixes F-01–F-03 and N-01 | Authoring surface, continuum, readout, grouped cards, meter; catalog live for authoring |
| 4 | [#137](https://github.com/okeylanders/prose-minion-vscode/pull/137) | `4f20c09` | [pr-137](../docs/pr-reviews/pr-137-show-vs-tell-slice-4-review.md) — approved after F-01 | One-shot commit, host 600 re-check, chip, exact reopen, clone-and-recommit, `widget:show-vs-tell` neutralizer |
| 5 | [#138](https://github.com/okeylanders/prose-minion-vscode/pull/138) | `9ce728f` | [pr-138](../docs/pr-reviews/pr-138-show-vs-tell-slice-5-review.md) — approved | Recommendation codec, input-only seed, prefill, Host-preparation door |
| 6 | [#139](https://github.com/okeylanders/prose-minion-vscode/pull/139) | pending | 6a mechanics, 6b docs | Witnesses, production-policy route matrix, docs |

Slice 6 is commits `26bdce2`, `452305d`, and `a5f3118` (6a), then the 6b docs
commits on top of `f4c0c4f`.

## Writer decisions

- **Q1, surrounding passage.** Persist a source reference now. The host resolves
  the passage text at generation time. Passage text never crosses from the
  webview, is never persisted, and never rides the commit. Implemented in 2b.
- **Q2, line breaks.** Multi-line values are allowed. Slice 4 defined the
  continuation-line format and redid the fit arithmetic.
- **Q3, POV custody.** After a persona prefill, POV is plain writer input with
  no custody marker. Only the beat keeps `persona-prefill` provenance.
- **Direction margin.** Direction must be strictly shorter than prose by an
  encoded margin of **4**, derived from one shared encoder used by generation
  decoding and persisted-draft integrity. A raw margin of 3 can collapse to
  equality under CRLF folding, so the rule is measured on encoded values. Set by
  the Slice 3 review fix (F-02).
- **Pronoun-free banner.** The persona catalog holds no pronoun data. The seed
  banner names the persona and uses no pronoun. A pronoun field would be a
  separate writer decision.

## Verification (6b head, after docs)

- `npm test` at the 6b docs head: **296 suites / 4,190 tests / 2 snapshots**, all
  pass. The same counts as the 6a head `a5f3118`. No test count changed in 6b.
- Lint and typecheck were not rerun in 6b, since no code changed. The 6a numbers
  stand: lint 0 errors and **1,112** warnings (the baseline), typecheck clean,
  build and `verify-bundle` OK.
- `git diff --check` clean (run on the 6b head).
- Not run: any native-browser, Extension Development Host, or live-provider check.

Slice 5 tip (for the delta): 292 suites / 4,160 tests / 2 snapshots. Slice 6a
added 4 suites and 30 tests. Slice 0 baseline (`main` at `7031b7ee`): **267 suites / 3,535 tests / 2 snapshots**.

## Sprint 05 completion

The Sprint 05 doc records each completion criterion. Five are ticked with
evidence. Three are open:

- The readout-comprehension criterion needs an interactive run.
- The "never silently canon" wording has no dedicated witness.
- The shared-vocabulary criterion has no second consumer until Sprint 04 is built.

## Follow-ups (filed in `.todo`)

- [Show vs. Tell interactive smoke test](../.todo/tech-debt/2026-10-09-show-vs-tell-interactive-smoke-test.md) — High.
- [Show vs. Tell live-provider quality pass](../.todo/tech-debt/2026-10-09-show-vs-tell-live-provider-quality-pass.md) — Medium.
- [Persona pronoun metadata](../.todo/tech-debt/2026-10-09-persona-pronoun-metadata.md) — Low, writer decision.

The epic stays open. Sprints 04 and 06 are still open, so the epic is not
archived.

## Not done, by instruction

- No merge of PR #139 or of the epic into `main`.

**Merging the epic into `main` is the writer's call.** The sprint's gate
(the epic stays off `main` until Slice 4 lands) is now satisfied, since Slice 4
merged in #137. That does not make the merge due. Sprints 04 and 06 are still
open, and the writer decides when the epic goes to `main`.
