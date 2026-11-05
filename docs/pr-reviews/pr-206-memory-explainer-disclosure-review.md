# PR #206: Memory explainer disclosure review

## Correction re-review: N-01 resolved

- Correction implementation: `4ee49756db863bd478776154f3442035de451e8c`.
- Comparison from report commit `87a57f18ba70a481131ef6ced168a3f98c453bbd`: exactly one production line changed, `.pm-ws-memory-vs-head svg` becomes `.pm-ws-memory-vs-head > svg`.
- An independent selector probe confirms that the accent rule still matches the direct information icon and no longer matches the nested chevron. Its wrapper's faint/hover colors can now inherit normally.
- Re-ran the actual panel and CSS-floor suites: **2 suites / 20 tests pass**.
- **Updated verdict: no open findings.** The original N-01 and review below are retained as history.
- Correction-head [CI run 41950161677](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41950161677) is in progress at this addendum's publication: installation and all typechecks passed; tests running. The earlier green run below applies to the earlier implementation and is not being substituted for this correction's CI.
- This addendum contains no production edit, formal approval, or merge.

## Original implementation review

- Review date: 2026-11-05.
- PR: https://github.com/okeylanders/prose-minion-vscode/pull/206
- Reviewed implementation: `ae6025613b139b4c09f2e36f08a138f3c6ce5feb`.
- Target: `epic/workshop-project-memory`, observed at `0a0f1a5b3533c08ce187602148673ad3fa60c67e`.
- Scope: all 11 changed files, controller/persistence composition, settings lifecycle, disclosure accessibility, and the CSS cascade.
- **Verdict: no blocking findings. One non-blocking CSS polish note below.** This is a review report, not a formal GitHub approval or permission to merge.

## N-01 — P3: The generic icon color masks the chevron's normal and hover colors

**Location:** `packages/core/src/presentation/webview/styles/workshop/memory.css:45–61`.

The chevron wrapper is given `var(--pm-faint)`, changing to `var(--pm-text-2)` on hover. However, `.pm-ws-memory-vs-head svg` explicitly gives every descendant SVG `var(--pm-accent-hi)`. The nested chevron SVG therefore uses the accent instead of inheriting either wrapper color. Its rotation works; only the intended color treatment is ineffective.

A small JSDOM cascade probe with the three color tokens replaced by distinct RGB constants confirms that the wrapper takes the faint color while the chevron SVG takes the accent color. This is a CSS-cascade verification, not a screenshot or native VS Code visual test.

Optional correction: scope the accent to the direct information icon, for example `.pm-ws-memory-vs-head > svg`, or explicitly make the nested chevron SVG inherit its wrapper's color. This does not block the fold-away behavior.

## Persistence and lifecycle

The preference is correctly owned by the viewer, not by a room or project-memory record:

- `useWorkshopMemoryExplainer` reads a boolean only. Missing, null, string, numeric, object, and array values open the explainer rather than treating a truthy/falsy value as a choice.
- Stored `false` remains false. Functional state updates prevent a rapid sequence of clicks from closing over stale state.
- The controller exposes state, actions, and a small persistence contract, following the existing hook pattern.
- `WorkshopApp` reads through `usePersistedState` and adds the preference to its existing composed `usePersistence` call. It does not create a separate writer that would replace other webview-state keys.
- An independent real-app probe preserves `workshopRailTab: 'material'` and confirms the composed snapshot changes only the explainer preference on a toggle.
- Switching settings tabs, cancelling and reopening settings, and receiving another host session snapshot do not reset the choice.
- Toggling posts no host message. In particular, it does not apply conversation settings, mutate memory, save a session, or require the settings Apply button.

This PR changes no session codec, filesystem store, transport message, memory loading, model prompt, or write authorization.

## Accessibility and presentation

- The entire title line is a native `button type="button"`, so it participates in normal keyboard navigation and activation without custom key handlers.
- Its text supplies the accessible name. Both icons are decorative, and the new chevron is explicitly hidden from assistive technology.
- `aria-expanded` tracks the controller. `aria-controls` points to the actual definition list through `React.useId`.
- Folding keeps the title and named region available while hiding the list. The explicit scoped `[hidden]` rule wins over `display: grid`; an independent DOM/CSS check observed `grid` when open and `none` when folded.
- The disclosure retains focus after repeated toggles. The shared full-tab `button:focus-visible` ring remains applicable because the new reset does not remove its outline.
- The mode controls, memory manager, folder action, Apply/Cancel behavior, and region order are unchanged. The existing integration suite still covers those paths.
- The preference remains usable while a host setting apply is pending, which is appropriate for a presentation-only choice.

Native VS Code keyboard/screen-reader and visual execution were not performed. Actual extension-host reload/restart behavior remains part of the live checklist; the reviewed tests remount the real app against mocked webview state. No billable provider calls were made.

## Architecture

No new upward dependency, host-specific import, duplicated persistence mechanism, or untyped production interface was introduced. The new controller is 57 lines. `WorkshopApp.tsx` is already an oversized composition component and grows by 12 lines to 1,816; the new behavior itself lives outside it. This is existing structural debt, not a new blocker for this small UI preference.

## Verification

Runtime/configuration files were materialized for the exact reviewed commit and checked against Git blob hashes. The check covered 2,019 relevant files, including repository guidance and the live checklist, with no mismatches. Installed dependencies were reused against the unchanged lockfile. Production source was not edited.

- **Local typecheck:** pass, core host, core webview, and extension targets.
- **Focused production Jest:** 9 suites / 136 tests pass, covering the new hook, settings panel, modal, real-app memory manager, composed persistence, architecture boundaries, and CSS floor.
- **Independent interaction probes:** 8 additional cases pass, plus 6 original real-app cases in the same temporary fixture (14 total). Added coverage: tab changes and Cancel/reopen without a host mutation; host refresh and composed-state preservation; 11 batched clicks with focus retention; and five malformed persisted values through the real app.
- **Changed-file lint:** 0 errors / 6 existing warnings. The warnings concern existing component naming and pre-existing unbraced conditionals.
- **Local broad Jest:** still running at report publication, with no assertion failure observed. It is not represented here as a completed local pass.
- **Local production build:** the environment killed webpack with exit 137. This is not a local build pass; the same reviewed implementation's CI build completed successfully.
- **CI:** [run 41948935571](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41948935571), associated with the reviewed implementation, completed successfully. Its job log confirms **692 suites / 9,706 tests / 59 snapshots**, all passing. Install, all typechecks, lint, both webpack bundles, and bundle verification succeeded.

The first unbounded local focused run was also killed with exit 137. The bounded retry completed successfully; the numbers above are from that completed retry. No killed or still-running stage is being counted as a local pass.

## Disposition

No functional correction is required by this review. N-01 is optional polish. Continue the human live-pass checklist and recheck the exact head if implementation changes. The report-only publication commit is separate from the implementation SHA evaluated above.
