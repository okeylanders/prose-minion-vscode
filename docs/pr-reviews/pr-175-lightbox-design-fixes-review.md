# PR Review — Lightbox Design Fixes, Slice 4M

**Author:** okeylanders · **PR:** [#175](https://github.com/okeylanders/prose-minion-vscode/pull/175)

**Branches:** `epic/lightbox-design-fixes` → `epic/lightbox`

**Reviewed implementation head:** `d341223c43aa393cac9d430c785378ca7a1dcd7a`

**Target base:** `611bebd63cd782c481c55768c53ff8af840517c8` · **Merge-base:** `daec95d342800a1eb12af7befc20634e610fb444`

**Actual integrated tree:** `b4adcd3b107b41d31e0c94bb2d59d45334904cc3`, retrieved from `refs/pull/175/merge`; both parents verified as the target base and implementation head above.

**Scope:** 77 changed files · +8,883 / −71; seven implementation files, tests, Lightbox epic notes and supplied visual evidence.

**Reviewed:** 2026-10-26 · **Reviewer:** Astra

## Summary

**Approved for `epic/lightbox`, with one nonblocking P3 follow-up.** No blocking defect established in the fixed focus-line layout or the secondary action's scope, price, reasons and retained-reading behavior. One nonblocking accessibility-consistency note is recorded below.

This review distinguishes independent source, production-host and DOM execution from the author's browser evidence. **No native VS Code session or live provider call was run.** Independent Chromium geometry could not be run in this cloud sandbox; the supplied screenshots and measurements were inspected, not relabeled as independent reproduction.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| N-01 | P3 | Nonblocking follow-up | The new unavailable secondary press inherits the primary's native-disabled keyboard-focus limitation |

### N-01 — Keep unavailable run-line controls discoverable by keyboard

**Location:** [`LightboxRunLine.tsx:40–47`](https://github.com/okeylanders/prose-minion-vscode/blob/d341223c43aa393cac9d430c785378ca7a1dcd7a/packages/core/src/presentation/webview/components/lightbox/LightboxRunLine.tsx#L40-L47).

The new secondary action uses native `disabled`, so an unavailable **Re-analyze all** cannot receive keyboard focus to expose its `aria-describedby` reason. This differs from the focusable `aria-disabled` pattern used by the adjacent call controls and documented in `AGENTS.md`.

This is **not a new regression in the old primary action**, which was already native-disabled at the merge-base. The visible, correctly attributed reason remains available; no screen-reader or WCAG-conformance claim is made. An independent DOM witness confirms that an enabled Finish receives focus while the disabled secondary does not.

Suggested follow-up: standardize the pair on the established focusable-disabled pattern, guard activation explicitly, and retain focus, description and disabled-activation tests. This does not block the two requested fixes.

## Independent coverage

### Ribbon stability and range/count semantics

- Inspected the fixed-height, single-row CSS and component structure: the eyebrow no longer shares a wrapping row with the focus line; the text can shrink/ellipsis, while the count tail cannot shrink. The outer focus paragraph stays mounted through idle, keyboard focus and pin transitions; it is deliberately not a live region.
- Independently exercised **1,000 deterministic generated paragraph sets**, plus seven cap/size boundaries: ascending nonoverlapping ranges, deduplication, exact full counts, no input mutation, and the 60-range display cap all passed, including 50,000 sparse paragraphs. The cap truncates only displayed ranges, not the count.
- Inspected focus propagation, pin fallback and the existing paragraph-resolution contracts; no second hover-driven geometry owner was introduced. The CSS uses features available at the declared Chromium 114 floor.
- The independently built integrated webpack bundle passed five JSDOM scenarios: repeated keyboard focus/pin transitions retain the focus-line element and exact 240-paragraph count; the secondary sends `all` with the current model/estimate; refused starts restore the actions; Finish still sends `rest`; keyless and oversized actions cannot activate; all reason references resolve; a new board removes the stale secondary pending its own estimate. These are DOM/message checks, not layout measurements.

### Re-analyze all, Finish and kept readings

- **448 planned-group/status combinations** agree with the production planner and price exactly the calls each action selects; **48 landed/oversize combinations** disable only the action that would make an oversized call. No-key reasons are shared once; differing reasons remain separately associated and labeled.
- The secondary uses the existing `{ mode: 'all' }` route and estimate/model identity; Finish remains `{ mode: 'rest' }`. Idle, estimating, all-landed, none-planned and running states do not acquire an inappropriate secondary action.
- A separate production-host witness first reads the board with B failing, then switches off C/D/E/G/F: the secondary prices and starts only **A+B**, while Finish prices only B. Every paid tile stays during the held run; untouched groups remain deep-equal. Cancel retains tiles, marks A's earlier reading, and late held replies do not overwrite the stopped board.
- The historical qualified run-line cost wording was already retained in PR #166's accepted re-review. This slice does not reintroduce the unqualified dollar-cap wording that review corrected.

### Actual integration and supplied visual evidence

- PR #173's base advance is included in the **actual integrated tree**, not merely checked for a clean textual merge. Its changes are disjoint from this slice's production modules. Full typed Jest, typecheck, lint and production build all pass on that combined tree, and host-state reproduction is byte-identical before and after integration.
- Rebuilt the author's 320-paragraph fixture through real handlers, service, runner, codec, store and library, with a stubbed provider, on **both head and integrated tree**. The state (192,583 bytes, SHA-256 `75a558a998eb6d7dfd92f746def180949918d5cdd6f38a2c95933ab31afc103c`) and log reproduce the committed files **byte for byte**.
- Inspected actual supplied full-width and narrow/zoomed captures: section and word hover, clipped references with the count retained, wrapped controls, shared no-key reason and side-by-side controls when space permits. The harness and facts cover six width/zoom configurations. Its head measurements show one focus-text transition and no height change; its base section case records 34 transitions and alternating heights. The broad audit reports 427 controls, with 23 explicitly skipped at the narrowest/zoomed configuration—not every control tested there.
- These are **author-supplied Chromium measurements**, not native VS Code acceptance or independent browser reproduction. Local Chromium launch failed on a sandbox Unix-socket restriction; an authorized cloud-only escalation failed before launch on environment setup. No protected-path workaround or connected Mac was used. DOM checks cannot establish hover geometry, real zoom or screen-reader behavior.

## Verification

Runtime: **Node 18.20.8 / npm 10.8.2**. Dependencies were reused from the retained installation only after verifying the lockfile SHA-256 is identical (`65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`). The full-suite/build lane was serialized with PR #174's review.

| Check | Result |
| --- | --- |
| Actual integrated tree: `npm run typecheck` | Pass: core, webview and extension |
| Actual integrated tree: `npm run lint` | Pass: 0 errors / 1,133 warnings |
| Actual integrated tree: full typed Jest | Pass: **556 suites / 7,741 tests / 59 snapshots**, 703.123 s |
| Actual integrated tree: `npm run build`, including `verify:bundle` | Pass |
| Independent run-control/host checks | 2 suites / 5 tests pass; 496 matrix cases within them |
| Host-state reproduction, head and integration | 1 suite / 1 test pass per tree; exact state/log bytes |
| Focus-line property/boundary checks | 1,007 cases pass |
| Exact-bundle DOM checks | 5 scenarios pass, no captured application errors |
| `git diff --check` | Pass |
| Exact implementation-head CI | Both `verify` runs succeeded: [push 40364391615](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40364391615), [PR 40364497245](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40364497245) |

The small independent scratch Jest checks use bounded transpilation, not a substitute for full typed Jest/typecheck. Their first deliberately constrained typed attempt exhausted its 600 MB heap before executing tests; the passing scratch runs and host-state regeneration emitted worker-teardown/deprecation warnings. The build reports the existing three webpack asset-size/performance warnings. The aggregate suite passed with ts-jest deprecation warnings and no worker-teardown warning in its captured log.

## Publication scope and remaining boundaries

Report only under `docs/pr-reviews/`; no product changes, formal GitHub review/comment, merge, deployment or billable provider call. No implementation from PR #174 is implicitly cleared by this review. PR #172's accepted native-preview lifetime risk remains an accepted risk, not a resolved defect or something tested here.

This approval covers the implementation against the recorded base. A later code or base advance requires its own delta/integration check. A report-only commit does not invalidate the code evidence; its exact-head CI is checked separately after publication.
