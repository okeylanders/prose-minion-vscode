# PR Review — Draft Edit Slice 3c, part 4: continuity

**Disposition: Changes requested — three P2 continuity-boundary findings. Two nonblocking P3 hardening notes.**

**Author:** okeylanders · **PR:** [#180](https://github.com/okeylanders/prose-minion-vscode/pull/180) · **Reviewer:** Astra · **Reviewed:** 2026-10-27

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Implementation head:** `08ef805766bce5e575b9862cb930f3c6d1d07d57`

**Base and merge-base:** `684bad24c935d7c3b0166fbbcdc5dc40cc2e5a21`

**Scope:** 41 files · +1,301 / −189 · implementation tree `c31c678a67f850cab548cd520917b97c3485ccea`

## Summary

The flag-only category, two-sided anchoring, related-range port and VS Code adapter fit the existing architecture. The shared detector preserves the Lightbox's behavior, the fourth call retains consented-model/lifetime ownership, and edits touching either quote correctly withdraw the pair. No new text-writing path is introduced.

The blocking gaps are all in the promised scene-boundary exclusion: protected syntax can hide a real boundary, boundaries added during a pending run are not checked, and a later quote can straddle a boundary. These are host-side, deterministic failures, not uncertain live-model quality. Existing green CI does not exercise them.

## Findings

### F-01 · P2 · Remove protected marker candidates before selecting the section signal

**Location:** [`chapterSections.ts:213–217`](../../packages/core/src/utils/chapterSections.ts#L213).

`chapterSectionStarts` selects a signal from all raw paragraphs and only then filters protected offsets. A heading inside fenced code can therefore make `headings` win over genuine `scene-breaks`. Filtering that heading afterward leaves no boundary; the real scene break is never recovered.

````markdown
Alice had pink eyes.

```markdown

# Fake chapter

```

* * *

Alice had blue eyes.
````

With a continuity pair on `pink eyes` / `blue eyes`, production code sends **`breaks: []`** and shows the pair (**`flagged: 1`, `acrossBreak: 0`**). Remove only the code block and the same real break is sent and correctly drops the pair (`acrossBreak: 1`). Both quotes themselves remain unprotected.

**Requested correction:** exclude ignored marker candidates before signal and heading-level selection, without changing the existing unignored Lightbox behavior. Preserve source paragraph addresses. Add a production use-case control with a protected higher-priority marker and a genuine lower-priority marker, plus protected/unprotected heading-level competition.

This is not a request to reverse the ADR's documented precedence between ordinary, unprotected headings and scene breaks. The defect is protected text influencing which unprotected boundaries exist.

### F-02 · P2 · Recheck live section boundaries before publishing the moved pair

**Location:** [`CraftFlagsUseCase.ts:251–260`](../../packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts#L251).

The final pass rechecks protection and speech against the settled document, but section starts are checked only against the gesture snapshot. Begin with:

```text
Alice had pink eyes.

Alice had blue eyes.
```

While the reply is pending, insert `* * *` as its own paragraph between the two sentences. Neither quoted phrase is touched, so both survive `moveIssues`; the run then shows the pair across the newly inserted scene break (**`flagged: 1`, `acrossBreak: 0`**). Reading the final document through `chapterSectionStarts` finds that boundary. Inserting `## New scene` or `Chapter Two` produces the same failure.

**Requested correction:** compute live section starts and apply the continuity boundary gate to the moved pair before `show`, counting exclusions as `acrossBreak`. Cover inserted scene breaks, headings and chapter lines, ordinary non-boundary edits that still preserve a valid pair, and selections. Do not re-anchor by searching the new text.

This is an analysis-settlement gap. The writer's accepted PR #172 native Refactor Preview lifetime race does not apply: Craft Flags never opens that preview or writes text.

### F-03 · P2 · Check the entire quoted pair, not only the later quote's start

**Location:** [`craftFlagsPlacement.ts:109–112`](../../packages/core/src/application/services/draftEdit/craftFlagsPlacement.ts#L109).

The cross-break predicate stops at `flagged.start`. A later quote can begin before a break and contain the conflicting fact after it:

```text
Alice had pink eyes.

She walked away.

* * *

Alice had blue eyes.
```

Use `pink eyes` as the earlier quote and `She walked away.\n\n* * *\n\nAlice had blue eyes.` as the later quote. Production frame/codec validation accepts the 45-character later quote (`malformed: 0`), both sides anchor, and the request correctly lists `* * *`. Nevertheless the pair is shown (**`flagged: 1`, `acrossBreak: 0`**) because the later quote begins before the marker.

**Requested correction:** ensure the whole anchored pair, through the later side's end, lies within one section, including when a boundary lies inside either quote. Reuse the same complete-range predicate for gesture placement and F-02's settled check. Add codec-to-use-case broad-quote controls; a prompt instruction to quote briefly is not a host boundary.

## Nonblocking notes

### N-01 · P3 · Validate `holds` against own enum values

**Location:** [`CraftFlagsResponseCodec.ts:decodePair`](../../packages/core/src/infrastructure/api/services/craftFlags/CraftFlagsResponseCodec.ts).

`holds in HOLDS` accepts inherited names. Production JSON/frame probes for `constructor`, `toString`, `__proto__`, `hasOwnProperty`, `isPrototypeOf` and `valueOf` all produce a finding with `malformed: 0`; its typed `holds` becomes a function or object. Strict rendering comparisons currently omit the holds sentence, so this does not execute the value or select a wrong side. It does violate the closed-value/malformed contract. Use an own-property check, a `Set`, or explicit enum comparisons, and add these adversarial strings alongside the existing ordinary invalid-value tests. Keep the intentional null/absent/`neither` behavior.

### N-02 · P3 · Avoid a section-by-protected-region cross product

**Locations:** [`chapterSections.ts:217`](../../packages/core/src/utils/chapterSections.ts#L217), [`CraftFlagsUseCase.ts:breakLines`](../../packages/core/src/application/services/draftEdit/CraftFlagsUseCase.ts).

Each section start scans all protected ranges, and each break line filters them all again. Deterministic getter probes with 500 / 1,000 / 2,000 real headings, each holding inline code, required **374,250 / 1,498,500 / 5,997,000** protected-boundary reads in `chapterSectionStarts` alone. These inputs have 2,000 / 4,000 / 8,000 masked words, below the chapter ceiling. A small selection in an over-ceiling document still computes sections across the whole document; the call's word limit is not a work limit for this path. `begin` also computes this when continuity is disabled.

No runtime freeze is claimed from instrumented timings. Prefer an ordered cursor or binary search over already ordered regions, and skip continuity-only preparation when that category is off. Pin work growth with a counted-operation control rather than a clock. This is nonblocking performance hardening, separate from the three reproduced correctness failures.

## Architecture and behavioral review

- **Ownership and layering:** the shared section/paragraph helpers import no Lightbox infrastructure. The Lightbox retains its paragraph rule id and output shape; a differential check of 10,000 randomized paragraph arrays returns exactly the base detector's results. Core gains no `vscode` dependency or applier route. Changed production modules remain below the repository's 500-line threshold.
- **Category contract:** all five continuity kinds, definitions, speech policy, manifest default/enum, prompt map and root-field allowlist agree. Continuity offers no suggestion or replacement; an incoming suggestion is ignored and counted. Quotes remain independently validated and anchored, with overlap/order failures excluded. The worked example runs through production parsing and placement in the repository's tests.
- **Pair movement:** primary and related ranges move independently through edits; touching either withdraws the pair. Each side is held to its own original text, and both sides are checked for current protected syntax and speech. The adapter emits same-document `DiagnosticRelatedInformation`; Craft Flags still offers only Dismiss/Clear, not a fix.
- **Selection ownership:** the later side determines whether a pair belongs to a selection, as explicitly decided. The earlier link may lie outside it. Existing flags outside the gesture's selection are preserved only while still shown; there is no fresh search for a moved occurrence.
- **Four-call orchestration:** all 24 completion orders yield the same four annotations, summed usage and no intermediate publication. Rejected, failed or malformed categories do not suppress usable siblings; four rejected replies get one recovery presentation. Cancellation publishes nothing. A closed document during held continuity-prompt preparation dispatches no calls. Every call retains the approved model even after the engine's current model changes. Only continuity's request carries `breaks`.
- **No count on continuity:** phrase/stock-beat counts remain for their existing categories; a continuity message carries the why and optional holds sentence, plus the related-place message, never a phrase count.

## Independent verification

Read `AGENTS.md` (the `.ai/central-agent-setup.md` symlink), the Draft Edit ADR and Slice 3c decisions, changed production/tests, adjacent lifecycle/placement contracts and the preceding review dispositions. No repository `.agents/skills` directory or dedicated review template is present; this follows the existing `docs/pr-reviews` format.

The isolated cloud worktree matches the exact implementation head/tree. Retained dependencies were reused after matching lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; workspace aliases resolve this checkout. Checks use **Node 18.20.8 / npm 10.8.2**.

| Check | Independent result |
| --- | --- |
| `npm run typecheck` | Pass: core, webview and adapter |
| `npm run lint` | Pass: 0 errors / 1,133 existing warnings |
| `npm run build`, including `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full typed repository Jest (`--runInBand`) | Running at initial report publication; final result will be appended |
| `git diff --check` | Pass |
| Exact implementation-head push CI | [Success, 40510478213](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40510478213) |
| Exact implementation-head PR CI | [Success, 40510546431](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40510546431); every verify step passed |

Additional scratch evidence, separate from repository test counts:

- Production-code reproductions of F-01–F-03, with an existing-break control and three live-marker variants.
- **39** four-category service/use-case scenarios: all 24 completion orders; three isolated failure modes per category; all-rejected recovery; cancellation; held-prompt lifetime.
- **30,000** randomized valid multi-edit events / **135,292** primary ranges with related ranges checked against an independent coordinate oracle: boundary insertions/deletions, reverse input order, metadata preservation and input immutability.
- **10,000** randomized paragraph arrays comparing the moved detector with the base implementation.
- Production JSON/frame checks of valid, absent, ordinary-invalid and prototype-name `holds` values; deterministic section-work probes for N-02.

Evidence/logs remain outside the repository in `../pr180-review-evidence/`. Only this report is published. No source/test/dependency changes, earlier-report rewrites, formal GitHub reviews/comments, connected-Mac access, merges or provider calls were made by the reviewer.

## Integration and remaining acceptance

**Resolve F-01–F-03 before integration.** N-01/N-02 are nonblocking. Corrections need delta review and exact final-head CI verification; this report is not a formal GitHub review submission.

Native VS Code Problems/hover navigation and live-provider seeded-fixture hit/false-positive acceptance remain unrun. The ADR enables all four categories provisionally; the fixture run still decides shipped defaults. Passing mocked/controlled tests does not establish editorial quality. No paid calls were made.
