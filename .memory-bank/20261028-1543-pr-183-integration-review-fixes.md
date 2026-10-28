# PR #183 integration review: three fixes

**Date:** 2026-10-28
**Branch:** `epic/lightbox` (PR #183, `epic/lightbox` → `main`, draft).
**Review:** `docs/pr-reviews/pr-183-lightbox-integration-review.md`
(reviewed head `688d4a72`, base `d1f25db2`), F-01–F-03, all P2.
**Decision records:** ADR 2026-10-21, "Amendment 2026-10-28: PR #183 review
(integration)" (F-01, F-02); ADR 2026-10-19 D12 addendum, "Owed writes
drain before deactivation resolves" (F-03).

## What was wrong

- **F-01.** A Draft Edit fix to `teh` in `[chapter][teh]`, `[teh][]` or
  `[teh]` (with `[teh]` and `[the]` both defined) passed every guard and
  retargeted the link: the inline scanner protected only `](…)`
  destinations, and the structure check compared token types, not where a
  link goes.
- **F-02.** Proofread took its document watch after the long-file
  confirmation, so a close and reopen (same URI, version, language) or a
  language change while the modal was open attached the watch to the new
  lifetime; a direct Fix then wrote.
- **F-03.** `deactivate` disposed the Lightbox tab (which stops its runs
  and queues their saves) but awaited only the Workshop's flush, so the
  extension could report itself done with a paid reading not yet on disk.

## What changed

- `markdownInlineRegions`: `]` then `[` protects the label (`[…]`), read on
  inside it so a code span still binds tighter. `markdownStructure`: link
  and image shapes carry `JSON.stringify([href, title])`.
- `DraftEditUseCase`: `begin(target, pass)` (sync; returns the plan) /
  `run(gesture)` / `release(gesture)`, as Craft Flags'; `plan(target)` and
  `run(target, …)` are gone. `ProofreadRunRequest.stillCurrent`, asked as
  each chunk starts. The Fix run's write step moved verbatim to
  `draftEditRunFixes.ts` (`applyRunFixes`, `fixReport`) to keep the use
  case under 500 lines; `followIssues` joined `draftEditIssues.ts`.
  Tests reach the gesture through `proofreadNow` (core fakes) or a local
  helper (app adapter tests, which may not import core's deep aliases).
- `LightboxBoardLibrary`: an owed set (`owe`) over saves, the first
  measured save (through `LightboxBoardSaves`' `owe` port), renames, spark
  marks and deletes; `drain()` loops until it is empty.
- `apps/vscode-extension/src/application/extensionShutdown.ts`:
  `shutDownExtension(parts)`, what `deactivate` runs. Tabs disposed first,
  then the Lightbox drain alongside the Workshop flush, the drain awaited
  even when the flush throws. VS Code awaits `deactivate`'s promise but not
  subscriptions' dispose.

## Behavior changes worth knowing

- An edit the writer makes while Proofread's confirmation is open is now
  followed (as one during the model call is); it used to refuse the run as
  `changed`.
- A Proofread gesture holds the document's in-flight slot through the
  confirmation, so a quick fix there answers `busy` (as Craft Flags does).

## Verification

Node 18.20.8 on the fixed tree: three typechecks pass; lint 0 errors /
1,130 warnings (unchanged); build and `verify:bundle` pass (three known
webpack size warnings); `git diff --check` clean. Each new witness fails
with the fix reverted. Full Jest counts are in the review's author response.

## Not done

Native VS Code acceptance (long-file confirmation with a language change,
deactivation with a held save) and live provider calls were not run.

## Re-review (`28751221`) and its correction

F-01 and F-02 resolved. F-03 partially: a source request already reading
or measuring when deactivation began could adopt its board after the
drain emptied, so its first save outlived `deactivate`. The fix ends the
service's source requests at shutdown only (`LightboxSourceRequests.end`,
through `LightboxBoardLibrary.shutDown`, which replaced the public
`drain`); every in-flight request then finishes `superseded`. A tab's own
close still keeps its request for the next tab (a control test).
`LightboxService` was at 495 lines against the Lightbox modules' 500-line
guard, so its tickets moved to `LightboxSourceRequests.ts` (listed in
`LIGHTBOX_MODULES`); the service is now 491.
