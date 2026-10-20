# PR Review — Lightbox Slice 3: Lexical Gravity, Palette and Build-as-lens Handoff

**Author:** okeylanders · **PR:** [#150](https://github.com/okeylanders/prose-minion-vscode/pull/150) (open, unmerged at re-review)
**Branches:** `epic/lightbox-slice-3-gravity` → `epic/lightbox`
**Re-reviewed implementation head:** `524a961c8d87749fdbe10dfefecf7e3f24a67fd8`
**Verified current base / merge-base:** `c6d4411076b4a3acbf4b555765ac77d8971f70ca`
**Current scope:** 149 files · +8,726 / −268 · 23 commits from the merge-base, including the existing review and author response
**Initial implementation head:** `4150c8c10d74a14fb74e185595af2af9e0b0e586`; initial scope 126 files · +6,108 / −189 · 11 commits from `bf8f1ca`
**Reviewed and re-reviewed:** 2026-10-19 · **Reviewer:** Astra
**Mode:** independent source/spec and merge-resolution review; production service/handler/engine probes with synthetic transport; rebuilt-production-bundle DOM witnesses; supplied-image inspection; Workshop parity; full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Partially addressed** = original cases fixed but a reproduced residual remains · **Addressed** = independently verified fix · **Deferred** = explicitly accepted follow-up. Author-proposed deferrals are not acceptance on the writer's behalf.

| ID | Sev | Finding | Status at `524a961c` |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | A Telescope-seeded Build sheet can install Photography before any build or explicit lens selection | **Addressed** |
| F-02 | Medium / P2 | An incoming seed opens over an unsaved text sheet; one Escape discards both | **Addressed**; separate browser-only limitation is F-07 |
| F-03 | Medium / P2 | Handoff lifecycle ownership: an already-dispatched seed can still open after timeout/replacement | **Partially addressed — Open residual** |
| F-04 | Medium / P2 | Collision cards assert a shared sentence without selecting and validating that sentence | **Addressed** |
| F-05 | Medium / P2 | Stale carry retains collisions and palette claims after their required support disappears | **Addressed** |
| F-06 | Medium / P2 | Stale tension scores are assigned to changed paragraphs, while headline and tension omit local stale labels | **Addressed** |
| F-07 | Low / P3 · nonblocking | The header Model Browser is outside the overlay stack; a seed overlaps it and one Escape closes both | **Open** |

**Current verdict: Request changes.** Five original findings are independently addressed. F-03 still permits an expired or replaced in-flight seed to open the wrong Build subject and block its replacement. No automatic build, installation or paid call is demonstrated by that residual. F-07 is a bounded, nonblocking modal-coordination issue. Green checks do not resolve F-03; this report is not merge or later-slice authorization.

**PR #149 integration is verified.** Its completed corrections are included through merge `567506a0`, whose second parent is `c6d4411`; that is now this PR's actual base and merge-base. The model-intent, Unicode and terminal-run protections survive the conflict resolutions and independent regression probes below. The earlier pending-prerequisite statement is superseded. The PR body's opening stacked/pending-149 paragraph and old verification figures have not been refreshed, but the repository history and appended author response establish the actual integration. Two inherited nonblocking accounting notes are now recorded in [exceptional-path accounting debt](../../.todo/tech-debt/2026-10-19-lightbox-exceptional-path-accounting.md): setup failure still displays three planned calls despite zero sends; a synthetic reply-check failure drops board-only usage while engine accounting remains intact.

## Re-review — F-03 remains open after dispatch

**Current locations:** [WorkshopPanelProvider.ts:276–303](https://github.com/okeylanders/prose-minion-vscode/blob/524a961c8d87749fdbe10dfefecf7e3f24a67fd8/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L276-L303), settlement at [306–323](https://github.com/okeylanders/prose-minion-vscode/blob/524a961c8d87749fdbe10dfefecf7e3f24a67fd8/apps/vscode-extension/src/application/providers/WorkshopPanelProvider.ts#L306-L323), receiver opening at [useWorkshopWidgetOpening.ts:174–191](https://github.com/okeylanders/prose-minion-vscode/blob/524a961c8d87749fdbe10dfefecf7e3f24a67fd8/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts#L174-L191).

The provider now correctly gates delivery on the owning panel being current, listening and visible. It cancels an **unsent** seed on timeout, replacement or disposal, ignores old panel callbacks, and waits for a matching webview answer before reporting success. Those original witnesses pass.

The remaining boundary is **after dispatch but before the receiver processes the message**. `settleBuildSeed` forgets only the provider's pending record. The already-posted seed has no expiry/current-delivery check at the receiver. Ignoring its late acknowledgement does not prevent its sheet from opening.

**Independent integrated witness:** Real `WorkshopPanelProvider`, real `WorkshopLexicalGravityHandler` and the exact rebuilt Workshop bundle, with a small handler-routing shim, mocked VS Code panel and controlled asynchronous `webview.postMessage` delivery. No malformed or spoofed acknowledgement is used.

1. A ready, visible Workshop accepts seed A (Telescope). The real handler posts its seed message; hold only delivery of that message to the webview.
2. Advance the provider's normal 20-second deadline. The handoff promise settles `{ opened: false, reason: 'timeout' }`.
3. Release the already-sent message. The production receiver opens Telescope and posts `opened: true`; the provider ignores this late answer because its pending record is gone.

A second witness needs no timeout:

1. Dispatch A and hold its webview delivery.
2. Accept a newer handoff B. The provider settles A as `replaced` and dispatches B.
3. Deliver the queued messages in their original FIFO order, A then B.
4. Cancelled A opens Telescope. B encounters that sheet, answers `busy`, and the newer handoff fails. The visible subject is A's, not B's.

These are delayed-renderer/message-processing interleavings; a later handoff can come from a reopened sender while the old receiver message is still in flight. The test does not bypass the sender's same-tab one-at-a-time guard. It also does not claim a measured frequency or reproduce native VS Code suspension: delay is controlled at the supported asynchronous transport boundary. The consequence is an unexpected stale/wrong Build draft and a refused newer request. F-01's correction still leaves Preview/Install unavailable until an explicit lens choice, so this is **not** an automatic installation or spend path.

**Requested change:** Extend delivery ownership/expiry to the receiver's decision to open, including already-dispatched messages. Use a current-delivery claim/acknowledgement protocol or another mechanism that validates a seed before opening it; merely discarding a late answer is insufficient. Preserve any sheet the writer has already begun editing. Add post-dispatch timeout, post-dispatch replacement and delayed FIFO delivery tests across provider → handler → receiver, alongside the passing unsent-queue/disposal cases.

## Re-review — F-07: Include the header Model Browser in overlay coordination

**Locations:** The new guard at [useWorkshopWidgetOpening.ts:178–191](https://github.com/okeylanders/prose-minion-vscode/blob/524a961c8d87749fdbe10dfefecf7e3f24a67fd8/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopWidgetOpening.ts#L178-L191) depends on `isAnyOverlayOpen()`. [ModelBrowserModal.tsx:173–180](https://github.com/okeylanders/prose-minion-vscode/blob/524a961c8d87749fdbe10dfefecf7e3f24a67fd8/packages/core/src/presentation/webview/components/shared/ModelBrowserModal.tsx#L173-L180) uses its own Escape listener instead of registering with that stack.

**Production-root and rebuilt-bundle reproduction:** Open Workshop's header Assistant Model browser, enter a search, then receive a valid seed. The seed answers `opened: true`, and two dialogs coexist. One Escape dismisses both. Reopening the browser retains its search, and no model selection or writer text is lost. The widget's own nested model browser remains protected by its existing `modelBrowserOpen` guard: first Escape closes the browser, second closes the widget sheet.

This is **P3/nonblocking**, not the original P2 writing-draft loss. Register the shared model browser with the same ownership mechanism, or explicitly include it in seed admission and dismissal coordination. Verify header and nested browser paths, selected-model routing, cleanup and focus restoration. Do not infer that a global stack automatically covers overlays that never use it.

## Re-review closures and retained boundaries

- **F-01 addressed (`f89991f`).** A seeded opening starts with no lens at mount and reopen. No Apply/build/preview is emitted automatically; Preview and Install are disabled. Explicitly choosing Music installs Music through the real directive/session boundary. Merely selecting an unsaved generated take is insufficient; adding it supplies the installable choice. An already-installed Photography directive remains unchanged when the new-install route is refused. Banner wording now separates Build, Add and Install.
- **F-02 addressed (`fd8e616`).** The original Add text witness now answers `busy`, keeps the typed draft as the sole dialog and never opens a deferred seed later. Context/session editors and widgets/tools browsers refuse similarly. Two registered shells dismiss only the top shell; backdrop/unmount cleanup permits a later seed. F-07 documents the remaining unregistered browser surface without retaining the original data-loss severity.
- **F-03 partially addressed (`3df7dcc`).** Boot → hide → first message → reveal delivers once; close/reopen does not inherit an unsent seed; old panel messages/view events/disposals cannot affect the current delivery. Matching answers, pre-dispatch timeout/replacement and provider disposal settle correctly. The post-dispatch cases above remain open.
- **F-04 addressed (`966f31f`).** The shared gate selects a sentence witness using the repository's documented prose-stats sentence rule. Cross-sentence terms are withheld, and a later supporting quote is selected/rendered instead of a first single-field quote. This is the existing deterministic punctuation rule, not a claim of complete linguistic sentence parsing.
- **F-05 addressed (`5af78ec`, `249bf5e`).** Fresh assembly and carry use the same kind-specific gate. Carry processes fields before collisions, even when stored tile order is reversed. The deleted collision witness and zero-support palette cases now withhold with host-owned reasons. A surviving alternate witness relocates; removing it on a second revision withholds the collision while both fields remain. Withheld counts and the original stale hash remain coherent.
- **F-06 addressed (`ca66b1b`, merge adaptation).** The original three-paragraph swap yields `[9, 1, 1]`; peak evidence and score both move to ¶1. New/changed column text becomes `null`, while the headline, tension caption and lane disclose staleness. Tests through the merged runner cover 192 paragraphs bucketed into 96 pairs, pair reordering, an edited pair, subsequent sparse reordering and the 96→97 boundary. Conflicting old scores for duplicate text produce `null`. Identical text with agreeing scores can reuse that score, including an inserted duplicate: identity here is content-based rather than occurrence-based, a disclosed limitation rather than transfer between different text.

**Merge resolution, not ancestry alone:** The remerge diff was inspected. `LightboxReadingHandler`, the quote verifier, failure categories and run contracts match `c6d4411`; the split runner retains its setup/check/listener failure settlement and adds column-key construction inside the guarded `readingTools`. `LightboxGroupReply` carries those keys into assembly. The root retains the wrapped `MODEL_DATA` route to both chrome and Lightbox alongside handoff routing; `useLightbox` retains selected/confirmed-model state and correlation beside handoff state.

Independent retained integration probes confirm that a held settings save never enables an old-model press under the new label; identical confirmations and same-model repricing withdraw the estimate; failed saves and stale/mismatched confirmations remain safely unpressable. Explicit later presses run on the named confirmed model. Long Japanese/Han normalization runs complete, both verifier/counter setup exceptions settle without sends and allow an explicit retry, and reply-check/listener failures terminate without stranded Stop controls or unhandled rejection. PR #149's inherited accounting limitations remain separately recorded as noted above.

Retained handoff boundary probes also confirm refusal after a source change, field removal or rereading during an asynchronous disk read; changed files, stale boards/fields, malformed/non-field requests, closed senders and duplicate requests are rejected. The host reverifies evidence, ignores injected request-side seed fields, recounts and orders terms, excludes absent/oversized terms, and enforces the 12-term and field/metaphor/source-label/subject bounds. These source-intent protections do not revoke an already-dispatched receiver message.

## Re-review verification and visual provenance

| Check at `524a961c` | Independent result |
| --- | --- |
| Full `npm test -- --runInBand` | **367 suites / 5,237 tests / 2 snapshots passed** (169.649 seconds) |
| Typechecks and production build, including bundle sentinels | **Passed**; three webpack size/performance warnings |
| Full lint | **0 errors / 1,135 warnings**; normalized per-file/message/rule multiset unchanged from the initial review |
| Focused gravity/stale repository checks | **12 suites / 156 tests passed**, included in full-suite count |
| Independent gravity/carry/merged-column probes | **2 suites / 14 tests passed** |
| Focused handoff/source/bounds probes | **8 suites / 50 tests passed**, including copied current regressions and explicit residual witnesses; overlapping coverage, not 50 new tests |
| Workshop production-bundle probes | **4 UI scenarios and 2 integrated delayed-transport scenarios** passed their expected assertions, including the reproduced F-03/F-07 defects |
| Retained PR #149 real-host boundaries | **178 assertions passed**: positives 21, ownership 46, close/reopen 6, model intent 14, long/setup 37, completion 54 |
| Exact-bundle model/host integration | **72 assertions / 8 scenarios passed** |
| Exact-bundle exceptional-run UI integration | **39 assertions / 3 scenarios passed**; zero unhandled rejections |
| Lightbox evidence/inspector/handoff/stale DOM replay | **28 assertions passed** |
| Workshop ordinary lifecycle parity | **9 checkpoints / 27 assertions passed** against the corrected PR #149 bundle |
| Unicode/evidence retained probes | 12 closure groups, 13 boundary assertions, 20,000 Unicode stress cases with zero fold differences/misses/wrong spans, 5,768 whole-string and 25,000 fragment cases plus four span assertions, seven long-run variants all passed |
| Diff whitespace and source ownership | **Passed**; no reviewer functional edits |
| Exact implementation-head GitHub CI | Both `verify` runs **succeeded**; report-only head requires its own post-publication check |

Local runtime remains Node 24.19.0 / npm 11.9.0; GitHub CI uses Node 18. Exact implementation-head evidence: [PR verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39343473547/job/118370364790) and [branch verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39343466386/job/118370342157). Additional controlled Workshop/provider probes reproduce F-03/F-07 while verifying the other handoff corrections; a passing defect witness records the defect, not expected-safe behavior.

All **18 changed PNGs** were inspected at actual pixels, supplementing the three unchanged PNGs already inspected in the first review. The independently rebuilt bundle has SHA-256 `874136650feae93b4875dba5bb1ba9a95535b4b13c0ada27e4140fc50535034c`, matching the regenerated evidence. Screenshots visibly show the collision witness, Opened wording, stale lane chip, updated seed banner, no-lens state and disabled Install. Production DOM replay independently confirms headline/caption stale disclosure and that the changed ¶15 has no tension score.

The builder/harness/state changes were reviewed. The evidence builder still synthesizes `{ opened: true }` after routing the seed; the separately replayed Workshop records its acknowledgement. Those screenshots therefore do **not** prove the asynchronous provider/receiver lifecycle addressed by F-03. The new delayed-transport witness exercises that boundary directly. Public-domain Alice and synthetic fixtures, stub provider responses and stub VS Code/theme remain the provenance; no live or billable inference occurred.

No Chromium capture, pixel-stability or overflow claim was independently rerun. JSDOM is event/DOM evidence, not layout or native VS Code acceptance. The unchanged 500 px Workshop background clipping and narrow inspector label wrapping remain presentation limitations, not new blockers. Writer-output acceptance before Slice 5 and native/live-provider acceptance are still outstanding. The appended author response below is preserved verbatim.

## Initial findings at `4150c8c`

The original reproductions and verification below are retained as historical evidence. The current ledger and re-review above supersede their original open statuses. At that initial review PR #149's corrections were still pending and the branch was stacked on `epic/lightbox-slice-2b-readings`; those conditions no longer describe the current head.

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

## Initial scope decisions and retained guarantees

The named Lightbox route, reference-only request, bounded host-built seed and Workshop-owned handler preserve the intended ports/adapters direction. No new VS Code import enters core. The new modules remain below the repository's 500-line guideline; the lightly touched existing oversized composition/UI files and duplicate field decoders are acknowledged debt, not additional blockers here.

Independent positive checks verified:

- The seed contains host-recounted, sorted and capped terms, bounded field/metaphor/source text and a subject of at most 100 characters. Extra untrusted request text cannot replace the host seed. Missing evidence refuses handoff.
- A changed disk source, removed/re-reading field during the asynchronous file read, or closed Lightbox refuses the handoff. Only one handoff is accepted at a time; a mismatched result does not release the current one. Stale Build is disabled and host-refused.
- The initial Workshop seed causes no build/preview/apply call. A second seed preserves an already-open widget's edited subject and reports refusal. Closing and reseeding accepts the new subject; explicit Build sends it once. Replacing the room does not automatically build/apply. The actual Apply handler still refuses during an active Workshop response.
- Quote relocation examines distant duplicates: a 499-match fixture chooses the nearest address, breaks ties toward the earlier paragraph, and handles an original address beyond the new document's end. Lost quotes are withheld, counts change with the text, and gravity below-line/degree/drift accounting remains host-owned.
- Malformed gravity/palette keys and unrecognized collision names do not leak arbitrary model strings into their host diagnostic reasons. The normalized lint warning multiset is unchanged.
- Ordinary Workshop loading, empty/excerpt rooms, API-key pause/recovery, widget/tool/session surfaces, key toggles and state restoration match the PR #149 bundle at nine checkpoints: identical DOM, persisted state and outbound-message multisets.

The documented in-flight-reading loss on source changes remains a follow-up, not a new review finding. This report does not accept it on the writer's behalf. Semantic output quality, resistance to all prompt injection and writer usefulness cannot be established by mocked structured replies. The writer-output checkpoint before Slice 5 and native/live-provider acceptance remain outstanding.

## Initial verification and evidence provenance

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

### Fixes for F-01 to F-06 (2026-10-19)

All six findings are fixed on `epic/lightbox-slice-3-gravity`, one commit
per finding, then one merge of `epic/lightbox` at `c6d4411` (PR #149
merged). Statuses in the ledger above are left for re-verification.

Every new test was run against the reviewed head's sources: the
`packages/core/src` and `apps/vscode-extension/src` trees of `4150c8c`, with
this branch's tests, and ts-jest's type diagnostics off so failures are
behavioral. Every new test fails there. One rewritten test passes there on
purpose: "holds a seed for a ready but hidden Workshop tab until it is
shown, then delivers it once" pins the once-only delivery you asked to keep.

#### F-01 — A seeded Build had an installable default

- **Root cause.** A `build` opening fell through the sheet's ordinary
  initial state, `lensSlug ?? 'photography'`, and the lens resolver's
  fallback to the first library lens. Photography resolved to a valid
  draft at once, so Preview and **Install on passage** acted on a lens the
  writer never chose. The banner folded building, saving and installing
  into one sentence about Build lens.
- **Fix** (`f89991f`). A `build` opening starts with no lens, at mount and
  on every reopen: `lensSlug` is `undefined`, and the resolver returns no
  lens for it, so there is no draft. The sheet says "No lens chosen yet";
  Preview, "What the room is told" and Install wait until the writer adds a
  built take or picks a library lens. The lens shown, its preview and the
  installable draft all follow that one choice. The banner now says
  "Nothing is built until you press Build lens, nothing is saved until you
  add a take, and nothing is installed until you choose a lens and press
  Install on passage."
- **Tests.**
  - `WorkshopApp.buildSeedInstall.test.tsx` drives the production Workshop
    app against the real `WorkshopStandingDirectiveHandler`,
    `WorkshopStandingDirectiveService` and `WorkshopSessionService`. Only
    prompt-frame replacement and the handler's persistence callbacks are
    mocked. Every Apply the webview posts is routed through that boundary,
    and its answer goes back to the webview. Three cases:
    - a fresh opening posts no Apply and installs nothing; after the writer
      picks Music, exactly Music is installed;
    - a reopened opening carries no earlier choice;
    - with Photography already installed, the opening offers no lens, and
      a lens picked there is refused ("already active; reopen it to shift
      the directive"), leaving Photography at revision 1.
  - `WorkshopLexicalGravityBuildSeed.test.tsx` checks the banner text, and
    that a selected but unsaved take is not a choice: only the added take
    makes Install install it.

#### F-02 — A seed could open over another sheet

- **Root cause.** The seed controller checked only the four widget
  openings. Every other Workshop overlay (Add text, the context and session
  editors, the widgets and tools browsers) was invisible to it. Every open
  `useOverlayDismiss` user also listened for Escape on its own, so one key
  closed every stacked sheet.
- **Fix** (`fd8e616`). `useOverlayDismiss` keeps the open overlays as a
  stack, newest last, and one window listener sends Escape to the top
  overlay only. `isAnyOverlayOpen()` reports whether any is open. Every
  `WorkshopModalShell` and the configure guide register by construction,
  so no hand-kept list of overlays can miss one. While any overlay is open,
  the controller refuses the seed:
  - it answers `busy` to the host (F-03), so the Lightbox says why;
  - it says so in the Workshop;
  - it drops the seed rather than deferring it, so nothing opens later
    unasked.

  The open overlay and its draft are never touched.
- **Tests.**
  - `WorkshopApp.buildSeedOverlays.test.tsx` uses the production Workshop
    app:
    - Add text with typed content refuses the seed, keeps the draft and
      stays the only dialog, and one Escape then closes only Add text;
    - the same refusal holds for the widgets browser, the context editor,
      the save-session editor, the session browser and the tools browser;
    - a later seed opens once the overlay is closed;
    - with nothing open, a seed opens and answers `opened`.
  - `WorkshopModalShellStack.test.tsx` lays a second shell over the real
    Add text sheet. One Escape closes only the top one, the draft beneath
    survives, and the next Escape closes the sheet that is then on top.

#### F-03 — Queued seeds were not bound to their recipient

- **Root cause.** The provider's first-message path delivered the pending
  seed without the visibility check, and cleared it before dispatch.
  Disposal never cleared it, so a fresh panel could receive an abandoned
  seed. `handOffToWorkshop` returned `true` as soon as the provider
  accepted the seed, so "sent" never meant that anything had opened.
- **Fix** (`3df7dcc`). The seed belongs to the panel that accepted it.
  - **Delivery.** `deliverPendingBuildSeed(panel)` delivers once, only to
    that panel, and only while it is the current panel, its webview is
    listening and its tab is visible.
  - **Older panels.** Late messages, view-state changes and disposals from
    an older panel are ignored.
  - **Settling.** A newer seed settles the pending one as `replaced`.
    Closing or replacing the panel, or disposing the provider, settles it
    as `closed`.
  - **Answer.** The Workshop webview answers with
    `WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER { seedId, opened, reason? }`,
    naming the provider's delivery id, which the Workshop handler keeps as
    the seed id. The provider takes that answer itself, for the matching
    panel and delivery only. `handOffToWorkshop` now returns a promise that
    settles with the answer, or with `timeout` after 20 seconds.
  - **Lightbox.** `LightboxHandler` waits for the outcome. It says "Opened"
    only when a visible Workshop opened the field, and otherwise refuses
    with a host-owned reason for `busy`, `closed`, `replaced` and
    `timeout`. An answer that arrives after the Lightbox closed posts
    nothing.
- **Tests.**
  - `WorkshopPanelProviderBuildSeed.test.ts` uses the real provider, a
    mocked panel and mocked handlers:
    - boot, hide, first message, reveal;
    - boot, close, reopen;
    - late callbacks from an older panel replaced through the serializer:
      its first message, view change, answers (including one naming the
      current delivery id) and late disposal settle and deliver nothing;
    - replacement;
    - timeout (fake timers), with nothing delivered afterwards;
    - provider disposal;
    - the answer mapping, `opened` and `busy`;
    - once-only delivery to a ready hidden panel.
  - `LightboxHandoff.test.ts`:
    - "Opened" only on the Workshop's word;
    - a second press is refused while the answer is awaited;
    - each refusal reason;
    - a late answer after the Lightbox closed.
  - `useLexicalGravity.test.ts` and `WorkshopLexicalGravityBuildSeed.test.tsx`
    cover the answer and the delivery id. `providerAssembly.test.ts` pins
    the delivery gate.

#### F-04 — A collision did not select its supporting sentence

- **Root cause.** A collision was accepted when its found quotes held a
  term of each field anywhere, and the tile showed its first found quote,
  which need not hold either.
- **Fix** (`966f31f`). `lightboxCollisionWitness` splits each found quote
  with `proseSentenceSpans`. That is the repository's sentence rule
  (`/[.!?]+/`), now exported from `passageProseStats` beside
  `countProseSentences`, which uses it. The witness is the first sentence
  that holds a term of each field. A collision without one is withheld:
  "No sentence of its quotes holds a term of each field, so the board
  cannot show them sharing one." The tile keeps
  `witness: LightboxVerifiedQuote` (the sentence and its ¶), and the card
  shows it, with "{A} and {B} share this sentence."
  `13-lexical-gravity.md` says the same.
- **Tests.**
  - `LightboxGravityWitness.test.ts`:
    - terms in separate sentences;
    - a non-supporting first quote with a valid later witness;
    - the sentence, not the whole quote, as the witness.
  - `LightboxAppGravity.test.tsx` shows the witness, not a first quote
    that holds one field.

#### F-05 — Carried tiles skipped the kind-specific gates

- **Root cause.** Carry re-checked quotes and recounted support, but it
  applied its own narrower acceptance: any tile with one surviving quote,
  plus motif recurrence and orphaned collision fields. Fresh assembly
  applied the kind-specific gates.
- **Fix** (`5af78ec`, and `249bf5e` for the test).
  - **One gate.** `LightboxTileGates.lightboxTileGate` holds the
    kind-specific rules once:
    - a found quote;
    - a motif in two paragraphs;
    - both collision fields drawn, plus the F-04 witness;
    - cluster words still in the chapter;
    - swatch words still in the chapter.
  - **Both paths.** Fresh assembly (`LightboxReadingTiles.claim`) and
    carry (`LightboxStaleReadings`) both use the gate. Carry runs in two
    passes, fields before collisions, so a collision sees which fields
    still stand.
  - **Reasons.** All reasons are host-owned (`LIGHTBOX_GATE_REASONS`). Two
    have a fresh wording and a carried wording ("Its quotes are no longer
    in the chapter.").
- **Tests.** `LightboxCarryParity.test.ts`:
  - **Your two reproductions.** A collision whose witness sentence was
    deleted is withheld while Fire and Ocean still stand on their own. A
    White swatch and a Pale tones cluster whose words are gone, with their
    quote standing, are both withheld with their reasons.
  - **Groups A, B and C.** One property test checks that carrying a
    reading and reading afresh agree on the changed text. It covers the
    worked examples for unchanged, edited and twice-edited texts.
    - Group A's body adds a two-quote collision and a swatch whose quote
      outlives its word.
    - B's and C's kinds have no rule beyond a found quote, so only group A
      can tell the two paths apart. The three groups therefore run as one
      property, which fails on `4150c8c`.
  - **Every kind.** A coverage test confirms that all twelve tile kinds
    are drawn, and that the partial survivals hold or withhold as they
    should: Ledger keeps ¶2, "Going down" survives once and is withheld at
    one paragraph, the "Sleepy" swatch loses its word, and the collision
    loses its witness while both fields stand.

#### F-06 — Stale tension was projected by position

- **Root cause.** A carried arc kept its positional score array, and the
  board drew it whenever the paragraph count matched. The headline, the
  tension caption and the lane had no stale label, and a lane that could
  not be drawn said "Not read yet".
- **Fix** (`ca66b1b`).
  - **Keys.** The tension tile stores `columnKeys`, one per ribbon column.
    Each key is a hash of that column's normalized paragraph text as read
    (`lightboxColumnKeys`, 16 hex characters of SHA-256).
  - **Carry.** Carrying the arc moves each score to the column whose
    paragraphs it read. Changed or new columns get `null`, so
    `scores: Array<number | null>`.
  - **Ribbon.** It draws only scored cells. An unscored cell's title says
    "tension not scored: this paragraph changed since the reading", and a
    scored one says "as read on an earlier version".
  - **Stale labels.** The lane gets a **stale** chip and an accurate note,
    also when no score can be drawn. The tension caption reads "Tension, as
    read on an earlier version (scores stand only on unchanged
    paragraphs)", and the headline carries a stale note.
  - **Module split.** `LightboxStaleLens` moved to its own contract module,
    `lightboxStale.ts`, still exported from the barrel, to keep
    `lightboxReadings.ts` under 500 lines.
  - **After the merge.** The keys are built in the split runner's
    `readingTools` and carried in `LightboxGroupTools`.
- **Tests.**
  - `LightboxStaleTension.test.ts`, through the real service:
    - unchanged paragraphs;
    - reordering (the 9 moves with its paragraph);
    - same-count replacement;
    - insertion;
    - deletion.
  - `LightboxStaleTension.test.tsx`:
    - scores only on unchanged paragraphs;
    - the headline, caption and lane labels;
    - the accurate note when an old lane cannot be drawn.

#### Merge, contracts and evidence

- **Merge** (`567506a`). `epic/lightbox` at `c6d4411` (PR #149's merge,
  including `56cb431` and `06fef0e`), as one merge commit. This adapted
  Slice 3 to the 2B changes:
  - 2B's split runner, with F-06's column keys re-applied in the new
    module;
  - `LightboxApp` keeps 2B's wrapped `MODEL_DATA` route beside
    `LIGHTBOX_HAND_OFF_RESULT` and `buildLens`, and `useLightbox` keeps its
    options and confirmed model beside the handoff state;
  - Slice 3's stale-readings app test now confirms the model first;
  - 2B's new model-selection test mocks the gravity stylesheet;
  - the evidence builder's press names its model.
- **Contract changes.**
  - `handOffToWorkshop` (and `LightboxWorkshopHandoffPort`) returns
    `Promise<LightboxWorkshopHandoffOutcome>`, with the new
    `LightboxWorkshopHandoffRefusal`.
  - `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD` carries `deliveryId`.
  - `WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER` is new; it goes from the
    webview to the provider only.
  - `answerLexicalGravityBuildSeed` replaces
    `consumeLexicalGravityBuildSeed`.
  - `isAnyOverlayOpen()` is new.
  - The collision tile has `witness`.
  - The tension tile has `scores` with nulls and `columnKeys`.
  - `LightboxTileGates` is a new module, and `proseSentenceSpans` is
    exported.
  - New modules stay under 500 lines and are listed in `boundaries.test.ts`.
- **Visual evidence** (`cfcbabc`). Rebuilt states and all 21 shots at the
  merged head:
  - the collision's witness sentence;
  - the "Opened" answer;
  - the stale headline, tension caption, lane chip and the unscored ¶15;
  - the Workshop build sheet with no lens, and Preview and Install
    disabled.

  The harness now confirms the stub model for the widget picker too. See
  the [evidence README](evidence/lightbox-slice-3-visual/README.md).
- **Tech debt** (`1ffd725`). The two nonblocking accounting notes from
  PR #149's third re-review are recorded as one Low item.
- **Not changed.** `WorkshopLexicalGravityModal.tsx` was already over 500
  lines and grows by 12. It is the existing Workshop god-file debt, not a
  new module.

#### Verification

Reviewed head `4150c8c` compared with this fix head, which merges
`epic/lightbox` at `c6d4411`:

| Check | Before | After |
|---|---|---|
| Jest | 357 suites, 5,175 tests, 2 snapshots | 367 suites, 5,237 tests, 2 snapshots |
| Lint | 0 errors, 1,135 warnings | 0 errors, 1,135 warnings, identical per file and rule to `c6d4411` |
| `npm run typecheck` | Passes | Passes |
| `npm run build` | Passes | Passes |
| `git diff --check` | Passes | Passes |

No live or billable call was made. Every test, and the evidence, plays the
provider. Fixtures are public-domain prose from "Alice's Adventures in
Wonderland" (1865), or short synthetic sentences written for the tests.

### Author response to re-review (2026-10-20)

The F-03 residual and F-07 are fixed on `epic/lightbox-slice-3-gravity`, one
commit each, at `4e70193` and `ceb5d6e`. The evidence follows the new
protocol at `c40e69d`. Statuses in the ledger are left for re-verification.

I ran every new test against `524a961`'s `packages/core/src` and
`apps/vscode-extension/src` trees, using this branch's tests and ts-jest
with type diagnostics off, so failures are behavioral.

- **Fails there:**
  - all six integrated provider → handler → receiver tests, including the
    four you asked for;
  - all three Model Browser overlay tests;
  - the header Model Browser seed test;
  - the new receiver tests.
- **Passes there, as intended:** the retained unsent-queue, hide/reveal,
  close/reopen and disposal provider tests, which you asked to keep green.
- **Cannot run there:** the new `WorkshopSeedDelivery` unit tests. The
  module does not exist at `524a961`; with it present they pass, since the
  old provider never calls it.

#### F-03 residual — a seed already sent could still open

- **Root cause.** The provider's settlement (timeout, replacement, closing)
  forgot only its own pending record. The receiver opened a seed when it
  arrived, with no check that the delivery was still wanted. So a seed
  message already in flight opened after its handoff had settled.
  Discarding its late answer could not undo that.
- **Fix** (`4e70193`). The receiver claims before it opens. This is the
  protocol you proposed.
  1. **Hold and claim.** On arrival, the webview holds the seed and posts
     `WORKSHOP_SEED_CLAIM { kind, deliveryId }`. Nothing opens yet.
  2. **Grant or deny.** The provider answers with
     `WORKSHOP_SEED_CLAIM_RESULT`. It grants the claim only while that
     delivery is the one it is still waiting on for that panel, and the
     message was sent. Otherwise it denies it as `timeout`, `replaced`,
     `closed` or `unknown`; the provider remembers the last 16 settled
     ids, so it can say why. A grant stops the deadline.
  3. **Open or drop.** The webview opens only on a grant. It then answers
     `WORKSHOP_SEED_ANSWER { kind, deliveryId, opened, reason? }`: opened,
     or `busy` if a sheet the writer is using appeared in between. A
     denied seed is dropped without a message and without touching any
     open sheet.
  4. **Claims and answers stay with the provider.** It intercepts both;
     they never reach a domain handler. Late messages from an older panel
     are still ignored.

  So a seed that timed out, was replaced or lost its panel never opens,
  even when its message was already on its way.

  One extension you had not specified: **a grant cannot be revoked.**
  Once the grant is posted, the webview will act on it. So a newer seed
  does not replace a granted one. It waits until the webview answers or
  the panel closes, and keeps its own deadline while it waits. Without
  that, a grant in flight could open the older seed over the newer one,
  which is the original FIFO bug one message later.

  I found no simpler mechanism with the same guarantee. Any check that
  happens only on the provider side runs before the in-flight message
  arrives.
- **Built for a second kind.**
  - `WorkshopSeedKind` is a closed union of seed kinds. Today it has
    `'lexical-gravity-build'`.
  - `WorkshopSeedDelivery<TRecipient>` is core and host-agnostic: offer,
    deliver, claim, answer, close. `WorkshopPanelProvider` keeps one per
    kind in a `Record<WorkshopSeedKind, …>` and routes claims and answers
    to it by `kind`.
  - On the webview side, `useWorkshopSeedClaim<TSeed>(kind)` holds, claims
    and answers. `useLexicalGravity` composes it.
  - Slice 4 adds a kind, composes the hook, and fans the claim-result
    route out by kind.
- **Tests.**
  - `WorkshopSeedDelivery.integration.test.tsx` uses the real
    `WorkshopPanelProvider`. The panel's MessageHandler is a routing shim
    that hands the seed's route to the real `WorkshopLexicalGravityHandler`.
    The production `WorkshopApp` is the receiver. Every host-to-webview
    `postMessage` is held and released in order. It covers:
    - a post-dispatch timeout: the claim is denied and nothing opens;
    - a post-dispatch replacement: A arrives first and does not open, and
      B opens;
    - delayed FIFO delivery of A then B: B opens with B's subject, and A
      is never answered;
    - a closed panel: its late claim gets no grant, and a reopened
      Workshop receives nothing;
    - a grant that crosses the panel's closing: the outcome stays
      `closed`;
    - the in-time case.
  - `WorkshopSeedDelivery.test.ts` covers each state, the grant as commit
    point, timeout of a seed queued behind a grant, closing, and wrong
    panel or delivery.
  - `WorkshopPanelProviderBuildSeed.test.ts` keeps the unsent-queue,
    hide/reveal, close/reopen, old-panel and disposal cases, now on the
    claim protocol. It adds post-dispatch replacement and timeout.
  - The receiver tests cover holding, granting, denying and supersession.
- **Contract changes (for Slice 4).**
  - New contracts module `shared/types/messages/workshop/seedDelivery.ts`
    with these types:
    - `WorkshopSeedKind`
    - `WorkshopSeedRefusal` (`busy`)
    - `WorkshopSeedClaimDenial`
    - `WorkshopSeedFailure`
    - `WorkshopSeedOutcome`
    - `WorkshopSeedAnswer`
    - claim, claim-result and answer payloads and messages
  - New `MessageType` values: `WORKSHOP_SEED_CLAIM`,
    `WORKSHOP_SEED_CLAIM_RESULT` and `WORKSHOP_SEED_ANSWER`.
  - Removed: `WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER` and its types.
  - The Lightbox's `LightboxWorkshopHandoffOutcome` and refusal types are
    now the generic seed outcome and failure.
  - `seedLexicalGravityBuild` returns `Promise<WorkshopSeedOutcome>`.
  - Core exports `WorkshopSeedDelivery`, `WorkshopSeedDeliveryPorts`,
    `WorkshopSeedDeliveryOptions` and `WORKSHOP_SEED_TIMEOUT_MS` (20 s).
    The provider's own timeout export is gone.
  - Webview: `useLexicalGravity` gains `handleSeedClaimResult`, and
    `answerLexicalGravityBuildSeed` takes a `WorkshopSeedAnswer`, keyed by
    `deliveryId`.
  - The contracts module is in the boundary and ownership lists, and in
    the architecture docs' Workshop contract trees. Its kind union is an
    approved closed-registry seam.

#### F-07 — The Model Browser was outside the overlay stack

- **Root cause.** `ModelBrowserModal` had its own window Escape listener
  and never registered with `useOverlayDismiss`.
  - `isAnyOverlayOpen()` could not see the header browser, so a seed
    opened over it.
  - Both listeners fired on one Escape, so both surfaces closed.
- **Fix** (`ceb5d6e`).
  - **Registration.** `ModelBrowserModal` uses `useOverlayDismiss`, the
    same mechanism as every other shell. While it is open:
    - it registers, so a seed's claim is granted and then answered `busy`;
    - it receives Escape only when it is on top;
    - its close button takes focus.
  - **Focus return.** `useOverlayDismiss` now also gives focus back for an
    overlay opened over another one (the widget sheet's nested browser).
    It returns focus to that overlay's opener, and only if focus fell out
    of the page when it closed. The last overlay still restores the page's
    original focus, and an overlay opening in the same commit keeps its
    own focus.
  - **Unchanged.**
    - Model selection still goes through `onSelect` to the model settings,
      by scope.
    - The widget sheets' `modelBrowserOpen` guard stays as a second
      safeguard.
- **Tests.**
  - `ModelBrowserOverlay.test.tsx`, the header path:
    - registration;
    - focus on open;
    - one Escape;
    - focus back to the trigger;
    - a choice routed to `assistant`.
  - `ModelBrowserOverlay.test.tsx`, the nested path, inside a
    `WorkshopModalShell`:
    - the first Escape closes only the browser and focus returns to its
      trigger in the sheet;
    - a choice routed to `widget`;
    - the next Escape closes the sheet.
  - `ModelBrowserOverlay.test.tsx` also checks that unmounting while open
    cleans the stack.
  - In the production Workshop app (`WorkshopApp.buildSeedOverlays`):
    - **Header browser:** with a search typed in, a seed is refused as
      `busy`. The browser stays the only dialog. One Escape closes only
      the browser, focus returns to the header trigger, and a choice posts
      `SET_MODEL_SELECTION` for `assistant`.
    - **Nested browser:** the Lexical Gravity sheet's browser closes
      before its sheet, returns focus to its trigger, and routes a choice
      to `widget`. This is a verification test: the old guard already held
      this path.

#### Evidence and verification

- **Evidence** (`c40e69d`). The builder no longer synthesizes
  `{ opened: true }`. It offers the seed through the real
  `WorkshopSeedDelivery`, then plays the webview's claim and answer. The
  grant is recorded after the seed in `states/workshop.json`, so the
  harness replays both.
  - In the rendered Workshop, the real page posts `workshop_seed_claim`,
    opens the sheet only on the grant, and posts `workshop_seed_answer`.
  - Rebuilt against the re-review bundle (SHA-256 `b5e5a1fb…5f9b`), every
    shot is within anti-aliasing of the committed one: at most 69 pixels,
    by 1/255. So no PNG changed.
  - This does not replace the delayed-transport test above. That test is
    the direct witness for F-03.
- **Verification.** Re-reviewed head `524a961` compared with this fix head:

| Check | Before | After |
|---|---|---|
| Jest | 367 suites, 5,237 tests, 2 snapshots | 370 suites, 5,257 tests, 2 snapshots |
| Lint | 0 errors, 1,135 warnings | 0 errors, 1,133 warnings |
| `npm run typecheck` | Passes | Passes |
| `npm run build` | Passes | Passes |
| `git diff --check` | Passes | Passes |

Lint per file and rule is identical except for `ModelBrowserModal.tsx`. It
has two fewer `curly` warnings, because the removed Escape listener's two
unbraced `if`s are gone. No file or rule gained a warning.

No live or billable call was made. The fixtures are public-domain prose
from "Alice's Adventures in Wonderland" (1865) or short synthetic strings,
and models are stub ids.
