# PR Review — Lightbox Slice 3: Lexical Gravity, Palette and Build-as-lens Handoff

**Author:** okeylanders · **PR:** [#150](https://github.com/okeylanders/prose-minion-vscode/pull/150) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-3-gravity` → `epic/lightbox-slice-2b-readings` (stacked)
**Reviewed implementation head:** `4150c8c10d74a14fb74e185595af2af9e0b0e586`
**Current base head:** `b5350a1440c182a891bb1f149a8decfb50ba7862`
**Verified merge-base:** `bf8f1ca2502441133216ca5013480da9aa37f9cf`
**Slice 3 scope:** 126 files · +6,108 / −189 · 11 commits, measured from the merge-base
**Reviewed:** 2026-10-19 · **Reviewer:** Astra
**Mode:** independent source/spec review; production codec, service and handler probes; rebuilt-production-bundle DOM witnesses; supplied-image inspection; Workshop lifecycle parity; full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. An author-proposed deferral is not acceptance on the writer's behalf.

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | A Telescope-seeded Build sheet can install Photography before any build or explicit lens selection | **Open** |
| F-02 | Medium / P2 | An incoming seed opens over an unsaved text sheet; one Escape discards both | **Open** |
| F-03 | Medium / P2 | Pending seeds bypass the visibility gate and survive disposal of their recipient panel | **Open** |
| F-04 | Medium / P2 | Collision cards assert a shared sentence without selecting and validating that sentence | **Open** |
| F-05 | Medium / P2 | Stale carry retains collisions and palette claims after their required support disappears | **Open** |
| F-06 | Medium / P2 | Stale tension scores are assigned to changed paragraphs, while headline and tension omit local stale labels | **Open** |

**Verdict: Request changes.** The six Slice 3 findings affect actual installed state, an unsaved writer draft, handoff ownership and evidence honesty. Green deterministic checks do not resolve them. This report authorizes neither merge nor progression to a later slice.

**Stacked prerequisite remains pending.** PR #149's re-review still has open P2 F-03: while `SettingsStore.update` is pending, an optimistic model change can accept the old model's estimate and send three old-model calls under the newly selected model label. Once the setting applies, the stale press key refuses safely. PR #149 F-09 is the separate, nonblocking compatibility-mark Unicode quote false-negative. Neither is reclassified as a new Slice 3 finding here. The latest PR #150 body explicitly plans to merge that correction and later retarget to `epic/lightbox`; that correction is not in this reviewed head. The base's `b5350a1` report-only commit is also not an ancestor of this branch, so a two-dot base/head comparison would misleadingly include changes to the PR #149 report. This review uses the actual merge-base.

## F-01 — Do not give a seeded Build an unrelated installable default

**Location:** [WorkshopLexicalGravityModal.tsx:197–220](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx#L197-L220), lens fallback at [244–248](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx#L244-L248), Install at [925–926](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx#L925-L926).

The new `build` opening fills the subject and selects Create New, but still takes the ordinary `photography` default. That default resolves to a valid draft immediately. The seed banner promises that nothing is built, saved or installed until Build lens is pressed, yet Install on passage is enabled against Photography.

**Independent reproduction:** Boot the production Workshop bundle into a normal room, deliver the host's Telescope seed and lens catalog, and press Install without building or selecting a library lens. No build or preview request occurs. The emitted Apply payload has `widgetId: 'lexical-gravity'`, `draft.lensSlug: 'photography'`, `draft.resolvedLens.name: 'Photography'` and `applicationMode: 'interpret'`.

Replaying that exact captured JSON through the real `WorkshopStandingDirectiveHandler`, `WorkshopStandingDirectiveService` and `WorkshopSessionService` commits Photography, marks the session dirty, returns `ok: true`, and appends `Lexical Gravity installed — Photography · interpret · blend · 60% · 2°`. Only prompt-frame replacement and persistence callbacks were mocked; no provider was called. This is an actual wrong-lens installation path, not merely an unrelated old draft momentarily visible in the sheet.

**Requested change:** A build-seeded opening should have no implicit installable lens until a built result is selected, or the writer explicitly chooses a library lens. Keep the displayed subject, preview and installable draft associated with the same deliberate choice. Correct the banner's build/save/install distinction. Add a production-root regression through the Apply boundary, including reopen and an existing installed widget.

## F-02 — Protect all existing editing sheets from an incoming seed

**Location:** [useWorkshopWidgetOpening.ts:164–183](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts#L164-L183).

The external seed guard checks widget openings, but not other Workshop editing overlays. It can mount a second `WorkshopModalShell` over an unsaved Add text sheet. Both shells independently handle Escape.

**Independent production-bundle reproduction:**

1. Open the supported Add text UI.
2. Type `UNSAVED WRITER EXCERPT` and assert the textarea contains it.
3. Deliver the Telescope build seed, as returning from Lightbox does.
4. Both `workshop-text-sheet-title` and `pm-ws-lexical-gravity-title` dialogs are mounted.
5. Press Escape once to dismiss the incoming sheet. Both dialogs disappear.
6. Reopen Add text. The typed text is blank.

The new incoming opening creates the coexistence that triggers draft loss. This is distinct from the passing case where an already-open widget sheet refuses a second seed and retains its edited subject.

**Requested change:** Coordinate external seeds with all Workshop overlays, not just the four widget sheets. Defer or refuse the seed without dismissing the existing editor or discarding its draft; do not consume it as successfully opened. Cover Add text with typed content, context/session editors and the widgets browser, and ensure a single Escape addresses only the intended topmost surface.

## F-03 — Bind queued seeds to a visible, ready recipient lifecycle

**Location:** [WorkshopPanelProvider.ts:155–158](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L155-L158), disposal at [183–195](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L183-L195), delivery at [234–255](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L234-L255).

The normal seed path checks `webviewListening && panel.visible`, but the first incoming webview message calls `deliverPendingBuildSeed()` without checking visibility. Delivery clears the pending value before dispatch. Panel disposal clears the handler and panel, but leaves `pendingBuildSeed` behind.

**Independent real-provider tests with a mocked VS Code panel/MessageHandler:**

- Seed a newly opened, still-booting Workshop; hide it before its first incoming message; deliver that first message while `visible === false`. The provider drains the seed while hidden. Revealing afterward does not replay it. This directly violates the documented readiness-plus-visibility gate; actual native-host message dropping was not measured here.
- Seed a booting panel, close it, open a fresh Workshop later, and deliver its first message. The abandoned old seed is delivered into the new panel. The seed is not owned by the lifecycle whose opening accepted it.

Lightbox's success currently means the provider accepted the seed, not that a visible recipient opened it. The hidden delivery can therefore become a lost handoff, and the disposal path can surface an unsolicited stale subject later.

**Requested change:** Enforce readiness, visibility and panel ownership at the delivery boundary itself. Clear or explicitly cancel an abandoned seed on disposal; define replacement/acknowledgement semantics. Test boot → hide → first message → reveal, boot → close → reopen, and late callbacks from an older panel. Preserve the passing once-only delivery for an already-ready hidden panel when it becomes visible.

## F-04 — Preserve a real supporting sentence for a collision

**Location:** [LightboxGravityTiles.ts:115–119](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/infrastructure/lightbox/LightboxGravityTiles.ts#L115-L119), rendering at [LightboxGravity.tsx:71–77](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/components/lightbox/LightboxGravity.tsx#L71-L77).

The [prompt contract](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/resources/system-prompts/lightbox/13-lexical-gravity.md#L18) and slice spec define a collision as two fields sharing a sentence. The code verifies only that some entire quote contains a term of each field. It neither checks the sentence relation nor retains which quote established it; the UI always displays the first quote and asserts that the fields share a sentence.

**Independent production codec/verifier/assembler witnesses:**

- Fire has term `flame`; Ocean has term `tide`; both fields have their own valid evidence. Collision evidence `The flame went out. The tide came in.` is accepted, despite the terms being in different sentences. The displayed shared-sentence assertion is stronger than the host established.
- Evidence ordered as `Her hope was a flame.` followed by `A tide swallowed the flame.` is accepted because of the second quote. The card displays only the first, Fire-only quote beside the sentence-sharing assertion.

**Requested change:** Retain and display the actual supporting witness, and validate the claimed sentence relation rather than treating any multi-sentence quote as a sentence. If only shared-quote support is intended, narrow the product claim and contract consistently. Test separate sentences, a non-supporting first quote, and a later valid witness. F-05 separately covers losing that witness on revision.

## F-05 — Reapply kind-specific evidence gates after stale recounting

**Location:** [LightboxStaleReadings.ts:170–186](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts#L170-L186), collision cleanup at [97–108](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts#L97-L108). Compare fresh palette gates at [LightboxGravityTiles.ts:85–100](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/infrastructure/lightbox/LightboxGravityTiles.ts#L85-L100).

Carry correctly rechecks individual quotations and recalculates support, but generally keeps any tile with one surviving quote. Motif recurrence and orphaned collision fields are checked; the other fresh-assembly gates are not.

**Independent production-path reproductions:**

- Begin with the valid two-evidence collision from F-04. Keep Fire and Ocean's independently supported field tiles, but delete `A tide swallowed the flame.`. The carried collision survives with only `Her hope was a flame.` and still asserts that Fire and Ocean share a sentence. Fresh assembly against the changed text correctly withholds it. Both fields remaining drawn is insufficient: no surviving collision quote holds both terms.
- Begin with `The white window was open.`. A White swatch (`white`) and Pale tones cluster (`white`, `gold`) cite the valid substring `window was open.`. Change `white` to `blue`. The quote still verifies, but all their counted words are now absent. Stale carry retains both zero-support tiles; fresh assembly withholds both with the appropriate host-owned reason.

A stale label permits an older interpretation to remain identifiable; it does not make the board's concrete shared-sentence claim or current color-word support true. The failing states arise through the normal changed-source carry path, without malformed wire data.

**Requested change:** Share the kind-specific acceptance rules between initial assembly and carried/recounted tiles. Withhold collisions lacking a surviving supporting witness and palette tiles whose required words disappear, while preserving useful refusal information. Test fresh/carry parity for every tile kind, including partial evidence survival and independently surviving sibling fields.

## F-06 — Do not project old positional readings onto new paragraph identities

**Location:** [LightboxTileCounts.ts:94–103](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/infrastructure/lightbox/LightboxTileCounts.ts#L94-L103), carried at [LightboxStaleReadings.ts:177–186](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts#L177-L186), projected at [lightboxReadings.ts:168–170](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts#L168-L170). Local labels are absent from [LightboxHeadline.tsx:42–49](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/components/lightbox/LightboxHeadline.tsx#L42-L49) and [LightboxTensionArc.tsx:15–22](https://github.com/okeylanders/prose-minion-vscode/blob/4150c8c10d74a14fb74e185595af2af9e0b0e586/packages/core/src/presentation/webview/components/lightbox/LightboxTensionArc.tsx#L15-L22).

The tension score array is retained unchanged. Its only projection guard is matching paragraph count, so a same-length revision places historical scores on different current paragraphs. Quote relocation does not relocate the corresponding score. The prominent headline, tension caption and tension ribbon also lack the per-lens stale disclosure that the regular reading frames provide.

**Independent real-service reproduction:** Build three paragraphs: `A quiet morning.`, `A bomb exploded.`, `The window was open.` Read tension `[1, 9, 1]` with its verified explosion peak at ¶2. Swap the first two paragraphs and rebuild the same source. The real service correctly marks the lens stale and moves the verified peak to ¶1, but `lightboxTensionScores` still returns `[1, 9, 1]`. The rendered current ¶2, now the quiet morning, is announced as `tension, as read: 9 of 9`.

The rebuilt bundle also confirms the supplied stale board has eight stale lenses while headline/tension show no local stale note. If paragraph count changes instead, the lane disappears and its tooltip says `Not read yet`, although an older reading exists. The PR body acknowledges the latter missing-note case, but does not address the same-count misattribution.

**Requested change:** Keep historical positional scores explicitly attached to their original source coordinates, or suppress their overlay on current paragraphs until re-read; length equality is not identity. Add stale disclosure to the headline, tension caption and lane, and an accurate explanation when an old lane cannot be projected. Test paragraph reordering and same-count replacement as well as insertion/deletion. The P2 impact is the false current paragraph association, not merely a missing cosmetic badge.

## Scope decisions and retained guarantees

The named Lightbox route, reference-only request, bounded host-built seed and Workshop-owned handler preserve the intended ports/adapters direction. No new VS Code import enters core. The new modules remain below the repository's 500-line guideline; the lightly touched existing oversized composition/UI files and duplicate field decoders are acknowledged debt, not additional blockers here.

Independent positive checks verified:

- The seed contains host-recounted, sorted and capped terms, bounded field/metaphor/source text and a subject of at most 100 characters. Extra untrusted request text cannot replace the host seed. Missing evidence refuses handoff.
- A changed disk source, removed/re-reading field during the asynchronous file read, or closed Lightbox refuses the handoff. Only one handoff is accepted at a time; a mismatched result does not release the current one. Stale Build is disabled and host-refused.
- The initial Workshop seed causes no build/preview/apply call. A second seed preserves an already-open widget's edited subject and reports refusal. Closing and reseeding accepts the new subject; explicit Build sends it once. Replacing the room does not automatically build/apply. The actual Apply handler still refuses during an active Workshop response.
- Quote relocation examines distant duplicates: a 499-match fixture chooses the nearest address, breaks ties toward the earlier paragraph, and handles an original address beyond the new document's end. Lost quotes are withheld, counts change with the text, and gravity below-line/degree/drift accounting remains host-owned.
- Malformed gravity/palette keys and unrecognized collision names do not leak arbitrary model strings into their host diagnostic reasons. The normalized lint warning multiset is unchanged.
- Ordinary Workshop loading, empty/excerpt rooms, API-key pause/recovery, widget/tool/session surfaces, key toggles and state restoration match the PR #149 bundle at nine checkpoints: identical DOM, persisted state and outbound-message multisets.

The documented in-flight-reading loss on source changes remains a follow-up, not a new review finding. This report does not accept it on the writer's behalf. Semantic output quality, resistance to all prompt injection and writer usefulness cannot be established by mocked structured replies. The writer-output checkpoint before Slice 5 and native/live-provider acceptance remain outstanding.

## Verification and evidence provenance

| Check | Independent result |
| --- | --- |
| `npm test -- --runInBand` | **357 suites / 5,175 tests / 2 snapshots passed** |
| `npm run typecheck` | **Passed** for core, webview and extension |
| `npm run build`, including `verify:bundle` | **Passed**; three webpack size/performance warnings |
| `npm run lint` | **0 errors / 1,135 warnings**; normalized per-file/message/rule multiset identical to PR #149 fix baseline |
| Gravity/stale focused repository suites | **6 suites / 106 tests passed**; included in the full-suite count |
| Additional gravity/stale/evidence probes | **9 tests passed**, including deliberate defect witnesses, real-service revision and React renderers |
| Additional handoff/provider/host probes | **4 suites / 17 tests passed**, including deliberate defect witnesses and captured Apply replay |
| Rebuilt Lightbox production-bundle DOM witness | **25 assertions passed**; host-state replay, inspector/handoff ownership, stale recount and disclosure checks |
| Rebuilt Workshop production-bundle DOM witnesses | Typed-draft loss, wrong-lens Apply, repeated seed/build and room replacement verified |
| Workshop regression comparison | **9 checkpoints / 27 parity assertions passed** against PR #149 |
| `git diff --check` and core dependency scan | **Passed**; no functional edits by reviewer |
| GitHub exact implementation-head CI | Both `verify` check runs **succeeded** at `4150c8c`; report-only head CI must be checked separately |

Local verification used Node **24.19.0** / npm **11.9.0**; repository CI uses Node **18**. Exact-head CI evidence: [PR run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39331934190/job/118332006837) and [branch run](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39331616998/job/118330949623). The legacy status endpoint's empty-context `pending` is not a failed or running check.

All **21 committed PNGs** were inspected at actual pixels: 18 Lightbox images and three Workshop images at 1440, 1000 and 500 px, including orbit/palette, inspector, sent and stale states. The [evidence README, builder, harness and recorded states](evidence/lightbox-slice-3-visual/README.md) were checked. The independently rebuilt production bundle's SHA-256 is `ef617ebfab0206dd10e6cacf08b2d7b66eb5ca95cd79f9fb34ea90518decc992`, exactly matching the bundle recorded for those screenshots.

The visual fixtures use public-domain Alice prose, hand-authored gravity/palette responses, prompt examples for other groups, a stub engine and a stub VS Code API/theme. Real host services generated the recorded states; these are not live-model outputs. Labels visibly distinguish counted support, claimed pull, below-line fields and chosen swatch colors. Stale frame/inspector notices are visible, but do not cure F-05/F-06. The supplied Workshop image also visibly pairs the Telescope seed with Photography's lens content and an enabled Install button; the additional action probe establishes the consequence.

This review independently replayed the production JavaScript in JSDOM, with no non-CSS runtime errors. It did **not** rerun the author's Chromium capture or independently reproduce its pixel-stability/overflow measurements. JSDOM cannot validate browser layout; its known stylesheet-parser warning occurred in both parity bundles. Actual VS Code focus, suspension, theme and native panel acceptance were not exercised. Provider lifecycle tests explicitly used a mocked VS Code panel. No live or paid inference occurred.

## Author response

Please retain the finding IDs and append fixes, commit references, regression evidence or proposed deferrals here. Resolution statuses should change only after independent re-verification. Implementation, merges and the PR #149 correction remain with the developer; this commit contains the review report only.
