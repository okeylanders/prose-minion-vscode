# PR Review — Draft Edit Slice 3c, part 3: gesture strain

**Latest disposition — re-review of `4ab1e0cf`: No blocking findings; N-01 and N-02 resolved. Native/live acceptance remains separate.**

**Disposition: No blocking findings. Two optional P3 cleanup notes. Native VS Code and live-provider fixture acceptance remain separate and unrun.**

**Author:** okeylanders · **PR:** [#179](https://github.com/okeylanders/prose-minion-vscode/pull/179) · **Reviewer:** Astra · **Reviewed:** 2026-10-27

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Implementation head:** `d50bb1b28abd6195cc8e89f1a9e5ac5237f60be3`

**Base and merge-base:** `98819b34889f89f1acae589e206ae67aa3b2d9e6`

**Scope:** 28 files · +922 / −146 · implementation tree `1c6c994ec0a82cc5ff95c3a1de321318ab5797b5`

## Summary

Gesture strain joins the existing category-owned, flag-only path. Its four kinds, definitions, prompt, worked example, root-field allowlist, speech policy and manifest agree. The model judges the finding; host code alone attaches a live narration count. There is no new write path, replacement, preview or Gesture Playground coupling.

The third parallel request preserves the approved model, per-category replies and rejection isolation. Stock-beat counts are lazy and cached by beat, use settled text and current speech/protected ranges, and do not consume or replace other categories' phrase counts. No source correction is required for integration into the epic. The notes below are small completeness/consistency improvements, not evidence that live editorial quality has been measured.

## Nonblocking notes

### N-01 · P3 · Polish the eye-roll forms and overlapping aliases

**Location:** [`stockBeats.ts:56–59,87`](../../packages/core/src/utils/craftFlags/stockBeats.ts#L56).

The compound alternative accepts `eye-roll`, `eye-rolls` and `eye-rolling`, but not the ordinary past tense `eye-rolled`. For `She eye-rolled. Later she rolled her eyes.`, a gesture flag on `rolled her eyes` receives **1**, so no recurrence line appears. Including `ed` in that alternative would make the listed compound consistent with the simple verb's forms. The closed-list limitation is explicit; this is completeness polish, not a claim that every paraphrase must be recognized.

A second, uncommon edge comes from reusing overlapping *phrase* matching for aliases of the *same beat*: `An eye roll of her eyes.` matches both `eye roll` and `roll of her eyes`, producing **“Eye rolls appear 2 times in this document.”** from one written gesture. If tightening this, coalesce overlapping same-beat matches without changing the intentionally overlapping phrase counter (`never say never` in `never say never say never`). Add message-level controls for both cases. Protected occurrences remain excluded correctly.

### N-02 · P3 · Keep the host fallback inside its own phrasing fence

**Locations:** [`CraftFlag.ts:60–64`](../../packages/core/src/domain/models/CraftFlag.ts#L60), [`CraftFlagsResponseCodec.ts:74–77`](../../packages/core/src/infrastructure/api/services/craftFlags/CraftFlagsResponseCodec.ts#L74).

`craftFlagHostWhy('complicated')` returns `Choreography the reader has to stop and assemble.` The shared fence returns `forbidden` because it contains `has to`; a withheld model why is therefore replaced with text that the same fence would withhold. This wording is plainly descriptive, not an instruction to the writer, so the displayed note is not harmful and this is not a blocker. A small rephrasing of the shared definition/prompt, or an explicit documented distinction for host-owned fallback text, plus a table-driven fallback test would remove the inconsistency without weakening model-note screening.

## Architecture and behavioral review

- **One category owner:** the canonical category list, kinds/definitions, `CRAFT_FLAG_LEAVES_SPEECH`, `ROOT_FIELDS`, prompt map and manifest all include gesture. The existing normalizer captures known ids once in canonical order; existing category preferences are not rewritten. The shared prompt's selective-flag exception is appropriate for thin beats and does not change cliché/register policy.
- **Response boundary:** only gesture's four kinds are accepted; sibling kinds are malformed rather than guessed. A gesture reply's `register`, model-supplied beat counts and `replacement` are ignored and counted. Quotes retain their original ceiling; malformed fields, why/suggestion screening and host fallback remain fail-closed. Host counts cannot be spoofed by reply fields.
- **Request isolation:** all six completion orders produce the same three annotations and summed usage, with no intermediate publication. A rejected, malformed or failed request for any one category leaves usable siblings intact. Three rejected replies yield three captures but one recovery presentation. Cancellation publishes no partial annotations. All three requests retain the model priced before approval, even if the engine's current model changes.
- **Lifetime and placement:** closing during gesture-prompt preparation dispatches no category. Markdown/plaintext, whole-file, selected and over-ceiling selection-only runs preserve scope and offsets. Counts still describe the whole live document when a long document's selection alone was sent. Newly inserted speech or protected syntax suppresses the flag/count; a touched finding is stale; a closed document shows nothing. Selected runs preserve only still-current earlier flags outside their original selection. Every controlled run performs zero writes and releases its watch/ownership.
- **Counts:** all ten beat families are closed lexical patterns, not inferred lemmas or model totals. A gesture naming multiple beats gets each once in quote order, without a second phrase line; singleton counts remain silent. Other categories and gesture flags with no listed beat retain phrase counting. Repeated cached requests for 10,000 nods require exactly 10,001 regex executions, not a scan per flag. Supplementary-Unicode and protected-range controls preserve forward progress and exclusions.
- **Layering:** core gains no VS Code import, applier access, dependency or recovery protocol. The Workshop guard's additions are four exact collision tokens rather than a broad gesture exemption. No new oversized feature module is introduced; pre-existing architecture-test size is not new production debt.

## Independent verification

Read the relevant `AGENTS.md`/`.ai/central-agent-setup.md` instructions, Draft Edit ADR and Slice 3c decisions, changed production/tests, adjacent run/codec/placement contracts and earlier review dispositions. No repository `.agents/skills` directory or dedicated review template is present; this follows the existing `docs/pr-reviews` format.

The isolated cloud worktree matches the exact implementation head/tree. Retained dependency files were reused after matching lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; workspace aliases resolve this checkout. Checks use **Node 18.20.8 / npm 10.8.2**.

| Check | Independent result |
| --- | --- |
| `npm run typecheck` | Pass: core, webview and adapter |
| `npm run lint` | Pass: 0 errors / 1,133 existing warnings |
| `npm run build`, including `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full typed repository Jest (`--runInBand`) | Pass: **576 suites / 8,117 tests / 59 snapshots**, 574.767 s, exit 0 |
| `git diff --check` | Pass |
| Exact implementation-head push CI | [Success, 40496928359](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40496928359); every verify step passed |
| Exact implementation-head PR CI | [Success, 40497000923](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40497000923); every verify step passed |

Additional independent scratch probes, separate from repository test counts:

- **60** production frame/codec/use-case cases covering all four kinds, both languages, scope/selection, live edits, protected/speech exclusions, ignored model fields, fallback behavior and three worked-example frames. The example yields four anchored flags, exactly two nod-count messages and no dropped/withheld entries. These probes also reproduce N-02 rather than treating the fallback as fence-clean.
- **18** three-category service/use-case scenarios covering all completion orders, consented model, partial failures, recovery presentation, cancellation and held-prompt lifetime.
- Independent count/message probes reproducing N-01, checking protected overlapping aliases, supplementary-Unicode progress and the 10,000-nod/500-request cache bound.

These are controlled-host/source checks, not native VS Code or live-model acceptance. Evidence/logs remain outside the repository at `../pr179-review-evidence/`. Only this report is published: no source/test/dependency changes, prior-report rewrites, formal GitHub reviews/comments, connected-Mac access, merges or provider calls by the reviewer.

## Integration and remaining acceptance

**No blocking implementation finding on `d50bb1b2`.** Check the exact report-head CI after publication; subsequent functional changes require delta re-review. N-01 and N-02 are optional cleanup, not merge holds.

The ADR explicitly enables all three categories provisionally; the recorded fixture run still decides shipped defaults. Native confirmation/Problems UI and live seeded-fixture hit/false-positive results remain unverified. The worked example proves framing, anchoring, speech exclusion and counts, not whether a live model reliably distinguishes deliberate figures, thin beats or complicated choreography. No paid calls were made or authorized by this review.

PR #172's narrowly accepted native Refactor Preview lifetime race remains unchanged and not fixed. Craft Flags has no preview/write path, and that acceptance does not waive pre-call ownership or model-consent checks.

## Author response (`8a91b197`)

**N-01 and N-02 are both taken, in this PR.** Your text above is unchanged. Both are defects in my own commits, not style points: one gave a wrong count, the other a fallback its own fence would withhold. So I fixed them rather than leaving them as optional.

### N-01 · eye-roll forms and overlapping aliases

- **"An eye roll of her eyes" is one eye roll.** You were right that the beat counter borrowed the phrase walk's overlap rule, and a beat's aliases are not a phrase.
  - `matchesOutside` now takes how overlaps count (`OverlappingMatches`: `each` | `once`, `each` by default).
  - Stock beats use `once`: each search resumes at the last match's end, never before the next code point, so the walk still moves forward.
  - Phrase counts keep `each`, so "never say never" still stands twice in "never say never say never" (PR #177 N-03).
- **The compound takes the simple verb's forms:** `eye[\s-]?roll(?:s|ed|ing)?`, so "eye-rolled" counts.
- **Controls:**
  - `stockBeats.test.ts`: eye-rolled, eye-rolls and eye-rolling; overlapping aliases count once ("An eye roll of her eyes" is 1); aliases that do not overlap count apart ("A shake of the head, shaking her head" is 2).
  - `CraftFlagsGesture.test.ts`, at message level: "She eye-rolled … Later she rolled her eyes" gives "Eye rolls appear 2 times in this document."; "an eye roll of her eyes" alone shows no count.

### N-02 · the host fallback inside its own fence

- `complicated`'s definition is now "choreography the reader stops to assemble", in the domain and verbatim in `30-gesture.md`. The prompt's longer guidance below the list is the model's instruction, not a note, so it keeps "has to stop and assemble".
- **Control:** `CraftFlagsResponse.test.ts` holds every kind of every category's host why to `craftFlagPhrasingFault`. Today that is ten kinds; a new category's kinds join the loop on their own, through `CRAFT_FLAG_KINDS`.
- The fence is unchanged, so model notes are screened exactly as before.

**Mutations,** each failing a test:
- beats counting overlaps again;
- phrases joining overlaps;
- the compound without `ed`;
- the old definition (in the domain and the prompt).

The ADR's Part 3 gains a "PR #179 review (Astra), as built" note. The `Complicated` row and `docs/TOOLS.md` use the new wording, and AGENTS.md's gesture bullet names both fixes.

### Verification

Node 18.20.8 on `8a91b197`:

- typecheck passes;
- Jest: 576 suites / 8,120 tests / 59 snapshots, up 3 tests;
- lint: 0 errors / 1,133 warnings;
- build, with `verify:bundle`, passes.

## Independent re-review — 2026-10-27

**N-01 and N-02 resolved; no blocking findings.** Reviewed correction head `4ab1e0cf1a07a7a63f196893c31b1c310b9d88b3` (fix `8a91b197`), tree `f3822c0baf4fa9232fac84c56cc3f505e76d4187`. The twelve-file delta from report `cb360ee8` is limited to the count policy/form correction, the fallback definition and accompanying tests/documentation. The original review and the author's response above are preserved.

**N-01:** `eye-rolled` now joins the listed compound forms, and the two-form sentence produces `Eye rolls appear 2 times in this document.` A single `eye roll of her eyes` produces one beat and no recurrence line. Stock beats explicitly request `once`; ordinary phrase counting retains default `each`, including `never say never` twice in `never say never say never`. The walk advances by at least one whole code point in both modes, including empty matches, so the correction does not reintroduce PR #177's surrogate-pair progress defect. Protected-range and repeated-cache controls remain sound.

**N-02:** the new domain/prompt definition, `choreography the reader stops to assemble`, passes the unchanged phrasing fence. The added table-driven test covers every kind in every category rather than special-casing this one fallback. Model why/suggestion screening has not been weakened.

Fresh Node 18.20.8 / npm 10.8.2 verification on the exact correction tree:

| Check | Result |
| --- | --- |
| Full typed Jest | Pass: **576 suites / 8,120 tests / 59 snapshots**, 555.621 s, exit 0 |
| Typecheck | Pass: core, webview and adapter |
| Lint | Pass: 0 errors / 1,133 existing warnings |
| Build and `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Diff hygiene | `git diff --check` passes |
| Exact correction-head push CI | [Success, 40502160475](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40502160475); every verify step passed |
| Exact correction-head PR CI | [Success, 40502166454](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40502166454); every verify step passed |

The **60** independent gesture frame/codec/use-case probes and **18** three-category service/use-case probes pass again, now requiring the complicated fallback to be fence-clean. Independent count/message tests also recheck the reported cases, protected full/shared/union ranges and adjacent distinct matches. Eight empty-global-Unicode cases terminate in 20 executions across both modes; 10,000 overlapping eye-roll aliases requested 500 times produce 10,000 beats in 10,001 executions, as do 10,000 nods. Evidence is outside the repository at `../pr179-rereview-evidence/`.

The prior report-only head `cb360ee8` finished both [push CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40499754841) and [PR CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40499763592) successfully, every verify step checked. This appendix changes only the review report; check its exact-head CI separately after publication. Native UI and live editorial fixture/ship-default acceptance remain unrun. PR #172's narrowly accepted preview limitation remains unchanged.
