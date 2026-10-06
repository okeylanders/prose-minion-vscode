# PR Review — Workshop session recall excerpt summaries (Slice 2C)

**Author:** okeylanders · **PR:** [#129](https://github.com/okeylanders/prose-minion-vscode/pull/129) (open at review)
**Branches:** `claude/workshop-recall-excerpts` → `epic/workshop-session-recall`
**Verified base / merge-base:** `ababfdedff5098f5ab5940d68f3003752abb0463`
**Reviewed head:** `17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11`
**Scope:** 25 files · +2,308 / −463 · 12 commits
**Reviewed:** 2026-10-06 · **Mode:** fresh thorough review, three independent specialist passes (catalog/matching/privacy; service/loading/scope/concurrency; rendering/allocation/provenance), an independent challenge of the continuation finding, integration review, adversarial probes, and full automated verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🔵 Nit | Continuation guidance omits the detail mode, which can change when fewer sessions remain | A default discussion batch's sole continuation defaults to full; preserving discussion fits all three remaining replies instead of one | **Open**, nonblocking guidance improvement |
| F-02 | 🔵 Nit | Eager complete-size rendering broadens an inherited invalid-timestamp failure to earlier windows | A deliberately malformed but codec-accepted tail timestamp aborts rendering before a previously readable 6K prefix window | **Open**, optional malformed-file hardening; not a normal-use blocker |

**Verdict: Approve for integration into `epic/workshop-session-recall`, subject to required checks on the final branch head.** No Blocking, High, or Standard finding was established. F-01 is a continuation-guidance trap; F-02 is a low-priority robustness edge involving deliberately altered saved data. This approves the dormant Slice 2C core, not live persona acceptance, and does not authorize a merge.

## F-01 — Carry the resolved detail mode in continuation guidance

**Evidence:** [WorkshopRecallReadSection.ts:220–227](https://github.com/okeylanders/prose-minion-vscode/blob/17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11/packages/core/src/application/services/workshop/recall/WorkshopRecallReadSection.ts#L220-L227), [WorkshopTranscriptRecallService.ts:254–257](https://github.com/okeylanders/prose-minion-vscode/blob/17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallService.ts#L254-L257). **Confidence: High in the behavior; priority: Low.**

The continuation names the session and remaining ranges, but not the read's resolved detail. Detail is recalculated from the next request's session count: several sessions default to `discussion`, one defaults to `full`. A reader following a default discussion batch's sole remaining continuation therefore needs to know to add an option that the initial request never needed.

Independently reproduced with normal aggregate operations, the real coordinator/store, and no persisted-data alteration:

1. Save one short chat and a second chat containing five tool reports, each followed by a roughly 3,200-character persona synthesis.
2. Read both sessions without an explicit detail, rendering at the supported 12,000-character cap. The read is in discussion mode and the short chat finishes.
3. The only remaining hint is `Continue with <session turns="10-16">long-2</session>`.
4. Request that sole session/range without adding detail. The service chooses `full`; at the same 12K cap the next response includes `DISCUSSION-2` but stops before the next report, leaving another continuation. `DISCUSSION-3` and `DISCUSSION-4` are not yet delivered.
5. Repeat those ranges with `detail: 'discussion'`. All three remaining persona replies fit in **11,842 characters**, and the continuation is empty.

The inverse is also verified with the repository's real `saveExcerptCorpus()` fixture: an explicit full-detail stock/cliché batch emits continuations for turns `17–18` and `15–18`. Following those two session fragments without retaining full detail defaults to discussion, collapsing two remaining reports. That response is **1,636 characters**, versus **32,881** with full detail retained.

**Suggested improvement:** include the resolved `<detail>discussion</detail>` or `<detail>full</detail>` beside continuation guidance, or make the surrounding instruction explicit that continuations retain the current detail. Add a multi-session-to-single-session continuation witness, as well as an explicit-full batch witness.

**Why this is nonblocking:** the ADR explicitly prescribes partial continuation snippets, not self-contained calls. The following response discloses its detail, the remaining turn addresses stay correct, and no source data is lost. There is no live adapter here to establish how a persona actually follows the hint. This is a useful improvement to D10's goal of avoiding reliance on the persona remembering discussion mode, rather than a demonstrated violation of a complete-request contract.

## F-02 — Harden complete-size preparation against invalid saved timestamps

**Evidence:** [WorkshopRecallReadSection.ts:134–141](https://github.com/okeylanders/prose-minion-vscode/blob/17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11/packages/core/src/application/services/workshop/recall/WorkshopRecallReadSection.ts#L134-L141), [WorkshopRecallTime.ts:46–50](https://github.com/okeylanders/prose-minion-vscode/blob/17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11/packages/core/src/application/services/workshop/recall/WorkshopRecallTime.ts#L46-L50), [WorkshopSessionStateV1Shape.ts:543](https://github.com/okeylanders/prose-minion-vscode/blob/17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11/packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts#L543). **Confidence: High; priority: Low.**

Preparation computes a section's exact need by packing the entire requested transcript at `Infinity` before allocating its bounded share. Consequently it formats timestamps in entries that the first window will never reach.

The saved-state validator already accepts finite timestamps outside JavaScript's representable Date range. A normal saved room was created through the real aggregate/coordinator/store, then only its final turn's timestamp was deliberately changed to `Number.MAX_SAFE_INTEGER`. `store.readNamed()` still decodes it, and the recall service returns `outcome: 'read'`. Rendering at a supported 6,000-character budget now throws `RangeError` while sizing the unseen tail.

For the same service-produced document and budget, the exact base renderer source was replayed against the full-detail window helper. It returned a **632-character** first window, delivered turn 1, and continued at turns `2–5`; it did not format the invalid tail yet. This is a targeted base-renderer comparison, not a full baseline checkout/test run.

**Suggested hardening:** give invalid saved timestamps an explicit safe rendering fallback, or otherwise keep one such entry from aborting the whole prepared read. A regression should put the invalid time beyond a bounded prefix and beside a healthy session in a batch. Avoid silently treating a failed render as complete evidence.

**Why this is nonblocking:** normal `Date.now()`-generated sessions cannot produce this timestamp. The codec/date-validation weakness predates the PR; this change expands when it is encountered. This is a deliberately malformed-file case, not a verified failure in ordinary saved chats or an output-budget escape.

## Review observations and strengths to preserve

- **Catalog matching happens before the display cap.** Persona/live-room exclusions precede mode selection; title/excerpt matching then runs over the admitted listing, and only the resulting rows are capped at 50. Counts cover every admitted match. An independent older-match-behind-60-newer-decoys witness passes, alongside the repository's 52-match/50-row witness.
- **One narrow matching meaning.** Catalog and to-dos share the tokenizer, prefix rule, all-terms preference, and bounded evaluated/overflow-term disclosure. Context labels cannot select catalog/to-do sessions, but remain searchable. The shared-copy extraction preserves the previous to-do behavior in the inspected diff and passing regression tests.
- **Batch outcome alignment holds.** Requests are validated before any read. Empty, duplicate, oversized, and invalid-range requests are refused. Unknown/live, unreadable, byte-budget-skipped, and loaded outcomes keep request order. Failed cold reads are charged, while warm cached sessions remain readable after the cold-byte budget is spent.
- **Fair allocation is deterministic and bounded.** Short sections and notices give unused shares to the remaining sessions. Complete text that fits its share is delivered without an unnecessary footer reserve. Independent seeded checks covered **3,000 allocations** and **1,292 rendered windows**, including **1,202 follow-on windows** with detail explicitly retained. Total output/share caps, progress, exact requested-position coverage, no repeated positions, delivered IDs/counts, and collapsed-report provenance held.
- **Discussion mode uses the projection's participant classification.** Tool replies collapse; writer messages, host/guest replies, and events retain their normal rendering. Tool-body sentinels are absent, collapsed entries carry positions and turn IDs, and private tool exchanges retain their marker. Disclosure of collapsed reports is distinct from truncation of a large entry.
- **Privacy remains projection-owned.** Catalog fields are constructed explicitly, and the recall document still comes from the shared visible-transcript projection. Hidden attachment/context/evidence/archive/preview/excerpt-identity sentinels remain absent from data and rendered output, including batch/discussion reads. No new hidden-state source or write port was introduced.
- **Scope/cancellation protections survived extraction.** The service owns scope identity and cache generations; the loader checks around cold reads and charges failures. Independent overlapping-read probes confirmed scope-invalidated results are refused and stale in-flight work cannot repopulate the cache. Cancellation of the final failed read remains `AbortError`, not an unreadable-session result.
- **The chapter-summary use case is witnessed at the core seam.** The repository's real saved-session corpus discovers three 6.7 chats, reads their discussions together with no report-body sentinel, excludes the 6.8 decoy, and obtains the corresponding open to-dos. Full-detail overflow and per-session continuations are separately exercised.
- **Architecture remains contained.** All fifteen recall production modules remain below 500 lines. The new loader/allocation/section modules join architecture guards. No VS Code import enters core, no composition-root construction was added, and no provider calls or persistence-enum changes were introduced.

## Accepted limitations and slice boundary

These were checked against current code and the ADR rather than reported as newly introduced findings:

1. **`chapter 6.7` is not an exact/exhaustive chapter selector under the accepted lexical policy.** When another session matches all three terms, an open session titled `6.7 cliché pass` is excluded because it lacks `chapter`. The current ADR records this explicitly; `6.7` retrieves that session. Matching still uses the existing lexical/prefix semantics. Slice 4 needs the documented short-form guidance.
2. **The matching operation itself parses no session, but `store.list()` retains legacy I/O.** Indexed sessions avoid full snapshot reads. Without indexes, the unchanged listing path can parse named snapshots and `current.json`; those reads are outside recall's `parsedBytes`. A real, valid **5,603,634-byte** indexless session was independently confirmed directly readable but absent from catalog with `matchingSessions: 0` and `listingTruncated: false`. These inherited limitations are already recorded in the ADR's Slice 2 implementation note. “Every match” is bounded by the store listing, not every possible file on disk.
3. **The cold-byte ceiling is the accepted estimated, start-next-read model.** It is not an exact pre-read file-size quota. Successful reads are charged from reserialized decoded state; an admitted final read can cross the nominal ceiling, and failed reads take the conservative exact-read-ceiling charge. Cached reads are free. The loader refactor and new batch path preserve that model.
4. **150K per-turn enforcement and the model-window clamp are not implemented here.** This PR adds/pins the constants and preserves a configurable renderer cap. Slice 3 must enforce the aggregate, reject or narrow a clamp below `workshopRecallMinimumReadCharacters(sessionCount)`, validate the new grammar, and build manifest/provenance rows from actual rendered results.
5. **This remains dormant.** No production construction/caller of the recall service or renderers, no `transcript.*` operation in the live capability list, and no live prompt/codec wiring was found. The end-to-end tests mean aggregate → coordinator → store → recall core, not a live persona completing the writer's request. Publication, XML evidence handling, save/reopen behavior for the new capability values, and model-context acceptance still need the later slices.

## Verification actually run

All code checks target **`17d33e665009e5fa2d9f8dfe4a9f7e9ae18f9d11`**, before this report-only commit. Local runtime: **Node v24.19.0 / npm 11.9.0**. Dependencies were copied from the prior isolated cloud checkout after a byte-identical `package-lock.json` comparison. No fresh local `npm ci`, Node 18 run, or Node 22 run is claimed.

| Check | Result |
| --- | --- |
| Live PR metadata, remote refs, and local merge-base | Reviewed base/head matched; open, non-draft, mergeable, targeting the epic branch |
| PR discussion/reviews at review start | No comments or reviews returned |
| `npm test -- --runInBand` | **259 suites / 3,322 tests / 2 snapshots passed**, 96.442 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| ESLint over all 22 changed TypeScript files | **0 errors / 0 warnings** |
| Full repository ESLint, excluding independent probes | Exit 0; **0 errors / 1,097 warnings**; baseline lint was not rerun, so no warning-delta claim |
| `npm run build` | Both production bundles and `verify:bundle` passed; three webpack size/performance warnings, 1.24 MiB webview bundle |
| `git diff --check ababfded...17d33e6` | Passed |
| Independent catalog/privacy probes | **7 passed**, including real-store matching/disclosure and hidden sentinels |
| Independent loader/scope/concurrency probes | **6 passed**, including real legacy-listing characterization and concurrent invalidation |
| Independent rendering probes | **4 focused probes passed**; characterize both nits and full-report hints |
| Independent allocation/continuation matrix | **2 seeded tests passed**: 3,000 allocations, 1,292 windows, 1,202 follow-ons |
| GitHub CI for reviewed code head | **Success**, [run 37408401070](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37408401070), `verify` job: `npm ci`, typecheck, tests, lint, and build all succeeded on the workflow's Node 18 configuration |

Probe assertions that characterize known edge behavior passing are not claims that the suggested improvements already exist. Review-only `.probe.ts` files were excluded from the default suite/lint and are not part of the publication; no implementation or repository tests were changed. No live VS Code Extension Development Host, paid provider call, or live persona pass was performed. The author's mutation-check and separate Node 18/22 local claims were not independently replayed.

The only intended published change is this review document. Its commit creates a new PR head; CI for that exact documentation head must be checked after publication. No merge, close, branch deletion, or implementation fix is part of this review.
