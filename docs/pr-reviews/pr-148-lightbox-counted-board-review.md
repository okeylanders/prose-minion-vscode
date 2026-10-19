# PR Review — Lightbox Slice 2A: The Counted Board

**Author:** okeylanders · **PR:** [#148](https://github.com/okeylanders/prose-minion-vscode/pull/148) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-2a-board` → `epic/lightbox`
**Verified base / merge-base:** `a504f6d6c264787163d057a1130e03c5326ac5e2`
**Reviewed implementation head:** `23c3f476fb891600af75c8beebcf72e1d1dbcde2`
**Scope:** 91 files · +7,244 / −105 · 11 commits
**Reviewed:** 2026-10-19 · **Reviewer:** Astra · **Mode:** independent source/spec review, real-service deferred-I/O and measurement probes, real-component and production-bundle DOM witnesses, supplied-image inspection, Workshop lifecycle comparison, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | An older source read can replace a newer choice, or post a stale refusal over it | Deferred resolver plus real handler/service; production-bundle source/preview and alert witness | **Open** |
| F-02 | Medium / P2 | A command refusal produced before webview readiness is lost on the initial board request | A 50,001-word selection is refused, but the subsequent mount request returns only `board: null` | **Open** |
| F-03 | Medium / P2 | POS paragraph references do not identify the occurrences used for their counts | Noun/verb `light` each count once but reference both paragraphs; valid possessive `alice` counts once with no paragraph | **Open** |
| F-04 | Medium / P2 | Inspector truncation permanently hides exact paragraph addresses | A valid 10,000-word, 5,000-paragraph board has unreachable ¶49–¶52 inside the first ribbon bucket | **Open** |

**Verdict: Request changes before merging into `epic/lightbox`.** The counted-board implementation and the authored verification suite are substantial, but the four independently reproduced defects affect current Slice 2A source ownership or evidence navigation. Green implementation-head tests do not cover these cases. This report does not request Slice 2B readings, paid calls, saving, or later handoffs. Required CI on the exact report-only head remains a separate post-publication check; green CI alone does not resolve these findings.

## F-01 — Own source intent before the first asynchronous read

**Changed-code location:** [`LightboxHandler.ts:128–153`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/application/handlers/domain/LightboxHandler.ts#L128-L153), with the generation first acquired in [`LightboxService.ts:140–156`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/infrastructure/lightbox/LightboxService.ts#L140-L156).

The supersede guard orders calls to `buildBoard`, not the writer's source requests. File resolution happens before that call. Thus an older read that resolves last obtains a *newer* service generation and wins. The resolver's failure path also posts a refusal without checking whether another source has since been selected. The picker and refresh paths enter this same unowned interval; there is no inbound result correlation in `useLightbox` to repair it.

**Independent reproduction:** Use the real `LightboxHandler`, `LightboxService`, and measurement services, replacing only file I/O with a deferred resolver and standards enrichment with a local pass-through.

1. Begin `LIGHTBOX_SET_SOURCE` for `older.md`; hold its resolver promise.
2. Send the text selection `A newer choice waits beside the river.` from `newer.md`; let it finish.
3. Resolve the first file as `An older choice stands by the gate.`
4. Observe posted board paths `[newer.md, older.md]` and `currentBoard().source.displayPath === 'older.md'`.

The expected-safe assertion that the newer choice remains current fails on this head. A second probe rejects the old resolver after the new board succeeds: the messages are `LIGHTBOX_BOARD` followed by an obsolete `LIGHTBOX_SOURCE_REFUSED`. A production `webview.js` witness confirms the UI consequences: the late old board replaces the newer source path and preview; the late refusal displays an alert over the valid newer board. This does not depend on AI or standards-enrichment timing.

**Requested change:** Establish one authoritative source-request identity before picker/resolver/build awaits, and guard both adoption and every success/failure publication against the current intent. Its ownership must remain coherent across the shared service and per-panel handlers; a per-handler counter alone should not allow an old disposed owner to win against a replacement panel. Preserve the intended picker-dismissal behavior. Add regressions for out-of-order file reads, refresh versus a new selection, old read/build failures after a new choice, and close/reopen while a source is pending. The existing standards-await supersede test remains useful but is not end-to-end coverage.

## F-02 — Replay a command's refusal when the Lightbox finishes mounting

**Changed-code location:** [`LightboxHandler.ts:62–65`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/application/handlers/domain/LightboxHandler.ts#L62-L65), in conjunction with [`LightboxPanelProvider.ts:165–181`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/apps/vscode-extension/src/application/providers/LightboxPanelProvider.ts#L165-L181) and the refusal publisher at `LightboxHandler.ts:190–205`.

`seedSource` opens the panel and immediately dispatches the command. Its comment relies on the mount-time board request to recover an outcome produced before the webview is listening. That works for retained successful boards, but refusals exist only in the posted message: neither the service nor the request route retains/replays them. An immediate ceiling/empty/unsaved-source refusal can therefore disappear during the normal first-open path. With a prior board retained, the first request instead returns that old board without explaining why the new source was rejected.

**Independent reproduction:** Send a selection of exactly 50,001 whitespace-separated words through the real handler/service before attaching the webview receiver. The initial output is the correct `over-ceiling` refusal, with `wordCount: 50001` and `ceilingWords: 50000`. Discard that pre-ready delivery, then issue the actual mount-time `LIGHTBOX_REQUEST_BOARD`. Its only response is `{ board: null }`; the reason, count, and corrective suggestion are unrecoverable. The expected-safe refusal-replay assertion fails. The compiled UI's loading-to-empty witness confirms that `board: null` shows the ordinary welcome screen, rather than a rejected-source explanation.

The committed refusal screenshot sends a refusal into an already-mounted page after a `board: null` message. It proves that the alert can render, but it does not exercise this command/bootstrap boundary. No native VS Code observation is claimed by this controlled dropped-delivery reproduction.

**Requested change:** Keep a coherent host-side current source outcome, including a refusal that has not yet been delivered/acknowledged, or defer seeding until an explicit ready handshake. The mount/reveal path must convey the latest outcome without discarding a retained successful board. Preserve UI-only webview persistence and make dismissal/replay behavior explicit so a dismissed refusal is not resurrected indefinitely. Test first-open over-ceiling, empty and unsaved sources, plus rejection with a previous board and hidden/reloaded delivery.

## F-03 — Place POS evidence using the same tagged occurrences that were counted

**Changed-code location:** [`LightboxMeasures.ts:141–142`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/infrastructure/lightbox/LightboxMeasures.ts#L141-L142), backed by the untyped frequency-token index at [`68–80`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/infrastructure/lightbox/LightboxMeasures.ts#L68-L80).

The POS lists take counts from the tagger, but locate each word using a different tokenizer and no part-of-speech discriminator. Splitting frequency tokens on hyphens handles one known difference; it cannot recover the tagger's occurrences or their grammatical role. The result can highlight uncounted occurrences and miss counted ones while claiming exact measured evidence.

**Independent real-service examples:**

| Source | Counted result | Actual paragraph references | Correct references for that counted item |
| --- | --- | --- | --- |
| `A light shines.` + blank line + `I light the lamp.` | Noun `light` ×1 | `[1, 2]` | `[1]` |
| Same source | Verb `light` ×1 | `[1, 2]` | `[2]` |
| `Alice's hat.` | Noun `alice` ×1 | `[]` | `[1]` |
| `Alice’s hat.` | Noun `alice` ×1 | `[]` | `[1]` |

Pinning either `light` item yields the contradictory claim **“Appears once across 2 paragraphs.”** The possessive examples leave the valid counted name without any location and produce **“No single paragraph holds it.”** These outputs come from the production measured-set builder and item resolver, not hand-created POS results.

This is separate from the documented [contraction-fragment debt](../../.todo/tech-debt/2026-10-19-pos-tagger-token-fragments.md). The review is not asking this slice to redesign the inherited tagger or suppress its `s`/`ll` fragments. It is asking the new Lightbox anchors for valid counted terms to agree with the actual evidence.

**Requested change:** Preserve or derive paragraph and POS provenance from the same tagged occurrence stream used for counts, with the same normalization. Keep ordinary Top Words and n-gram placement aligned with their own tokenizer. Add noun/verb homograph and straight/curly possessive regressions that assert counts, exact paragraph references, ribbon focus, and inspector claims together.

## F-04 — Keep every paragraph address reachable behind the inspector's bound

**Changed-code location:** [`LightboxInspector.tsx:60–61`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/presentation/webview/components/lightbox/LightboxInspector.tsx#L60-L61) and [`93`](https://github.com/okeylanders/prose-minion-vscode/blob/23c3f476fb891600af75c8beebcf72e1d1dbcde2/packages/core/src/presentation/webview/components/lightbox/LightboxInspector.tsx#L93).

The inspector view model retains every exact paragraph index, but the component displays only the first 48 and replaces the rest with an inert `span` saying `+N more`. There is no page, expand, range, or jump control. This breaks D4's exact-address escape hatch once the ribbon is bucketed; it is not merely a request to render a longer list.

**Independent reproduction:** Build paragraph metrics/ribbon from 5,000 repetitions of `Alice waits.`, separated by blank lines. This is only 10,000 words, well inside the source ceiling. Mount the real Lightbox root, deliver the board, and click the first ribbon column.

- The ribbon has 96 columns. Its first range is **¶1–¶52**; the next starts at **¶53**.
- The inspector shows **¶1–¶48** and **`+4 more`**. Clicking `+4 more` has no effect.
- ¶49–¶52 cannot be pinned through that range or the next range.
- Pinning `alice`, `waits`, or the repeated phrase also exposes only the first 48 addresses, with `+4952 more`; it offers no alternate path to those paragraphs.

A second, sparse 200-paragraph fixture places a term in `[1, 3, …, 199]`. The view model contains 100 exact addresses, but the DOM ends at ¶95 and hides the rest behind `+52 more`. A lit aggregate ribbon column does not reveal which paragraph in its range actually contains that word. Both component tests and the rebuilt production-bundle DOM witness reproduce the missing navigation.

**Requested change:** Keep rendering bounded, but provide a usable page/window/jump or bounded expansion control so every exact address remains reachable and can be pinned. Do not solve this by eagerly adding tens of thousands of buttons. Add interaction tests beyond 48 references, for sparse term membership, and for a ribbon bucket containing more than 48 paragraphs; verify the last address is reachable without changing the selected evidence item.

## Other scope and behavior checked

- Read repository guidance, the [slice record](../../.todo/epics/epic-lightbox-2026-10-19/slice-2a-tab-and-counted-board.md), [ADR](../adr/2026-10-19-lightbox-inspiration-board.md), relevant architecture, production changes, and tests. No `.agents/skills` package was present. The already-merged PR #146 matcher and PR #147 shell are the base, not reopened review scope.
- `LightboxService` is constructed once at the composition root and passed through `CoreServices`. The new panel constructs its own `MessageHandler` over that bundle, registers the second serializer, has explicit command/menu activation, retains context while hidden, and tears down its handler before the panel. Its restore path does not treat serializer state as a second board store.
- `LIGHTBOX_*` has four inbound routes and two outbound result types. The source domain does not emit `WORKSHOP_*`, modify Workshop excerpts, or write a board file. Its controllers remain transport-free. The current all-domain-per-handler arrangement is the ADR's known debt, not a new per-surface isolation promise.
- File reads use an absolute path through `TextSourceResolver`, avoiding its recorded relative-path fallback. The shell's optional `openLabel` keeps the Workshop default `Pin`. Empty/unsaved/unreadable and over-ceiling outcomes are typed; the replay and request-ownership gaps are F-01/F-02.
- The 50,001-word source is rejected before measurement; the exact 50,000-word source succeeds in the production suite. The board calls the existing offline measurement services and standards enrichment directly. It contains measured data and three `not-run` groups; Read stays disabled and no model-generation path was added.
- The paragraph splitter preserves UTF-16 offsets and matches the prose-stat blank-line rule. Sentence counts use the exported unchanged heuristic. Dialogue uses the actual PR #146 shared matcher in both consumers: 10,000 additional synthetic mixed-quote probes found no disagreement between whole-text dialogue words and the sum of paragraph words. Single-quote and inherited metric limitations remain as documented in that prerequisite.
- Hashing normalizes line endings, NFC and outer whitespace, while offsets refer to the original input. Unchanged-source rebuilds remeasure standards and retain identity; the 12-entry recency cache and existing superseded-build case are tested. Ordinary word/phrase placement uses the same frequency tokenizer. The n-gram option defaults to 20 for existing consumers and is increased only for the board's filtered candidate pool.
- Host-side ribbon bucketing stays at 96 columns, covers contiguous ranges and pools words/sentences/dialogue. The 1.5× rhythm-focus threshold is a documented presentation choice. Item pinning, filters, lenses, and UI-only persistence work in the inspected paths. F-04 concerns access beyond the inspector bound, not the ribbon bound itself.
- The measured register and renderer maps remain exhaustive. Reading kinds deliberately remain `never`, lens controls only affect placeholders, and the tension lane is a disabled future reading. These are intended Slice 2A boundaries, not missing-functionality findings.

**Nonblocking source-identity observation:** `lightboxSourceKey` uses the display path rather than `sourceUri`/canonical file identity. The adapter/resolver explicitly requests `asRelativePath(..., false)`, so two workspace roots containing `chapter.md` share a cache key; a synthetic service probe confirms identical-text sources at different URIs reuse one board ID and replace the same retained entry. Current measurements are rebuilt from the correct latest input, so no additional current-slice display corruption was established. Use a canonical source identity before future retained readings rely on this key; this observation is not counted as a fifth blocker or as a claimed Slice 2B failure.

## Workshop and visual evidence

The three moved rail-card rules keep their declarations and specificity, and the new aside layout is gated by the aside modifier. Workshop has no aside. Its own surface styles and domain state remain separate; the Lightbox styles are surface-scoped.

The exact rebuilt PR #148 production `webview.js` was compared with the available reviewed PR #147 integrated bundle through the same synthetic host messages. At **nine checkpoints**, root DOM, persisted state, and outbound-message multisets were identical: initial loading; empty session; excerpt; provider-paused banner; settings/self-healed key; Widgets open/close/reopen; Tools and Sessions; repeated key status; and remount from persisted preferences. All **27 parity assertions** passed. This is a newly executed DOM/lifecycle comparison; it does not rerun native VS Code or the earlier browser screenshots.

All **nine supplied Lightbox images** were inspected at actual pixels: empty, counted/pinned and refused states at 1440, 1000 and 500 px. The visible layout follows the three-column, paired-left-column and stacked arrangements described by the author. The source, count, disabled Read copy and refusal explanation are legible in those captured viewports. The 500 px counted shot ends at the ribbon, so it does not establish the offscreen tiles/inspector or scrolling/focus behavior. The images use the author's public-domain Alice fixture, stubbed theme variables and headless Chromium, not a native VS Code host.

For the three supplied Workshop excerpt images, a direct pixel comparison against PR #147's committed result images found **0 changed pixels at 1000 and 500 px**, and **22 pixels with maximum channel difference 1/255 at 1440 px**, confined to the header model control. The author's broader multi-run noise comparison is documented in the [evidence README](evidence/lightbox-slice-2a-visual/README.md); it was inspected but not independently rerun in a real browser here.

The screenshots precede commits `94ab57d7` (same-text remeasurement) and `b6eb47af` (hover announcement). Those deltas were inspected and the exact final bundle was rebuilt/tested. This does not turn the earlier images into exact-head/native pixel evidence. JSDOM emitted its known stylesheet-parser limitation in both Workshop bundles and once in the Lightbox witness; it supplies DOM/event evidence, not layout or screen-reader acceptance.

## Independent verification at `23c3f476`

Runtime: **Node 24.19.0 / npm 11.9.0**, isolated cloud worktree. Dependencies were copied from the prior reviewed checkout after verifying the lockfile is identical; no dependency, source, or configuration change was made. Synthetic text and committed public-domain fixtures only; no live or billable provider calls.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **329 suites / 4,881 tests / 2 snapshots passed**, 160.015 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,140 warnings**; normalized file/message/rule multiset matches the prior integrated baseline (786 distinct entries) |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; all three bundle sentinels verified |
| Whole-PR `git diff --check` | Passed |
| Deferred-source and refusal probes | Three controlled reproductions confirmed; all three expected-safe assertions fail on this head, as described in F-01/F-02 |
| POS measured-output probes | Homograph and both possessive cases reproduce F-03 with the real measurement stack |
| Real-component UI probes | **2 suites / 3 tests passed**, reproducing missing addresses and late result/refusal behavior |
| Rebuilt Lightbox production-bundle witness | Loading/empty, source replacement, stale refusal, pin/UI persistence and large-bucket defect assertions passed |
| Independent Workshop bundle comparison | **9 checkpoints / 27 parity assertions passed** |
| Additional dialogue integration probes | **10,000 synthetic inputs**, no whole-text/per-paragraph disagreement |
| Supplied visual evidence | Nine Lightbox images inspected; three Workshop excerpt pixel comparisons performed, with limits above |
| Exact report-head CI | **Pending separate post-publication verification** |

The defect probes live outside the tracked checkout. Their passing reproduction assertions describe the observed bugs; the separate expected-safe failures are not failures in the author's 4,881-test suite. Only this report is published. No functional edits, formal GitHub review/comment, merge, deployment, release, notification change, or branch cleanup was performed.
